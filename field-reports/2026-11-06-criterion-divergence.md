# When the line-level criterion fires and the formal features see nothing

**Two field observations from the same deployment, 2026-11-04 and 2026-11-06.**

This continues [`../REPORT.md`](../REPORT.md). That report covered October. These two are what happened after it, and they cut in opposite directions: one case sits below the threshold the earlier report derived, the other sits exactly on it while every formal feature reports nothing.

No mechanism is proposed and no prevalence is estimated. Two single sessions, one model route each, conditions not matched.

---

## 1. Case A — 2026-11-04

Repeated line: `做。` ("do."), alternating with a short line containing a time limit. The two alternate, with ordinary task analysis interleaved between them.

| Quantity | Value |
| --- | --- |
| Reasoning length | 1,006 characters |
| Lines after splitting | 125 fragments |
| **Maximum line count R** | **60** |
| Guard threshold at the time | **40** (lowered during a climb) |
| `exact_run` | 2 |
| `template_run` | 2 |
| `alternating_run` | period 2, 2 cycles |

Under the fixed threshold of 100 that the October report derived, this response would have been classified **normal**. It was caught only because the guard was running its lowered climb-phase threshold of 40.

The reasoning text is not a collapse. It carries explicit task analysis; the repeated phrase is mixed into it. This is a different form from the October incidents, where the step produced nothing usable at all.

## 2. Case B — 2026-11-06

Repeated line: `时间紧。快。` Two short phrases sharing one line.

| Quantity | Value |
| --- | --- |
| Reasoning length | 3,608 characters |
| Fragments after splitting | 605 |
| **Maximum line count R** | **100** |
| Guard threshold | **100** |
| `exact_run` | **1** |
| `template_run` | **1** |
| `alternating_run` | **none** |

The line-level criterion fires: R = 100 meets the threshold exactly. One more repetition or one fewer and the classification flips.

Every formal feature reports nothing. The reason is the splitting unit, not an implementation defect. The line-level criterion splits on newlines and sees `时间紧。快。` as one unit, counting 100. The three formal features split on `。！？`, which cuts the same line into two fragments that then alternate: `时间紧` 100 times, `快` 296 times, `时间非常久` 98 times, never adjacent. Longest equal consecutive run 1, same after template normalization, no period-2 or period-3 alternation detected.

## 3. The two cases together

| | Case A (11-04) | Case B (11-06) |
| --- | --- | --- |
| Repeated line | `做。` alternating with a time-limit line | `时间紧。快。` |
| Line count R | 60 | **100** |
| Fixed criterion (R ≥ 100) | **no flag** | **flag** |
| Deployed guard threshold | 40 → flag | 100 → flag |
| `exact_run` | 2 | **1** |
| `template_run` | 2 | **1** |
| `alternating_run` | p=2×2 | **none** |

Both real degradations. Across both, the three formal features report at or near zero, while the line-level criterion caught each one, once by a lowered threshold and once by landing exactly on it.

## 4. Why this matters for the earlier report

The October report derived the threshold 100 from a gap between normal steps (max 84) and degraded steps (min 189) over 3,240 replayed steps. These two cases show that gap is a property of that sample, not of the failure mode:

- Case A degrades at 60, inside the "normal" side of that gap.
- Case B degrades at exactly 100, on the boundary itself.

A threshold derived from a past distribution does not survive a change in what the repetition looks like.

## 5. What is not claimed

1. **Not a positive example for `alternating_run`.** Case A reaches 2 cycles, which meets the reporting floor, but 2 cycles is not persuasive evidence. The feature still has no real positive case.
2. **No claim that 40 is more correct than 100.** Both are thresholds; the observation is that they disagree, not which one is right.
3. **No prevalence estimate.** Two sessions, single occurrences.
4. **No mechanism claim.** Case A in particular is mixed into normal reasoning, not a collapse, and the two sessions differ in context size and settings, so no factor can be separated.
5. **No claim that the climb is predictable.** Case A went 27 → 60 in one step. That is one sequence, not a trend.

## 6. Data

Session archives were decompressed locally and analysed with the same definitions as [`../code/verify-repeat-v3.mjs`](../code/verify-repeat-v3.mjs). Raw session archives are **not** published: they contain unrelated working content. The counts above can be reproduced from the archives by anyone who has them, using the splitting and normalization rules in the code.

Decompression note for anyone doing this: the `session.v4.jsonl.zstd` archives are **multi-frame**, and both Node's `zstdDecompressSync` and Python's `ZstdDecompressor().decompress()` return only the first frame (187 bytes, the session header). Python's `stream_reader(..., read_across_frames=True)` is required.
