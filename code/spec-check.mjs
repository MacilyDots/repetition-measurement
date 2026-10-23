// 运行规范一致性检查：逐例对比「按规范写的预期」与「实现输出」。
// 不一致时只记录，不修改预期。
import { readFileSync } from "node:fs";
import { CASES } from "./spec-cases.mjs";

// ── 实现（与 verify-repeat-v3.mjs 同一份逻辑，抽出来复用）──
const normExact = (s) =>
  s
    .replace(/\s+/g, "")
    .replace(/[。．.！!？?，,、；;：:]+$/g, "")
    .trim();
const normTemplate = (s) => normExact(s).replace(/[0-9０-９]+/g, "#").replace(/[一二三四五六七八九十百千]+/g, "#");

function sentences(text) {
  const out = [];
  for (const line of text.split(/\n/)) {
    for (const p of line.split(/(?<=[。！？])/)) {
      const t = p.trim();
      if (t === "") continue;
      out.push(t);
    }
  }
  return out;
}

function maxRun(keys) {
  let best = keys.length ? 1 : 0;
  let run = 1;
  let idx = 0;
  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i] === keys[i - 1]) {
      run += 1;
      if (run > best) {
        best = run;
        idx = i;
      }
    } else run = 1;
  }
  return { len: best, idx };
}

function maxAlternating(keys) {
  // v1.2 修正：
  //   ① 至少 2 个完整周期才算「交替」，否则任意两个不同句子都会得到 p2×1；
  //   ② 不允许从某个 exact run 的中间起算，否则 `A A B A A B` 会从第 2 个 A 起
  //      取到 `[A,B,A]` 而误报 p3×3，绕过「单元内部不能有相邻相同项」的约束。
  let best = null;
  for (const p of [2, 3]) {
    for (let i = 0; i + p * 2 <= keys.length; i += 1) {
      if (i > 0 && keys[i] === keys[i - 1]) continue;
      const unit = keys.slice(i, i + p);
      let degenerate = false;
      for (let k = 1; k < p; k += 1) if (unit[k] === unit[k - 1]) degenerate = true;
      if (degenerate) continue;
      let cycles = 1;
      let j = i + p;
      while (j + p <= keys.length && keys.slice(j, j + p).every((v, k) => v === unit[k])) {
        cycles += 1;
        j += p;
      }
      if (cycles >= 2 && (best === null || cycles > best.cycles)) {
        best = { period: p, cycles, unit: unit.join(" / ") };
      }
    }
  }
  return best;
}

function run(text) {
  const sents = sentences(text);
  const ex = maxRun(sents.map(normExact).filter((s) => s !== ""));
  const tp = maxRun(sents.map(normTemplate).filter((s) => s !== ""));
  const alt = maxAlternating(sents.map(normExact).filter((s) => s !== ""));
  return {
    exact: ex.len,
    template: tp.len,
    alternating: alt === null ? null : { period: alt.period, cycles: alt.cycles },
  };
}

// ── 对比 ──
const fmt = (v) => (v === null ? "null" : v.period ? `p${v.period}×${v.cycles}` : String(v));
const match = (a, b) => {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (typeof a === "object" && typeof b === "object") return a.period === b.period && a.cycles === b.cycles;
  return a === b;
};

let pass = 0;
const fails = [];
const byGroup = {};

console.log(`# 规范一致性检查\n`);
console.log(`共 ${CASES.length} 例。预期按 v1.1 冻结规范独立写出，未参考运行结果。\n`);

for (const c of CASES) {
  const got = run(c.text);
  const okE = match(c.expected.exact, got.exact);
  const okT = match(c.expected.template, got.template);
  const okA = match(c.expected.alternating, got.alternating);
  const ok = okE && okT && okA;

  byGroup[c.group] = byGroup[c.group] ?? { total: 0, pass: 0 };
  byGroup[c.group].total += 1;
  if (ok) {
    pass += 1;
    byGroup[c.group].pass += 1;
  } else {
    fails.push({ c, got, okE, okT, okA });
  }

  const mark = ok ? "通过" : "**不一致**";
  console.log(`### ${c.id}（${c.group}）— ${mark}`);
  console.log("");
  console.log(`- 输入：\`${c.text.replace(/\n/g, "\\n").slice(0, 80)}\``);
  console.log(`- 规范预期：exact=${fmt(c.expected.exact)}, template=${fmt(c.expected.template)}, alternating=${fmt(c.expected.alternating)}`);
  console.log(`- 实现输出：exact=${fmt(got.exact)}, template=${fmt(got.template)}, alternating=${fmt(got.alternating)}`);
  if (!ok) {
    console.log(`- **差异**：${!okE ? "exact " : ""}${!okT ? "template " : ""}${!okA ? "alternating " : ""}`);
  }
  console.log(`- 理由：${c.reason}`);
  console.log("");
}

console.log(`## 汇总\n`);
console.log(`| 分组 | 通过 | 总数 |`);
console.log(`| --- | --- | --- |`);
for (const [g, v] of Object.entries(byGroup)) {
  console.log(`| ${g} | ${v.pass} | ${v.total} |`);
}
console.log(`| **合计** | **${pass}** | **${CASES.length}** |`);
console.log("");

if (fails.length > 0) {
  console.log(`## 不一致清单（${fails.length} 例）\n`);
  for (const f of fails) {
    console.log(`- **${f.c.id}**：预期 exact=${fmt(f.c.expected.exact)}/template=${fmt(f.c.expected.template)}/alt=${fmt(f.c.expected.alternating)}，实得 exact=${fmt(f.got.exact)}/template=${fmt(f.got.template)}/alt=${fmt(f.got.alternating)}`);
  }
  console.log("");
  console.log(`**处理原则**：不一致时先判断是实现偏离规范，还是规范本身有歧义；不得为了让测试通过而改预期。`);
}
