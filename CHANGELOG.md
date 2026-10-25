# Changelog

Versions are Git tags on this repository. The repository name intentionally carries no version.

## v0.2.2

**Added**

- `governance/publish-rules.md` — how release assets are built, verified and kept immutable.
- `governance/release-incident-2026-10-25.md` — the v0.2.0 asset defect, root cause and response.

**Changed**

- `tools/repro/manifest.json` now records the paper versions it corresponds to (`v0.12` Chinese, `v0.6` English) and the correct current-draft pointers in its layout description.

**Unchanged**

- Code, inputs, expected values and the manifest's claim list are identical to `v0.2.1`.
- Tags `v0.1.0`, `v0.2.0` and `v0.2.1` are untouched.

## v0.2.1

**Changed**

- Release asset rebuilt from tag blobs, so it is byte-identical to the tag and self-contained (includes `LICENSE` and this file).

**Fixed**

- The `v0.2.0` asset had been built from an unsanitised working tree and contained a local machine path; it also omitted `LICENSE` and `CHANGELOG.md` and differed from the tag in 13 files. That asset was withdrawn. See `governance/release-incident-2026-10-25.md`.

## v0.2.0 (unreleased at time of writing; `v0.2.0-rc.1` was used for remote verification)

**Added**

- `tools/repro/` — authoritative manifest and reproducible implementation for every quantitative claim:
  - `manifest.json` lists each claim with its script, arguments, input SHA-256 and expected output.
  - `agreement.py` is the canonical implementation for human agreement, Cohen's kappa and onset position difference (previously two separate ad-hoc scripts).
  - `verify-strong.mjs`, `batch-stats.mjs`, `batch-dispersion-test.mjs` cover the coverage-gap and block-level claims.
  - `tests/` covers empty input, duplicate IDs, single-label categories, full agreement, full disagreement and even-n medians.
  - `inputs/` holds minimal de-identified logs and labels (about 390 KB).
- `labels/run1v3-A-原始/` — batch A material and answers as originally exported.
- `CHANGELOG.md`.

**Changed**

- **Onset position median: 264 → 230.** Earlier drafts used an upper median (the element at index `floor(n/2)`), which was an implementation detail and never stated as a rule in the paper or the experiment log. The paper now reports the standard median (mean of the two middle values when n is even), which is 230 for n = 8. The upper median 264 is still emitted as `median_upper` for audit. The three denominators (8, 7, 3) are unchanged and no pair falls within 100 characters under either definition, so the conclusion is unaffected.
- README rewritten to separate the v0.1 detector claims from the v0.2 paper-number claims, and to point at `tools/repro/manifest.json` as the single source of truth.
- `code/README.md` gains a scope note pointing at the manifest instead of maintaining a second command list.

**Not changed**

- No Git history rewrite. The v0.1 commit `7a45755` is preserved and tagged `v0.1.0`.

## v0.1.0

Original replication package, 14 files: `code/` (28-case specification check and the batch-B feature run) and `labels/` (public metadata plus the reconstructed batch-B labels).
