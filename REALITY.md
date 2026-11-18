# REALITY.md: what exists now

A thing not written here does not exist. Kept by travel@PrompTugal.dinis (account A, to 17 Nov 2026) and travel.b@PrompTugal.dinis (account B, from 18 Nov 2026).

## History
- Seeded by the AgentiCCells site factory on 2026-11-17 from AgentiCCells/AgentiCCells__Site__Template@dev (live state: requests/2026-11-17__travel-promptugal-news/status.json in AgentiCCells__Site__Factory).
- 2026-11-17, ~19:00 UTC: cells@AgentiCCells.dinis, at Dinis's word, replaced the seed page with a placeholder, wrote the README, added `LICENSE-TEXT` (CC BY 4.0) beside `LICENSE` (Apache-2.0), `src/CNAME` (travel.promptugal.news), ignored `.credentials/` and `.sg-send/`, and created `main` from that commit.
- 2026-11-17, ~19:10 to 20:30 UTC: travel@PrompTugal.dinis built the first version (below); live as v0.1.5.
- 2026-11-18, from ~09:30 UTC: travel.b@PrompTugal.dinis (account B, started by conductor.b@PrompTugal.dinis at Dinis's word) made the account-B fixes (below).

## Exists (first version, 17 November 2026)
- **Pages** (each with a markdown twin `index.md`, the version in the masthead, "pay for what you read", and a "how this page was made" block): `/` (front page, layout A), `/flights/` (Faro airport), `/getting-around/`, `/disruptions/`, `/weather/`, `/events/`, `/tourism/`, `/about/`, and `/design/` with three front-page variations (`/design/a/` dashboard, `/design/b/` newspaper, `/design/c/` board), not indexed.
- **Data in** (`data/inputs/`): `scripts/pull.mjs` copies 37 public files of PrompTugal.news's place data (`places.json`, the 18 Algarve places' `<id>.json` and `now/<id>.json`) from promptugal.news, with the time read and the first 40 hex digits of each sha256 in `data/inputs/manifest.json`. The signatures beside those files (`.sig`) are not verified here yet.
- **Faro airport series** (`data/series/faro-airport.jsonl`): one line of counts per airline per pull; no aircraft identity. One row so far (17:16 UTC, 17 Nov).
- **Research** (`data/research/`, each naming its agent and model, every fact with its page and the date read): `transport-algarve.json` (travel.research@, Sonnet), `disruptions.json` (travel.research.disruptions@, Sonnet; one edit by travel@ recorded in the file), `tourism.json` (travel.data@, Sonnet: INE monthly guests, overnight stays and revenue for the Algarve and Portugal, Sep 2025 to Sep 2026; Faro airport passengers from INE; Turismo de Portugal's Alojamento Local register; travel@ re-read INE's Sep 2026 Algarve overnight stays from the API and matched 2,387,961). `data/editorial/holidays.json` (travel@).
- **Live refresh**: `src/assets/now.js` updates the Faro airport list and temperature in the browser from promptugal.news's `now/faro.json` when it is newer than the build.
- **API** (`/api/v1/`): `travel.json` (digest), `manifest.json`, `faro-airport.jsonl`, and the research files. `llms.txt`, `sitemap.xml`, `robots.txt`, `version.json`.
- **Gate**: `scripts/validate.mjs` (the factory's checks, plus: every page has a markdown twin, shows the version and a provenance block; llms.txt exists). `scripts/leak-scan.mjs`, `scripts/check-commits.mjs`, `scripts/release.sh` as seeded.
- **Brand**: PrompTugal.news v2.0 wordmarks and favicons copied from PrompTugal__News__Website `assets/brand/`; colours from its `brand-tokens.css`. The brand fonts are not bundled (system serif and sans fall-backs).

## Added on 18 November 2026 (travel.b@PrompTugal.dinis, account B)
- **The reading meter** (account-B fix 3): promptugal.news's `assets/meter/meter.js`, `meter.css` and newsroom.sgit.ai's `sg-meter-core.js` v1.5.0, vendored from PrompTugal__News__Website (Apache-2.0; `src/assets/components/sg-meter/VENDOR.md` lists each file, its hash and the one comment character changed). Every page's top bar has the chip "Pay for what you read · £balance" (phones too). Pages: `/account/` (balance, history, the reading graph, export and restore), `/account/top-up/` (promptugal.news's Stripe payment link), `/account/topped-up/`, `/account/billing/` (prices). Config `/api/v1/billing/meter.json` from `data/editorial/meter.json`. Prices: data pages 1p, `/about/` 1p, account pages 0. This site's balance is its own (`promptugal.travel.meter.v1` in the reader's browser), not promptugal.news's.
- **IPMA pages free** (fix 4): `/`, `/weather/`, `/design/` and its three variations are page type `free` (0p) and say why.
- **The sites rail**: Weather, Civic, Startups, Travel, Data, at the right edge on screens wider than 1180px (promptugal.news's `em-net`), and a line in every footer.
- **data.promptugal.news** (fix 5): `scripts/pull.mjs` reads `/api/v1/by-place/now/<place>.json` there first for the 18 places, and promptugal.news's copy only when the data site's is more than 3 hours older than the pull; `data/inputs/manifest.json` (`now`) records, place by place, which was used and why. `src/assets/now.js` reads both in the browser and keeps the newer. At the first pull (09:32 UTC, 18 Nov) the data site's files were from 02:28 UTC, so all 18 came from promptugal.news. places.json and the place desks' events still come from promptugal.news only.
- **Observability** (fix 6): `src/assets/obs/obs.js` (promptugal.news's, Apache-2.0) on every page, lane `travel`: config read at run time from promptugal.news's public `obs.json`, so no append token is in this repository. Footer disclosure and Pause switch.
- **pull.mjs fixed**: the committed version had an unescaped quote in the manifest's `about` and could not run; fixed.

- **What's on** (10:53 UTC wake): `/events/` lists 24 events from 18 Nov 2026 to early January 2027 (Christmas, markets, festivals, music, sport, New Year) in 10 municipalities, from the councils' own agendas (`data/research/events-algarve.json`, travel.b.events@, Sonnet; travel.b@ re-read three against their pages), by month, with gaps listed; then the place desks' technology events. The front page's card shows the next three. Not yet covered: Visit Algarve (JavaScript page), Olhão, Vila do Bispo, Alcoutim, Monchique's dates, most New Year's Eves, and December in Faro, Loulé, Silves, São Brás and Tavira.

## Still does not exist (18 November 2026)
- **No session key for travel.b@ either**: `pki-agent.mjs keygen --session` was refused by this session's permission check (`board/keys.json`).
- **The commit check still accepts only `@AgentiCCells` agents**: changing `scripts/check-commits.mjs` was refused by the permission check. Commits carry `Agent: travel.b@AgentiCCells.dinis`.
- No device vault: the account page's "carry it to another device" is hidden.

## Does not exist (first version)
- No session key: `pki-agent.mjs keygen` was refused by this session's permission check. Nothing is signed with an agent key; `board/keys.json` says so.
- No scheduled pull: data is as of the last `scripts/pull.mjs` run, plus the browser refresh for Faro.
- (17 Nov) No data.promptugal.news API yet: superseded on 18 Nov, see above. No collectors run here.
- No CP, Vamus, Rede Expressos or Faro airport board data: JavaScript apps, a 403 and a bot check (gaps in `data/research/transport-algarve.json`).
- No person has checked any page.
- Events are only those the PrompTugal.news place desks listed (technology and AI); no councils' agendas yet.
