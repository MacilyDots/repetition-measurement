# 论文数字的复现目录

对应论文：中文 `论文_v0.11_编辑稿_2026-10-25.md`、英文 `paper_en_v0.5_2026-10-25.md`。

本目录把论文里的定量主张逐条映射到脚本、输入与期望输出。逐项的机器可读版本见 `manifest.json`。

论文里每处数字的口径（允许怎么写、禁止怎么写）见 `主张一致性表_2026-10-25.md`，本目录的 `claim_id` 与它一一对应。

## 怎么跑

```bash
cd tools/repro

python agreement.py --expect      # C4/C5/C6 的 canonical 实现（一致率、κ、起点位置差）
node verify-strong.mjs            # C1  行级盲区（需原始 SSE，见下）
node batch-stats.mjs              # C7a 九个条件的块间比值
node batch-dispersion-test.mjs    # C7b 单侧过度离散 p 值
```

`--expect` 会按内置期望值断言，任何一项不符即非零退出。产物写到 `outputs/`。

**C4/C5/C6 的 canonical 脚本是 `agreement.py`。** 旧脚本 `verify-kappa.mjs` 与 `verify-onset.mjs` 保留为 legacy，只用于迁移对拍（`python crosscheck_legacy.py`），不再作为引用来源。

测试：

```bash
python -m unittest discover -s tests -v      # 13 项，含空输入/重复 ID/单标签/全一致/完全不一致/n=8 中位数
python crosscheck_legacy.py                  # 新旧脚本逐项对拍
```


C2 与 C3 不在本目录：

- **C3** 自包含，脚本与输出日志已在 `code/`（`spec-check.mjs`、`spec-out3.txt`）。
- **C2** 需要 exp20 的 300 份上游日志（未发布），产出脚本是 `tools/exp20_reclassification.py`，其输出 JSON 的 `format_flips` 字段记录 14 → 0 与 14 → 24。

## 期望值一览

| 项 | 主张 | 期望输出 |
|---|---|---|
| C1 | 行级判据的结构性盲区 | 20 份；最高行重复中位数 **1** |
| C4 | 批次 A 绕圈一致率 | n=8；观察 75.0% = 机会 75.0%；**κ=0** |
| C5 | 批次 B 绕圈一致率 | n=16；16/16；机会 88.3%；**κ=1.000**；共同阳性 15、共同阴性 1 |
| C6 | 批次 A 起点位置差 | 全部 8 对中位 **230**（常规中位数）；上中位 **264**；排除标 0 后 7 对 **196**；最严口径 3 对 **290**；三种口径下 ≤100 字都是 0 |
| C7a | 块间比值 | 0.95 / 0.98 / 1.20 / 1.12 / 1.20 / 0.74 / 0.72 / 0.90 / 1.01，区间 **0.72–1.20** |
| C7b | 单侧过度离散检验 | p 区间 **0.258–0.969** |

## 三个复现坑

**1. C7 的块大小必须随条件冻结。** exp2 与 baseline 用 10，其余用 20。换成 20 会让 exp2 从 0.90 变成 0.72。`batch-stats.mjs` 与 `batch-dispersion-test.mjs` 都把块大小写进条件表，不接受全局覆盖。

**2. C6 的中位数口径已正式定为常规中位数。** 原脚本用的是「上中位」（排序后取第 `floor(n/2)` 个，0-indexed），n=8 时得 264。但论文与实验记录**都没有把这个定义写成规则**，它只是实现细节。因此 v0.10 起主字段改为常规中位数（偶数样本取中间两值平均），n=8 时为 **230**；上中位 264 同时保留在 `median_upper` 供审计。

`agreement.py` 同时输出两个口径，不把它们混成一个 `median`：

```json
"cases": { "all": { "n": 8, "median_standard": 230.0, "median_upper": 264, "le100": 0 } }
```

改口径不改变结论——两种算法都在「远大于 100 字」的量级，起点位置差都不足以支持前兆窗口分析。

**3. C7b 是参数化蒙特卡洛，不是重排。** 零假设下按 `Binomial(n_b, p̂)` 生成块计数再算 Pearson X²，固定种子 20261017、每条件 50,000 次。稿件里应写「参数化蒙特卡洛模拟」，不要写「重排/重采样观察值」。

## 未随仓库发布的材料

| 材料 | 为什么没发 | 影响 |
|---|---|---|
| `inputs/replay-raw/`（482 MB 原始 SSE） | 含项目原文 | C1 无法从零重算。缺该目录时脚本改为核对脱敏结果（20 份、中位数 1），一致则退出码 0 |
| exp20 上游 300 份响应日志 | 含项目原文 | C2 无法从零重算；仓库只给产出脚本与输出 JSON |
| `labels/run1-full.json` | 含响应原文，24 条中 23 条命中项目词汇 | 交替判据 v1.1 vs v1.2 的对照无法复算，故未并入 `verify-kappa.mjs` |

## 输入清单

`inputs/` 共约 390 KB：

```
inputs/
  ngram-full-scan.json            42 KB   C1 的样本清单（文件名 + 计数，无原文）
  verify-strong-sanitized.json    16 KB   C1 当时的逐条结果（脱敏，只有数值字段）
  labels/
    run1-A-human-answers.json     1.2 KB  C6
    run1-A-answers.json           2.5 KB  C6
    run1v3-A-human1-answers.json  1.3 KB  C4
    run1v3-A-human2-answers.json  1.3 KB  C4
    run1v3-B-human1-answers.json  1.6 KB  C5
    run1v3-B-human2-answers.json  4.3 KB  C5
  logs/
    exp19-repeat-vs-unique.log    82 KB   C7
    exp18-interleave.log          80 KB   C7
    exp20-density.log             73 KB   C7
    exp2-effort-high.log          16 KB   C7
    replay-tail20-n100.txt        15 KB   C7（基线）
```

重放日志只含轮次号、条件标签、耗时、字符数、重复串、工具块数、token 计数与 trace id，**不含 prompt 或响应正文**。

标注文件只含 `blindId` 与判断字段，**不含响应原文**。

## 批次 B 的标签来源

`run1v3-B-human1/human2-answers.json` 是**按对话记录重建**的逐条标签，不是两名标注者当时导出的原始提交——原始提交在分析后未保留。重建件保留了全部字段（编号、各项判断、点选位置、置信度、备注），未补造未记录内容，但不能替代原始文件。

论文正文（中文 v0.8 §4.13、英文 v0.2 §A.3）已披露这条限制。引用 C5 的结果时应同时引用这条限制。

## 与临时区的关系

本目录的脚本原在项目的临时区。现迁入正式目录，临时区的原件保留作为历史记录，不再维护，也不构成运行依赖。

迁移时改了五处路径硬编码：

| 原脚本 | 原输入 | 现输入 |
|---|---|---|
| `verify-strong.mjs` | 临时区的原始 SSE 与扫描结果 | `inputs/`（原始 SSE 需自备） |
| `verify-kappa-and-alt.mjs` | `labels/run1v3-A-原始`、`labels/run1v3-B-重建`（目录已改名，原脚本已失效） | `inputs/labels/` 扁平结构 |
| `recheck-onset-denominator.mjs` | 本机桌面的两份标注（已不存在） | `inputs/labels/` |
| `batch-stats.mjs` | 命令行传入单文件 | 无参数时跑九个条件 |
| `batch-dispersion-test.mjs` | 临时区 | `inputs/logs/` |

（上表只写相对位置，不写本机绝对路径——本文件随仓库公开。）

**两个原脚本在迁移前已经跑不起来**：kappa 脚本引用的 `run1v3-B-重建` 目录已改名 `batch-B-reconstructed`；onset 脚本引用的桌面文件已不存在（实际文件后来从调查目录找回）。这两处是迁入时才发现的。
