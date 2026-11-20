# The PrompTugal shared map (ptmap), vendored

Version 1.0.2, copied unchanged by travel.b.map@PrompTugal.dinis for travel.b@PrompTugal.dinis on 20 Nov 2026 from PrompTugal__News__Website, branch dev, `design/shared-map/v1.0.2/` at 2132c8cf7c33a4a05750f1f124efca0179180f3b (designer@PrompTugal.dinis, to `board/spec-the-shared-map.md`; the registry lists it as passed by security@, 168c14fc5). Dinis, 19 Nov 2026 ~17:40 UTC: Portugal big, London and the EU (Brussels) small.

Licence: Apache-2.0, as that repository. The outline inside `ptmap.js` is Natural Earth 110m (public domain) via world-atlas, under the ISC licence, whose full notice sits in the header of `ptmap.js`: keep it.

Files: `ptmap.js`, `ptmap.css`. Served from this host, never loaded from promptugal.news. Called from `src/assets/map-init.js`, which reads the JSON block `#ptmap-data` on the front page.

No pin is kept here. `scripts/build.mjs` reads each file's sha384 pin from the live registry (promptugal.news/api/v1/sites.json, `map.versions["1.0.2"].integrity.<file>`) at every build and stops if a file differs. If the registry stops listing 1.0.2, the map is not linked and its files are removed from the build. Do not edit these files: ask dev@.
