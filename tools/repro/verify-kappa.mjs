// C4 / C5：批次 A 与批次 B 的人类间一致率。
//
// 论文位置：中文 v0.8 §4.13；英文 v0.2 §A.3。
// 期望输出：
//   批次 A · loop    n=8  观察一致 75.0%  机会一致 75.0%  κ=0
//   批次 B · loop    n=16 观察一致 100.0% 机会一致 88.3%  κ=1.000
//
// 用法：
//   node verify-kappa.mjs [--labels <标注目录>] [--expect] [--out <输出JSON>]
//   --expect  按内置期望值断言，任何一项不符即非零退出
//
// 输入：
//   inputs/labels/run1v3-A-human1-answers.json
//   inputs/labels/run1v3-A-human2-answers.json
//   inputs/labels/run1v3-B-human1-answers.json   ← 批次 B 为对话记录重建件
//   inputs/labels/run1v3-B-human2-answers.json
//
// 批次 B 的标签来源说明：两名标注者导出的原始提交在分析后未保留，
// 现用标签按对话记录重建，字段完整但不等同原始提交。论文已披露这条限制。
//
// 迁移前的旧脚本还含「交替判据 v1.1 vs v1.2」一节，
// 需要 labels/run1-full.json（含响应原文，未公开），故未并入本目录。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const LAB = arg("labels", join(HERE, "inputs", "labels"));
const OUT = arg("out", join(HERE, "outputs", "verify-kappa.json"));
const CHECK = process.argv.includes("--expect");

const EXPECT = {
  "A:loop": { n: 8, po: 0.750, pe: 0.750, kappa: 0 },
  "B:loop": { n: 16, po: 1.0, pe: 0.883, kappa: 1.0 },
};

const RD = (p) => {
  if (!existsSync(p)) {
    console.error(`缺少输入：${p}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
};

/** Cohen's κ。 */
function kappa(pairs) {
  const n = pairs.length;
  let agree = 0;
  const c1 = {};
  const c2 = {};
  for (const [a, b] of pairs) {
    if (a === b) agree += 1;
    c1[a] = (c1[a] ?? 0) + 1;
    c2[b] = (c2[b] ?? 0) + 1;
  }
  const po = agree / n;
  let pe = 0;
  for (const v of new Set([...Object.keys(c1), ...Object.keys(c2)])) {
    pe += ((c1[v] ?? 0) / n) * ((c2[v] ?? 0) / n);
  }
  return { n, po, pe, kappa: pe === 1 ? NaN : (po - pe) / (1 - pe) };
}

const A1 = RD(join(LAB, "run1v3-A-human1-answers.json"));
const A2 = RD(join(LAB, "run1v3-A-human2-answers.json"));
const B1 = RD(join(LAB, "run1v3-B-human1-answers.json"));
const B2 = RD(join(LAB, "run1v3-B-human2-answers.json"));
const mk = (arr) => new Map(arr.map((a) => [a.blindId, a]));

const results = [];
function run(label, m1, m2, keys) {
  const ids = [...m1.keys()].sort();
  for (const key of keys) {
    const r = kappa(ids.map((id) => [m1.get(id)[key], m2.get(id)[key]]));
    results.push({ set: label, dim: key, ...r });
    console.log(
      `批次 ${label} · ${key}：n=${r.n}｜观察一致 ${(r.po * 100).toFixed(1)}%｜` +
        `机会一致 ${(r.pe * 100).toFixed(1)}%｜κ=${Number.isNaN(r.kappa) ? "未定义" : r.kappa.toFixed(3)}`,
    );
  }
}

console.log(`# Cohen's κ（标注目录 ${LAB}）\n`);
run("A", mk(A1), mk(A2), ["loop", "repeat", "resume"]);
console.log();
run("B", mk(B1), mk(B2), ["loop", "repeat"]);

// 批次 B 的共同阳性/共同阴性计数
// 注意：标注里 loop 的取值是字符串 "yes"/"no"，不能直接用布尔判断。
const mB1 = mk(B1);
const mB2 = mk(B2);
let pos = 0;
let neg = 0;
for (const id of [...mB1.keys()].sort()) {
  const a = mB1.get(id).loop;
  const b = mB2.get(id).loop;
  if (a !== b) continue;
  if (a === "yes") pos += 1;
  else if (a === "no") neg += 1;
}
console.log(`\n批次 B · loop 共同阳性 ${pos} 条、共同阴性 ${neg} 条`);

const payload = {
  inputs: {
    labels: LAB,
    batch_B_source: "按对话记录重建（原始提交未保留）",
  },
  expectation: EXPECT,
  results: results.map((r) => ({
    set: r.set,
    dim: r.dim,
    n: r.n,
    po: Number.isFinite(r.po) ? Number(r.po.toFixed(4)) : null,
    pe: Number.isFinite(r.pe) ? Number(r.pe.toFixed(4)) : null,
    kappa: Number.isFinite(r.kappa) ? Number(r.kappa.toFixed(4)) : null,
  })),
  batch_b_common: { positive: pos, negative: neg },
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
console.log(`\n写入 ${OUT}`);

if (CHECK) {
  let bad = 0;
  for (const [k, want] of Object.entries(EXPECT)) {
    const [set, dim] = k.split(":");
    const got = results.find((r) => r.set === set && r.dim === dim);
    if (!got) {
      console.error(`断言失败：${k} 没有结果`);
      bad += 1;
      continue;
    }
    const okPo = Math.abs(got.po - want.po) < 5e-4;
    const okPe = Math.abs(got.pe - want.pe) < 5e-4;
    const okK = Math.abs(got.kappa - want.kappa) < 5e-4;
    if (!(okPo && okPe && okK && got.n === want.n)) {
      console.error(
        `断言失败：${k} 期望 n=${want.n} po=${want.po} pe=${want.pe} κ=${want.kappa}，` +
          `实际 n=${got.n} po=${got.po} pe=${got.pe} κ=${got.kappa}`,
      );
      bad += 1;
    } else {
      console.log(`断言通过：${k}`);
    }
  }
  if (bad > 0) {
    console.error(`\n${bad} 项断言未通过`);
    process.exit(1);
  }
  console.log("\n全部断言通过");
}
