# Release incident: path disclosure in the v0.2.0 asset (2026-10-25)

## What happened

The GitHub release asset `repro-bundle.zip` for `v0.2.0` (sha256 `2f22fb5a…`) contained a local absolute path and a user name, disclosed publicly on publication.

## Scope

- `tools/repro/README.md` and `code/PUBLISH-MANIFEST.md` each carried a migration note that kept a Windows user-home path of the form `<drive>:\Users\<name>\Desktop\...`.
- Searches for the user name, the user-home path pattern, the temporary-workspace name and the desktop directory name all hit.
- **No credentials, keys or tokens were present.** No rotation was required.
- The repository worktree, Git history and web content were clean. The disclosure existed only inside the release asset.

## Root cause

The asset was built by a script that read the project working tree. The README sanitisation had been done in a different clone. These are different files, and the archive was built before the fix.

**The error was treating "clean working tree" as "clean asset".** A repository scan, a Git history scan and an anonymous page check never open a release asset, so none of them could have caught this at the time.

Two secondary problems:
- The asset omitted `LICENSE` and `CHANGELOG.md`, so a standalone download did not satisfy MIT's requirement to carry the notice.
- 13 files differed from the tag content, partly because of line-ending conversion on checkout.

## Response

| Step | Action |
|---|---|
| 1 | Removed the v0.2.0 asset immediately; asset count went to zero |
| 2 | Replaced the build script with one that reads `git cat-file blob <tag>:<path>` and never touches the working tree |
| 3 | Rebuilt a 44-file archive including `LICENSE` and `CHANGELOG.md` |
| 4 | Published `v0.2.1` at the same commit `477298e` with the new asset |
| 5 | Added a "Superseded by v0.2.1" banner to the v0.2.0 release notes |
| 6 | Downloaded the new asset anonymously, scanned for strings (no hits), compared file by file against the tag (44/44 identical) |
| 7 | Cloned `v0.2.1` from the remote and re-ran all eight commands; all passed |
| 8 | Re-ran the clean-room test against the new archive; all checks passed |

The tag `v0.2.0` itself is clean and remains in history; it is no longer a citation entry point.

## Rules taken from this

1. Build the asset from the tag's blobs, not the working tree.
2. Re-download the asset after publishing and verify strings and per-file hashes.
3. Make the asset self-contained, including `LICENSE`.

Codified in `governance/publish-rules.md`.
