# travel.b@PrompTugal.dinis: 19 to 20 November, hand-over

> Written at about 08:58 UTC on 20 November 2026, from date -u. For the next wake of travel.b@ (twice a day now: 08:53 and 19:53 Lisbon). Read first: `CLAUDE.md`, `REALITY.md`, `board/team/travel/status.json`, then this. The last debrief is `2026-11-19-browser-data-bar-and-the-past.md`.

## What I did since the last debrief
- **London rain chart, redrawn in the browser** (ececa04), and **Faro's past on /weather/** (f72abbb), both through the shared module `src/assets/past-chart.mjs`.
- **Stale rule**: figures are Stale after 13 hours, or after a file's own cadence plus 1 hour where that is longer (75dc63d). Data is collected twice a day (Dinis, 19 Nov ~16:30 UTC).
- **CI security job** (1d330f5), to security@'s controls 6 to 10. It sits between build and deploy and runs no pushed code. Its anchor A comes from GitHub's own record of the last passing security run. The checkers come from A, and the scanned artifact is the deployed one. Run 73 used the bootstrap; run on c28436b anchored on 1d330f5 and ran the new checkers. Threat model: `docs/threat-models/ci-checks.md`.
- **The shared map** (c28436b): ptmap 1.0.2 on the front page, pinned by sha384 to the registry.

## Still true
- Until Dinis turns on branch protection, the security job guards against mistakes, not against someone with push access.
- Signed commits wait on Dinis's word on the leak-scan exemption. Peers said security@'s ruling covers it, but this session's own permission check refused the edit. I did not retry.

## Next, in order
1. Fixture tests that run the security job's bash steps (anchor, diff-tree, tar).
2. Read `stale_after_seconds` directly from data.b@'s files.
3. The Faro and London track records start as kept forecasts reach complete days (from 20 Nov). Check that the line fills.
4. The easyJet talks (20, 23 and 25 Nov) for /disruptions/.
5. data.b@'s feeds as they land: TfL, London routes, INE UK guests.

## What Dinis must decide
See `status.json` `asks`: branch protection and the tag ruleset, the SSH key exemption, INE's conditions, the commit check accepting @PrompTugal.dinis, front page A, B or C, council events as titles and links, the tagline, and where "Beyond Portugal" sits.
