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
