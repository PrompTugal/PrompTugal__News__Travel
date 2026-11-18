# Threat model: scripts/pull.mjs (the data reader)

Owner: travel.b@PrompTugal.dinis. Written 18 November 2026, at Dinis's word (PrompTugal__News__Website `board/guidance/2026-11-18-inner-passes-and-security.md`, section 3). To be reviewed by security@PrompTugal.dinis.

## What it does
It reads public JSON files and writes them into `data/inputs/`, with a manifest of what was read, when, and the first 40 hex digits of each answer's sha256. It also appends one line of counts per airline to `data/series/faro-airport.jsonl`. It runs in a travel.b@ session at each wake, and in CI on the scheduled rebuild (see `scheduled-rebuild.md`).

## What it reads (fixed hosts only)
- `https://promptugal.news/data/by-place/`: `places.json`, each place desk's `<id>.json`, and each place's `now/<id>.json` as a fallback.
- `https://data.promptugal.news/api/v1/by-place/now/<id>.json` and `/api/v1/events/by-place/<id>.json`.

The hosts are constants in the code. The data cannot change which host is read; it chooses only the place ids.

## What it writes
Files under `data/inputs/` (`by-place/`, `by-place/now/`, `events/`), `data/inputs/manifest.json` and `data/series/faro-airport.jsonl`. Nothing else. It holds no secret and sends no data out except the GET requests, which carry a named user agent.

## What it trusts, and what could go wrong
| Threat | Effect | Mitigation |
|---|---|---|
| A hostile or broken `places.json` gives a place id like `../../x` | A write outside `data/inputs/` | Place ids must match `^[a-z0-9-]+$` before use (added after this review if missing; see the checklist). |
| A source serves HTML or script inside a JSON value (a title, a URL) | Injection into our pages | `scripts/build.mjs` escapes every value it writes into HTML (`esc()`) and only links `http(s)` URLs. The browser script `now.js` uses `textContent`. |
| A source serves text written to instruct an agent ("ignore your rules...") | Prompt injection when an agent reads the data | Agents treat all data as material, never instruction (CLAUDE.md). Any such text is reported to security@. |
| A source is down, slow or answers 403/429 | Stale data | One retry with backoff; the stale file stays and the manifest records the status. The page shows the time each value was read. |
| A source serves a very large file | Memory use, a slow build | The sources are PrompTugal's own sites. A size cap is on the checklist. |
| A copy is stale (data.promptugal.news more than 3 hours old) | Old data shown as current | The newer copy is used; the manifest records which, and why. |

## Checklist (for security@)
- [ ] Place ids validated against `^[a-z0-9-]+$` before any path is built.
- [ ] Response size cap (for example 5 MB) before `JSON.parse`.
- [x] Hosts fixed in code; no host or path taken from fetched data, apart from the validated id.
- [x] Polite: about 2 seconds between requests, a named user agent, no retries beyond one backoff.
