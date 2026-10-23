// 机械重复计数 v1.2：三指标独立报告。
//
// 与 spec-check.mjs 使用同一份实现（v1.2 交替判据）：
//   ① 至少 2 个完整周期才算交替；
//   ② 不从某个 exact run 的中间起算。
// 旧版 v1.1 内置 ≥5 轮门槛，与 spec-check.mjs 不一致，已于 2026-10-20 统一到 v1.2。
//
// 数据路径：默认取本脚本所在目录的上一级（论文目录），可用 PAPER_DATA_ROOT 覆盖。
// 不写死任何盘符或用户名，便于归档后迁移。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PAPER_DATA_ROOT ?? join(HERE, "..");
const LABELS = join(ROOT, "labels");
const REBUILT = join(LABELS, "batch-B-reconstructed");

// ── 实现（与 spec-check.mjs 同一份逻辑）─────────────────────────────
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

function measure(text) {
  const sents = sentences(text);
  const ex = maxRun(sents.map(normExact).filter((s) => s !== ""));
  const tp = maxRun(sents.map(normTemplate).filter((s) => s !== ""));
  const alt = maxAlternating(sents.map(normExact).filter((s) => s !== ""));
  return { ex: ex.len, tp: tp.len, alt };
}

// ── 数据加载 ─────────────────────────────────────────────────────────
// 完整版（本地）含 text 原文，可重算指标；
// 公开版（run1-full.public.json）只有条目元数据与 text 的 SHA-256，无法重算指标。
const FULL = join(LABELS, "run1-full.json");
const PUB = join(LABELS, "run1-full.public.json");
const hasFullText = existsSync(FULL);
const dataPath = hasFullText ? FULL : PUB;
if (!existsSync(dataPath)) {
  console.error(`缺少数据文件：${FULL} 与 ${PUB} 都不存在。可用 PAPER_DATA_ROOT 指定数据根目录。`);
  process.exit(1);
}
const full = JSON.parse(readFileSync(dataPath, "utf8"));
const items = new Map(full.items.map((i) => [i.blindId, i]));

const H1 = JSON.parse(readFileSync(join(REBUILT, "run1v3-B-human1-answers.json"), "utf8"));
const H2 = JSON.parse(readFileSync(join(REBUILT, "run1v3-B-human2-answers.json"), "utf8"));
const m1 = new Map(H1.map((a) => [a.blindId, a]));
const m2 = new Map(H2.map((a) => [a.blindId, a]));

const ids = [...items.keys()]
  .filter((k) => k.startsWith("R") && Number(k.slice(1)) >= 9)
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

// ── 输出 ─────────────────────────────────────────────────────────────
if (hasFullText) {
  console.log(`# 机械重复计数 v1.2：三指标独立报告\n`);
  console.log(`| 条目 | exact_run | template_run | alternating_run | H1 | H2 |`);
  console.log(`| --- | --- | --- | --- | --- | --- |`);
  for (const id of ids) {
    const { ex, tp, alt } = measure(items.get(id).text);
    const altStr = alt === null ? "无" : `p=${alt.period}×${alt.cycles}`;
    const h1 = m1.get(id)?.repeat ?? "—";
    const h2 = m2.get(id)?.repeat ?? "—";
    console.log(`| ${id} | ${ex} | ${tp} | ${altStr} | ${h1} | ${h2} |`);
  }
} else {
  // 公开模式：没有 text 原文，只列元数据与哈希，并明确说明指标不可重算。
  console.log(`# 机械重复计数 v1.2：公开版数据（无 text 原文）\n`);
  console.log(
    `> 本仓库未包含原始响应文本（含项目内容）。下表给出条目元数据与 text 的 SHA-256，` +
      `可与 \`verify-v12-out.txt\` 中的指标输出逐条对照；**无法据此重算 exact_run / template_run / alternating_run**。\n`,
  );
  console.log(`| 条目 | chars | isDegen | toolN | stop | textLength | textSha256（前 16） | H1 | H2 |`);
  console.log(`| --- | ---: | --- | ---: | --- | ---: | --- | --- | --- |`);
  for (const id of ids) {
    const it = items.get(id);
    const h1 = m1.get(id)?.repeat ?? "—";
    const h2 = m2.get(id)?.repeat ?? "—";
    console.log(
      `| ${id} | ${it.chars} | ${it.isDegen} | ${it.toolN} | ${it.stop} | ${it.textLength} | ${it.textSha256.slice(0, 16)} | ${h1} | ${h2} |`,
    );
  }
  console.log(`\n数据来源：\`run1-full.public.json\`，其 \`_sourceSha256\` = ${full._sourceSha256 ?? "（未记录）"}`);
}

console.log(`\n## 验证说明里的交替例子\n`);
const testCases = [
  { name: "说明中的正面例", text: "好。做。好。做。好。做。好。做。好。做。" },
  { name: "不足 5 轮", text: "好。做。好。做。好。做。" },
  { name: "周期 3", text: "做。执行。等待。做。执行。等待。做。执行。等待。做。执行。等待。做。执行。等待。" },
  { name: "退化情形（同句）", text: "做。做。做。做。做。做。" },
];
for (const tc of testCases) {
  const { ex, alt } = measure(tc.text);
  const altStr = alt === null ? "无" : `p=${alt.period}×${alt.cycles} 单元「${alt.unit}」`;
  console.log(`- ${tc.name}：exact_run=${ex}，alternating=${altStr}`);
}
