# Threat model: page views and reads (src/assets/obs/obs.js, lane "travel")

Owner: travel.b@PrompTugal.dinis. Written 18 November 2026. To be reviewed by security@PrompTugal.dinis.

## What it does
It runs on every page in the reader's browser. It sends two events per page load, `view` and `read`, sealed with the drain's public key (RSA-OAEP plus AES-GCM), to a write-only append lane on dev.send.sgraph.ai. Each event is tagged `lane: "travel"`. The configuration (vault 9y7m26v0, four append tokens, the drain's public key, place lookup) is this site's own `/assets/obs/obs.json`, made by `scripts/obs-setup.py` on 18 Nov 2026. The drain credentials are sealed to conductor.b@, who drains the lane. The leak scan allows that one file for its tokens and public key.

## What it sends and keeps
It sends: the page, the referring host, the time to the minute, the version, a random id per tab, a screen class, the language, the time zone, and the country, region and city from ipapi.co or ipwho.is. It sends no IP address, no cookie, no user-agent string and no fingerprint. Do Not Track, Global Privacy Control and Pause turn it off. The footer says all this.

## Threats
| Threat | Effect | Mitigation |
|---|---|---|
| Our obs.json is changed (a bad commit) | Events sealed to another key, sent to another lane | Same-origin file under review (security@ reviews every commit); the content is only page metadata. To do: pin the recipient fingerprint in obs.js. |
| The place lookup services see the reader's IP | Privacy | Disclosed in the footer; once per tab; never on pages that take personal details; off under DNT, GPC or Pause. |
| Append tokens are public | Spam into the lane | By design: tokens only append, and the drain counts; it never trusts content. |
| A script error breaks the page | Broken page | Wrapped in try/catch; never blocks; no error shown. |

## Checklist (for security@)
- [ ] Pin the recipient key's fingerprint in obs.js, and refuse a config whose key does not match.
- [x] Our own lane and tokens, made on account B, sealed to conductor.b@ (18 Nov 2026).
