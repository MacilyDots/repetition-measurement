# Repetition measurement — replication package (v0.1)

Replication materials for the working paper **"When Repetition Depends on the Detector: A Case Study of Measurement Blind Spots in a Tool-Using Reasoning Agent"** (working paper draft v0.1, October 2026).

This package supports two claims from the paper:

1. **Specification consistency** — three formal repetition features (`exact_run`, `template_run`, `alternating_run`) match their pre-written expectations on 28 constructed cases.
2. **Batch B behaviour** — on 16 real responses, all three features produce the values reported in the paper; in particular `alternating_run` marks zero cases.

It does **not** support claims about detection accuracy, coverage, or failure prevalence. See `code/README.md` for the explicit boundary of what this code can and cannot establish.

## Contents

```text
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
  batch-B-reconstructed/            per-item labels from two annotators (reconstructed, not raw submissions)
```

The three `spec-*.txt` files have **identical SHA-256**. That is the point, not a mistake: the same code run from three different locations produced byte-identical output.

## Running

```bash
cd code
node spec-check.mjs        # expect 28/28
node verify-repeat-v3.mjs  # expect output matching verify-v12-out.txt
```

Requires Node.js. No dependencies beyond the standard library.

Data paths resolve relative to the script location. Set `PAPER_DATA_ROOT` to point at a different data root.

## Data availability

The raw response texts are **not included**. They contain content from a real development workload. `labels/run1-full.public.json` provides, for each item, the metadata and the SHA-256 of its text, so that the published metrics can be checked against the published digests — but the metrics cannot be recomputed without the originals.

## Scope

Single-user, single-environment case study. Nothing here estimates population sensitivity, specificity, or failure prevalence. The 28 constructed cases participated in developing the rules; 28/28 is a development-set result, not a held-out one.

## License

MIT — see `LICENSE`.

## Citation

If you use this package, please cite the paper. The arXiv identifier is added once the preprint is announced.
