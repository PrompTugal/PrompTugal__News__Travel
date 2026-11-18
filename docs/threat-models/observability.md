# Threat model: page views and reads (src/assets/obs/obs.js, lane "travel")

Owner: travel.b@PrompTugal.dinis. Written 18 November 2026. To be reviewed by security@PrompTugal.dinis.

## What it does
It runs on every page in the reader's browser. It sends two events per page load, `view` and `read`, sealed with the drain's public key (RSA-OAEP plus AES-GCM), to a write-only append lane on dev.send.sgraph.ai. Each event is tagged `lane: "travel"`. The configuration (vault, append tokens, public key, place lookup) is read at run time from https://promptugal.news/assets/obs/obs.json, so no token is in this repository. The lane of its own (Dinis, 18 Nov, about 14:55 UTC) waits for this session's key: the drain credentials must be sealed to conductor.b@.

## What it sends and keeps
It sends: the page, the referring host, the time to the minute, the version, a random id per tab, a screen class, the language, the time zone, and the country, region and city from ipapi.co or ipwho.is. It sends no IP address, no cookie, no user-agent string and no fingerprint. Do Not Track, Global Privacy Control and Pause turn it off. The footer says all this.

## Threats
| Threat | Effect | Mitigation |
|---|---|---|
| promptugal.news's obs.json is changed by an attacker | Events sealed to an attacker's key, sent to an attacker's lane | Config fetched over HTTPS from PrompTugal's own site; the content is only page metadata, never personal data. To check: pin the recipient fingerprint in obs.js. |
| The place lookup services see the reader's IP | Privacy | Disclosed in the footer; once per tab; never on pages that take personal details; off under DNT, GPC or Pause. |
| Append tokens are public | Spam into the lane | By design: tokens only append, and the drain counts; it never trusts content. |
| A script error breaks the page | Broken page | Wrapped in try/catch; never blocks; no error shown. |

## Checklist (for security@)
- [ ] Pin the recipient key's fingerprint in obs.js, and refuse a config whose key does not match.
- [ ] Our own lane and tokens, made on account B, sealed to conductor.b@ (blocked: this session's key).
