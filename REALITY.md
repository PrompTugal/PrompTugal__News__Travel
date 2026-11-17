# REALITY.md: what exists now

A thing not written here does not exist. Kept by travel@PrompTugal.dinis.

## History
- Seeded by the AgentiCCells site factory on 2026-11-17 from AgentiCCells/AgentiCCells__Site__Template@dev (live state: requests/2026-11-17__travel-promptugal-news/status.json in AgentiCCells__Site__Factory).
- 2026-11-17, ~19:00 UTC: cells@AgentiCCells.dinis, at Dinis's word, replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), `src/CNAME` (travel.promptugal.news), ignored `.credentials/` and `.sg-send/`, and created `main` from that commit.
- 2026-11-17, ~19:10 to 20:30 UTC: travel@PrompTugal.dinis built the first version (below).

## Exists (first version, 17 November 2026)
- **Pages** (each with a markdown twin `index.md`, the version in the masthead, "pay for what you read", and a "how this page was made" block): `/` (front page, layout A), `/flights/` (Faro airport), `/getting-around/`, `/disruptions/`, `/weather/`, `/events/`, `/tourism/`, `/about/`, and `/design/` with three front-page variations (`/design/a/` dashboard, `/design/b/` newspaper, `/design/c/` board), not indexed.
- **Data in** (`data/inputs/`): `scripts/pull.mjs` copies 37 public files of PrompTugal.news's place data (`places.json`, the 18 Algarve places' `<id>.json` and `now/<id>.json`) from promptugal.news, with the time read and the first 40 hex digits of each sha256 in `data/inputs/manifest.json`. The signatures beside those files (`.sig`) are not verified here yet.
- **Faro airport series** (`data/series/faro-airport.jsonl`): one line of counts per airline per pull; no aircraft identity. One row so far (17:16 UTC, 17 Nov).
- **Research** (`data/research/`, each naming its agent and model, every fact with its page and the date read): `transport-algarve.json` (travel.research@, Sonnet), `disruptions.json` (travel.research.disruptions@, Sonnet; one edit by travel@ recorded in the file), `tourism.json` (travel.data@, Sonnet) when present. `data/editorial/holidays.json` (travel@).
- **Live refresh**: `src/assets/now.js` updates the Faro airport list and temperature in the browser from promptugal.news's `now/faro.json` when it is newer than the build.
- **API** (`/api/v1/`): `travel.json` (digest), `manifest.json`, `faro-airport.jsonl`, and the research files. `llms.txt`, `sitemap.xml`, `robots.txt`, `version.json`.
- **Gate**: `scripts/validate.mjs` (the factory's checks, plus: every page has a markdown twin, shows the version and a provenance block; llms.txt exists). `scripts/leak-scan.mjs`, `scripts/check-commits.mjs`, `scripts/release.sh` as seeded.
- **Brand**: PrompTugal.news v2.0 wordmarks and favicons copied from PrompTugal__News__Website `assets/brand/`; colours from its `brand-tokens.css`. The brand fonts are not bundled (system serif and sans fall-backs).

## Does not exist
- No session key: `pki-agent.mjs keygen` was refused by this session's permission check. Nothing is signed with an agent key; `board/keys.json` says so.
- No scheduled pull: data is as of the last `scripts/pull.mjs` run, plus the browser refresh for Faro.
- No data.promptugal.news API yet (checked 17 Nov, ~19:15 UTC: only a placeholder page). No collectors run here.
- No CP, Vamus, Rede Expressos or Faro airport board data: JavaScript apps, a 403 and a bot check (gaps in `data/research/transport-algarve.json`).
- No person has checked any page.
- Events are only those the PrompTugal.news place desks listed (technology and AI); no councils' agendas yet.
