# Batch B — reconstructed annotation labels

## What this is

Per-item labels from the two annotators for batch B (16 items, R09–R24). The original submission file (the `run1v3-B-answers.json` downloaded at export time) was cleared from the desktop during analysis and is not preserved on disk; `labels/` at the time only archived the batch-A material.

The two JSON files in this directory are **reconstructed from conversation records**. They are not the original submission files.

## Basis for reconstruction

The original content came from a complete read of the file at the time (the full text of a `Get-Content` output), recorded in this project's research conversation. Reconstruction means transcribing that output item by item, without adding, deleting or modifying any field value.

## Field completeness

Both reconstructed files preserve every field of the original output:

| Field | Meaning | Source |
| --- | --- | --- |
| `blindId` | item identifier, R09–R24 | original output |
| `loop` | whether persistent looping is present | original output |
| `repeat` | whether mechanical repetition is present | original output |
| `pickPos` | position of the quoted illustrative fragment | original output |
| `pickNote` | explanation of that fragment | original output |
| `conf` | annotator's confidence | original output |
| `note` | free-text remark | original output |

## What was deliberately not invented

- **No remarks were written in.** Human 1's `note` was empty in the original output and is empty in the reconstruction; Human 2's remarks are preserved verbatim.
- **No timestamps were written in.** The original export carried no submission time, and neither does the reconstruction.
- **No confidence values were written in or adjusted.** `conf` follows the original output throughout.
- **No labels were back-filled from analysis results.** The reconstruction was completed before any computation, and nothing was revised afterwards.

## Limitations that must be stated

**A reconstruction cannot substitute for the original submission file.** It lacks metadata the original may have carried (export time, tool version, file hash), and transcription errors cannot be ruled out — although it was compared item by item against the conversation record.

Therefore:

- The project's **inter-annotator agreement and Cohen's κ are computed on reconstructed labels** and should be described as "recomputed from reconstructed labels", not as agreement obtained directly from the original submissions.
- **Program results are unaffected**: the 28/28 specification-consistency check under v1.2, and the zero alternating hits on batch B, both come from running code on fixed text and are independent of the annotation files.

## Which computations depend on the reconstruction

| Item | Depends on the reconstruction? |
| --- | --- |
| Batch B loop agreement 16/16, κ = 1.00 | **Yes** |
| Batch B mechanical-repetition agreement 14/16, κ = 0.709 | **Yes** |
| Batch B alternating pattern: 0 items (v1.2) | No (program run on text) |
| Specification consistency 28/28 | No (constructed cases, no annotations involved) |

## If the original submissions become available

If either annotator still holds their exported `run1v3-B-answers.json`, these files can be replaced. After replacement, re-run the κ computation and check whether the agreement rate and κ still match the values recorded above.
