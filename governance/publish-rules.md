# Publication rules

Applies to every public release of this repository: Git tags, release assets, and the replication bundle.

## Frozen identifiers

| Item | Value |
|---|---|
| Version | see the latest Git tag; `CHANGELOG.md` records what changed |
| Asset | `repro-bundle-<tag>.zip`, built from the tag's blobs |
| Integrity | the asset must hash-match the tag file by file |

Superseded tags stay in the repository for history but are not citation entry points.

## Hard rules

**1. The release asset is built from the tag's blobs, never from the working tree.**

Use `git cat-file blob <tag>:<path>` to read bytes. A working tree can contain uncommitted edits, line-ending conversion, and cache files that the tag does not.

**2. After publishing, download the asset again and verify it.**

- Scan for local paths and identifiers: user names, user-home path patterns, drive letters, temporary-workspace names, email addresses, token prefixes.
- Compare every file against the tag by SHA-256. Differences must be zero, or limited to explainable omissions.

**3. The asset must be self-contained.**

MIT requires that the copyright and permission notice accompany distributed copies, so a standalone download must include `LICENSE`. `CHANGELOG.md` should also be present.

**4. Published tags and assets are immutable.**

Any change to code, inputs or documentation goes into a new version. Do not move a tag and do not replace an asset. If an asset must be withdrawn, say in the release notes which version replaces it and why.

**5. Repository scanning does not cover release assets.**

`publish-audit.ps1` scans the worktree, the Git history, a fresh remote clone and the remote history. It does **not** open release assets. Assets are verified separately.

## Procedure

```bash
# 1. Audit, fully green
pwsh -File publish-audit.ps1 -RepoPath <clone> -Remote <owner/repo>

# 2. Annotated tag
git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z

# 3. Build the asset from tag blobs (not the working tree)
python tools/rebuild_release_zip.py vX.Y.Z

# 4. Publish
gh release create vX.Y.Z <zip> --repo <owner/repo> --notes-file <notes>

# 5. Download the asset again, verify strings and per-file hashes
python tools/verify_release_asset.py

# 6. Clone the tag from the remote and re-run every command
python tools/remote_verify.py vX.Y.Z

# 7. Clean-room extraction test
python tools/clean_room_test.py
```

If step 5, 6 or 7 fails, do not describe the release as reproducible. Handle an asset defect through the incident procedure below.

## Incident procedure

`governance/release-incident-2026-10-25.md` records one asset defect end to end: what leaked, why the audit missed it, and how it was fixed.
