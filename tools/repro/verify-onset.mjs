// C6：批次 A 的起点位置差（三种分母口径）。
//
// 论文位置：中文 v0.8 §4.13；英文 v0.2 §A.3。
// [LEGACY] canonical 实现已改为 agreement.py（主字段 median_standard=230）。
// 本脚本保留原口徑，用于迁移对拍。
// 期望输出（上中位口径）：全部 8 对 中位 264；排除「有一方标 0」7 对 中位 196；
//          最严口径（只共享一种异常且排除 0）3 对 中位 290；三种口径下 ≤100 字的都是 0。
//
// 用法：
//   node verify-onset.mjs [--labels <标注目录>] [--expect] [--out <输出JSON>]
//   --expect  按内置期望值断言，任何一项不符即非零退出
//
// 输入：
//   inputs/labels/run1-A-human-answers.json  （人类标注，字段 conf）
//   inputs/labels/run1-A-answers.json        （对照标注，字段 confidence）
//
// 这两份是批次 A 的「一名人类 + 一份对照标注」，与 run1v3-A 的两名人类是不同批次。
// 起点位置差来自这一批；上中位 264，常规中位 230（见 agreement.py）。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const LAB = arg("labels", join(HERE, "inputs", "labels"));
const OUT = arg("out", join(HERE, "outputs", "verify-onset.json"));
const CHECK = process.argv.includes("--expect");

const EXPECT = {
  all: { n: 8, median: 264, le100: 0 },
  dropZero: { n: 7, median: 196, le100: 0 },
  strict: { n: 3, median: 290, le100: 0 },
};

const RD = (p) => {
  if (!existsSync(p)) {
    console.error(`缺少输入：${p}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, "utf8"));
};

const A = RD(join(LAB, "run1-A-human-answers.json")).map((a) => ({
  id: a.blindId ?? a.id,
  main: a.main ?? "",
  also: a.also ?? [],
  pos: a.pos === "" || a.pos === undefined || a.pos === null ? null : Number(a.pos),
  conf: a.conf ?? "",
}));
const B = RD(join(LAB, "run1-A-answers.json")).map((a) => ({
  id: a.blindId ?? a.id,
  main: a.main ?? "",
  also: a.also ?? [],
  pos: a.pos === "" || a.pos === undefined || a.pos === null ? null : Number(a.pos),
  conf: a.confidence ?? "",
}));
const mapA = new Map(A.map((x) => [x.id, x]));
const mapB = new Map(B.map((x) => [x.id, x]));
const ids = [...new Set([...A, ...B].map((x) => x.id))].sort();

const hasTag = (row, tag) => row.main === tag || row.also.includes(tag);

const bothFilled = ids.filter((id) => mapA.get(id).pos !== null && mapB.get(id).pos !== null);
const zeroStart = bothFilled.filter((id) => mapB.get(id).pos === 0 || mapA.get(id).pos === 0);
const withCommon = [];
for (const id of bothFilled) {
  const a = mapA.get(id);
  const b = mapB.get(id);
  const common = [
    hasTag(a, "loop") && hasTag(b, "loop") && "loop",
    hasTag(a, "repeat") && hasTag(b, "repeat") && "repeat",
  ].filter(Boolean);
  if (common.length > 0) withCommon.push({ id, common });
}
const singleCommon = withCommon.filter((x) => x.common.length === 1);
const noZero = (id) => !zeroStart.includes(id);

function stats(list) {
  const diffs = list
    .map((id) => Math.abs(mapA.get(id).pos - mapB.get(id).pos))
    .sort((x, y) => x - y);
  const n = diffs.length;
  // 沿用原始分析的中位数定义：取排序后第 floor(n/2) 个（0-indexed），
  // 即偶数组取「上中位」而非两数平均。n=8 时取第 5 个。
  // 换成平均口径会让 n=8 那组从 264 变成 230，与论文不符。
  const med = n === 0 ? NaN : diffs[Math.floor(n / 2)];
  return { n, median: med, le100: diffs.filter((d) => d <= 100).length };
}

console.log(`# 起点位置差：分母核对后重算（标注目录 ${LAB}）\n`);
console.log(`双方都填了位置：${bothFilled.length}/${ids.length}`);
console.log(`其中有一方标「从第 0 字开始」：${zeroStart.length} 条（${zeroStart.join(", ") || "无"}）`);
console.log(`双方至少共享一种异常类型：${withCommon.length}/${bothFilled.length}`);
console.log(`只共享一种异常（位置指向无歧义）：${singleCommon.length} 条\n`);

const payload = {
  inputs: {
    labels: LAB,
    batch: "run1-A：一名人类标注 + 一份对照标注",
  },
  expectation: EXPECT,
  counts: {
    bothFilled: bothFilled.length,
    zeroStart: zeroStart.length,
    withCommon: withCommon.length,
    singleCommon: singleCommon.length,
  },
  results: {},
};

const CASES = [
  ["all", "全部双方填写", bothFilled],
  ["dropZero", "排除「有一方标 0」", bothFilled.filter(noZero)],
  ["strict", "限定「只共享一种异常」且排除 0", singleCommon.map((x) => x.id).filter(noZero)],
];

for (const [key, label, list] of CASES) {
  const s = stats(list);
  payload.results[key] = { label, ...s };
  console.log(`- ${label}（n=${s.n}）：中位 ${s.median} 字｜≤100 字 ${s.le100}/${s.n}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
console.log(`\n写入 ${OUT}`);

if (CHECK) {
  let bad = 0;
  for (const [key, want] of Object.entries(EXPECT)) {
    const got = payload.results[key];
    if (!got || got.n !== want.n || got.median !== want.median || got.le100 !== want.le100) {
      console.error(
        `断言失败：${key} 期望 n=${want.n} 中位=${want.median} ≤100=${want.le100}，` +
          `实际 n=${got?.n} 中位=${got?.median} ≤100=${got?.le100}`,
      );
      bad += 1;
    } else {
      console.log(`断言通过：${key}`);
    }
  }
  if (bad > 0) {
    console.error(`\n${bad} 项断言未通过`);
    process.exit(1);
  }
  console.log("\n全部断言通过");
}
