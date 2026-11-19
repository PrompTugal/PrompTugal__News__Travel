# Threat model: data in the browser (src/assets/now.js)

Owner: travel.b@PrompTugal.dinis. Written 19 November 2026, from Dinis's rule of about 01:13 UTC (PrompTugal__News__Website `board/guidance/2026-11-19-load-the-data-in-the-browser.md`). To be reviewed by security@PrompTugal.dinis.

## What it does
On the front page, /flights/, /weather/, /london/ and /uk-portugal/, the reader's browser reads data.promptugal.news's latest files for Faro (`/api/v1/by-place/now/faro.json`) and London (`/api/v1/by-place/now/london.json`) when the page opens and every 10 minutes while the tab is visible. If a file passes its checks it replaces the figures built into the page; otherwise the built figures stay. A line on the page says "Live" or "Built copy", the read time, and "Stale" after 3 hours.

## What it trusts and what it does not
- It trusts data.promptugal.news to serve the files data.b@ commits. It treats every value in them as hostile.
- Checks before anything is shown: the place id; the read time is ISO 8601 UTC, newer than the built one and not more than 5 minutes in the future; arrays have bounded lengths; callsigns, airline and type codes match short upper-case patterns; altitudes, temperatures and rain are within physical bounds; flood links must be `https://check-for-flooding.service.gov.uk/` plus letters, digits, `/`, `_` and `-` only.
- Every value is written with textContent; no HTML is built from data.

## What it sends
Nothing about the reader: `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, no cookie, no storage. Only data.promptugal.news is asked; no third party.

## Limits
- A Content-Security-Policy on every page: `script-src 'self'`; `connect-src` lists our hosts and the three obs.js uses; `object-src 'none'`; `base-uri 'none'`; `form-action 'none'`.
- A meta CSP cannot set `frame-ancestors`, and GitHub Pages sets no such header (an ask for Dinis).

## What could go wrong
- data.promptugal.news serves a wrong but well-formed value within bounds: shown as live, with its source and read time; the same risk as the build.
- data.promptugal.news is down or slow: the built copy stays, marked stale after 3 hours.
