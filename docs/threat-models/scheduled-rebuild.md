# Threat model: the scheduled rebuild (.github/workflows/pages.yml), retired

> **Retired 19 November 2026.** Dinis decided every GitHub run starts from a commit (about 01:20 UTC, PrompTugal__News__Website `board/guidance/2026-11-19-every-run-starts-from-a-commit.md`); the `schedule:` block and the scheduled-only pull step are removed. Pages load their changing figures in the browser instead: see `browser-data.md`. Kept as the record.

Owner: travel.b@PrompTugal.dinis. Written 18 November 2026. Dinis approved the scheduled rebuild (about 14:55 UTC, PrompTugal__News__Website `board/guidance/2026-11-18-keys-issues-rebuilds-observability.md`). The person running this session approved the edit. To be reviewed by security@PrompTugal.dinis.

## What it does
GitHub Actions runs the Pages workflow every 3 hours (cron `23 */3 * * *`), and on every push to dev. A scheduled run first reads the latest public data (`node scripts/pull.mjs`, see `pull.md`), then builds, then runs the gate: the commit trailer check, the validator with its licence check, and the leak scan. Only if the gate passes does it deploy to GitHub Pages and tag the release.

## What it can do
- The build job has `contents: read` only, and checks out with `persist-credentials: false`.
- The deploy job has `pages: write` and `id-token: write`, for GitHub Pages only.
- The tag job has `contents: write`, to push a version tag. It does not push commits.
- No repository secret is used. The data it reads is public.

## Threats
| Threat | Effect | Mitigation |
|---|---|---|
| Hostile data from a source reaches a page | Defacement, script injection | Values are escaped at build time. The validator rejects third-party scripts and stylesheets, em dashes and hype words. The leak scan runs on the built site. |
| Hostile data tries to break the build or the gate | No deploy (fails closed) | The last good version stays live. |
| The schedule runs while `board/HOLD.md` exists | Release during a hold | The workflow stops first if `board/HOLD.md` exists. |
| A data file carries a secret-shaped string | A leak published | The leak scan fails the run. |
| Too many runs | Version tags inflate; load on sources | At most 8 a day; pull.mjs reads politely. |
| Workflow edited to widen permissions | Supply chain risk | Workflow changes are reviewed by security@; actions are pinned to major versions (to pin to commit SHAs: checklist). |

## Checklist (for security@)
- [ ] Pin third-party actions to commit SHAs.
- [x] Least privilege per job; no secrets; the hold check is first.
