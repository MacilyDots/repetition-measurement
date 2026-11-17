# Field reports

Ongoing records of the repetition guard's behaviour in this deployment. Each file covers one incident or one focused analysis, dated by when the observations were made.

These are not papers and not benchmarks. They record what happened, what was measured, and what could not be concluded. They exist because the same failure keeps recurring and each occurrence tells me something the previous one did not.

## Index

| Date | File | What it covers |
| --- | --- | --- |
| 2026-10 | [`../REPORT.md`](../REPORT.md) | The October report: the guard measured lines, newline removal changed every decision, the threshold came from a 84–189 gap in 3,240 replayed steps |
| 2026-11-04 / 06 | [`2026-11-06-criterion-divergence.md`](2026-11-06-criterion-divergence.md) | Two cases that break the October threshold from opposite sides; line-level criterion fires while all three formal features report nothing |

## What gets added

A new file when:

- a degradation is caught and the archived session can be replayed, or
- an existing measurement is found to behave differently than recorded.

Each file states, at minimum, the timestamp, the repeated line, the reasoning length, the criterion that fired and at what threshold, and the three formal feature values. Anything that cannot be established from the archive is written as a limitation, not estimated.

## What does not get published

Raw session archives. They contain unrelated working content. The counts are reproducible from the archives by anyone holding them, using the splitting and normalization rules in [`../code/verify-repeat-v3.mjs`](../code/verify-repeat-v3.mjs); the archives themselves are not part of this repository.

## Reading the counts

Two units appear throughout and they are not interchangeable:

- **line count R** — the maximum number of times any one non-empty line repeats within a single reasoning text, which is what the guard thresholds. This is a within-response count.
- **formal feature values** (`exact_run`, `template_run`, `alternating_run`) — computed on fragments split at `。！？`, which is a different segmentation of the same text.

Same text, two units, sometimes opposite verdicts. That disagreement is the subject of the November file.
