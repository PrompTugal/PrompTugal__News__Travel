# The Storm site's travel items: travel.b@'s plan

travel.b@PrompTugal.dinis, 18 November 2026, ~14:40 UTC. These are proposals, not yet built.

## Background
- Dinis, 18 Nov, 08:50 UTC, as conductor.b@ relayed it: lose nothing from the Storm site.
- conductor.b@ passed on data.b@'s list in PrompTugal__News__Data `board/team/data/storm-handoff.md` (commit d0ecfa6), which gives travel 7 items. data.b@ calls them "proposals from the map, not decisions: each team decides what it takes".
- The data is served at https://data.promptugal.news/api/v1/storm/charles/index.json. I checked it on 18 Nov 2026: 151 files, 110 of them matching flights, transport, guide or crosswind. Its OpenAPI is at /api/v1/storm/openapi.json.

## What travel takes, and how
| Item (data.b@'s list) | Decision | How |
|---|---|---|
| Flights and the wind (page) | Take | A page `/storm-charles/flights/`: the two maps (Lisbon, Madeira), crosswind per runway end, departures against ANA cancellations. Read from data.promptugal.news; reuse data.b@'s `src/assets/viz/flightmap.js` and `wind.js` if their licence and size fit (Apache-2.0, same estate). |
| Crosswind by runway end and departures against cancellations (chart) | Take, with the page above | Reads `crosswind.json` and `movements.json` from the data site. |
| Transport (page: flights, metro, buses, ferries, trains, bridges, coaches, taxis) | Take as an archive page | `/storm-charles/transport/`: what ran and what stopped on 10 to 12 Nov, by mode. It stays marked as an archived event, not as live service. |
| Transport page: counts per mode, schedule, bridges (chart) | Take, with the page above | Port `transport.js` (17 KB, no libraries) after reading it. |
| Guide for readers: Lisbon, media, stranded | Take, rewritten | `/guides/stranded/`: what to do when a storm or strike stops your flight or train (rights, operators' pages). A lasting guide, not a Storm page. Keep the Storm version as an archived link. |
| METAR crosswind and runways (collector) | Leave with data.b@ | This repository runs no collectors (BRIEF.md). Ask data.b@ for a live `/api/v1/` feed for Faro's runways (LPFR) from METAR: crosswind on today's Faro page would be new and useful. |
| Open transport reader (collector) | Leave with data.b@ | The same reason. OpenSky stays paused under its terms. Ask data.b@ whether ANA cancellations and adsb.lol departures can be published per airport for Faro. |

## Order
1. `/storm-charles/` as an archive section: the flights and wind page first (the most visual), then transport.
2. The stranded guide.
3. With data.b@: Faro METAR crosswind, and What's on reading `/api/v1/events/by-place/<place>.json`. On 18 Nov at 14:35 UTC that endpoint answered 404; I will switch when it answers.
