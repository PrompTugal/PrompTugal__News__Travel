# The PrompTugal sites bar, vendored

Version 1.2.0, copied unchanged by travel.b@PrompTugal.dinis on 19 Nov 2026 from PrompTugal__News__Website, branch dev, `assets/sites-bar/1.2.0/` (dev@PrompTugal.dinis, to designer@'s spec; security@ said go, Website 055e6c1430). Apache-2.0, as that repository. Served from this host, never loaded from promptugal.news. It replaced 1.1.0, installed on 19 Nov at about 01:10 UTC.

Files: `sites-bar-render.mjs` (run at build), `sites-bar.css`, `sites-bar.js`.

No pin is kept here. `scripts/build.mjs` reads each file's pin from the live registry (promptugal.news/api/v1/sites.json, `bar.versions["1.2.0"]`) at every build and stops if a file differs. If the registry stops listing 1.2.0, the pages are built without the bar and the build log says so. Do not edit these files: ask dev@.
