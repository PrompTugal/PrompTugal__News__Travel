# Threat model: the CI checks (trailer check and leak scan)

Owner: travel.b@PrompTugal.dinis. Written 19 November 2026 by travel.b.ci@PrompTugal.dinis, to meet security@'s controls 6 to 10 for the checks we already run. To be reviewed by security@PrompTugal.dinis. Signatures (the later controls) are out of scope: they wait on a decision.

## What runs where
| Job | Runs | Pushed code? |
|---|---|---|
| `build` | the trailer check, build, validate, leak scan, `test-leak-scan.mjs`, `test-ci-checks.mjs`, then uploads the Pages artifact | Yes. It is the job that builds the site, so it must run pushed code. Its checks are a first line only. |
| `security` | needs `build`; only on `refs/heads/dev` | No. It uses git, curl, jq, tar, find and the node binary. The only scripts it runs are the checkers as they were in the anchor commit A. |
| `deploy` | needs `build` and `security`; only on `refs/heads/dev` | No. It deploys the artifact the `security` job has scanned. |
| `tag` | needs `build`, `security` and `deploy`; only on `refs/heads/dev` | No. |

## What the security job does, in order
1. Fails on a git older than 2.42, and on a shallow clone. Every step runs with `GIT_NO_REPLACE_OBJECTS=1`, an empty `NODE_OPTIONS`, and `GIT_ATTR_SOURCE` set to the empty tree, so replace refs, node options and attributes in the checkout cannot change what git or node does.
2. Refuses a pushed `_site` path and any pushed `.gitattributes`.
3. Finds the anchor A: the head of the newest earlier successful push run of this workflow on `dev` in which a job named `security` succeeded, read from GitHub's API with the run's own `GITHUB_TOKEN`. If the API answers and lists no such run, A is the pinned `TRUSTED_BASE` written in the workflow ("bootstrap"). An API error fails the job; it never falls back to the bootstrap. No input or variable sets A.
4. Requires A to be an ancestor of the pushed commit.
5. Fails on any commit in A..pushed with no parent, merges included (control 6).
6. Fails on any symlink, with no exceptions (control 10): a new-side mode 120000 in any commit of A..pushed (`git diff-tree -r -m --raw -z`, parsed on NUL bytes), mode 120000 anywhere in the pushed tree, and any symlink on disk in the workspace including `.git`.
7. Overwrites `scripts/check-commits.mjs`, `scripts/leak-scan.mjs`, `scripts/test-leak-scan.mjs` and `scripts/commit-exemptions.json` with A's copies (a file A lacks is removed), then runs A's trailer check over A..pushed and A's leak-scan test (controls 7 and 9). The write comes after the symlink checks, so no symlink can redirect it.
8. Downloads the Pages artifact the `build` job uploaded, lists it with `tar -tvf`, accepts only regular files and directories, refuses absolute names and `..` components, extracts it fresh, refuses any symlink in it, moves it to `_site`, and runs A's leak scan over the tracked files and that `_site`. The `deploy` job deploys the same artifact, so the bytes scanned are the bytes deployed (control 9).

In the repository, `check-commits.mjs` skips a commit only if it is an ancestor of its pinned `TRUSTED_BASE` (control 8: ancestry alone, never a date, file, path, message or name) and fails on any commit with no parent. `leak-scan.mjs` scans binary files like any other (decoded as latin1; a NUL byte never skips a file), uses lstat, and fails on any symlink in the tracked files or `_site`. The only file class it still skips is the vault's ciphertext under `.sg_vault/bare/`.

## What it trusts
- GitHub's run records for A, read with the job's own token. A run's `head_sha` is checked to be 40 hex digits and an ancestor of what was pushed.
- git (2.42 or later), curl, jq, tar, find, bash and the node binary that `actions/setup-node` installed, whose path is recorded right after that step. Also the actions `checkout`, `setup-node` and `download-artifact`, pinned by major version.
- The pinned `TRUSTED_BASE` constants (in the workflow and in `check-commits.mjs`), until a release containing the new checkers becomes A. Moving them is a person's decision.

## What it does not trust
Everything pushed: scripts, the tree, attributes, commit dates and messages, the artifact's contents and names, and any `commit-exemptions.json` that A does not hold.

## What can still go wrong
| Limit | Why it remains |
|---|---|
| The workflow YAML itself comes from the pushed tree. A push that removes or weakens the `security` job runs the weakened workflow. | Only branch protection on `dev` (Dinis's decision) closes this, with a required review of `.github/workflows/`. Until then the checks guard against mistakes and against a changed script, not against someone with push access who edits the workflow. |
| The first run uses the bootstrap A, whose checkers are the old ones. | By design: the base's copy runs only on the push that adds the new checkers. From the next run A holds them. |
| Tags are not trusted. The `tag` job creates a tag; the version is worked out from existing tags in `build`. | A tag is a label, not evidence. The checks use ancestry from A, never tags. The old rule "since the last release tag" is kept only in the `build` job's first-line check. |
| The run list is every page of successful push runs on dev (100 per page, up to 100 pages), newest first. | The first run whose `security` job passed is A. The bootstrap base is used only when GitHub lists no such run at all; if 100 pages hold none, the job fails rather than falling back. |
| The `build` job still runs pushed code with the `GITHUB_TOKEN` it is given (`contents: read`). | It cannot deploy or tag. A hostile build can still upload a hostile artifact, which the `security` job then scans and vets, but a leak scan is a pattern check, not a proof. |
| A secret split or encoded in a way no pattern catches. | The leak scan is a set of shapes plus an entropy rule. Binary files are now scanned as latin1, so a key stored raw is caught, but an encoded or compressed one is not. |
| Signatures. | Out of scope here; they wait on a decision. |

## Tests
`scripts/test-ci-checks.mjs` makes throwaway git repositories and checks: no trailer fails; an orphan fails, even backdated; a merge of unrelated history fails; deleting the checker does not save an untrailered commit when the base's copy runs it; ancestors of the base are skipped; a symlink fails the leak scan; a binary file holding a private-key header fails. It also reads `pages.yml` without its comment lines, checks the controls above are present, and runs `bash -n` on every `run:` block. `scripts/release.sh` and the `build` job both run it, with `test-leak-scan.mjs`.

## Plainly

Until Dinis turns on branch protection for dev and `.github/workflows/`, the security job guards against mistakes, not against someone with push access: a pushed workflow can keep a job named `security` that does nothing, and once its run succeeds it becomes A (AppSec post-review, 19 Nov 2026, high, accepted as the known limit). The first push of this check also runs the base's older checkers (by design). The workflow tests check that the steps are present and parse with `bash -n`; the anchor pagination, diff-tree parsing and tar vetting were tested by hand on extracted steps, not by a fixture test yet (to do).
