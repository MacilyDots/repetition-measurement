// C1：行级判据的结构性盲区。
//
// 从字符级 30-gram 扫描结果里取出「强度 ≥100」的强重复样本，
// 逐份重算行重复计数，用来支持「行级判据漏掉行内重复」这个工程判断。
// 论文位置：中文 v0.8 §4.11；英文 v0.2 §4.1。
// 期望输出：20 份样本，行重复计数中位数 1。
//
// 用法：
//   node verify-strong.mjs [--raw <原始SSE目录>] [--scan <扫描结果>] [--out <输出>]
//
// 输入说明：
//   inputs/ngram-full-scan.json     已有（扫描结果，含文件名与计数，不含原文）
//   <原始SSE目录>                    未随仓库发布（482 MB，含项目原文）；
//                                    需要完整复算时自备，目录内为 <file> 命名的 .sse 文件。
//   inputs/verify-strong-sanitized.json  已脱敏的当时结果，只有数值字段，可直接核对中位数。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INPUTS = join(HERE, "inputs");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const RAW = arg("raw", join(INPUTS, "replay-raw"));
const SCAN = arg("scan", join(INPUTS, "ngram-full-scan.json"));
const OUT = arg("out", join(HERE, "outputs", "verify-strong.json"));

/** 从 SSE 原文里抽出 reasoning 与 text 两段累积文本。 */
function parseRaw(raw) {
  const frames = raw.split(/\r?\n\r?\n/).filter((s) => s.trim() !== "");
  let reasoning = "";
  let text = "";
  for (const frame of frames) {
    for (const line of frame.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      let ev;
      try {
        ev = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (ev.type === "content_block_delta" && ev.delta) {
        if (ev.delta.type === "thinking_delta") reasoning += ev.delta.thinking ?? "";
        if (ev.delta.type === "text_delta") text += ev.delta.text ?? "";
      }
    }
  }
  return { reasoning, text };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

const scan = JSON.parse(readFileSync(SCAN, "utf8"));
const strong = (scan.hits ?? [])
  .filter((h) => h.gramCount >= 100)
  .sort((a, b) => b.gramCount - a.gramCount);

if (!existsSync(RAW)) {
  console.error(`找不到原始 SSE 目录：${RAW}`);
  console.error("该目录未随仓库发布（含项目原文）。改用已脱敏结果核对：");
  const san = join(INPUTS, "verify-strong-sanitized.json");
  if (!existsSync(san)) {
    console.error(`  连脱敏结果也不存在：${san}`);
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(san, "utf8"));
  const lines = rows.map((r) => r.lineCount);
  const med = median(lines);
  console.error(`  ${san}`);
  console.error(`  ${rows.length} 份，行重复计数中位数 ${med}（期望 20 份 / 1）`);
  if (rows.length === 20 && med === 1) {
    console.error("  → 与期望一致（仅核对脱敏结果，未重算原文）");
    process.exit(0);
  }
  console.error("  → 与期望不符");
  process.exit(1);
}

const out = [];
for (const h of strong) {
  const { reasoning, text } = parseRaw(readFileSync(join(RAW, h.file), "utf8"));
  const joined = reasoning + "\n" + text;
  const idx = joined.indexOf(h.gramSample);
  const around = idx >= 0 ? joined.slice(Math.max(0, idx - 120), idx + 260) : joined.slice(0, 380);
  out.push({
    file: h.file,
    chars: joined.length,
    gramCount: h.gramCount,
    lineCount: h.lineCount,
    reasoningChars: reasoning.length,
    textChars: text.length,
    // 下面三个字段含原文，仅用于本地人工核对，不要提交
    开头: joined.slice(0, 160).replace(/\n/g, "⏎"),
    重复处上下文: around.replace(/\n/g, "⏎"),
    结尾: joined.slice(-160).replace(/\n/g, "⏎"),
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

const lines = out.map((o) => o.lineCount);
console.log(`强重复样本 ${out.length} 份，行重复计数中位数 ${median(lines)}`);
for (const o of out) {
  console.log(`  ${o.file} | ${o.chars} 字 | 最高 30-gram ${o.gramCount} | 行重复 ${o.lineCount}`);
}
console.log(`\n写入 ${OUT}（含原文片段，不要提交）`);
console.log(`期望：20 份，中位数 1`);
