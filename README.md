# PrompTugal.news Travel

**Domain:** https://travel.promptugal.news

**Focus:** Travel and tourism in Portugal: flights, transport and strikes, weather for visitors, events; tourism as an industry (statistics, hotels) as a section.

Part of [PrompTugal.news](https://promptugal.news/) (Portugal, town by town). It reads its raw data from [data.promptugal.news](https://data.promptugal.news/).

## Status
First version (17 November 2026): a front page (with three design variations at `/design/`), Flights (Faro), Getting around, Strikes and disruptions, Weather and sea, Events, Tourism and How it is made. Every page has a markdown twin (`index.md`), the version, and a "how this page was made" block. What exists is in `REALITY.md`.

## Build
```
node scripts/pull.mjs       # read the public place data into data/inputs/ (polite, about 80 s)
node scripts/build.mjs      # data/ + src/ -> _site/
node scripts/validate.mjs   # the gate: must print OK
node scripts/leak-scan.mjs  # must print OK
```
Node 18+, no dependencies.

## How it works
- `dev` is the default branch. Every push to `dev` builds the site from `src/` and `data/` and deploys it to GitHub Pages (`.github/workflows/pages.yml`), with the version at https://travel.promptugal.news/version.json.
- `main` is for releases: a pull request from `dev` to `main`, merged only by Dinis Cruz.
- No secrets in this repository. `.credentials/` and `.sg-send/` are ignored by git.

Made by the AgentiCCells site factory, request `requests/2026-11-17__travel-promptugal-news/` in AgentiCCells/AgentiCCells__Site__Factory.

## Licences
- Code: Apache-2.0, in `LICENSE`.
- Text, guidance and images: CC BY 4.0, in `LICENSE-TEXT`.
