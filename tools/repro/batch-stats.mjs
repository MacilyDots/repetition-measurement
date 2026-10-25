// C7（比值部分）：块级稳健性——块间 sd 与独立二项预期的比值。
//
// 论文位置：中文 v0.8 §3.5；英文 v0.2 §3.3。
// p 值部分见同目录 batch-dispersion-test.mjs。
//
// 用法：
//   node batch-stats.mjs                     # 跑全部九个条件（块大小随条件冻结）
//   node batch-stats.mjs <log文件> [块大小]   # 单条件
//
// 期望比值：0.95 / 0.98 / 1.20 / 1.12 / 1.20 / 0.74 / 0.72 / 0.90 / 1.01
// 块大小必须随条件冻结：exp2 与 baseline 用 10，其余用 20。
// 换块大小会改变比值（exp2 用 20 得 0.72，用它原定的 10 得 0.90）。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(HERE, "inputs", "logs");

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

const EXPECT_RATIO = [0.95, 0.98, 1.2, 1.12, 1.2, 0.74, 0.72, 0.9, 1.01];

const LINE = /(?:attempt|round) (\d+)(?: \[inject=([^\]]+)\])?: .*? 退化=(是|否)/;

const singleFile = process.argv[2];
const singleBlock = Number(process.argv[3] ?? 20);

function wilson(k, n) {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** 块级 bootstrap。注：用 Math.random，不作复算依据，只作参考区间。 */
function blockBootstrap(blocks, iterations = 5000) {
  const rates = [];
  for (let i = 0; i < iterations; i += 1) {
    let n = 0;
    let d = 0;
    for (let b = 0; b < blocks.length; b += 1) {
      const pick = blocks[Math.floor(Math.random() * blocks.length)];
      n += pick.n;
      d += pick.degen;
    }
    if (n > 0) rates.push(d / n);
  }
  rates.sort((a, b) => a - b);
  const at = (q) => rates[Math.min(rates.length - 1, Math.max(0, Math.floor(q * rates.length)))];
  return [at(0.025), at(0.975)];
}

function parse(filePath, inject) {
  const rows = [];
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m === null) continue;
    const tag = m[2] ?? "";
    if (inject === null) {
      if (tag !== "") continue;
    } else if (tag !== inject) {
      continue;
    }
    rows.push(m[3] === "是");
  }
  return rows;
}

/** 对一组布尔序列算比值。切块口径与原始分析一致：按记录顺序切，不按轮次号。 */
function analyse(label, rows, blockSize, file) {
  const n = rows.length;
  const degen = rows.filter(Boolean).length;
  const [lo, hi] = wilson(degen, n);
  const blocks = [];
  for (let i = 0; i < n; i += blockSize) {
    const part = rows.slice(i, i + blockSize);
    blocks.push({ n: part.length, degen: part.filter(Boolean).length });
  }
  const rates = blocks.map((b) => b.degen / b.n);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rates.length - 1);
  const sd = Math.sqrt(variance);
  const p = degen / n;
  const expectedSd = Math.sqrt((p * (1 - p)) / blockSize);
  const [blo, bhi] = blockBootstrap(blocks);

  console.log(`条件 ${label}（${file}，块大小 ${blockSize}）`);
  console.log(`  逐请求：${degen}/${n} = ${(p * 100).toFixed(1)}%，Wilson 95% CI ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}%`);
  console.log(`  分 ${blocks.length} 块；块间 sd ${(sd * 100).toFixed(1)} 个百分点，独立预期 ${(expectedSd * 100).toFixed(1)}`);
  console.log(`  → 比值 ${(sd / Math.max(1e-9, expectedSd)).toFixed(2)}`);
  console.log(`  块级 bootstrap 95% CI ${(blo * 100).toFixed(1)}–${(bhi * 100).toFixed(1)}%\n`);
  return sd / Math.max(1e-9, expectedSd);
}

if (singleFile !== undefined) {
  // 单文件模式：把文件内所有 inject 标签各算一次（无标签时记为 all）
  const groups = new Map();
  for (const line of readFileSync(singleFile, "utf8").split(/\r?\n/)) {
    const m = line.match(LINE);
    if (!m) continue;
    const key = m[2] ?? "all";
    const list = groups.get(key) ?? [];
    list.push(m[3] === "是");
    groups.set(key, list);
  }
  for (const [k, v] of groups) analyse(k, v, singleBlock, singleFile.split(/[\\/]/).pop());
} else {
  let idx = 0;
  let bad = 0;
  for (const c of CONDITIONS) {
    const filePath = join(LOG_DIR, c.file);
    if (!existsSync(filePath)) {
      console.error(`缺少日志：${filePath}`);
      bad += 1;
      idx += 1;
      continue;
    }
    const rows = parse(filePath, c.inject);
    if (rows.length === 0) {
      console.error(`条件 ${c.batch} ${c.label} 解析到 0 条`);
      bad += 1;
      idx += 1;
      continue;
    }
    const ratio = analyse(`${c.batch} ${c.label}`, rows, c.blockSize, c.file);
    const want = EXPECT_RATIO[idx];
    if (Math.abs(Number(ratio.toFixed(2)) - want) > 0.005) {
      console.error(`  !! 期望 ${want}，实际 ${ratio.toFixed(2)}`);
      bad += 1;
    }
    idx += 1;
  }
  if (bad > 0) {
    console.error(`\n${bad} 项与期望不符`);
    process.exit(1);
  }
  console.log("九个条件全部与期望比值一致");
}
