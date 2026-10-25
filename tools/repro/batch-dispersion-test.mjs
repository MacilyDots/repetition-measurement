// 单侧过度离散检验：给 batch-stats.mjs 的比值补上可复现的 p 值。
//
// 背景：batch-stats.mjs 只算「块间 sd / 独立预期 sd」这个比值，不给显著性。
// 论文 v0.8 §3.5 写了「固定种子单侧块级检查 p 约 0.26–0.97」，
// 必须有对应实现，否则这个区间没有产出脚本。
//
// 方法：
//   H0  同一条件内每次请求独立，退化数 ~ Binomial(n_b, p_hat)
//   统计量 Pearson X² = Σ_b (O_b − n_b·p_hat)² / (n_b·p_hat·(1−p_hat))
//   零分布 参数化蒙特卡洛：固定 p_hat 与各块 n_b，重复 ITER 次重抽，
//          单侧 p = P(X²_sim ≥ X²_obs)
//   随机数 固定种子的 mulberry32，流式复用，保证同样输入同样输出
//
// 用法：
//   node batch-dispersion-test.mjs [日志目录] [输出JSON]
//   默认日志目录 inputs/logs，默认输出 outputs/batch-dispersion.json
//
// 块大小随条件冻结（与实验记录 §〇 第 2 条表一致），不接受全局覆盖。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// 日志默认从本目录的 inputs/logs 读；可用第一个参数覆盖
const LOG_DIR = process.argv[2] ?? join(HERE, "inputs", "logs");
// 产物落到本目录 outputs/，不写进临时区
const OUT = process.argv[3] ?? join(HERE, "outputs", "batch-dispersion.json");

const SEED = 20261017;
const ITER = 50000;

// 九个条件：文件、inject 标签（null 表示无标签单一组）、块大小
// 块大小来自实验记录 §〇 第 2 条的原始口径，不能统一成 20。
const CONDITIONS = [
  { batch: "exp19", label: "75:repeat", file: "exp19-repeat-vs-unique.log", inject: "75:repeat", blockSize: 20 },
  { batch: "exp19", label: "75:unique", file: "exp19-repeat-vs-unique.log", inject: "75:unique", blockSize: 20 },
  { batch: "exp18", label: "50", file: "exp18-interleave.log", inject: "50", blockSize: 20 },
  { batch: "exp18", label: "75", file: "exp18-interleave.log", inject: "75", blockSize: 20 },
  { batch: "exp20", label: "density:4", file: "exp20-density.log", inject: "4:density", blockSize: 20 },
  { batch: "exp20", label: "density:2", file: "exp20-density.log", inject: "2:density", blockSize: 20 },
  { batch: "exp20", label: "density:0", file: "exp20-density.log", inject: "0:density", blockSize: 20 },
  { batch: "exp2", label: "high", file: "exp2-effort-high.log", inject: null, blockSize: 10 },
  { batch: "baseline", label: "tail20", file: "replay-tail20-n100.txt", inject: null, blockSize: 10 },
];

const LINE = /(?:attempt|round) (\d+)(?: \[inject=([^\]]+)\])?: .*? 退化=(是|否)/;

/** 固定种子、可复现的均匀随机数。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parse(filePath, inject) {
  const body = readFileSync(filePath, "utf8");
  const rows = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m === null) continue;
    const tag = m[2] ?? "";
    if (inject === null) {
      if (tag !== "") continue; // 单一组只取无标签行
    } else if (tag !== inject) {
      continue;
    }
    rows.push(m[3] === "是");
  }
  return { rows, sha256: createHash("sha256").update(body).digest("hex") };
}

/** 按记录顺序切块，与 batch-stats.mjs 保持一致（不按轮次号切，避免空块）。 */
function toBlocks(rows, blockSize) {
  const blocks = [];
  for (let i = 0; i < rows.length; i += blockSize) {
    const part = rows.slice(i, i + blockSize);
    blocks.push({ n: part.length, k: part.filter(Boolean).length });
  }
  return blocks;
}

function pearson(blocks, pHat) {
  let x2 = 0;
  for (const b of blocks) {
    const e = b.n * pHat;
    const v = b.n * pHat * (1 - pHat);
    if (v <= 0) continue;
    x2 += ((b.k - e) ** 2) / v;
  }
  return x2;
}

/** 同一条件内按块重抽，得到 X² 的零分布。 */
function nullX2(blocks, pHat, iterations, rand) {
  const out = new Float64Array(iterations);
  for (let it = 0; it < iterations; it += 1) {
    let x2 = 0;
    for (const b of blocks) {
      let k = 0;
      for (let j = 0; j < b.n; j += 1) {
        if (rand() < pHat) k += 1;
      }
      const e = b.n * pHat;
      const v = b.n * pHat * (1 - pHat);
      if (v <= 0) continue;
      x2 += ((k - e) ** 2) / v;
    }
    out[it] = x2;
  }
  return out;
}

const rand = mulberry32(SEED);
const results = [];

console.log(`日志目录 ${LOG_DIR}`);
console.log(`种子 ${SEED}，每条件 ${ITER} 次重抽\n`);
console.log("条件".padEnd(12), "块数".padStart(4), "k/n".padStart(9), "块大小".padStart(6), "比值".padStart(6), "X²".padStart(8), "p".padStart(7));

for (const c of CONDITIONS) {
  const filePath = join(LOG_DIR, c.file);
  if (!existsSync(filePath)) {
    console.error(`缺少文件 ${filePath}`);
    process.exitCode = 1;
    continue;
  }
  const { rows, sha256 } = parse(filePath, c.inject);
  if (rows.length === 0) {
    console.error(`条件 ${c.batch} ${c.label} 解析到 0 条`);
    process.exitCode = 1;
    continue;
  }
  const blocks = toBlocks(rows, c.blockSize);
  const k = rows.filter(Boolean).length;
  const n = rows.length;
  const pHat = k / n;

  // 与 batch-stats.mjs 完全相同的比值定义
  const rates = blocks.map((b) => b.k / b.n);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rates.length - 1);
  const sd = Math.sqrt(variance);
  const expectedSd = Math.sqrt((pHat * (1 - pHat)) / c.blockSize);
  const ratio = sd / Math.max(1e-9, expectedSd);

  const x2Obs = pearson(blocks, pHat);
  const nulls = nullX2(blocks, pHat, ITER, rand);
  let ge = 0;
  for (let i = 0; i < nulls.length; i += 1) if (nulls[i] >= x2Obs) ge += 1;
  const p = ge / ITER;

  console.log(
    `${c.batch} ${c.label}`.padEnd(12),
    String(blocks.length).padStart(4),
    `${k}/${n}`.padStart(9),
    String(c.blockSize).padStart(6),
    ratio.toFixed(2).padStart(6),
    x2Obs.toFixed(2).padStart(8),
    p.toFixed(3).padStart(7),
  );

  results.push({
    batch: c.batch,
    condition: c.label,
    file: c.file,
    file_sha256: sha256,
    block_size: c.blockSize,
    blocks: blocks.length,
    block_k: blocks.map((b) => b.k),
    block_n: blocks.map((b) => b.n),
    k,
    n,
    p_hat: Number(pHat.toFixed(6)),
    ratio_sd_over_expected: Number(ratio.toFixed(4)),
    pearson_x2: Number(x2Obs.toFixed(4)),
    p_one_sided: Number(p.toFixed(4)),
  });
}

const ratios = results.map((r) => r.ratio_sd_over_expected);
const ps = results.map((r) => r.p_one_sided);
const payload = {
  method: "one-sided parametric block-level Monte Carlo overdispersion test",
  statistic: "Pearson X^2 = sum_b (O_b - n_b*p)^2 / (n_b*p*(1-p))",
  seed: SEED,
  iterations: ITER,
  note: "块大小按各条件原始口径冻结，不可统一；p_hat 固定为各条件总体比例",
  summary: {
    ratio_min: Math.min(...ratios),
    ratio_max: Math.max(...ratios),
    p_min: Math.min(...ps),
    p_max: Math.max(...ps),
    n_conditions: results.length,
  },
  conditions: results,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
console.log(`\n比值范围 ${payload.summary.ratio_min}–${payload.summary.ratio_max}`);
console.log(`p 范围 ${payload.summary.p_min}–${payload.summary.p_max}`);
console.log(`\n写入 ${OUT}`);