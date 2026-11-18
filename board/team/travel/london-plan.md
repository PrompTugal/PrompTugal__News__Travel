# London on travel.promptugal.news: the plan

> Dinis, 18 November 2026, about 22:20 UTC (PrompTugal__News__Website `board/guidance/2026-11-18-london.md`, relayed by conductor.b@PrompTugal.dinis): London is the first place beyond Portugal, shown as "Beyond Portugal: London". The sites add London as data.b@'s UK feeds land.

Written by travel.b@PrompTugal.dinis, 18 Nov 2026 ~22:25 UTC. This is a proposal, not yet built.

## State on 18 Nov ~22:20 UTC
- data.promptugal.news has no London data yet: `/api/v1/by-place/now/london.json` returned 404 and its `index.json` names no UK feed (read 18 Nov ~22:20 UTC).
- This repository reads data and never collects it (CLAUDE.md), so the London pages wait for data.b@'s feeds. Nothing is fetched from TfL or the airports from here.

## What the London section will be (when data lands)
1. `/london/` ("Beyond Portugal: London"): one page, free or metered as Dinis decides.
   - TfL line status and disruptions, from data.b@'s copy of TfL's Unified API, with "Powered by TfL Open Data" and the Open Government Licence attribution beside it.
   - Flights near Heathrow, Gatwick, Stansted, Luton, London City and Southend from adsb.lol (ODbL): airline flights by callsign, every other aircraft only counted, as at Faro.
   - Weather for visitors from Open-Meteo and, when Dinis registers, the Met Office DataHub. Dinis's own observations shown as "observed by a reader on the ground" once weather.b@ has the form.
2. A "Beyond Portugal" line on the front page and in the navigation.
3. The preview picture and `/api/v1/travel.json` get London figures.

## Stop assuming a place is Portuguese (code to change)
- `scripts/pull.mjs` line 61: reads only the Algarve's places. To read: Algarve places plus each place under the new country layer (ontologist@'s place, region, country).
- `scripts/build.mjs` `lisbon()` (line 45): every time is shown in Lisbon time. To change: each time in its place's own time zone (Europe/London for London), named.
- `algarveIds`, `municipalities`, `transport-algarve.json`, `events-algarve.json`: Algarve-only names; London gets its own lists.
- The licence register: TfL (OGL v2 with TfL's terms), Open-Meteo (CC BY 4.0), Met Office (OGL or its DataHub terms), checked on their own pages before use.
- Copy says "Portugal" and "the Algarve" in fixed places: front page, /about/, llms.txt.

## Waits on
- data.b@: the UK feeds, starting with TfL status and London weather.
- ontologist@: the country layer in places.json.
- Dinis: where "Beyond Portugal: London" sits, and whether London pages are metered.
