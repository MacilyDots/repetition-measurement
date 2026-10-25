# Repetition measurement — replication package

Replication materials for the working paper **"When Repetition Depends on the Detector: A Case Study of Measurement Blind Spots in a Tool-Using Reasoning Agent"** (working paper draft, October 2026).

Versions are tracked by Git tags. See `CHANGELOG.md` for what changed between tags.

## What this package supports

**Detector and specification (v0.1 line):**

1. **Specification consistency** — three formal repetition features (`exact_run`, `template_run`, `alternating_run`) match their pre-written expectations on 28 constructed cases.
2. **Batch B behaviour** — on 16 real responses, all three features produce the values reported in the paper; in particular `alternating_run` marks zero cases.

**Paper numbers (v0.2 line):**

3. **Coverage gap** — 20 individually reviewed responses with strong within-line repetition; the exact-line rule flagged none, and the median maximum line count was 1.
4. **Format sensitivity** — on 300 fixed, already-generated responses, deleting newlines removed all 14 line-level flags and rewrapping after punctuation flipped 10 of 300. No model request is made by either transformation.
5. **Human agreement** — batch A loop judgments: observed and chance agreement both 75.0% (κ = 0). Batch B: 16/16 (κ = 1.00), 15 joint positives and 1 joint negative, on labels reconstructed from conversation records rather than original submissions.
6. **Onset position** — among the eight paired batch-A items the median difference is 230 characters (standard median, averaging the two middle values for even n; the upper median is 264), too large to support a precursor-window analysis.
7. **Block-level description** — across nine conditions the ratio of between-block variation to the independent-binomial reference is 0.72–1.20, with block size frozen per condition.

It does **not** support claims about detection accuracy, population coverage, or failure prevalence. See `code/README.md` and `tools/repro/README.md` for the explicit boundary of what this code can and cannot establish.

## Contents

```text
tools/repro/
  manifest.json             authoritative list of every paper number: script, inputs, expected output
  agreement.py              C4/C5/C6: human agreement, Cohen's kappa, onset position difference
  verify-strong.mjs         C1: within-line coverage gap
  batch-stats.mjs           C7a: between-block variation ratio
  batch-dispersion-test.mjs C7b: one-sided overdispersion check (parametric Monte Carlo)
  verify-kappa.mjs          legacy, kept only for cross-checking against agreement.py
  verify-onset.mjs          legacy, kept only for cross-checking against agreement.py
  crosscheck_legacy.py      cross-checks the two implementations
  tests/                    unit tests for agreement.py
  inputs/                   minimal de-identified inputs (logs and labels)

code/
  spec-cases.mjs            28 cases with expectations written before the run
  spec-check.mjs            v1.2 implementation + per-case comparison
  verify-repeat-v3.mjs      three features on batch B; supports public and full data
  spec-out3.txt             first full pass (28/28)
  spec-verify-rerun.txt     independent re-run (28/28)
  rerun-in-archive.txt      re-run after archiving to this directory (28/28)
  verify-v12-out.txt        v1.2 output on the 16 batch-B items
  README.md                 what this code can and cannot establish

labels/
  run1-full.public.json     per-item metadata and the SHA-256 of each response text
  batch-B-reconstructed/    per-item labels from two annotators (reconstructed, not raw submissions)
  run1v3-A-原始/            batch A material and answers, archived as originally exported
```

The three `spec-*.txt` files have **identical SHA-256**. That is the point, not a mistake: the same code run from three different locations produced byte-identical output.

## Running

Detector checks:

```bash
cd code
node spec-check.mjs        # expect 28/28
node verify-repeat-v3.mjs  # expect output matching verify-v12-out.txt
```

Paper-number reproduction. Expected values and known pitfalls are in `tools/repro/README.md`:

```bash
cd tools/repro
python agreement.py --expect        # human agreement, kappa, onset position
node verify-strong.mjs              # coverage gap; needs original SSE, see below
node batch-stats.mjs                # between-block ratio, nine conditions
node batch-dispersion-test.mjs      # one-sided overdispersion p values
python -m unittest discover -s tests
python crosscheck_legacy.py
```

Requires Node.js 18+ and Python 3.10+, standard library only, no network access.

## Materials not included

| Material | Reason | Effect |
|---|---|---|
| Original SSE responses (about 480 MB) | Contains project text | `verify-strong.mjs` falls back to checking the de-identified summary |
| exp20 upstream logs (300 responses) | Contains project text | Format-flip numbers cannot be recomputed from scratch; the script and its output JSON are included |
| `labels/run1-full.json` | Contains response text | The alternating-criterion v1.1 vs v1.2 comparison cannot be recomputed |

## Tags

| Tag | Contents |
|---|---|
| `v0.1.0` | Original 14-file package: `code/` and the batch-B labels |
| `v0.2.1` | Rebuilt release asset, byte-identical to the tag and self-contained |
| `v0.2.2` | **Current.** Adds `governance/`; the manifest records the paper versions it matches |
| `v0.2.0` | Superseded; its release asset was withdrawn — see `governance/release-incident-2026-10-25.md` |
