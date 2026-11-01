# Repetition guards measure lines, not repetition

A field report from one production agent deployment, October 2026. Not a paper. No prevalence claims, no mechanism.

**[Read the full report →](REPORT.md)**

---

## The three findings in one line each

1. **The guard could not see what it was built to catch.** 20 hand-verified responses with obvious repetition, all repeated *within* a single line. The line-level rule flagged **0 of 20**; median maximum line count was **1**. Switching to character 30-grams lit up the same 20 immediately.

2. **Delete the newlines and the result disappears.** On 300 already-generated responses, the line-level rule found **14/300**. Removing newlines (no model call) took that to **0/300**; rewrapping on sentence boundaries flipped **10/300**. The model never ran — only the segmentation changed.

3. **Hitting the threshold is not failing.** Across 400 interleaved requests, most responses that crossed the repetition threshold went on to emit a tool call anyway (20/22 and 17/21 in the two batches).

## What I did not manage

- **No live event captured.** Three-layer recording (upstream SSE / adapter / event stream) never fired on a real repetition — only one normal request aligns. A case study with no case.
- **A cross-session comparison withdrawn.** The two conversations differed in turn, system prompt, tool count, and total tokens. Not separable. Archived, not re-collected.
- **Human agreement inconclusive.** κ = 0 in one batch (75% observed = 75% chance); κ = 1.00 in the other but with exactly one jointly-negative item.
- **Neither headline finding is recomputable by anyone else.** The raw material contains project text and is not published.

## Repository

| Path | Contents |
|---|---|
| `REPORT.md` | the full report |
| `code/` | three repetition features + 28 specification cases and run logs |
| `tools/repro/` | every number in the report, with `manifest.json` |
| `labels/` | de-identified annotation data |
| `governance/` | release incident record and publish rules |

```bash
cd code && node spec-check.mjs                 # expect 28/28
cd tools/repro && python agreement.py --expect # human agreement, kappa, onset position
cd tools/repro && node batch-stats.mjs         # block-level dispersion, nine conditions
```

Node 18+, Python 3.10+, standard library only, no network.
