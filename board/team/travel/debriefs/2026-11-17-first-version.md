# travel@PrompTugal.dinis: first version, hand-over

> 17 November 2026, ~20:30 UTC. For the next session of travel@ (on another account, on a schedule). Read first: `CLAUDE.md`, `BRIEF.md`, `REALITY.md`, then this.

## What exists
- **https://travel.promptugal.news** is live over HTTPS from `dev` (GitHub Pages; CI numbers the release `v0.1.N` and tags it). Pages: `/` (front, layout A), `/flights/`, `/getting-around/`, `/disruptions/`, `/weather/`, `/events/`, `/tourism/`, `/about/`, `/design/` (A, B, C side by side). Each has a markdown twin, the version, "pay for what you read" and a "how this page was made" block. Also `/api/v1/` (digest, manifest, Faro series, research files), `llms.txt`, `sitemap.xml`.
- **Build**: `scripts/pull.mjs` (reads 37 public files of PrompTugal.news place data from promptugal.news, 2 s apart, about 80 s), `scripts/build.mjs` (all pages from `data/`), `scripts/validate.mjs` (the gate, with checks added for twins, the version and provenance), `scripts/leak-scan.mjs`, `scripts/release.sh`. Node 18+, no dependencies.
- **Research** (Sonnet sub-agents, files in `data/research/` name their agent and model): transport operators and gaps; strikes and disruptions (easyJet cabin crew strike 19 to 23 December is the main item ahead); tourism statistics from INE.
- **Browser refresh**: `src/assets/now.js` updates the Faro airport list and temperature from promptugal.news when newer than the build.

## What is next, in order
1. **A scheduled pull**: each wake, `node scripts/pull.mjs`, build, gate, commit `data/inputs/` and `data/series/faro-airport.jsonl`, `scripts/release.sh`. The Faro series then becomes the airport's day, hour by hour.
2. **Switch to data.promptugal.news** source by source as data@ publishes APIs (on 17 Nov it was a placeholder). Change `BASE` in `scripts/pull.mjs` and the manifest's `source`.
3. **Verify the place data's signatures** (`<file>.sig`) in `pull.mjs` once a session can run the pki tool.
4. **Events beyond technology**: the councils' own agendas (cm-faro.pt, cm-loule.pt and others) for festivals, markets and sport; the place desks' events are mostly AI.
5. **Disruptions, re-checked each wake**: the easyJet December strike (deal or call-off?), union and operator pages read directly (CP, SNPVAC, SPAC, SITAVA, STRUP), DGERT's notices. Mark each status change with its source.
6. **Getting around gaps**: Faro and Olhão councils' island ferry pages (connection reset, 503), Portal das Portagens (502). Ask Data whether any operator offers a feed.
7. **Design**: apply Dinis's choice from `/design/`; bundle the brand fonts if wanted.

## What blocks me (for Dinis)
- **Session key**: running `pki-agent.mjs keygen --session` (downloaded from pki.sgit.ai) was refused by this session's permission check, so nothing is signed with an agent key and `board/keys.json` says "not made". Allow it in the next session's environment, or make the key there.
- **Agent trailer**: the brief names the agent `travel@PrompTugal.dinis`, but the seeded `scripts/check-commits.mjs` accepts only `role@agenticcells.<x>`. Commits use subject `travel@PrompTugal.dinis: ...` and trailer `Agent: travel@AgentiCCells.dinis`. I did not change the check. The other four sites will meet the same.
- **Operators that refuse automated readers**: aeroportofaro.pt (Incapsula bot check), Rede Expressos (403); cp.pt, vamusalgarve.pt and Próximo are JavaScript apps. ANA, CP and IP's terms ask consent to reproduce content. Feeds or permission are a question for a person.

## What Dinis must decide
1. The front page: A (dashboard), B (newspaper) or C (board), at https://travel.promptugal.news/design/.
2. Whether `scripts/check-commits.mjs` should also accept `@promptugal.dinis` agent names.
3. Whether to ask ANA, CP or Vamus for a feed or permission.

## What I learnt
- The leak scan flags hex longer than 40 characters and session ids: the manifest keeps the first 40 hex digits of each sha256, and session ids stay out of files.
- promptugal.news serves the place data with `access-control-allow-origin: *`, so pages can refresh in the browser without a server.
- The place data's `now/<id>.json` carries IPMA's warnings, station, forecast, sea, UV and fire risk for every Algarve place, and the Faro airport block for Faro, Loulé, Olhão and the Algarve.
- The sub-agents reported honestly where pages failed. One research date (the EES "end") was the end of the search window and was changed to "ongoing"; check dates the sub-agents give.

## Where things live
- Brief and rules: `BRIEF.md`, `CLAUDE.md`. Truth: `REALITY.md`. Keys: `board/keys.json`.
- Inputs: `data/inputs/` (+ `manifest.json`). Series: `data/series/`. Research: `data/research/`. Editorial: `data/editorial/`.
- Shared brief for the five sites: `board/briefs/2026-11-17-the-five-sites.md` in PrompTugal/PrompTugal__News__Website.
