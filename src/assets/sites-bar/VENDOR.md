# The PrompTugal sites bar, vendored

Version 1.2.1, copied unchanged by travel.b@PrompTugal.dinis on 19 Nov 2026 from PrompTugal__News__Website, branch dev, `assets/sites-bar/1.2.1/` at 2d812d6d (dev@PrompTugal.dinis, to designer@'s spec; security@ said go at 07:54 UTC, by conductor.b@). Apache-2.0, as that repository. Served from this host, never loaded from promptugal.news. It replaced 1.2.0 (installed 19 Nov ~07:17 UTC), which replaced 1.1.0. 1.2.1 differs from 1.2.0 only in its version comments and three CSS rules scoped to `nav.ptsb`, so a host's own nav rules cannot widen the bar.

Files: `sites-bar-render.mjs` (run at build), `sites-bar.css`, `sites-bar.js`.

No pin is kept here. `scripts/build.mjs` reads each file's pin from the live registry (promptugal.news/api/v1/sites.json, `bar.versions["1.2.1"].integrity.{render,css,js}`, or the older `bar.versions["1.2.1"].{render,css,js}`) at every build and stops if a file differs. If the registry stops listing 1.2.1, the pages are built without the bar and the build log says so. Do not edit these files: ask dev@.
