# travel.b@PrompTugal.dinis: 19 November, hand-over

> 19 November 2026, written at about 08:01 UTC. For the next wake of travel.b@. Read first: `CLAUDE.md`, `BRIEF.md`, `REALITY.md` and `board/team/travel/status.json`, then this. The last debrief is `2026-11-18-account-b-fixes.md`.

## What I did (19 Nov, from about 01:00 UTC)
- **Data in the browser** (Dinis, ~01:13 UTC): `src/assets/now.js` reads the Faro and London files from data.promptugal.news, checks each one, and says Live, Built copy or Stale on the page. Every page has a CSP. The 3-hourly GitHub schedule is gone, because every run starts from a commit (Dinis, ~01:20 UTC).
- **No IP lookup** (Dinis, ~03:15 UTC): obs.js takes the country from the browser's time zone, using the shared tz-country table 1.1.0. Old place fields are stripped from queued events.
- **Sites bar 1.2.0, then 1.2.1** (security@'s go at 07:54 UTC): pins are read from the live registry in both of its shapes, and no pin is kept here. Our own nav CSS is scoped off the bar. Every table now sits in a box that scrolls on its own. All 16 pages measure 375 px at a 375 px viewport.
- **Leak scan**: SSH public key lines outside team/keys are flagged, with tests in `scripts/test-leak-scan.mjs`.
- **Predictions**: `data/predictions/predictions.jsonl` (the easyJet strike: missed), imported by the library as PRED 2026/0002.
- **Show the past** (Dinis, ~01:17 UTC): /london/ draws rain measured beside what we said the day before, with the forecast ahead, to designer@'s PF1 to PF9 (travel.b.charts@, Sonnet). There is no track record yet: the first complete day with a kept forecast is 20 Nov at the earliest.
- Releases today include 226bf95 (bar 1.2.0), 3d9eb58 (registry shapes, 375 px), 2612c3c (London chart) and e339e60 (bar 1.2.1).

## Refused, not worked around
- A leak-scan exemption for an SSH public key in team/keys.json was refused by the permission check. It is an ask for Dinis, and signed commits wait on it.

## Next, in order
1. Refresh the London chart in the browser (now.js reads the history file and redraws, under the same checks).
2. Faro's past from data.b@'s IPMA history: on a free page only, never on promptugal.news.
3. Signed commits, once the exemption is decided. The plan is in status.json.
4. Show the licence of each loaded file next to the live figures.
5. data.b@'s feeds as they land: TfL, London routes, INE UK guests.
6. Watch the easyJet talks (20, 23 and 25 Nov).

## What Dinis must decide
See `status.json` `asks`: the SSH key exemption, INE's conditions, the commit check accepting @PrompTugal.dinis, front page A, B or C, council events as titles and links, the tagline, and where "Beyond Portugal" sits.

## A slip to remember
I wrote "~08:05 UTC" for the 1.2.1 release before 08:05; the clock said 08:00:51. It is corrected to ~08:01. Take every time from `date -u`.
