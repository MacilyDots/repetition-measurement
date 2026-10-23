# code/: reproducible code for the paper

These files were archived from a local temporary workspace into this directory on 2026-10-20, so that they would not be lost when the temporary area was cleaned up.

## Specification-consistency check for the mechanical repetition counts (paper §5, Formal Features and Development Checks)

| File | Content |
| --- | --- |
| `spec-cases.mjs` | 28 cases. Each holds an expectation written **before** the run, whether it was met, and the reason |
| `spec-check.mjs` | v1.2 implementation (`normExact` / `normTemplate` / `sentences` / `maxRun` / `maxAlternating`) plus per-case comparison |
| `spec-out3.txt` | output of the first complete pass (28/28) |
| `spec-verify-rerun.txt` | output of an independent re-run on 2026-10-20 (28/28, no inconsistent entries) |
| `rerun-in-archive.txt` | output of the re-run after archiving into this directory (28/28) — shows it does not depend on the original path |

**Re-run**:

```
cd code
node spec-check.mjs
```

The last line of the expected output reads `| **合计** | **28** | **28** |` (the log is in Chinese; 合计 means "total"), with no "inconsistent list" section.

## The three features on real batch-B data (paper §5, final paragraph — 16-item batch B)

| File | Content |
| --- | --- |
| `verify-repeat-v3.mjs` | **upgraded to the v1.2 implementation** (aligned with the alternating criterion in `spec-check.mjs`: no built-in ≥5-cycle threshold, at least 2 cycles, no start inside an exact run). Runs the three features on R09–R24 and validates the alternating examples from the specification. See "Data source and run mode" below |
| `verify-v12-out.txt` | v1.2 output on batch B: `alternating_run` is 无 ("none") for every item |

**Evidence source**: the `alternating_run` column is the program's output on fixed text; it **does not depend on any annotation file**. The `H1` / `H2` columns beside it are read from `labels/batch-B-reconstructed/`, which holds labels reconstructed from conversation records. They are kept for human cross-reading only and take no part in computing the metrics.

**Version note (important)**: before 2026-10-20, `verify-repeat-v3.mjs` in this directory used the v1.1 alternating criterion (a built-in ≥5-cycle threshold), while `spec-check.mjs` used v1.2. The two were different code and cannot be described as "the same logic".

Both versions were measured on the same 16 batch-B items and gave **identical results** (zero alternating hits in each), so the paper's conclusion of "zero alternating cases" is unaffected by the version difference. The version difference still has to be recorded; both are now unified on v1.2.

**Data source and run mode (important)**: `verify-repeat-v3.mjs` selects its data source in this order:

1. `../labels/run1-full.json` — the **full** version, containing the `text` field. Held locally only; not released with this repository.
2. `../labels/run1-full.public.json` — the **public** version, containing only per-item metadata and the SHA-256 of each `text`.

The repository contains **only the public version**. Running `verify-repeat-v3.mjs` after cloning therefore enters **public mode**: it prints per-item metadata and hashes, and states explicitly that the three metrics cannot be recomputed from them. With the full version present locally it prints the metric values, matching `verify-v12-out.txt`.

Paths resolve relative to the script's own directory (its parent). Set the environment variable `PAPER_DATA_ROOT` to override the data root. **No drive letters or usernames are hard-coded**, so the code runs as-is after moving the directory.

**Annotation-standard version difference (critical)**: the batch-B human annotations were produced under the **v1.1 criterion** — at that time `alternating_run` required "the same unit repeated for ≥5 complete cycles". v1.2 changed the threshold to "at least 2 cycles" and added the constraint that a run may not start inside an exact run.

The `H1` / `H2` columns therefore reflect human judgements made under **v1.1**, and are **not directly comparable** with what the current code computes under v1.2. They are kept in the output for cross-reading only (for instance, checking whether an item a human marked "no" is also "no" under the program). They **take no part in any metric computation and do not constitute a re-annotation under the new standard**.

Both versions yield zero alternating hits on the 16 batch-B items. That is a measured fact, but it is **not proof that the two rules are equivalent**.

## What this code can establish

- **Consistency** between the implementation and the v1.2 specification: all 28 constructed cases match their expectations.
- **Reproducibility** of the check: three separate runs (original, re-run in the temporary area, re-run after archiving) produce identical results.

## What this code cannot establish

- **Not that the rules are valid.** Three legitimate repetition examples (numbered lists, consecutive assignments, same-structure table rows) still hit `template_run=5`; that is a known false-positive surface.
- **Not coverage.** The cases are hand-constructed and do not represent the real data distribution.
- **Not detection accuracy.** The cases took part in revising the rules; the pass rate is a development-set result.
- **`alternating_run` has no real sample.** In the 16 real batch-B items the alternating pattern is zero; this feature is supported only by constructed cases.
