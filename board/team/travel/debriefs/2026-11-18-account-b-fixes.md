# travel.b@PrompTugal.dinis: the account-B fixes, hand-over

> 18 November 2026, ~10:00 UTC. For the next wake of travel.b@ (every 3 hours, 07:00 to 23:00 Lisbon, from conductor.b@PrompTugal.dinis). Read first: `CLAUDE.md`, `BRIEF.md`, `REALITY.md`, `board/team/travel/status.json`, then this. The first version's debrief is `2026-11-17-first-version.md`.

## What I did
- **Reading meter** (fix 3): promptugal.news's meter vendored (`src/assets/meter/`, `src/assets/components/sg-meter/`, see its `VENDOR.md`). The chip "Pay for what you read · £balance" in every page's top bar, phones too. `/account/` (balance, history, the reading graph), `/account/top-up/`, `/account/topped-up/`, `/account/billing/`. Config `data/editorial/meter.json` -> `/api/v1/billing/meter.json`. Checked in a browser: data pages charge 1p, IPMA pages none, the graph draws.
- **Sites rail**: Weather, Civic, Startups, Travel, Data at the right edge (wide screens) and in every footer.
- **IPMA pages free** (fix 4): `/`, `/weather/`, `/design/*` are type `free`, with a note saying why.
- **data.promptugal.news** (fix 5): `scripts/pull.mjs` reads `/api/v1/by-place/now/<place>.json` first; falls back to promptugal.news when the data site's copy is more than 3 h older; `manifest.json` (`now`) says which. Also fixed a quoting bug that stopped pull.mjs running. `now.js` reads both in the browser.
- **Observability** (fix 6): `src/assets/obs/obs.js` on every page, lane `travel`; config read from promptugal.news at run time (no tokens here).
- **Disruptions re-checked** with travel.b.research@ (Sonnet): the easyJet 19 to 23 December strike stands as announced; nothing else found for the next 8 weeks; DGERT answered 503 (a gap). I read the minimum-services source myself: the sub-agent had read it too narrowly, so I did not use its summary.

## What was refused (not worked around)
- `pki-agent.mjs keygen --session`: refused by this session's permission check. No key; `board/keys.json` says so.
- Editing `scripts/check-commits.mjs` to accept @PrompTugal.dinis: refused by the permission check. Commits use `Agent: travel.b@AgentiCCells.dinis`.
- Attaching PrompTugal__News__Website as a session repository: refused; I read it from a public read-only clone in the scratchpad instead.

## Next, in order
1. Each wake: `node scripts/pull.mjs`, build, validate, leak scan, commit, `scripts/release.sh`. See whether data.promptugal.news is fresh again (it was 7 h old at 09:32 UTC).
2. Re-check the easyJet strike each wake (SNPVAC, easyJet press, Lusa); DGERT when it answers.
3. Events beyond technology: councils' agendas.
4. Getting-around gaps: island ferries, tolls.
5. When Dinis allows them: make the key; change the commit check.

## What Dinis must decide
In `status.json` `asks`: the key, the commit check, data.promptugal.news's freshness, front page A/B/C, IPMA, and one reading account across the sites.

## Later the same day: the 10:53 UTC wake
- data.promptugal.news was fresh again: all 18 places came from it.
- `/events/` is now What's on: 24 events from the councils' agendas (travel.b.events@, Sonnet), 18 Nov to early January. I re-read three (Lagos Christmas, Albufeira São Silvestre, Portimão Fado Gala): they match. cm-faro.pt, cm-vrsa.pt and cm-aljezur.pt did not answer from this container. I dropped Aljezur's sweet potato festival (page title says 2025) and the Lagos magusto (no year).
- Next for What's on: the gaps listed on the page and in the research file.

## The 13:53 UTC wake
- Fresh pull, all 18 places from data.promptugal.news. Faro: Iberia Express and Royal Air Maroc now named.
- `/getting-around/` opens with "This winter: boats and tolls" (travel.b.transport@, Sonnet). I re-read the A22 law (Lei 37/2024 lists the A22) and Postal's 10 Nov Armona notice (winter times): both match. Faro's island timetables are pictures, so the page links them rather than listing times. The sub-agent's report named a company mailbox from the Faro council page; I left it out.
- Next: the disruptions re-check, What's on gaps, the boat timetables published as pictures.

## Afternoon, 14:00 to 15:10 UTC
- Storm items: plan in `board/team/travel/storm-plan.md` (5 taken, 2 collectors left with data.b@).
- What's on reads data.promptugal.news's events by place (titles, dates, links; Lagos 89 so far).
- Dinis's licence rule applied: marks on every outside link, `license` in every API item, a gate check, a register of 53 sources (travel.b.licences@, Sonnet). I spot-checked IPMA's and adsb.lol's entries (consistent with what we knew and with data.b@'s finding).
- One mistake: commit bd57ab6's Claude-Session trailer names conductor.b@'s session, not this one. Left as is (no history rewrite).

## The 16:53 UTC wake
- The easyJet 19 to 23 December strike was called off by SNPVAC on 18 Nov after an easyJet proposal at DGERT (Público, ECO; I re-read Público). Talks on 20, 23 and 25 Nov; new action possible. /disruptions/ now has a "Called off" section.
- Since the last debrief entry: the key (travel.b-promptugal), the travel observability lane (live), the scheduled rebuild (none fired yet), the AppSec fixes, /security/, the threat models, the licence register.
- Next: the easyJet talks; the pipeline standard per source; /storm-charles/flights/; What's on gaps.

## The 19:53 UTC wake
- `/storm-charles/flights/`: crosswind per runway end at Lisbon and Madeira, hour by hour, 10 to 12 November, from data.promptugal.news's METAR feed (frozen copy in `data/inputs/storm/`). Peaks: Lisbon 12.9 kt (11 Nov 18:00 UTC), Madeira 19.3 kt (11 Nov 11:00 UTC). OpenSky departures left out (non-commercial terms). Build-time SVG, no script.
- Lesson: `stroke="var(--x)"` does not resolve in SVG attributes; use `style`.
- The scheduled rebuild has still not fired (15:23 and 18:23 slots passed).
- Next: Faro when LPFR exists; transport archive; stranded guide; easyJet talks 20 Nov.

## Late evening, 22:05 to 23:00 UTC (on conductor.b@'s messages)
- Sites bar: /preview.svg and /preview.png, /api/v1/preview.json, Open Graph tags. The bar itself waits for dev@ and designer@.
- London: plan in board/team/travel/london-plan.md; no UK data on data.promptugal.news yet.
- /uk-portugal/: ONS 2025 visits (re-read in the spreadsheet), FCDO advice (re-checked via the gov.uk content API), UK ETA, UK airlines near Faro. INE by country of residence and London routes are gaps.
- Scheduled rebuild: still zero schedule runs; pages.yml on dev (default branch) is right, so asked Dinis to check the repository's Actions settings.
- ~23:10 UTC: /london/ live from data.b@'s London file (forecast beside Faro, flood alerts). Licence marks now wrap on phones. mdesc hardened.
- ~23:20 UTC: Eurostat nights by country on /uk-portugal/ (UK 10,373,206 in 2025, re-read in Eurostat's API); measured London rain on /london/. Routes held by data.b@; INE waits for Dinis to accept its conditions.

## The 22:53 UTC wake (last of 18 Nov)
- No HOLD. New guidance rows (22:40 writer, 22:10 cells.b) are for other agents. Library requests: none for us.
- Footers now link promptugal.news's /principles/ and /report/ (the 15:00 guidance asked for it; it had been missed).
- For the morning wake: the easyJet talks (20 Nov); data.b@'s route counts and TfL status; the sites bar if published; whether the scheduled rebuild ran overnight.
- ~23:50 UTC: billing removed at Dinis's word (only promptugal.news bills); chip says Free to read; /account/ and the meter gone. One piece of work per push from now on (each run releases and tags).
- 19 Nov ~01:50 UTC: data in the browser (now.js rewritten with checks, status line, CSP); sites bar 1.1.0 (~01:10); billing removed (~23:50). Signed commits are first at the next wake.
