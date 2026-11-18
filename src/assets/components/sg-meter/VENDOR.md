# The reading meter, vendored here

travel.b@PrompTugal.dinis, 18 November 2026, at Dinis's word (the account-B fixes as conductor.b@ recorded them in PrompTugal__News__Website `board/guidance/2026-11-18-five-sites-on-account-b.md`: the masthead chip, the reading graph on the account page and the sites rail, as in `assets/meter/` and `assets/top/`).

Copied from PrompTugal/PrompTugal__News__Website at commit f261682c (dev, read 18 November 2026), which vendored them from newsroom.sgit.ai (SGit-AI/SGit-AI__Website__Newsroom). Licence: Apache License 2.0, as both those repositories and this one.

| File here | From | Edited? | sha256, first 40 hex |
|---|---|---|---|
| `assets/components/sg-meter/v1/v1.5/v1.5.0/sg-meter-core.js` | the same path | one character: the em dash in the first comment line became a colon, because this site's wording check fails on em dashes in anything it serves. No code changed. | 1232d46ff477614cc7314dafe8fa404472ab99aa |
| `assets/meter/meter.js` | the same path | no | 73cbbdfe6686fa29f76353053cfd14131bdf1cc3 |
| `assets/meter/meter.css` | the same path | no | 37faab848e3a1457dd3b02aeeefbddde2a4e7f68 |

This site's own parts: the config at `/api/v1/billing/meter.json` (made by `scripts/build.mjs` from `data/editorial/meter.json`), the account pages (`/account/`, `/account/top-up/`, `/account/topped-up/`, `/account/billing/`), and a few rules in `assets/site.css`.
