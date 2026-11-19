// Build: src/ (static files) + data/ (inputs and research) -> _site/ pages, markdown twins,
// llms.txt, sitemap.xml, version.json and the site's own JSON at /api/v1/.
// travel@PrompTugal.dinis, 17 November 2026, from the factory's copy-and-stamp build.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev". Node 18+, no dependencies.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const version = process.env.SITE_VERSION || 'dev';
const SITE = 'https://travel.promptugal.news';
const built = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
rmSync('_site', { recursive: true, force: true });
cpSync('src', '_site', { recursive: true });

// ---------- data ----------
const J = p => JSON.parse(readFileSync(p, 'utf8'));
const maybe = p => (existsSync(p) ? J(p) : null);
const IN = 'data/inputs/by-place';
const manifest = maybe('data/inputs/manifest.json') || { reads: [], read_at: null };
const placesList = J(join(IN, 'places.json')).places;
const algarveIds = manifest.places && manifest.places.length ? manifest.places : placesList.filter(p => p.parent === 'algarve').map(p => p.id);
const placeName = id => (placesList.find(p => p.id === id) || {}).name || id;
const now = Object.fromEntries(algarveIds.filter(id => existsSync(join(IN, 'now', id + '.json'))).map(id => [id, J(join(IN, 'now', id + '.json'))]));
const desk = Object.fromEntries(algarveIds.filter(id => existsSync(join(IN, id + '.json'))).map(id => [id, J(join(IN, id + '.json'))]));
const research = {
  transport: maybe('data/research/transport-algarve.json'),
  disruptions: maybe('data/research/disruptions.json'),
  tourism: maybe('data/research/tourism.json'),
  events: maybe('data/research/events-algarve.json'),
};
const holidays = maybe('data/editorial/holidays.json');
const series = existsSync('data/series/faro-airport.jsonl') ? readFileSync('data/series/faro-airport.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const faro = now.faro || {};
const airport = faro.airport || (now.algarve || {}).airport || null;
const municipalities = algarveIds.filter(id => id !== 'algarve' && now[id]);

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mdesc = s => String(s ?? '').replace(/[\r\n\u0000-\u001f]+/g, ' ').replace(/([|\[\]<>*_`])/g, '\\$1');
const nodash = s => String(s ?? '').replace(/—/g, ',').replace(/–/g, '-');
const lisbon = (iso, withDate = true) => {
  if (!iso) return 'not known';
  const d = new Date(/Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  if (isNaN(d)) return iso;
  const o = withDate ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'Europe/Lisbon' }).format(d) + ' Lisbon';
};
const day = iso => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d); };
const longDay = iso => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d); };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
// Only http(s), site-relative, fragment and mailto addresses become links (security post-review, 18 Nov 2026: a data URL
// such as javascript: must never reach an href); anything else is shown as text.
const safeUrl = u => typeof u === 'string' && /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(u.trim());
const a = (url, text) => (url && safeUrl(url) ? `<a href="${esc(url)}">${esc(text ?? host(url))}</a>` : esc(text ?? ''));
const ml = (url, text) => (url && safeUrl(url) ? `[${mdesc(text ?? host(url))}](${String(url).replace(/[\s()]/g, encodeURIComponent)})` : mdesc(text ?? ''));
const today = built.slice(0, 10);
const firstSentence = s => { const m = String(s || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : s; };

// IPMA's weather types (https://api.ipma.pt/open-data/weather-type-classe.json), in English.
const WT = { 0: 'no information', 1: 'clear sky', 2: 'partly cloudy', 3: 'sunny intervals', 4: 'cloudy', 5: 'cloudy (high cloud)', 6: 'showers', 7: 'light showers', 8: 'heavy showers', 9: 'rain or showers', 10: 'light rain', 11: 'heavy rain', 12: 'intermittent rain', 13: 'intermittent light rain', 14: 'intermittent heavy rain', 15: 'drizzle', 16: 'mist', 17: 'fog', 18: 'snow', 19: 'thunderstorms', 20: 'showers and thunderstorms', 21: 'hail', 22: 'frost', 23: 'rain and thunderstorms', 24: 'convective clouds', 25: 'partly cloudy', 26: 'fog', 27: 'cloudy' };
const WIND = { 1: 'N', 2: 'NE', 3: 'E', 4: 'SE', 5: 'S', 6: 'SW', 7: 'W', 8: 'NW', 9: 'N' };
// ICAO airline designators seen near Faro, from ICAO Doc 8585 as published by the airlines themselves.
const AIRLINES = { EZY: 'easyJet', EJU: 'easyJet Europe', EZS: 'easyJet Switzerland', RYR: 'Ryanair', RUK: 'Ryanair UK', MAY: 'Malta Air (Ryanair)', TAP: 'TAP Air Portugal', TOM: 'TUI Airways', TFL: 'TUI fly Netherlands', JAF: 'TUI fly Belgium', TUI: 'TUIfly', EXS: 'Jet2', BAW: 'British Airways', IBB: 'Binter (Iberia Regional)', IBE: 'Iberia', IBS: 'Iberia Express', RAM: 'Royal Air Maroc', VLG: 'Vueling', TRA: 'Transavia', TVF: 'Transavia France', DLH: 'Lufthansa', EWG: 'Eurowings', AFR: 'Air France', KLM: 'KLM', SAS: 'SAS', NAX: 'Norwegian', NSZ: 'Norwegian', WZZ: 'Wizz Air', WUK: 'Wizz Air UK', EIN: 'Aer Lingus', BEL: 'Brussels Airlines', SWR: 'Swiss', CFG: 'Condor', LOG: 'Loganair', SXS: 'SunExpress', PGA: 'Portugalia', SAT: 'SATA Azores Airlines', RZO: 'Azores Airlines', LGL: 'Luxair', BTI: 'airBaltic', FIN: 'Finnair', ENT: 'Enter Air', AEA: 'Air Europa', EDW: 'Edelweiss', TAY: 'ASL Airlines Belgium', ABR: 'ASL Airlines Ireland' };
const airlineName = c => AIRLINES[c] || c;

// ---------- licences (Dinis, 18 Nov 2026: "Every single piece of data that we get should have a link to the license
// that it has"; PrompTugal__News__Website board/guidance/2026-11-18-licences-and-submissions.md) ----------
// Ours is CC BY 4.0. A source's item carries the source's licence, or a link to its terms labelled "the source's terms";
// never blank: a host not yet in data/editorial/licences.json links to its home page as "the source's terms (not yet found)".
const LIC = maybe('data/editorial/licences.json') || { hosts: {}, ours: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } };
const OURS = LIC.ours || { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
const OWN_HOSTS = /(^|\.)travel\.promptugal\.news$/;
const LIC_ALIASES = { 'api.ipma.pt': 'ipma.pt', 'files.diariodarepublica.pt': 'diariodarepublica.pt', 'en.newsroom.ana.pt': 'ana.pt', 'fct.ualg.pt': 'ualg.pt', 'global.flixbus.com': 'flixbus.pt', 'geo.turismodeportugal.pt': 'turismodeportugal.pt', 'travelbi.turismodeportugal.pt': 'turismodeportugal.pt', 'vamusalgarve.pt': 'vamus.pt', 'adsb.lol': 'api.adsb.lol', 'globe.adsb.lol': 'api.adsb.lol', 'www2.cm-olhao.pt': 'cm-olhao.pt' };
const licFor = url => {
  let h; try { h = new URL(url).hostname.replace(/^www\d?\./, ''); } catch { return null; }
  if (OWN_HOSTS.test(h)) return { name: OURS.name, url: OURS.url, kind: 'licence' };
  if (/(^|\.)creativecommons\.org$|(^|\.)opendatacommons\.org$/.test(h)) return null;
  const k = LIC_ALIASES[h] || h, e = LIC.hosts[k] || LIC.hosts[h.split('.').slice(-2).join('.')];
  if (e && e.url) return { name: e.kind === 'licence' ? e.name : e.terms_found === false ? "the source's terms (no terms page found; its home page)" : "the source's terms", url: e.url, kind: e.kind || 'terms' };
  return { name: "the source's terms (not yet found)", url: `https://${h}/`, kind: 'terms' };
};
// a licence mark after every outside link in a page's body (HTML) and its markdown twin
const withLicHtml = html => html.replace(/(<a href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<\/a>)/g, (m, link, url) => { const l = licFor(url.replace(/&amp;/g, '&')); return l ? `${link}<a class="lic" rel="license" href="${esc(l.url)}" title="${esc(l.name)}">${l.kind === 'licence' ? esc(l.name) : 'terms'}</a>` : link; });
const withLicMd = md => md.replace(/(\[[^\]]*\]\((https?:\/\/[^)\s]+)\))/g, (m, link, url) => { const l = licFor(url); return l ? `${link} ([${l.kind === 'licence' ? l.name : "the source's terms"}](${l.url}))` : link; });
// in JSON: every object that names a source url gets its license
const withLicJson = o => { if (Array.isArray(o)) return o.map(withLicJson); if (o && typeof o === 'object') { const out = {}; for (const [k, v] of Object.entries(o)) out[k] = withLicJson(v); const u = typeof o.url === 'string' ? o.url : typeof o.page === 'string' ? o.page : typeof o.source === 'string' && /^https?:/.test(o.source) ? o.source : null; if (u && !o.license) { const l = licFor(u); if (l) out.license = l; } return out; } return o; };

// ---------- provenance ----------
const MODELS = { lead: 'Opus (Claude)', sub: 'Sonnet (Claude)' };
const prov = (extra = {}) => ({
  code: ['scripts/pull.mjs reads the public place data', 'scripts/build.mjs makes this page', ...(extra.code || [])],
  agents: [`travel@PrompTugal.dinis (${MODELS.lead}) chose what to show and wrote the words (17 Nov 2026); travel.b@PrompTugal.dinis (${MODELS.lead}) keeps it from 18 Nov 2026`, ...(extra.agents || [])],
  person: extra.person || 'No person has checked this page yet.',
});

// ---------- layout ----------
const NAV = [
  ['/', 'Now'], ['/flights/', 'Flights'], ['/getting-around/', 'Getting around'], ['/disruptions/', 'Strikes and disruptions'],
  ['/weather/', 'Weather and sea'], ['/events/', "What's on"], ['/tourism/', 'Tourism'], ['/uk-portugal/', 'UK and Portugal'], ['/london/', 'London'], ['/about/', 'How it is made'],
];
const pages = [];
// Vendored pieces from promptugal.news (the shared sites bar, the time-zone-to-country table), each checked at every
// build against its own version's pin in the live registry, promptugal.news/api/v1/sites.json (security@'s rulings of
// 19 Nov 2026: the pin is read from the registry and never written into this repository; the registry keeps every
// version's pin, append-only). Registry unreadable, or a listed version with other bytes: the build stops. A version the
// registry no longer lists: that piece is left out and the build log says "<piece> <version> off: ...".
const sriOf = buf => 'sha256-' + createHash('sha256').update(buf).digest('base64');
const SRI = /^sha256-[A-Za-z0-9+/]{43}=$/;
let REG = null;
try { const r = await fetch('https://promptugal.news/api/v1/sites.json', { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } }); const t = await r.text(); if (r.ok && t.length < 1_000_000) REG = JSON.parse(t); } catch {}
if (!REG || !REG.bar || !REG.obs_tz) { console.error('build: the registry (promptugal.news/api/v1/sites.json) cannot be read'); process.exit(1); }
const pinFor = (versions, v) => (versions && typeof versions === 'object' && Object.prototype.hasOwnProperty.call(versions, v) ? versions[v] : null);
// the time-zone table (obs.js reads it; without it no country is sent)
let tzTableWithheld = false;
{
  const raw = readFileSync('src/assets/obs/tz-country.json');
  let haveV = ''; try { haveV = String(JSON.parse(raw).version || ''); } catch {}
  // both registry shapes (civic.b@, 19 Nov): today versions[v].integrity is the string; dev@'s reshape makes it
  // versions[v].integrity['tz-country.json']
  const pin = pinFor(REG.obs_tz.versions, haveV), integ = pin ? pin.integrity : null;
  const want = typeof integ === 'string' ? integ : integ && typeof integ === 'object' && Object.prototype.hasOwnProperty.call(integ, 'tz-country.json') && typeof integ['tz-country.json'] === 'string' ? integ['tz-country.json'] : '';
  if (!want) { console.warn(`build: tz-country ${haveV || 'none'} off: the registry names ${REG.obs_tz.version} and no longer lists ${haveV || 'this version'} (no country sent until upgraded)`); tzTableWithheld = true; }
  else if (!SRI.test(want) || sriOf(raw) !== want) { console.error(`build: src/assets/obs/tz-country.json ${haveV} does not match the registry's pin for that version`); process.exit(1); }
  else if (REG.obs_tz.version !== haveV) console.warn(`build: tz-country ${haveV} on; the registry's newest is ${REG.obs_tz.version}: upgrade only after security@'s go`);
}
// the shared sites bar (Dinis, 18 Nov 2026, the sites-bar guidance; 1.2.1 from 19 Nov ~08:01 UTC, security@'s go of 07:54):
// rendered at build from the live registry; if the renderer refuses the registry it returns '' and the pages go out
// without a bar, never a hand-made one
const SBV = '1.2.1', SB = `src/assets/sites-bar/${SBV}/`;
let sitesBar = '', sitesBarChecked = false;
{
  const pin = pinFor(REG.bar.versions, SBV);
  if (!pin) console.warn(`build: sites-bar ${SBV} off: the registry names ${REG.bar.version} and no longer lists ${SBV}`);
  else {
    // both registry shapes (civic.b@, 19 Nov): today versions[v] is the map {render, css, js}; dev@'s reshape makes it
    // versions[v].integrity.<file>; an own key, a string, or nothing
    const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'string' ? o[k] : '';
    for (const [f, k] of [['sites-bar-render.mjs', 'render'], ['sites-bar.css', 'css'], ['sites-bar.js', 'js']]) {
      const want = own(pin.integrity, f) || own(pin.integrity, k) || own(pin, k);
      if (!SRI.test(want) || sriOf(readFileSync(SB + f)) !== want) { console.error(`build: ${SB + f} does not match the registry's pin for sites-bar ${SBV}`); process.exit(1); }
    }
    sitesBarChecked = true;
    if (REG.bar.version !== SBV) console.warn(`build: sites-bar ${SBV} on; the registry's newest is ${REG.bar.version}: upgrade only after security@'s go`);
    const { render: renderSitesBar } = await import(new URL('../' + SB + 'sites-bar-render.mjs', import.meta.url));
    sitesBar = renderSitesBar(REG, { here: 'travel.promptugal.news' });
  }
}
// type and ipma: kept from the reading meter, which this site no longer has (Dinis, 18 Nov 2026 ~23:45 UTC: only
// promptugal.news bills). Every page is free; the page's type is still written in its meta for other tools.
function page({ path, title, description, body, md, provenance, variant = '', script = '', noindex = false, type = 'data', ipma = false, extraModule = '' }) {
  const pageType = ipma ? 'free' : type;
  const isHome = path === '/';
  const fullTitle = isHome ? 'PrompTugal.news Travel' : `${title} · PrompTugal.news Travel`;
  const p = provenance || prov();
  body = withLicHtml(body); md = withLicMd(md);
  const provHtml = `<section class="provenance" aria-label="How this page was made"><h2>How this page was made</h2><dl>
<dt>Code</dt><dd>${p.code.map(esc).join('; ')}.</dd>
<dt>Agents</dt><dd>${p.agents.map(esc).join('; ')}.</dd>
<dt>A person</dt><dd>${esc(p.person)}</dd></dl>
<p class="meta">Built ${esc(lisbon(built))} from data read ${esc(lisbon(manifest.read_at))}. ${a('/about/', 'Sources, gaps and method')} · ${a('index.md', 'This page as markdown')}</p></section>`;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- CSP (data in the browser, 19 Nov 2026): scripts from this host only; data from our hosts; dev.send.sgraph.ai for obs.js (the page-view counter; no IP look-up since 19 Nov 2026). -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.promptugal.news https://promptugal.news; connect-src 'self' https://data.promptugal.news https://promptugal.news https://*.promptugal.news https://dev.send.sgraph.ai; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/preview.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="text/markdown" href="${SITE}${path}index.md">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/site.css">
${sitesBar ? `<link rel="stylesheet" href="/assets/sites-bar/${SBV}/sites-bar.css">\n` : ''}<meta name="page-type" content="${pageType}">
<meta name="page-date" content="${today}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}</head>
<body class="${esc(variant)}">
<a class="skip" href="#main">Skip to the content</a>
${sitesBar}
<header class="masthead">
<div class="bar"><span class="version" data-version="${esc(version)}">Version ${esc(version)}</span><span>Independent: not an official site. Your airline or operator decides whether your service runs: its site or app has the latest.</span><span class="tools" id="nr-tools"><a class="tool meter free" id="nr-meter-chip" href="/about/#h-pay"><span class="meter-label">Free to read</span></a></span></div>
<div class="brand"><a class="wordmark" href="/" aria-label="PrompTugal.news Travel, the front page"><img class="light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="220" height="36"><img class="dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="220" height="36"><span class="sub">· Travel</span></a>
<p class="tagline">Travel and tourism in Portugal, the Algarve first. Every value with its source and the time it was read.</p></div>
<nav aria-label="Sections"><ul>${NAV.map(([h, t]) => `<li><a href="${h}"${h === path ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>
</header>
<main id="main">
${script === '/assets/now.js' ? (() => { const lonPage = /^\/(london|uk-portugal)\//.test(path); const at = lonPage ? (london && london.forecast && london.forecast.at) : (airport && airport.at) || manifest.read_at; return `<p class="live-status" data-now="status" data-read="${esc(at || '')}"${lonPage ? ` data-zone="london" data-london-read="${esc(at || '')}"${(() => { const c = london && london.forecast && london.forecast.expected_cadence; const sec = c && Number.isInteger(c.seconds) && c.seconds >= 600 && c.seconds <= 86400 ? c.seconds : null; return sec ? ` data-stale-s="${sec + 3600}"` : ''; })()}` : ''}>Built copy: figures read ${esc(lonPage ? ukTime(at) : lisbon(at))}. Your browser loads newer figures from data.promptugal.news when they pass their checks.</p>`; })() : ''}
<div class="body">
${body}
</div>
${provHtml}
</main>
<footer class="foot"><p>${a('https://promptugal.news/', 'PrompTugal.news')}: Portugal, town by town. Raw data from ${a('https://data.promptugal.news/', 'data.promptugal.news')} and from ${a('https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/data/by-place', 'PrompTugal.news place data')}. Not a warning service: follow ${a('https://www.ipma.pt/', 'IPMA')} and ${a('https://prociv.gov.pt/', 'ANEPC')}.</p>
<p class="takedown">Is something here yours, and do you think we should not show it? ${a('https://github.com/PrompTugal/PrompTugal__News__Travel/issues/new', 'Open an issue')} and we take it down while we talk. Text and data we make: CC BY 4.0; what we show from others stays under its source\'s licence or terms, linked beside it.</p>
<p class="obs-row">Version ${esc(version)} · ${a('https://github.com/PrompTugal/PrompTugal__News__Travel', 'Source')} · Code Apache-2.0, text CC BY 4.0 · ${a('/llms.txt', 'llms.txt')} · ${a('/version.json', 'version.json')} · ${a('/security/', 'Security')} · ${a('https://promptugal.news/principles/', 'Principles')} · ${a('https://promptugal.news/report/', 'Report a problem')}</p></footer>
${script ? `<script src="${script}" defer></script>\n` : ''}${extraModule ? `<script type="module" src="${extraModule}"></script>\n` : ''}
<script src="/assets/obs/obs.js" defer></script>${sitesBar ? `\n<script src="/assets/sites-bar/${SBV}/sites-bar.js" defer></script>` : ''}
</body>
</html>
`;
  const mdOut = `---
title: "${title.replace(/"/g, "'")}"
description: "${description.replace(/"/g, "'")}"
url: ${SITE}${path}
version: ${version}
built: ${built}
data_read: ${manifest.read_at}
---
# ${title}

${md.trim()}

## How this page was made

- Code: ${p.code.join('; ')}.
- Agents: ${p.agents.join('; ')}.
- A person: ${p.person}

Independent: not an official site. Your airline or operator decides whether your service runs: its site or app has the latest. Version ${version}. Code Apache-2.0, text CC BY 4.0. Principles: https://promptugal.news/principles/ · Report a problem: https://promptugal.news/report/

Is something here yours, and do you think we should not show it? Open an issue at https://github.com/PrompTugal/PrompTugal__News__Travel/issues/new and we take it down while we talk.
`;
  const dir = join('_site', path);
  mkdirSync(dir, { recursive: true });
  // every table sits in a box that scrolls on its own, so a wide table never makes the page scroll sideways at 375 px
  // (conductor.b@'s check, 19 Nov 2026); tables already inside .scroll are left as they are
  const boxed = html.replace(/(<div class="scroll">\s*)?<table\b([\s\S]*?)<\/table>/g, (m, inBox) => inBox ? m : `<div class="scroll">${m}</div>`);
  writeFileSync(join(dir, 'index.html'), nodash(boxed));
  writeFileSync(join(dir, 'index.md'), nodash(mdOut));
  pages.push({ path, title, description, noindex });
}

// ---------- shared blocks ----------
function warningsBlock() {
  const w = (faro.warnings || {});
  const act = w.active || [];
  const levels = { yellow: 'Yellow', orange: 'Orange', red: 'Red' };
  if (!act.length) return { html: `<p class="ok">No IPMA warning in force for the Faro district at ${esc(lisbon(faro.read_at))}. ${a(w.page, 'IPMA warnings')}</p>`, md: `No IPMA warning in force for the Faro district at ${lisbon(faro.read_at)}. ${ml(w.page, 'IPMA warnings')}` };
  return {
    html: `<ul class="warnings">${act.map(x => `<li class="lvl-${esc(x.level)}"><strong>${esc(levels[x.level] || x.level)}: ${esc(x.type)}</strong> from ${esc(lisbon(x.start))} to ${esc(lisbon(x.end))}. <span lang="pt">${esc(x.text || '')}</span></li>`).join('')}</ul><p class="meta">IPMA warnings for ${esc(w.area || 'the Faro district')}, read ${esc(lisbon(faro.read_at))}. ${a(w.page, 'IPMA')}</p>`,
    md: act.map(x => `- **${levels[x.level] || x.level}: ${x.type}** from ${lisbon(x.start)} to ${lisbon(x.end)}. ${x.text || ''}`).join('\n') + `\n\nIPMA warnings for ${w.area || 'the Faro district'}, read ${lisbon(faro.read_at)}. ${ml(w.page, 'IPMA')}`,
  };
}

function airportBlock(full = false) {
  if (!airport) return { html: '<p>No airport reading in the place data yet.</p>', md: 'No airport reading in the place data yet.' };
  const list = airport.airline || [];
  const by = {};
  for (const f of list) by[f.airline] = (by[f.airline] || 0) + 1;
  const rows = list.map(f => ({ ...f, name: airlineName(f.airline), phase: f.on_ground ? 'on the ground' : f.alt_ft < 10000 ? 'low: arriving or leaving' : 'cruising overhead' }));
  const lead = `${list.length} airline flight${list.length === 1 ? '' : 's'} seen within ${airport.within_nm} nautical miles of Faro airport at ${lisbon(airport.at)}${airport.other_aircraft ? `, and ${airport.other_aircraft} other aircraft (counted, not named)` : ', and no other aircraft'}.`;
  const tbl = rows.length ? `<table class="flights"><caption>Airline flights near Faro (LPFR) at ${esc(lisbon(airport.at))}</caption><thead><tr><th scope="col">Callsign</th><th scope="col">Airline</th><th scope="col">Type</th><th scope="col">Phase</th><th scope="col" class="num">Altitude (ft)</th></tr></thead><tbody data-now="airport-rows">${rows.map(f => `<tr><td class="mono">${esc(f.callsign)}</td><td>${esc(f.name)}</td><td class="mono">${esc(f.type)}</td><td>${esc(f.phase)}</td><td class="num">${f.on_ground ? 'ground' : esc(f.alt_ft?.toLocaleString('en-GB'))}</td></tr>`).join('')}</tbody></table>` : '';
  const md = `${lead}\n\n${rows.length ? '| Callsign | Airline | Type | Phase | Altitude (ft) |\n|---|---|---|---|---|\n' + rows.map(f => `| ${f.callsign} | ${f.name} | ${f.type} | ${f.phase} | ${f.on_ground ? 'ground' : f.alt_ft} |`).join('\n') : ''}\n\nSource: ${ml(airport.source, 'adsb.lol')} community receivers (ODbL 1.0), read by the PrompTugal.news place data. Airline flights by callsign; other aircraft only counted. ${ml(airport.page, 'The live map at adsb.lol')}`;
  return {
    html: `<p class="lead" data-now="airport-lead" data-at="${esc(airport.at)}">${esc(lead)}</p>${tbl}<p class="meta">Source: ${a(airport.source, 'adsb.lol')} community receivers (data under ODbL 1.0), as read by the PrompTugal.news place data. Airline flights by callsign; other aircraft only counted. A snapshot, not a departures board. ${a(airport.page, 'The live map at adsb.lol')}</p>`,
    md, by, rows,
  };
}

function forecastStrip(n, days = 5) {
  const f = (n || {}).forecast;
  if (!f || !f.days) return { html: '<p>No forecast in the place data.</p>', md: 'No forecast in the place data.' };
  const ds = f.days.slice(0, days);
  return {
    html: `<ol class="strip">${ds.map(d => `<li><span class="d">${esc(day(d.date))}</span><span class="t">${esc(Math.round(d.t_max_c))}° / ${esc(Math.round(d.t_min_c))}°</span><span class="w">${esc(WT[d.weather_type] || 'type ' + d.weather_type)}</span><span class="r">rain ${esc(Math.round(d.rain_prob_pct))}%</span></li>`).join('')}</ol><p class="meta">IPMA forecast for ${esc(f.place)}. ${a(f.page, 'IPMA')}</p>`,
    md: '| Day | Max / min (°C) | Sky | Chance of rain |\n|---|---|---|---|\n' + ds.map(d => `| ${day(d.date)} | ${d.t_max_c} / ${d.t_min_c} | ${WT[d.weather_type] || d.weather_type} | ${d.rain_prob_pct}% |`).join('\n') + `\n\nIPMA forecast for ${f.place}. ${ml(f.page, 'IPMA')}`,
  };
}

const disruptions = (research.disruptions || {}).items || [];
const upcoming = disruptions.filter(d => (d.ongoing || (d.end || d.start) >= today) && d.status !== 'called off').sort((x, y) => x.start.localeCompare(y.start));
const past = disruptions.filter(d => !(d.ongoing || (d.end || d.start) >= today)).sort((x, y) => y.start.localeCompare(x.start));
const dateRange = d => (d.ongoing ? `since ${day(d.start)}, ongoing` : d.end && d.end !== d.start ? `${day(d.start)} to ${day(d.end)}` : day(d.start));
const srcList = s => (s || []).map(x => a(x.url, x.publisher)).join(' · ');
const srcMd = s => (s || []).map(x => ml(x.url, x.publisher)).join(' · ');

// ---------- the front page and its three design variations ----------
function front(variant, path, label) {
  const w = warningsBlock();
  const ap = airportBlock();
  const fc = forecastStrip(faro);
  const st = (faro.station || {}).reading || {};
  const sea = faro.sea || {};
  const seaW = (now.lagos || {}).sea || {};
  const next = upcoming[0];
  const allEvents = municipalities.concat(['algarve']).flatMap(id => ((desk[id] || {}).events || []).map(e => ({ ...e, place: id })));
  const tourismHead = ((research.tourism || {}).headlines || [])[0];
  const modes = ((research.transport || {}).modes || []);

  const blocks = {
    now: `<section class="card now" aria-labelledby="h-now"><h2 id="h-now">Faro now</h2>
<p class="big" data-now="faro-temp">${esc(st.temp_c ?? 'n/a')}°C</p><p>Wind ${esc(st.wind_kmh ?? 'n/a')} km/h from the ${esc(WIND[st.wind_dir_id] || 'n/a')}, humidity ${esc(st.humidity_pct ?? 'n/a')}%, rain in the last hour ${esc(st.rain_mm ?? 'n/a')} mm.</p>
<p class="meta">IPMA station ${esc((faro.station || {}).name)}, reading at ${esc(lisbon(st.at))}. ${a((faro.station || {}).page, 'IPMA')}</p>${fc.html}</section>`,
    warn: `<section class="card warn" aria-labelledby="h-warn"><h2 id="h-warn">Warnings in force</h2>${w.html}</section>`,
    air: `<section class="card air" aria-labelledby="h-air"><h2 id="h-air">Above Faro airport</h2>${ap.html}<p><a href="/flights/">Flights: Faro airport in full</a></p></section>`,
    strikes: `<section class="card strikes" aria-labelledby="h-strikes"><h2 id="h-strikes">Strikes and disruptions ahead</h2>${upcoming.length ? `<ul class="items">${upcoming.slice(0, 3).map(d => `<li><strong>${esc(dateRange(d))}</strong>: ${esc(d.title)} <span class="status s-${esc(d.status)}">${esc(d.status)}</span><br><span class="meta">${srcList(d.sources)}</span></li>`).join('')}</ul>` : '<p>None found for the weeks ahead, which is not proof that there are none.</p>'}<p><a href="/disruptions/">All strikes, disruptions and holidays</a></p></section>`,
    sea: `<section class="card sea" aria-labelledby="h-sea"><h2 id="h-sea">The sea</h2><p>${esc(sea.coast || 'Faro coast')}: waves up to ${esc(sea.waves_max_m ?? 'n/a')} m, sea temperature up to ${esc(sea.sea_temp_max_c ?? 'n/a')}°C (${esc(sea.date || '')}).${seaW.coast ? ` ${esc(seaW.coast)}: waves up to ${esc(seaW.waves_max_m ?? 'n/a')} m, sea up to ${esc(seaW.sea_temp_max_c ?? 'n/a')}°C.` : ''}</p><p class="meta">IPMA coastal forecast. ${a(sea.page, 'IPMA')}</p><p><a href="/weather/">Weather and sea, place by place</a></p></section>`,
    move: `<section class="card move" aria-labelledby="h-move"><h2 id="h-move">Getting around the Algarve</h2>${modes.length ? `<ul class="items">${modes.map(m => `<li><strong>${esc(m.title)}</strong>: ${esc(firstSentence(m.summary))}</li>`).join('')}</ul>` : '<p>The map of operators and their official pages is being researched.</p>'}<p><a href="/getting-around/">Trains, buses, ferries and roads</a></p></section>`,
    events: `<section class="card events" aria-labelledby="h-events"><h2 id="h-events">What's on</h2>${(() => { const w = research.events ? research.events.events.filter(e => (e.end || e.start) >= today).sort((x, y) => x.start.localeCompare(y.start)) : []; const nx = w.filter(e => e.start >= today).slice(0, 3); return w.length ? `<p>${w.length} events from the councils' own agendas to early January.${nx.length ? ` Next: ${nx.map(e => `${esc(e.title)} (${esc(placeName(e.place))}, ${esc(day(e.start))})`).join('; ')}.` : ''}</p>` : ''; })()}<p>${allEvents.length} technology and AI events listed by the PrompTugal.news place desks.</p><p><a href="/events/">What's on in the Algarve</a></p></section>`,
    tourism: `<section class="card tourism" aria-labelledby="h-tourism"><h2 id="h-tourism">Tourism as an industry</h2>${tourismHead ? `<p>${esc(tourismHead.text)} <span class="meta">${a(tourismHead.url, tourismHead.publisher)}</span></p>` : '<p>Official statistics (INE, Turismo de Portugal) are being gathered.</p>'}<p><a href="/tourism/">Tourism in numbers</a></p></section>`,
  };
  const order = {
    a: ['warn', 'now', 'air', 'strikes', 'sea', 'move', 'events', 'tourism'],
    b: ['strikes', 'warn', 'air', 'now', 'sea', 'move', 'tourism', 'events'],
    c: ['air', 'strikes', 'warn', 'now', 'sea', 'move', 'events', 'tourism'],
  }[variant];
  const intro = {
    a: `<h1>Travel in the Algarve, now</h1><p class="dek">What a visitor needs to know today: the weather and the sea, what is flying at Faro, strikes ahead, and how to get around. Data pulled ${esc(lisbon(manifest.read_at))}; each value says when its source read it.</p>`,
    b: `<h1>${next ? esc(next.title) : 'Travel in the Algarve, now'}</h1><p class="dek">${next ? esc(`${dateRange(next)}. ${next.where}. ${next.status}.`) : ''} The rest of today's travel picture for the Algarve follows: warnings, Faro airport, the weather and the sea.</p>`,
    c: `<h1>The Algarve board: what is flying near Faro now</h1><p class="dek">A board for the Algarve: aircraft near Faro, strikes ahead, warnings and the weather. Data pulled ${esc(lisbon(manifest.read_at))}.</p>`,
  }[variant];
  const body = `${label ? `<p class="variant-label">${esc(label)}</p>` : ''}<div class="intro">${intro}</div><div class="grid g-${variant}">${order.map(k => blocks[k]).join('\n')}</div>`;
  const md = `${{ a: 'What a visitor needs to know today about travel in the Algarve.', b: next ? `${next.title}: ${dateRange(next)}, ${next.where} (${next.status}).` : '', c: 'A board for the Algarve.' }[variant]} Data read ${lisbon(manifest.read_at)}.

## Warnings in force

${w.md}

## Faro now

${st.temp_c ?? 'n/a'}°C, wind ${st.wind_kmh ?? 'n/a'} km/h from the ${WIND[st.wind_dir_id] || 'n/a'}, humidity ${st.humidity_pct ?? 'n/a'}%, rain in the last hour ${st.rain_mm ?? 'n/a'} mm. IPMA station ${(faro.station || {}).name}, reading at ${lisbon(st.at)}.

${fc.md}

## Above Faro airport

${ap.md}

## Strikes and disruptions ahead

${upcoming.length ? upcoming.map(d => `- **${dateRange(d)}**: ${d.title} (${d.status}). ${srcMd(d.sources)}`).join('\n') : 'None found for the weeks ahead, which is not proof that there are none.'}

## The sea

${sea.coast || 'Faro coast'}: waves up to ${sea.waves_max_m ?? 'n/a'} m, sea temperature up to ${sea.sea_temp_max_c ?? 'n/a'}°C. ${ml(sea.page, 'IPMA')}

## Getting around

${modes.length ? modes.map(m => `- **${m.title}**: ${m.summary}`).join('\n') : 'Being researched.'}

## More

- [Flights](${SITE}/flights/) · [Getting around](${SITE}/getting-around/) · [Strikes and disruptions](${SITE}/disruptions/) · [Weather and sea](${SITE}/weather/) · [Events](${SITE}/events/) · [Tourism](${SITE}/tourism/) · [How it is made](${SITE}/about/)
`;
  page({
    path, title: label ? `Front page, ${label}` : 'Travel in the Algarve, now',
    description: 'Travel and tourism in Portugal, the Algarve first: weather and sea for visitors, flights at Faro, strikes and disruptions, getting around, events and tourism statistics, each value sourced.',
    body, md, variant: `front v-${variant}`, script: '/assets/now.js', noindex: !!label, ipma: true,
    provenance: prov({ agents: ['travel.research.disruptions@, travel.research@ and travel.data@ (Sonnet sub-agents) researched the strikes, transport and tourism sections'] }),
  });
}
front('a', '/');
front('a', '/design/a/', 'Variation A: the dashboard');
front('b', '/design/b/', 'Variation B: the newspaper');
front('c', '/design/c/', 'Variation C: the board');
page({
  path: '/design/', title: 'Three front pages, for Dinis to choose', noindex: true, ipma: true,
  description: 'Three variations of the travel.promptugal.news front page, side by side, built from the same data.',
  body: `<h1>Three front pages, side by side</h1><p class="dek">The same data, three layouts. The live front page uses A until Dinis chooses. Each is a full page you can open on its own.</p>
<div class="compare">${[['a', 'A: the dashboard', 'Warnings first, then the weather, the airport and strikes: the practical order for a visitor already here.'], ['b', 'B: the newspaper', 'The biggest travel story leads (today: the next strike), in an editorial serif, with the data below it.'], ['c', 'C: the board', 'A dark departures-board look: the airport first, in monospace, for someone about to travel.']].map(([v, t, d]) => `<figure><figcaption><strong>${esc(t)}</strong>. ${esc(d)} <a href="/design/${v}/">Open ${v.toUpperCase()}</a></figcaption><iframe src="/design/${v}/" title="Front page variation ${v.toUpperCase()}" loading="lazy"></iframe></figure>`).join('')}</div>`,
  md: `The same data, three layouts. The live front page uses A until Dinis chooses.\n\n- [A: the dashboard](${SITE}/design/a/): warnings first, then weather, airport, strikes.\n- [B: the newspaper](${SITE}/design/b/): the biggest travel story leads, data below.\n- [C: the board](${SITE}/design/c/): a dark departures-board look, airport first.`,
});

// ---------- flights ----------
{
  const ap = airportBlock(true);
  const byRows = Object.entries(ap.by || {}).sort((x, y) => y[1] - x[1]);
  const sHtml = series.length ? `<table><caption>Our readings so far (one row per pull, counts only)</caption><thead><tr><th scope="col">Read at</th><th scope="col" class="num">Airline flights</th><th scope="col" class="num">On the ground</th><th scope="col" class="num">Other aircraft</th><th scope="col">By airline</th></tr></thead><tbody>${series.slice(-24).reverse().map(r => `<tr><td>${esc(lisbon(r.at))}</td><td class="num">${esc(r.airline_total)}</td><td class="num">${esc(r.on_ground)}</td><td class="num">${esc(r.other_aircraft)}</td><td>${esc(Object.entries(r.by_airline).map(([k, v]) => `${airlineName(k)} ${v}`).join(', '))}</td></tr>`).join('')}</tbody></table>` : '';
  const strikeAir = upcoming.filter(d => d.mode === 'air' || d.mode === 'border');
  page({
    path: '/flights/', title: 'Flights: Faro airport',
    description: 'Faro airport (LPFR): airline flights seen nearby now, by callsign, with strikes and border checks that affect flying from the Algarve. Sourced, with the time read.',
    script: '/assets/now.js',
    body: `<h1>Flights: Faro airport</h1><p class="dek">Faro (LPFR) is the Algarve's airport, run by ANA (VINCI Airports). What we show is what community receivers saw in the sky near it at one moment, not the airport's departures board.</p>
<section aria-labelledby="h-seen"><h2 id="h-seen">Seen near Faro</h2>${ap.html}${byRows.length ? `<p>By airline: ${esc(byRows.map(([k, v]) => `${airlineName(k)} ${v}`).join(', '))}.</p>` : ''}</section>
<p class="meta">Archive: ${a('/storm-charles/flights/', 'Storm Charles, 10 to 12 November 2026: the crosswind at Lisbon and Madeira, hour by hour')}.</p>
<section aria-labelledby="h-ahead"><h2 id="h-ahead">Strikes and border checks that touch flying</h2>${strikeAir.length ? `<ul class="items">${strikeAir.map(d => `<li><strong>${esc(dateRange(d))}: ${esc(d.title)}</strong> <span class="status s-${esc(d.status)}">${esc(d.status)}</span><p>${esc(d.what)}</p><p class="meta">${srcList(d.sources)}</p></li>`).join('')}</ul>` : '<p>None found.</p>'}</section>
<section aria-labelledby="h-series"><h2 id="h-series">Our series</h2><p>Each time the site's data is pulled, we keep one line of counts per airline (never an aircraft's identity) in <a href="/api/v1/faro-airport.jsonl">faro-airport.jsonl</a>. It starts on 17 November 2026; with a reading every hour it becomes a picture of the airport's day.</p>${sHtml}</section>
<section aria-labelledby="h-official"><h2 id="h-official">The official sources</h2><ul><li>${a('https://www.aeroportofaro.pt/en', 'Faro airport (ANA)')}: departures, arrivals and notices. Its boards answered automated readers with a bot check in earlier PrompTugal.news work, so we link and do not read them.</li><li>${a('https://en.newsroom.ana.pt/', "ANA's newsroom")}: statements per airport in a disruption; ANA asks consent to reproduce its content, so only figures, with the link.</li><li>${a('https://globe.adsb.lol/?lat=37.014&lon=-7.966&zoom=9', 'adsb.lol live map')}: the community data we show (ODbL 1.0).</li></ul></section>
<section aria-labelledby="h-rule"><h2 id="h-rule">The privacy rule</h2><p>Airline flights are shown by callsign, because a scheduled airline flight is a public service. Every other aircraft (private, medical, military, training) is only counted, never named, located or typed.</p></section>`,
    md: `Faro (LPFR) is the Algarve's airport, run by ANA (VINCI Airports). What we show is a snapshot of what community receivers saw near it, not the airport's departures board.

## Seen near Faro

${ap.md}

## Strikes and border checks that touch flying

${strikeAir.length ? strikeAir.map(d => `- **${dateRange(d)}: ${d.title}** (${d.status}). ${d.what} ${srcMd(d.sources)}`).join('\n') : 'None found.'}

## Our series

One line of counts per airline per pull, never an aircraft's identity: ${SITE}/api/v1/faro-airport.jsonl (from 17 November 2026).

## The official sources

- [Faro airport (ANA)](https://www.aeroportofaro.pt/en): linked, not read (bot check in earlier work).
- [ANA's newsroom](https://en.newsroom.ana.pt/): figures only, with the link.
- [adsb.lol live map](https://globe.adsb.lol/?lat=37.014&lon=-7.966&zoom=9): ODbL 1.0.

## The privacy rule

Airline flights by callsign; every other aircraft only counted.`,
  });
}

// ---------- getting around ----------
{
  const t = research.transport;
  const modes = (t || {}).modes || [];
  const opHtml = o => `<li><strong>${a(o.url, o.name)}</strong>${o.role ? `, ${esc(o.role)}` : ''}${o.status && o.status !== 'read' ? ` <span class="status s-gap">${esc(o.status)}</span>` : ''}${(o.facts || []).length ? `<ul>${o.facts.map(f => `<li>${esc(f.text)} <span class="meta">${a(f.url, host(f.url))}, read ${esc(f.read_on)}${f.kind === 'report' ? ', a report' : ''}</span></li>`).join('')}</ul>` : ''}${o.open_data && o.open_data.exists ? `<p class="meta">Open data: ${a(o.open_data.url, 'the data set')}${o.open_data.licence ? `, ${esc(o.open_data.licence)}` : ''}.</p>` : ''}${o.terms && o.terms.url ? `<p class="meta">Terms: ${a(o.terms.url, 'its terms of use')}${o.terms.clause ? `: "${esc(o.terms.clause)}"` : ''}</p>` : ''}</li>`;
  const opMd = o => `- **${ml(o.url, o.name)}**${o.role ? `, ${o.role}` : ''}${o.status && o.status !== 'read' ? ` (${o.status})` : ''}\n${(o.facts || []).map(f => `  - ${f.text} (${ml(f.url, host(f.url))}, read ${f.read_on})`).join('\n')}${o.open_data && o.open_data.exists ? `\n  - Open data: ${ml(o.open_data.url, 'data set')} ${o.open_data.licence || ''}` : ''}`;
  const gaps = (t || {}).gaps || [];
  page({
    path: '/getting-around/', title: 'Getting around the Algarve',
    description: 'Trains, buses, ferries and roads in the Algarve: who runs what, their official pages, the facts they publish and the open data that exists, each with the date read.',
    provenance: prov({ agents: ['travel.research@PrompTugal.dinis (Sonnet) read the operators\' official pages (17 Nov 2026)', 'travel.b.transport@PrompTugal.dinis (Sonnet) read the winter boats and tolls (18 Nov 2026); travel.b@PrompTugal.dinis re-read the A22 law and the Armona notice'] }),
    body: `<h1>Getting around the Algarve</h1><p class="dek">Who runs the trains, buses, boats and roads a visitor uses, what each publishes, and where to look on the day. Operators' own information only; where a site refused an automated reader we say so and link it.</p>
${(research.transport || {}).winter ? `<section aria-labelledby="h-winter" class="winter"><h2 id="h-winter">This winter: boats and tolls</h2>${research.transport.winter.items.map(w => `<h3>${esc(w.title)}</h3><p>${esc(w.text)}</p><p class="meta">${w.sources.map(x => `${a(x.url, x.title)}, read ${esc(x.read)}`).join(' · ')}</p>`).join('')}</section>` : ''}
${modes.length ? modes.map(m => `<section aria-labelledby="h-${esc(m.id)}"><h2 id="h-${esc(m.id)}">${esc(m.title)}</h2><p>${esc(m.summary)}</p><ul class="ops">${(m.operators || []).map(opHtml).join('')}</ul></section>`).join('\n') : '<p>Being researched: this page fills in as the research lands.</p>'}
${gaps.length ? `<section aria-labelledby="h-gaps"><h2 id="h-gaps">Gaps</h2><ul>${gaps.map(g => `<li><strong>${esc(g.what)}</strong>: ${esc(g.why)}${g.url ? ` ${a(g.url, host(g.url))}` : ''}</li>`).join('')}</ul></section>` : ''}`,
    md: `Who runs the trains, buses, boats and roads a visitor uses, and what each publishes.\n\n${(research.transport || {}).winter ? `## This winter: boats and tolls\n\n${research.transport.winter.items.map(w => `### ${w.title}\n\n${w.text}\n\n${w.sources.map(x => `${ml(x.url, x.title)}, read ${x.read}`).join('; ')}`).join('\n\n')}\n\n` : ''}${modes.map(m => `## ${m.title}\n\n${m.summary}\n\n${(m.operators || []).map(opMd).join('\n')}`).join('\n\n')}\n\n${gaps.length ? `## Gaps\n\n${gaps.map(g => `- **${g.what}**: ${g.why} ${g.url || ''}`).join('\n')}` : ''}`,
  });
}

// ---------- disruptions ----------
{
  const d = research.disruptions || {};
  const calledOff = disruptions.filter(d => d.status === 'called off' && (d.end || d.start) >= today);
  const item = x => `<li id="${esc(x.id)}"><h3>${esc(x.title)}</h3><p class="meta"><strong>${esc(dateRange(x))}</strong> · ${esc(x.where)} · ${esc(x.who)} · <span class="status s-${esc(x.status)}">${esc(x.status)}</span>${x.algarve ? ' · the Algarve' : ''}</p><p>${esc(x.what)}</p><p class="meta">Sources: ${srcList(x.sources)}</p></li>`;
  const itemMd = x => `### ${x.title}\n\n${dateRange(x)} · ${x.where} · ${x.who} · ${x.status}\n\n${x.what}\n\nSources: ${srcMd(x.sources)}`;
  const hol = (holidays || {}).days || [];
  page({
    path: '/disruptions/', title: 'Strikes and disruptions',
    description: 'Strikes, planned disruptions and public holidays that affect travel in Portugal and the Algarve, each with its sources and status.',
    provenance: prov({ agents: ['travel.research.disruptions@PrompTugal.dinis (Sonnet) searched official notices and news reports'] }),
    body: `<h1>Strikes and disruptions</h1><p class="dek">What may stop or slow a journey in Portugal, the Algarve first: strikes called, border checks, storms and holidays. Each item has its status and its sources. Your airline or operator decides whether your service runs: its site or app has the latest.</p>
<section aria-labelledby="h-up"><h2 id="h-up">Ahead and in force</h2>${upcoming.length ? `<ul class="items long">${upcoming.map(item).join('')}</ul>` : '<p>None found.</p>'}</section>
${calledOff.length ? `<section aria-labelledby="h-off"><h2 id="h-off">Called off</h2><ul class="items long">${calledOff.map(item).join('')}</ul></section>` : ''}
<section aria-labelledby="h-hol"><h2 id="h-hol">Public holidays</h2>${hol.length ? `<ul>${hol.filter(h => h.date >= today).map(h => `<li><strong>${esc(longDay(h.date))}</strong>: ${esc(h.name)}</li>`).join('')}</ul><p class="meta">${esc(holidays.note || '')} ${a(holidays.source, holidays.source_title)}</p>` : '<p>Not listed yet.</p>'}</section>
<section aria-labelledby="h-past"><h2 id="h-past">Recently</h2>${past.length ? `<ul class="items long">${past.map(item).join('')}</ul>` : '<p>None listed.</p>'}</section>
<section aria-labelledby="h-gap"><h2 id="h-gap">What we looked for and did not find</h2><p>Not finding a strike is not proof there is none. These were searched for on ${esc((d.read_at || '').slice(0, 10))}:</p><ul>${(d.gaps || []).map(g => `<li><strong>${esc(g.what)}</strong>: ${esc(g.why)}</li>`).join('')}</ul></section>`,
    md: `What may stop or slow a journey in Portugal, the Algarve first. Your airline or operator decides whether your service runs: its site or app has the latest.\n\n## Ahead and in force\n\n${upcoming.map(itemMd).join('\n\n') || 'None found.'}${calledOff.length ? `\n\n## Called off\n\n${calledOff.map(x => `- **${dateRange(x)}**: ${mdesc(x.title)}. ${mdesc(x.what)} ${srcMd(x.sources)}`).join('\n')}` : ''}\n\n## Public holidays\n\n${hol.filter(h => h.date >= today).map(h => `- **${longDay(h.date)}**: ${h.name}`).join('\n')}\n\n${holidays ? `${holidays.note || ''} ${ml(holidays.source, holidays.source_title)}` : ''}\n\n## Recently\n\n${past.map(itemMd).join('\n\n')}\n\n## What we looked for and did not find\n\n${(d.gaps || []).map(g => `- **${g.what}**: ${g.why}`).join('\n')}`,
  });
}

// Serialise the chart's node tree: tag and attribute names from the module's allowlists only, every value through esc().
const svgOf = n => {
  if (n.text !== undefined) return esc(n.text);
  if (!PAST_TAGS.includes(n.t)) throw new Error(`build: tag ${n.t} is not allowed in the chart`);
  const at = Object.entries(n.a).map(([k, v]) => { if (!pastOkAttr(n.t, k, v)) throw new Error(`build: attribute ${k} is not allowed on ${n.t} in the chart`); return ` ${k}="${esc(String(v))}"`; }).join('');
  if (!n.c.length && (n.t === 'line' || n.t === 'rect')) return `<${n.t}${at}/>`;
  return `<${n.t}${at}>${n.c.map(svgOf).join('')}</${n.t}>`;
};
// "Faro: what we said and what happened" (Dinis, 18 Nov 2026, "show the past"; designer@ PF1 to PF9): the temperature chart on
// /weather/, from data/inputs/beyond/history/faro.json (data.promptugal.news's history/weather/faro.json) and IPMA's city
// forecast for Faro. Missing or unusable history: no chart, and the build goes on. IPMA data: free page, outside the meter.
const faroTemp = (() => {
  const none = { html: '', md: '', used: null };
  let h = null;
  try { h = existsSync('data/inputs/beyond/history/faro.json') ? J('data/inputs/beyond/history/faro.json') : null; } catch { h = null; }
  if (!h || h.place !== 'faro' || !Array.isArray(h.rows)) return none;
  let m = null, svg = '';
  try {
    const days = ((faro.forecast && faro.forecast.days) || []).filter(x => x && typeof x.date === 'string');
    m = pastModel(h, days, today, { kind: 'temp', place: 'faro' });
    if (!m) return none;
    svg = svgOf(pastTree(m));
  } catch { return none; }
  const { track } = m, tbl = m.table;
  const read = typeof h.data_read_at === 'string' ? lisbon(h.data_read_at) : 'not known';
  const histUrl = 'https://data.promptugal.news/api/v1/history/weather/faro.json';
  const note = `Measured: IPMA station ${esc((faro.station || {}).name || 'Faro (Aeródromo)')}, each day's lowest and highest reading (a day is complete when it has all its hours). What we said: IPMA's forecast for Faro kept the day before. Forecast ahead: IPMA's forecast for Faro, read ${esc(lisbon(faro.read_at))}. History read <span data-now="temp-read">${esc(read)}</span>; ${a(histUrl, 'the history file')}. Source: ${a('https://api.ipma.pt/', 'IPMA, Instituto Português do Mar e da Atmosfera')}, used under the source's terms: not for commercial use.`;
  const table = `<details><summary>Table view</summary><div class="tscroll"><table><thead><tr><th>Day</th><th>Measured low to high</th><th>What we said the day before</th><th>Difference in the high</th><th>Forecast</th></tr></thead><tbody data-now="temp-table">${tbl.map(r => `<tr><td>${esc(r.day)}</td><td>${esc(r.meas)}</td><td>${esc(r.said)}</td><td>${esc(r.diff)}</td><td>${esc(r.fc)}</td></tr>`).join('')}</tbody></table></div></details>`;
  return {
    used: histUrl,
    html: `<section aria-labelledby="h-faro-temp"><h2 id="h-faro-temp">Faro: what we said and what happened</h2><figure class="chart" data-now="temp-chart" data-read="${esc(typeof h.data_read_at === 'string' ? h.data_read_at : '')}"><div class="chart-wide">${svg}</div><figcaption>${esc(track)}</figcaption></figure>${table}<p class="meta">${note}</p></section>`,
    md: `\n\n## Faro: what we said and what happened\n\n${mdesc(track)}\n\n| Day | Measured low to high | What we said the day before | Difference in the high | Forecast |\n|---|---|---|---|---|\n${tbl.map(r => `| ${mdesc(r.day)} | ${mdesc(r.meas)} | ${mdesc(r.said)} | ${mdesc(r.diff)} | ${mdesc(r.fc)} |`).join('\n')}\n\nMeasured: IPMA station ${mdesc((faro.station || {}).name || 'Faro (Aeródromo)')}. What we said: IPMA's forecast kept the day before. Forecast ahead: IPMA, read ${mdesc(lisbon(faro.read_at))}. History read ${mdesc(read)}. ${ml(histUrl, 'History file')}. Source: ${ml('https://api.ipma.pt/', 'IPMA')}, the source's terms, not for commercial use.`,
  };
})();

// ---------- weather and sea ----------
{
  const rows = municipalities.map(id => {
    const n = now[id]; const r = (n.station || {}).reading || {}; const f0 = ((n.forecast || {}).days || [])[0] || {}; const f1 = ((n.forecast || {}).days || [])[1] || {};
    return { id, name: placeName(id), station: (n.station || {}).name, temp: r.temp_c, wind: r.wind_kmh, today: f0, tomorrow: f1, sea: n.sea, uv: n.uv, fire: ((n.fire_risk || {}).days || [])[0] };
  });
  const w = warningsBlock();
  const coasts = {};
  for (const r of rows) if (r.sea && r.sea.coast) coasts[r.sea.coast] = r.sea;
  const cell = v => (v === null || v === undefined ? 'n/a' : v);
  page({
    path: '/weather/', title: 'Weather and sea for visitors', ipma: true,
    description: 'The weather, the sea, UV and fire risk in each Algarve municipality, from IPMA open data, with warnings in force and the time each value was read.',
    script: '/assets/now.js', extraModule: '/assets/past-chart-live.mjs',
    body: `<h1>Weather and sea for visitors</h1><p class="dek">Each Algarve municipality: the latest station reading, today and tomorrow, the sea on its coast, UV and fire risk. From IPMA's open data, via the PrompTugal.news place data, read ${esc(lisbon(faro.read_at))}. For storms and warnings, ${a('https://weather.promptugal.news/', 'PrompTugal.news Weather')} goes deeper.</p>
<section aria-labelledby="h-w"><h2 id="h-w">Warnings in force</h2>${w.html}</section>
<section aria-labelledby="h-coast"><h2 id="h-coast">The sea, coast by coast</h2><ul class="coasts">${Object.values(coasts).map(s => `<li><strong>${esc(s.coast)}</strong>: waves up to ${esc(cell(s.waves_max_m))} m, swell up to ${esc(cell(s.sea_max_m))} m, sea temperature up to ${esc(cell(s.sea_temp_max_c))}°C (${esc(s.date)}). ${a(s.page, 'IPMA')}</li>`).join('')}</ul><p class="meta">The Faro coast faces south (Olhão to Vila Real de Santo António, Albufeira, Quarteira); the Sagres coast covers the west and the Barlavento (Lagos, Portimão, Aljezur, Vila do Bispo), as IPMA groups them.</p></section>
<section aria-labelledby="h-places"><h2 id="h-places">Place by place</h2><div class="scroll"><table class="places"><thead><tr><th scope="col">Place</th><th scope="col" class="num">Now (°C)</th><th scope="col">Today</th><th scope="col">Tomorrow</th><th scope="col" class="num">UV</th><th scope="col">Fire risk</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${esc(r.name)}<span class="meta"> ${esc(r.station || '')}</span></th><td class="num">${esc(cell(r.temp))}</td><td>${esc(r.today.t_max_c != null ? `${Math.round(r.today.t_max_c)}° / ${Math.round(r.today.t_min_c)}°, ${WT[r.today.weather_type] || ''}, rain ${r.today.rain_prob_pct}%` : 'n/a')}</td><td>${esc(r.tomorrow.t_max_c != null ? `${Math.round(r.tomorrow.t_max_c)}° / ${Math.round(r.tomorrow.t_min_c)}°, ${WT[r.tomorrow.weather_type] || ''}, rain ${r.tomorrow.rain_prob_pct}%` : 'n/a')}</td><td class="num">${esc(r.uv ? r.uv.index : 'n/a')}</td><td>${esc(r.fire ? r.fire.level : 'n/a')}</td></tr>`).join('')}</tbody></table></div>
<p class="meta">"Now" is the nearest IPMA station with a reading; n/a means that station sent none in the hour read. Forecasts: IPMA's daily forecast for the nearest town. ${a('https://www.ipma.pt/en/otempo/prev.localidade.hora/', 'IPMA forecasts')} · ${a('https://www.ipma.pt/en/riscoincendio/rcm.pt/', 'IPMA fire risk')} · ${a('https://www.ipma.pt/en/otempo/prev.uv/', 'IPMA UV')}</p></section>
${faroTemp.html}`,
    md: `Each Algarve municipality, from IPMA's open data via the PrompTugal.news place data, read ${lisbon(faro.read_at)}.\n\n## Warnings in force\n\n${w.md}\n\n## The sea\n\n${Object.values(coasts).map(s => `- **${s.coast}**: waves up to ${cell(s.waves_max_m)} m, sea temperature up to ${cell(s.sea_temp_max_c)}°C (${s.date}).`).join('\n')}\n\n## Place by place\n\n| Place | Now (°C) | Today | Tomorrow | UV | Fire risk |\n|---|---|---|---|---|---|\n${rows.map(r => `| ${r.name} | ${cell(r.temp)} | ${r.today.t_max_c != null ? `${r.today.t_max_c}/${r.today.t_min_c}, ${WT[r.today.weather_type] || ''}, rain ${r.today.rain_prob_pct}%` : 'n/a'} | ${r.tomorrow.t_max_c != null ? `${r.tomorrow.t_max_c}/${r.tomorrow.t_min_c}, ${WT[r.tomorrow.weather_type] || ''}, rain ${r.tomorrow.rain_prob_pct}%` : 'n/a'} | ${r.uv ? r.uv.index : 'n/a'} | ${r.fire ? r.fire.level : 'n/a'} |`).join('\n')}\n\nSource: IPMA open data (api.ipma.pt).${faroTemp.md}`,
    provenance: prov({ code: ['built from IPMA\'s open data via the PrompTugal.news place data', ...(faroTemp.used ? ['and data.promptugal.news\'s weather history file for Faro, history/weather/faro.json (data.b@PrompTugal.dinis keeps it)'] : [])], agents: ['travel.b.charts@PrompTugal.dinis (Sonnet) drew the Faro chart; travel.b@PrompTugal.dinis reviewed it'] }),
  });
}

// ---------- events ----------
// What's on (travel.b@PrompTugal.dinis, 18 Nov 2026): festivals, markets, Christmas and New Year from the councils'
// and Visit Algarve's own agendas (data/research/events-algarve.json, travel.b.events@, Sonnet, each with its page and
// the date read), then the technology events the PrompTugal.news place desks list.
{
  const by = municipalities.concat(['algarve']).map(id => ({ id, name: placeName(id), events: ((desk[id] || {}).events || []) })).filter(p => p.events.length);
  const total = by.reduce((n, p) => n + p.events.length, 0);
  const ev = research.events;
  const KIND = { christmas: 'Christmas', market: 'Market', festival: 'Festival', music: 'Music', sport: 'Sport', food: 'Food', 'new-year': 'New Year', culture: 'Culture' };
  const whatson = ev ? ev.events.filter(e => (e.end || e.start) >= today).sort((x, y) => x.start.localeCompare(y.start) || x.place.localeCompare(y.place)) : [];
  const when = e => e.end && e.end !== e.start ? `${day(e.start)} to ${day(e.end)}` : day(e.start);
  const months = [...new Set(whatson.map(e => (e.start < today ? today : e.start).slice(0, 7)))];
  const monthName = ym => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(ym + '-15T12:00:00Z'));
  const inMonth = ym => whatson.filter(e => (e.start < today ? today : e.start).slice(0, 7) === ym);
  const evLi = e => `<li><strong>${esc(when(e))}</strong> · ${esc(placeName(e.place))}: <b>${esc(e.title)}</b>${e.name_pt ? ` <span lang="pt">(${esc(e.name_pt)})</span>` : ''}. ${esc(e.what || '')} <span class="meta">${esc(KIND[e.kind] || e.kind || '')}${e.free === true ? ' · free' : ''}${e.where ? ` · ${esc(e.where)}` : ''} · ${a(e.source.url, host(e.source.url))}, read ${esc(e.source.read)}</span></li>`;
  const evMd = e => `- **${when(e)}**, ${placeName(e.place)}: ${e.title}${e.name_pt ? ` (${e.name_pt})` : ''}. ${e.what || ''} ${ml(e.source.url, host(e.source.url))}, read ${e.source.read}.`;
  const gaps = ev ? (ev.gaps || []) : [];
  // the data site's events by place, minus any event the council research already lists (same link)
  const ours = new Set(whatson.map(e => e.source.url));
  const feedSeen = new Set(ours);
  const feed = [...algarveIds.filter(i => i !== 'algarve'), 'algarve'].map(id => { const p = `data/inputs/events/${id}.json`; if (!existsSync(p)) return null; const d = J(p); const events = (d.events || []).filter(e => e.url && e.startDate && !ours.has(e.url) && (e.endDate || e.startDate) >= today && !feedSeen.has(e.url) && feedSeen.add(e.url)).sort((x, y) => x.startDate.localeCompare(y.startDate)); return events.length ? { place: id, events, read_at: d.read_at, source: (d.source_note || '').split(';')[0] } : null; }).filter(Boolean);
  page({
    path: '/events/', title: "What's on in the Algarve",
    description: "Christmas markets, festivals, fairs, concerts and New Year in the Algarve, from the councils' and Visit Algarve's own agendas, each with its page and the date read; plus technology events by place.",
    body: `<h1>What's on in the Algarve</h1><p class="dek">${whatson.length ? `${whatson.length} events from the councils' and Visit Algarve's own agendas, from today to early January, each linked to the page its dates were read from. Dates change: check the organiser's page before you travel.` : 'The councils\' agendas are being read.'}</p>
${months.map(ym => `<section aria-labelledby="h-${ym}"><h2 id="h-${ym}">${esc(monthName(ym))}</h2><ul class="events">${inMonth(ym).map(evLi).join('')}</ul></section>`).join('\n')}
${feed.length ? `<section aria-labelledby="h-feed"><h2 id="h-feed">More from the councils' own lists</h2><p>From ${a('https://data.promptugal.news/api/v1/events/by-place/', 'data.promptugal.news')}, which reads the councils' event lists hourly. Titles as the council writes them, with the dates and a link to each event; for reference only, so open the council's page for details.</p>${feed.map(f => `<details><summary><strong>${esc(placeName(f.place))}</strong>: ${f.events.length} events in the next 60 days</summary><ul class="events">${f.events.map(e => `<li><strong>${esc(e.endDate && e.endDate !== e.startDate ? `${day(e.startDate)} to ${day(e.endDate)}` : day(e.startDate))}</strong>: ${a(e.url, nodash(e.name))}${e.location && e.location.name ? ` <span class="meta">${esc(nodash(e.location.name))}</span>` : ''}</li>`).join('')}</ul><p class="meta">Source: ${esc(f.source)}, read ${esc(lisbon(f.read_at))}.</p></details>`).join('')}</section>` : ''}
${gaps.length ? `<section aria-labelledby="h-evgaps"><h2 id="h-evgaps">What we could not read</h2><ul>${gaps.map(g => `<li>${esc(g.what)}: ${esc(g.why)}</li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="h-tech"><h2 id="h-tech">Technology and AI events, by place</h2><p>${total} events across ${by.length} Algarve places, as the PrompTugal.news place desks listed them.</p>
${by.map(p => `<h3 id="h-${esc(p.id)}">${esc(p.name)}</h3><ul class="events">${p.events.map(e => `<li><strong>${esc(e.date)}</strong>: ${a(e.url, e.title)} <span class="meta">read ${esc(e.read_on)}</span></li>`).join('')}</ul><p class="meta">From ${a(`https://promptugal.news/${(placesList.find(x => x.id === p.id) || {}).path || ''}`, `PrompTugal.news ${p.name}`)}.</p>`).join('\n')}</section>`,
    md: `${whatson.length} events from the councils' and Visit Algarve's agendas, today to early January. Dates change: check the organiser's page before you travel.\n\n${months.map(ym => `## ${monthName(ym)}\n\n${inMonth(ym).map(evMd).join('\n')}`).join('\n\n')}${gaps.length ? `\n\n## What we could not read\n\n${gaps.map(g => `- ${g.what}: ${g.why}`).join('\n')}` : ''}${feed.length ? `\n\n## More from the councils' own lists (data.promptugal.news, reference only)\n\n${feed.map(f => `### ${placeName(f.place)}\n\n${f.events.map(e => `- **${e.startDate}${e.endDate && e.endDate !== e.startDate ? ` to ${e.endDate}` : ''}**: ${ml(e.url, e.name)}`).join('\n')}`).join('\n\n')}` : ''}\n\n## Technology and AI events, by place\n\n${total} events across ${by.length} places, as listed by the PrompTugal.news place desks.\n\n${by.map(p => `### ${p.name}\n\n${p.events.map(e => `- **${e.date}**: ${ml(e.url, e.title)} (read ${e.read_on})`).join('\n')}`).join('\n\n')}`,
    provenance: prov({ agents: ev ? [`${ev.by} read the councils' and Visit Algarve's agendas on ${ev.read_at}; travel.b@PrompTugal.dinis checked a sample of them against their pages`] : [] }),
  });
}

// ---------- tourism ----------
{
  const t = research.tourism || {};
  const ser = t.series || [];
  const fmt = v => (typeof v === 'number' ? v.toLocaleString('en-GB') : v);
  const bars = s => {
    const pts = (s.points || []).slice(-13);
    const max = Math.max(...pts.map(p => +p.value || 0), 1);
    return `<figure class="bars" aria-label="${esc(s.title)}"><figcaption><strong>${esc(s.place)}</strong>: ${esc(s.title)} (${esc(s.unit)}). Latest, ${esc(pts.length ? pts[pts.length - 1].period : '')}: <strong>${esc(pts.length ? fmt(pts[pts.length - 1].value) : 'n/a')}</strong>${pts.length && pts[pts.length - 1].flag ? ` (${esc(pts[pts.length - 1].flag)})` : ''}.</figcaption><ol>${pts.map(p => `<li title="${esc(p.period)}: ${esc(fmt(p.value))}${p.flag ? ' ' + esc(p.flag) : ''}"><span class="bar" style="--h:${((+p.value || 0) / max * 100).toFixed(1)}%"></span><span class="v">${esc(fmt(p.value))}${p.flag ? ` <abbr title="INE flag">${esc(p.flag)}</abbr>` : ''}</span><span class="p">${esc(p.period)}</span></li>`).join('')}</ol><p class="meta">${esc(s.source.publisher)}${s.source.indicator ? `, indicator ${esc(s.source.indicator)}` : ''}. ${a(s.source.page || s.source.api, 'Source')}${s.source.licence ? ` · ${esc(s.source.licence)}` : ''}</p></figure>`;
  };
  page({
    path: '/tourism/', title: 'Tourism in numbers',
    description: 'Tourism as an industry in the Algarve and Portugal: guests, overnight stays and revenue from INE, Faro airport passengers, and what Turismo de Portugal publishes, each figure sourced.',
    provenance: prov({ agents: ['travel.data@PrompTugal.dinis (Sonnet) read INE\'s open API and official releases'] }),
    body: `<h1>Tourism in numbers</h1><p class="dek">Tourism as an industry: how many come, how long they stay and what it earns, from official statistics. A section for now; it grows as data.promptugal.news publishes its tourism sources.</p>
${(t.headlines || []).length ? `<section aria-labelledby="h-head"><h2 id="h-head">The latest figures</h2><ul class="items">${t.headlines.map(h => `<li>${esc(h.text)} <span class="meta">${a(h.url, h.publisher)}, ${esc(h.date)}</span></li>`).join('')}</ul></section>` : ''}
${ser.length ? `<section aria-labelledby="h-ser"><h2 id="h-ser">Month by month</h2>${ser.map(bars).join('')}</section>` : '<p>Being gathered.</p>'}
${(t.gaps || []).length ? `<section aria-labelledby="h-tg"><h2 id="h-tg">Gaps</h2><ul>${t.gaps.map(g => `<li><strong>${esc(g.what)}</strong>: ${esc(g.why)}</li>`).join('')}</ul></section>` : ''}`,
    md: `Tourism as an industry, from official statistics.\n\n## The latest figures\n\n${(t.headlines || []).map(h => `- ${h.text} (${ml(h.url, h.publisher)}, ${h.date})`).join('\n')}\n\n## Month by month\n\n${ser.map(s => `### ${s.title} (${s.unit}), ${s.place}\n\n| Period | Value |\n|---|---|\n${(s.points || []).slice(-13).map(p => `| ${p.period} | ${p.value}${p.flag ? ' ' + p.flag : ''} |`).join('\n')}\n\nSource: ${s.source.publisher} ${s.source.indicator || ''} ${s.source.page || s.source.api || ''}`).join('\n\n')}\n\n## Gaps\n\n${(t.gaps || []).map(g => `- **${g.what}**: ${g.why}`).join('\n')}`,
  });
}

// ---------- about ----------
{
  const okReads = manifest.reads.filter(r => r.status === 200).length;
  page({
    path: '/about/', title: 'How it is made', type: 'site',
    description: 'How travel.promptugal.news is made: the sources, the code, the agents and models, what a person checked, the gaps and refusals, and the rules we read by.',
    body: `<h1>How it is made</h1><p class="dek">travel.promptugal.news is one of five PrompTugal.news sites. It is built by an AI agent team for Dinis Cruz, who instructs it. Nothing here is official.</p>
<section aria-labelledby="h-who"><h2 id="h-who">Who makes it</h2><ul><li><strong>travel@PrompTugal.dinis</strong>, the lead agent (${MODELS.lead}): chooses what to show, writes the words and the code, reviews the sub-agents' work.</li><li><strong>travel.research@, travel.research.disruptions@ and travel.data@</strong> (${MODELS.sub}): research the operators, strikes and statistics; each file in <code>data/research/</code> names its author and model.</li><li><strong>A person</strong>: Dinis Cruz instructs the team. No person has yet checked this first version page by page.</li></ul></section>
<section aria-labelledby="h-data"><h2 id="h-data">Where the data comes from</h2><ul><li><strong>The place data</strong> of PrompTugal.news (${a('https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/data/by-place', 'data/by-place')}, public and signed): IPMA's weather, warnings, sea, UV and fire risk; adsb.lol's aircraft near Faro; events by place. Last pulled ${esc(lisbon(manifest.read_at))}: ${okReads} of ${manifest.reads.length} files read; each read's time and the start of its sha256 are in ${a('/api/v1/manifest.json', 'manifest.json')}.</li><li><strong>${a('https://data.promptugal.news/api/v1/', 'data.promptugal.news')}</strong>, the PrompTugal.news data site: since 18 November 2026 each place's "now" (IPMA's weather, warnings, sea, UV and fire risk; adsb.lol's aircraft near Faro) is read from its ${a('https://data.promptugal.news/api/v1/by-place/now/', '/api/v1/by-place/now/')} first. When its copy is more than ${esc(manifest.stale_after_hours || 3)} hours older than the pull, the same file from the place data is used instead; ${a('/api/v1/manifest.json', 'manifest.json')} says, place by place, which was used and why. Last pull: ${esc(Object.values(manifest.now || {}).filter(v => /data\.promptugal/.test(v.from || '')).length)} of ${esc(Object.keys(manifest.now || {}).length)} places from data.promptugal.news.</li><li><strong>Research</strong> by the sub-agents from official and operator pages, each fact with its page and the date read: ${[['transport-algarve', 'transport', research.transport], ['disruptions', 'disruptions', research.disruptions], ['tourism', 'tourism', research.tourism]].filter(x => x[2]).map(x => a(`/api/v1/${x[0]}.json`, x[1])).join(', ')}.</li><li>This site runs no collectors of its own.</li></ul></section>
<section aria-labelledby="h-rules"><h2 id="h-rules">The rules we read by</h2><ul><li>Public, official sources first; operators' published information only.</li><li>One request every 2 to 3 seconds, a named reader, a backoff. A refusal (403, a bot check, robots.txt) is respected and recorded as a gap, never worked around.</li><li>Where an operator's terms ask consent to reproduce its content (ANA, CP, Infraestruturas de Portugal), we give figures and titles in our own words, with the link.</li><li>Airline flights by callsign; every other aircraft only counted.</li><li>No private person's contact, ever. No advice: your airline or operator decides whether your service runs.</li></ul></section>
<section aria-labelledby="h-api"><h2 id="h-api">Reuse</h2><p>Everything this site shows is in its JSON: ${a('/api/v1/travel.json', '/api/v1/travel.json')} (the digest), the inputs and the research files beside it, and a markdown twin of every page (add <code>index.md</code> to any address). For language models: ${a('/llms.txt', 'llms.txt')}. Text CC BY 4.0, code Apache-2.0; adsb.lol data ODbL 1.0; IPMA data under IPMA's terms.</p></section>
<section aria-labelledby="h-pay"><h2 id="h-pay">Free to read</h2><p>This site carries no billing: only ${a('https://promptugal.news/', 'promptugal.news')} bills its readers (Dinis, 18 November 2026). Every page here is free, and may show any public data, IPMA's and Open-Meteo's included, each with its licence and where it came from.</p></section>
<section aria-labelledby="h-take"><h2 id="h-take">If we show something of yours</h2><p>Much of what this site shows comes from public bodies (councils, IPMA, INE) and from operators, each linked with its licence or terms. If you think we should not show your data, ${a('https://github.com/PrompTugal/PrompTugal__News__Travel/issues/new', 'open a public issue')} and we take it down while we talk (Dinis, 18 November 2026). Organisers can send their own events the same way: they are published, credited and dated as theirs.</p></section>
<section aria-labelledby="h-tm"><h2 id="h-tm">What runs on its own, and its threat models</h2><p>Three things run without a person: the data reader (${a('https://github.com/PrompTugal/PrompTugal__News__Travel/blob/dev/docs/threat-models/pull.md', 'threat model')}), the figures your browser loads from data.promptugal.news (${a('https://github.com/PrompTugal/PrompTugal__News__Travel/blob/dev/docs/threat-models/browser-data.md', 'threat model')}) and the page-view counter (${a('https://github.com/PrompTugal/PrompTugal__News__Travel/blob/dev/docs/threat-models/observability.md', 'threat model')}). Each says what it reads, what it writes, what it trusts, what could go wrong and how that is limited. security@PrompTugal.dinis reviews them.</p></section>
<section aria-labelledby="h-obs"><h2 id="h-obs">What is counted</h2><p>Page views and reading time are counted, publicly, in PrompTugal.news's observability lane for this site ("travel"), as on promptugal.news: the page, the time to the minute, the screen size class, the browser's language and time zone, and the country that time zone gives (a fixed table in the page, no lookup). No IP address, no cookie, no fingerprint. Do Not Track, Global Privacy Control and Pause in the footer turn it off. ${a('https://promptugal.news/newsroom/observability/index.html', 'The report')}.</p></section>`,
    md: `travel.promptugal.news is one of five PrompTugal.news sites, built by an AI agent team for Dinis Cruz. Nothing here is official.

## Who makes it

- travel@PrompTugal.dinis, lead agent (${MODELS.lead}).
- travel.research@, travel.research.disruptions@, travel.data@ (${MODELS.sub}): research.
- A person: Dinis Cruz instructs. No person has yet checked this first version page by page.

## Where the data comes from

- PrompTugal.news place data (data/by-place, public, signed): IPMA, adsb.lol, events. Pulled ${lisbon(manifest.read_at)}; ${okReads} of ${manifest.reads.length} files read. ${SITE}/api/v1/manifest.json
- data.promptugal.news (https://data.promptugal.news/api/v1/by-place/now/): each place's "now" is read from it first since 18 November 2026; the place data stands in when its copy is more than 3 hours older. manifest.json says which was used. Last pull: ${Object.values(manifest.now || {}).filter(v => /data\.promptugal/.test(v.from || '')).length} of ${Object.keys(manifest.now || {}).length} places from data.promptugal.news.
- Research files: ${SITE}/api/v1/transport-algarve.json, ${SITE}/api/v1/disruptions.json, ${SITE}/api/v1/tourism.json
- No collectors run here.

## Rules

Public, official sources first; polite reading; refusals recorded as gaps; operators' terms respected; airline flights by callsign, other aircraft counted only; no private contacts; no advice.

## Reuse

${SITE}/api/v1/travel.json, markdown twins, ${SITE}/llms.txt. Text CC BY 4.0, code Apache-2.0.

## Free to read

This site carries no billing: only promptugal.news bills its readers (Dinis, 18 November 2026). Every page here is free, and may show any public data, IPMA's and Open-Meteo's included, each with its licence and where it came from.

## What is counted

Page views and reading time, publicly, in PrompTugal.news's observability lane for this site ("travel"): the page, the time, the screen class, the language, the time zone and the country it gives; no IP address, no cookie, no fingerprint. Do Not Track, Global Privacy Control and Pause in the footer turn it off. https://promptugal.news/newsroom/observability/index.html`,
  });
}


// ---------- Storm Charles archive: flights and the wind (travel.b@, 18 Nov 2026; the Storm site's travel items,
// board/team/travel/storm-plan.md). From one frozen copy of data.promptugal.news's crosswind.json; METAR wind only.
if (existsSync('data/inputs/storm/crosswind.json')) {
  const cw = J('data/inputs/storm/crosswind.json'), meta = J('data/inputs/storm/README.json');
  const num = x => (Number.isFinite(x) ? x : null);
  const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:00`; };
  const COL = ['var(--red)', 'var(--sea)', 'var(--amber)', 'var(--green)'];
  const chart = ap => {
    const hours = (cw.hours_by_airport || {})[ap.icao] || [];
    const ends = (ap.runways || []).flatMap(r => (r.ends || []).map(e => String(e.end)));
    const W = 720, H = 240, L = 40, R = 40, T = 12, B = 30, n = Math.max(1, hours.length - 1);
    const vals = hours.flatMap(h => ends.flatMap(e => { const x = (h.by_runway_end || {})[e] || {}; return [num(x.cross_kt), num(x.gust_cross_kt)]; })).filter(v => v != null);
    const max = Math.max(10, Math.ceil((Math.max(0, ...vals) + 2) / 5) * 5);
    const X = i => (L + (W - L - R) * i / n).toFixed(1), Y = v => (T + (H - T - B) * (1 - v / max)).toFixed(1);
    const line = (e, key, dash) => { const pts = hours.map((h, i) => { const v = num(((h.by_runway_end || {})[e] || {})[key]); return v == null ? null : `${X(i)},${Y(Math.abs(v))}`; }).filter(Boolean); return pts.length > 1 ? `<polyline fill="none" style="stroke:${COL[ends.indexOf(e) % 4]}" stroke-width="${dash ? 1 : 2}"${dash ? ' stroke-dasharray="3 3"' : ''} points="${pts.join(' ')}"/>` : ''; };
    const grid = [0, max / 2, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="currentColor">${esc(v)}</text>`).join('');
    const ticks = hours.map((h, i) => (i % 6 === 0 ? `<text x="${X(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="currentColor">${esc(hhmm(h.t))}</text>` : '')).join('');
    const peak = ends.map(e => { let best = null; for (const h of hours) { const v = num(((h.by_runway_end || {})[e] || {}).cross_kt); if (v != null && (!best || Math.abs(v) > best.v)) best = { v: Math.abs(v), t: h.t }; } return best ? `runway end ${esc(e)}: ${esc(best.v.toFixed(1))} kt at ${esc(hhmm(best.t))} UTC` : ''; }).filter(Boolean).join('; ');
    return { svg: `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Crosswind at ${ap.name}, by runway end, hour by hour`)}">${grid}${ends.map(e => line(e, 'gust_cross_kt', true) + line(e, 'cross_kt', false)).join('')}${ticks}</svg><figcaption>${ends.map((e, i) => `<span style="color:${COL[i % 4]}">&#9644;</span> runway end ${esc(e)}`).join(' &nbsp; ')} &nbsp; (dashed: in gusts). Knots across the runway; day and hour UTC. The two ends of one runway feel the same crosswind, so their lines lie on top of each other.</figcaption></figure>`, peak, hours: hours.length };
  };
  const aps = (cw.airports || []).map(ap => ({ ap, ...chart(ap) }));
  page({
    path: '/storm-charles/flights/', title: 'Storm Charles: flights and the wind',
    description: 'The crosswind on each runway at Lisbon and Madeira airports during Storm Charles (10 to 12 November 2026), hour by hour, from the airports\' own weather reports (METAR). An archive.',
    body: `<h1>Storm Charles: flights and the wind</h1><p class="dek">An archive of Storm Charles (10 to 12 November 2026). How hard the wind blew across each runway at Lisbon and Madeira, hour by hour, from the weather reports the airports publish (METAR). Strong crosswinds are what close runways and send flights elsewhere. This is a record, not today's weather: for that, see ${a('/weather/', 'weather and sea')}.</p>
${aps.map(({ ap, svg, peak, hours }) => `<section aria-labelledby="h-${esc(ap.icao)}"><h2 id="h-${esc(ap.icao)}">${esc(ap.name)} (${esc(ap.iata)})</h2>${svg}<p>Highest crosswind: ${peak || 'not known'}. ${esc(hours)} hourly reports.</p></section>`).join('\n')}
<section aria-labelledby="h-how-cw"><h2 id="h-how-cw">How it was made</h2><p>${esc(cw.about || '')}</p><p class="meta">The data: ${a(meta.source, 'data.promptugal.news, the Storm Charles archive')} (read ${esc(meta.read_at)}), made by the Storm Charles site's team. Wind: METAR from IPMA, through the US NOAA Aviation Weather Center (${a('https://aviationweather.gov/', 'aviationweather.gov')}, public domain). Runways: ${a('https://ourairports.com/data/', 'OurAirports')} (public domain). The file also counts departures from the OpenSky Network; they are not shown here, as OpenSky asks for non-commercial use.</p></section>`,
    md: `An archive of Storm Charles (10 to 12 November 2026): the crosswind on each runway at Lisbon and Madeira, hour by hour, from METAR.\n\n${aps.map(({ ap, peak, hours }) => `## ${ap.name} (${ap.iata})\n\nHighest crosswind: ${peak.replace(/<[^>]+>/g, '') || 'not known'}. ${hours} hourly reports.`).join('\n\n')}\n\nData: ${ml(meta.source, 'data.promptugal.news Storm Charles archive')}, read ${meta.read_at}. Wind: METAR (IPMA via NOAA aviationweather.gov, public domain). Runways: OurAirports (public domain). OpenSky departures not shown (non-commercial use).`,
    provenance: prov({ code: ['the chart is drawn at build time from the archive\'s numbers'], agents: ['the Storm Charles site\'s flights team (incident.flights@web-summit.dinis) compiled the data in November 2026'] }),
  });
}

// ---------- Beyond Portugal: London (Dinis, 18 Nov 2026 ~22:20 UTC; board/guidance/2026-11-18-london.md). From
// data.promptugal.news's /api/v1/by-place/now/london.json (data.b@: Open-Meteo forecast, Environment Agency floods).
const london = existsSync('data/inputs/beyond/now/london.json') ? J('data/inputs/beyond/now/london.json') : null;
const ukTime = iso => { const d = new Date(iso); return isNaN(d) ? 'not known' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(d) + ' London'; };
// WMO weather codes as Open-Meteo uses them (https://open-meteo.com/en/docs), in plain English.
const WMO = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'light showers', 81: 'showers', 82: 'heavy showers', 85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail' };
const numC = v => (Number.isFinite(v) ? `${Math.round(v)}°C` : 'n/a');
const londonDays = () => ((london && london.forecast && london.forecast.days) || []).filter(x => typeof x.date === 'string');
const faroDays = () => ((faro.forecast && faro.forecast.days) || []).filter(x => typeof x.date === 'string');
const sideBySide = () => {
  const ld = londonDays(), fd = Object.fromEntries(faroDays().map(x => [x.date, x]));
  if (!ld.length) return { html: '<p>London\'s forecast is not available at this build.</p>', md: 'London\'s forecast is not available at this build.' };
  const rows = ld.map(l => { const f = fd[l.date] || {}; return { date: l.date, day: day(l.date), lon: `${numC(l.t_min_c)} to ${numC(l.t_max_c)}, ${(Object.hasOwn(WMO, l.weather_code) && WMO[l.weather_code]) || 'weather not known'}${Number.isFinite(l.rain_mm) ? `, ${l.rain_mm} mm rain` : ''}`, faro: f.date ? `${numC(f.t_min_c)} to ${numC(f.t_max_c)}, ${(Object.hasOwn(WT, f.weather_type) && WT[f.weather_type]) || 'weather not known'}${Number.isFinite(f.rain_prob_pct) ? `, ${f.rain_prob_pct}% chance of rain` : ''}` : 'not in the forecast' }; });
  const note = `London: ${a('https://open-meteo.com/', 'Weather data by Open-Meteo.com')}, read ${esc(ukTime(london.forecast.at))} via ${a(london.forecast.source, 'data.promptugal.news')}. Faro: IPMA's forecast, read ${esc(lisbon(faro.read_at))}. The two forecasts come from different services and are not measured the same way (rain in millimetres for London, a chance of rain for Faro).`;
  return {
    html: `<table><thead><tr><th>Day</th><th>London</th><th>Faro</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.day)}</td><td data-now-london="${esc(r.date)}">${esc(r.lon)}</td><td>${esc(r.faro)}</td></tr>`).join('')}</tbody></table><p class="meta">${note}</p>`,
    md: `| Day | London | Faro |\n|---|---|---|\n${rows.map(r => `| ${mdesc(r.day)} | ${mdesc(r.lon)} | ${mdesc(r.faro)} |`).join('\n')}\n\nLondon: ${ml('https://open-meteo.com/', 'Weather data by Open-Meteo.com')}, via data.promptugal.news. Faro: IPMA.`,
  };
};
// Measured rain in London (EA rain gauges, daily totals in UTC days), beside the forecast for the same day.
const eaRainTable = (() => {
  const ea = existsSync('data/inputs/beyond/ea-flood.json') ? J('data/inputs/beyond/ea-flood.json') : null;
  if (!ea || !ea.daily_rain || typeof ea.daily_rain !== 'object') return { html: '', md: '' };
  const fc = Object.fromEntries(londonDays().map(x => [x.date, x]));
  const days = Object.keys(ea.daily_rain).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-7).reverse();
  const rows = days.map(k => { const g = Object.values(ea.daily_rain[k] || {}).filter(v => v && Number.isFinite(v.rain_mm) && Number.isFinite(v.readings));
    if (!g.length) return null; const mm = g.map(v => v.rain_mm).sort((x, y) => x - y); const med = mm.length % 2 ? mm[(mm.length - 1) / 2] : (mm[mm.length / 2 - 1] + mm[mm.length / 2]) / 2;
    const full = g.filter(v => v.readings >= 90).length; const f = fc[k];
    return { day: day(k), gauges: g.length, full, lo: mm[0], hi: mm.at(-1), med: Math.round(med * 10) / 10, fc: f && Number.isFinite(f.rain_mm) ? `${f.rain_mm} mm` : 'not kept', today: k === today }; }).filter(Boolean);
  if (!rows.length) return { html: '', md: '' };
  const fmt = r => `${r.med} mm (gauges from ${r.lo} to ${r.hi} mm)`;
  const note = `Measured by ${rows[0].gauges} Environment Agency rain gauges around London (${a('https://environment.data.gov.uk/flood-monitoring/doc/reference', 'real-time flood-monitoring API')}), read ${esc(ukTime(ea.read_at))} via ${a('https://data.promptugal.news/api/v1/ea-flood/latest.json', 'data.promptugal.news')}. This uses Environment Agency rainfall data from the real-time data API (Beta). Days are UTC; a full day is 96 readings, and today is not yet complete. The forecast is Open-Meteo's for the same day; earlier days' forecasts are not kept yet, so most rows have none.`;
  return {
    html: `<section aria-labelledby="h-lon-rain"><h2 id="h-lon-rain">Rain measured in London</h2><table><thead><tr><th>Day</th><th>Measured (median of gauges)</th><th>Forecast</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.day)}${r.today ? ' (so far)' : ''}</td><td>${esc(fmt(r))}</td><td>${esc(r.fc)}</td></tr>`).join('')}</tbody></table><p class="meta">${note}</p></section>`,
    md: `\n\n## Rain measured in London\n\n| Day | Measured (median of gauges) | Forecast |\n|---|---|---|\n${rows.map(r => `| ${mdesc(r.day)}${r.today ? ' (so far)' : ''} | ${mdesc(fmt(r))} | ${mdesc(r.fc)} |`).join('\n')}\n\nEnvironment Agency rain gauges, via data.promptugal.news. Days are UTC.`,
  };
})();
// What we said beside what happened (designer@ PF1 to PF9; Dinis, 18 Nov 2026, "show the past"): one bar per day, past first,
// today, then the forecast. From data/inputs/beyond/history/london.json (data.promptugal.news's history/weather/london.json).
import { model as pastModel, tree as pastTree, TAGS as PAST_TAGS, okAttr as pastOkAttr } from '../src/assets/past-chart.mjs';
const historyFile = 'data/inputs/beyond/history/london.json';
const eaRain = (() => {
  let h = null;
  try { h = existsSync(historyFile) ? J(historyFile) : null; } catch { h = null; }
  if (!h || h.place !== 'london' || !Array.isArray(h.rows)) return eaRainTable;
  // the logic and the drawing live in src/assets/past-chart.mjs, shared with the browser (past-chart-live.mjs)
  const m = pastModel(h, londonDays(), today);
  if (!m) return eaRainTable;
  const { track, first } = m, tbl = m.table;
  const svg = svgOf(pastTree(m));
  const read = typeof h.data_read_at === 'string' ? ukTime(h.data_read_at) : 'not known';
  const histUrl = 'https://data.promptugal.news/api/v1/history/weather/london.json';
  const note = `Measured: Environment Agency rain gauges around London, mean of the gauges, days in UTC (${a('https://environment.data.gov.uk/flood-monitoring/doc/reference', 'OGL v3.0')}). Forecast: ${a('https://open-meteo.com/', 'Open-Meteo')} (CC BY 4.0), and what we said is the forecast kept the day before. Read <span data-now="rain-read">${esc(read)}</span>; ${a(histUrl, 'the history file')}. A day is complete when its gauges have all their readings.`;
  const table = `<details><summary>Table view</summary><div class="tscroll"><table><thead><tr><th>Day</th><th>Measured</th><th>What we said the day before</th><th>Difference</th><th>Forecast</th></tr></thead><tbody data-now="rain-table">${tbl.map(r => `<tr><td>${esc(r.day)}</td><td>${esc(r.meas)}</td><td>${esc(r.said)}</td><td>${esc(r.diff)}</td><td>${esc(r.fc)}</td></tr>`).join('')}</tbody></table></div></details>`;
  return {
    used: histUrl,
    html: `<section aria-labelledby="h-lon-rain"><h2 id="h-lon-rain">Rain in London: what we said and what happened</h2><figure class="chart" data-now="rain-chart" data-read="${esc(typeof h.data_read_at === 'string' ? h.data_read_at : '')}"><div class="chart-wide">${svg}</div><figcaption>${esc(track)}</figcaption></figure>${table}<p class="meta">${note}</p></section>`,
    md: `\n\n## Rain in London: what we said and what happened\n\n${mdesc(track)}\n\n| Day | Measured | What we said the day before | Difference | Forecast |\n|---|---|---|---|---|\n${tbl.map(r => `| ${mdesc(r.day)} | ${mdesc(r.meas)} | ${mdesc(r.said)} | ${mdesc(r.diff)} | ${mdesc(r.fc)} |`).join('\n')}\n\nMeasured: Environment Agency rain gauges (OGL v3.0). Forecast: Open-Meteo (CC BY 4.0). Read ${mdesc(read)}. ${ml(histUrl, 'History file')}.`,
  };
})();
if (london) {
  const fl = (london.floods || {}), warns = (fl.warnings || []).filter(w => w && typeof w.area === 'string');
  const sb = sideBySide();
  page({
    path: '/london/', title: 'Beyond Portugal: London', script: '/assets/now.js', extraModule: '/assets/past-chart-live.mjs',
    description: 'London for a visitor: the three-day forecast (Open-Meteo) beside Faro\'s, and the Environment Agency\'s flood alerts and warnings. The first place beyond Portugal. Each value with its source and the time read.',
    body: `<h1>Beyond Portugal: London</h1><p class="dek">The first place on this site outside Portugal. For a visitor: the weather for the next three days, side by side with Faro, and any flood alerts. London's transport (TfL) and its airports come next, as data.promptugal.news collects them. See also ${a('/uk-portugal/', 'the UK and Portugal')}.</p>
<section aria-labelledby="h-lon-wx"><h2 id="h-lon-wx">The next three days, London and Faro</h2>${sb.html}</section>
${eaRain.html}
<section aria-labelledby="h-lon-fl"><h2 id="h-lon-fl">Flood alerts and warnings</h2>${warns.length ? `<ul data-now="london-floods">${warns.map(w => `<li><strong>${esc(w.severity || 'Notice')}</strong>: ${a(w.url, w.area)}</li>`).join('')}</ul>` : '<p>None in force at the time read.</p>'}<p class="meta">From the Environment Agency (${a('https://check-for-flooding.service.gov.uk/', 'Check for flooding')}), read ${esc(ukTime(fl.at))} via ${a(fl.source, 'data.promptugal.news')}. ${esc(fl.attribution || '')}. Not a warning service: for flooding follow the Environment Agency, and the Met Office for the weather.</p></section>`,
    md: `The first place on this site outside Portugal.\n\n## The next three days, London and Faro\n\n${sb.md}${eaRain.md}\n\n## Flood alerts and warnings\n\n${warns.length ? warns.map(w => `- ${mdesc(w.severity || 'Notice')}: ${ml(w.url, w.area)}`).join('\n') : 'None in force at the time read.'}\n\nFrom the Environment Agency, via data.promptugal.news. Not a warning service.\n`,
    ipma: true,
    provenance: prov({ code: ['built from data.promptugal.news\'s now file for London', ...(eaRain.used ? ["and its rain history file for London, history/weather/london.json"] : [])], agents: ['data.b@PrompTugal.dinis collects the London sources; travel.b@PrompTugal.dinis wrote this page'] }),
  });
}

// ---------- the UK and Portugal (Dinis, 18 Nov 2026 ~22:25 UTC: "there's a lot of tourism that comes from the UK to
// Portugal"; PrompTugal__News__Website board/guidance/2026-11-18-london.md). From data/research/uk-portugal.json
// (travel.b.research@, Sonnet; travel.b@ re-read the ONS table and the FCDO page on 18 Nov).
if (existsSync('data/research/uk-portugal.json')) {
  const uk = J('data/research/uk-portugal.json');
  const n = v => (Number.isFinite(v) ? v.toLocaleString('en-GB') : esc(v));
  const fig = x => (x.unit === '£ million' ? `£${n(x.value)} million` : `${n(x.value)} ${esc(x.unit)}`);
  const ons = uk.ons || [];
  const src1 = ons[0];
  const UKA = { EZY: 'easyJet', EXS: 'Jet2', BAW: 'British Airways', TOM: 'TUI Airways', RUK: 'Ryanair UK', WUK: 'Wizz Air UK', LOG: 'Loganair' };
  const seen = {};
  for (const r of series) for (const [c, k] of Object.entries(r.by_airline || {})) if (UKA[c] && Number.isFinite(k)) seen[c] = (seen[c] || 0) + k;
  const seenList = Object.entries(seen).sort((x, y) => y[1] - x[1]);
  const adv = l => (l || []).filter(x => x.detail && !/^Not stated|did not mention/.test(x.detail));
  const advHtml = l => `<ul>${adv(l).map(x => `<li><strong>${esc(x.point)}.</strong> ${esc(nodash(x.detail))} <span class="meta">(${a(x.url, x.publisher)}, read ${esc(String(x.read_at).slice(0, 10))})</span></li>`).join('')}</ul>`;
  const advMd = l => adv(l).map(x => `- **${mdesc(x.point)}.** ${mdesc(nodash(x.detail))} (${ml(x.url, x.publisher)}, read ${String(x.read_at).slice(0, 10)})`).join('\n');
  // Eurostat: nights in Portugal by country of origin (tour_occ_ninraw), via data.promptugal.news (data.b@).
  const es = existsSync('data/inputs/beyond/eurostat-tourism.json') ? J('data/inputs/beyond/eurostat-tourism.json') : null;
  const esChart = (() => {
    if (!es) return { html: '', md: '' };
    const P = ['UK', 'DE', 'FR', 'ES', 'US', 'NL'];
    const rows = (es.rows || []).filter(r => r && r.dataset === 'tour_occ_ninraw' && r.geo === 'PT' && P.includes(r.partner) && /^\d{4}$/.test(String(r.time)) && Number.isFinite(r.nights));
    // one pass into maps (security post-review: no per-lookup scans, no spread of a large array), last 30 years at most
    const byKey = new Map(), labels = new Map();
    for (const r of rows) { byKey.set(`${r.partner}|${+r.time}`, r.nights); if (!labels.has(r.partner) && typeof r.partner_label === 'string') labels.set(r.partner, r.partner_label); }
    const years = [...new Set(rows.map(r => +r.time))].sort((x, y) => x - y).slice(-30);
    if (years.length < 2) return { html: '', md: '' };
    const label = c => labels.get(c) || c;
    const val = (c, y) => byKey.get(`${c}|${y}`);
    const max = rows.reduce((m, r) => (r.nights > m ? r.nights : m), 0), top = Math.ceil(max / 2e6) * 2e6;
    if (!(top > 0)) return { html: '', md: '' };
    const W = 720, H = 300, L = 56, R = 130, T = 14, B = 30;
    const x = y => L + (W - L - R) * (y - years[0]) / (years.at(-1) - years[0]);
    const yv = v => T + (H - T - B) * (1 - v / top);
    const grid = [0, top / 2, top].map(v => `<line x1="${L}" x2="${W - R}" y1="${yv(v)}" y2="${yv(v)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${yv(v) + 4}" text-anchor="end" font-size="11" fill="currentColor">${v / 1e6}m</text>`).join('');
    const ticks = years.filter((y, i) => i % 3 === 0 || y === years.at(-1)).map(y => `<text x="${x(y)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="currentColor">${y}</text>`).join('');
    // end labels, pushed apart so none overlap (at least 14px between them)
    const ly = {}; P.map(c => [c, val(c, years.at(-1))]).filter(([, v]) => Number.isFinite(v)).sort((p1, p2) => p2[1] - p1[1]).reduce((prev, [c, v]) => { const y0 = Math.max(yv(v) + 4, prev + 14); ly[c] = y0; return y0; }, -Infinity);
    const lines = P.slice().reverse().map(c => { const pts = years.map(y => [y, val(c, y)]).filter(([, v]) => Number.isFinite(v)); if (!pts.length) return ''; const uk = c === 'UK'; const last = pts.at(-1);
      return `<polyline fill="none" style="stroke:${uk ? 'var(--sea)' : 'var(--muted)'};stroke-width:${uk ? 3 : 1.5};opacity:${uk ? 1 : 0.6}" points="${pts.map(([y, v]) => `${x(y).toFixed(1)},${yv(v).toFixed(1)}`).join(' ')}"/><text x="${x(last[0]) + 6}" y="${(ly[c] ?? yv(last[1]) + 4).toFixed(1)}" font-size="${uk ? 13 : 11}" ${uk ? 'font-weight="600" style="fill:var(--sea)"' : 'fill="currentColor"'}>${esc(label(c))}</text>`; }).join('');
    const ukLast = val('UK', years.at(-1));
    const ds = (es.datasets || []).find(d => d && d.dataset === 'tour_occ_ninraw') || {};
    const cap = `Nights in Portugal's tourist accommodation by the visitor's country of residence, ${years[0]} to ${years.at(-1)}. Source: Eurostat, ${a(ds.page, 'tour_occ_ninraw')}, via ${a('https://data.promptugal.news/api/v1/eurostat-tourism/latest.json', 'data.promptugal.news')} (read ${esc(lisbon(es.read_at))}).`;
    const table = `<table><thead><tr><th>Country</th>${years.slice(-3).map(y => `<th>${y}</th>`).join('')}</tr></thead><tbody>${P.map(c => `<tr><td>${esc(label(c))}</td>${years.slice(-3).map(y => `<td>${Number.isFinite(val(c, y)) ? val(c, y).toLocaleString('en-GB') : 'n/a'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return {
      html: `<section aria-labelledby="h-es"><h2 id="h-es">Nights in Portugal by country, ${years[0]} to ${years.at(-1)}</h2><p>Visitors from the United Kingdom spent ${Number.isFinite(ukLast) ? ukLast.toLocaleString('en-GB') : 'n/a'} nights in Portugal's hotels and other tourist accommodation in ${years.at(-1)}: more than from any other country shown here.</p><figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Nights in Portugal by country of residence, ${years[0]} to ${years.at(-1)}; the United Kingdom highest in ${years.at(-1)}`)}">${grid}${lines}${ticks}</svg><figcaption>${cap}</figcaption></figure>${table}<p class="meta">Eurostat names countries for Portugal as a whole only; the Algarve has domestic and foreign totals but no country split. travel.b@ re-read the UK's 2024 and 2025 figures in Eurostat's own API on 18 Nov 2026.</p></section>`,
      md: `\n\n## Nights in Portugal by country, ${years[0]} to ${years.at(-1)}\n\n| Country | ${years.slice(-3).join(' | ')} |\n|---|${years.slice(-3).map(() => '---').join('|')}|\n${P.map(c => `| ${mdesc(label(c))} | ${years.slice(-3).map(y => Number.isFinite(val(c, y)) ? val(c, y).toLocaleString('en-GB') : 'n/a').join(' | ')} |`).join('\n')}\n\nSource: Eurostat, ${ml(ds.page, 'tour_occ_ninraw')}, via data.promptugal.news.`,
    };
  })();
  page({
    path: '/uk-portugal/', title: 'The UK and Portugal', script: london ? '/assets/now.js' : '',
    description: 'British visitors to Portugal in numbers (ONS), what a British visitor needs to enter Portugal and what a Portuguese visitor needs for the UK (gov.uk), and UK airlines seen near Faro. Each value with its source and the date read.',
    body: `<h1>The UK and Portugal</h1><p class="dek">Beyond Portugal: the link with the UK. Residents of Great Britain made ${src1 ? n(src1.value) : 'many'} visits to Portugal in 2025. Below: the numbers, the rules both ways, and the UK airlines our receivers see near Faro. London itself comes when its data does.</p>
<section aria-labelledby="h-ons"><h2 id="h-ons">British visitors to Portugal, 2025</h2><table><thead><tr><th>What</th><th>2025</th></tr></thead><tbody>${ons.map(x => `<tr><td>${esc(x.title)}</td><td>${fig(x)}</td></tr>`).join('')}</tbody></table>
<p class="meta">Source: ${src1 ? a(src1.url, 'ONS, Travel trends 2025, UK residents\' visits abroad') : 'ONS'}, ${esc(src1 ? src1.flag || '' : '')}. Great Britain residents only (Northern Ireland is not in the country table). travel.b@ re-read the total, holiday and visiting-friends figures in the table on 18 Nov 2026.</p></section>
${esChart.html}
<section aria-labelledby="h-to-pt"><h2 id="h-to-pt">A British visitor going to Portugal</h2>${advHtml(uk.advice_uk_to_pt)}</section>
<section aria-labelledby="h-to-uk"><h2 id="h-to-uk">A Portuguese or EU visitor going to the UK</h2>${advHtml(uk.advice_pt_to_uk)}</section>
<section aria-labelledby="h-faro-uk"><h2 id="h-faro-uk">UK airlines seen near Faro</h2>${seenList.length ? `<p>Across our ${series.length} reads of the sky within 40 nautical miles of Faro airport (adsb.lol), we saw: ${seenList.map(([c, k]) => `${esc(UKA[c])} ${k}`).join(', ')}. A flight seen near Faro is not always to or from the UK.</p>` : `<p>No UK airline in our ${series.length} reads near Faro so far.</p>`}<p class="meta">${a('/flights/', 'Flights at Faro')} · ${a('/api/v1/faro-airport.jsonl', 'the series')}</p></section>
${london ? `<section aria-labelledby="h-uk-wx"><h2 id="h-uk-wx">Weather side by side, London and Faro</h2>${sideBySide().html}<p class="meta">${a('/london/', 'More on London')}</p></section>` : ''}
<section aria-labelledby="h-gaps-uk"><h2 id="h-gaps-uk">Not here yet</h2><ul>${(uk.gaps || []).map(g => `<li>${esc(nodash(g.what))}: ${esc(nodash(g.why))}</li>`).join('')}<li>London's weather, transport and airports: waiting on data.promptugal.news's UK feeds.</li></ul></section>`,
    md: `Beyond Portugal: the link with the UK.\n\n## British visitors to Portugal, 2025\n\n| What | 2025 |\n|---|---|\n${ons.map(x => `| ${mdesc(x.title)} | ${mdesc(fig(x).replace(/&amp;/g, '&'))} |`).join('\n')}\n\nSource: ${src1 ? ml(src1.url, 'ONS Travel trends 2025') : 'ONS'}. Great Britain residents only.${esChart.md}\n\n## A British visitor going to Portugal\n\n${advMd(uk.advice_uk_to_pt)}\n\n## A Portuguese or EU visitor going to the UK\n\n${advMd(uk.advice_pt_to_uk)}\n\n## UK airlines seen near Faro\n\nAcross ${series.length} reads within 40 nautical miles of Faro (adsb.lol):\n\n${seenList.length ? seenList.map(([c, k]) => `- ${UKA[c]}: ${k}`).join('\n') : '- none so far'}${london ? `\n\n## Weather side by side, London and Faro\n\n${sideBySide().md}` : ''}\n\n## Not here yet\n\n${(uk.gaps || []).map(g => `- ${mdesc(nodash(g.what))}: ${mdesc(nodash(g.why))}`).join('\n')}\n`,
    ipma: !!london,
    provenance: prov({ agents: ['travel.b.research@PrompTugal.dinis (Sonnet) read ONS and gov.uk on 18 Nov 2026', 'travel.b@PrompTugal.dinis re-read the ONS table and the FCDO page'] }),
  });
}

// ---------- security (Dinis, 18 Nov 2026, ~15:15 UTC: every vulnerability, bug and breach is published) ----------
{
  const sec = J('data/editorial/security.json');
  const TM = [['pull.md', 'The data reader (scripts/pull.mjs)'], ['browser-data.md', 'The figures your browser loads (now.js)'], ['scheduled-rebuild.md', 'The scheduled rebuild (retired 19 Nov 2026)'], ['observability.md', 'The page-view counter (obs.js)']];
  const G = 'https://github.com/PrompTugal/PrompTugal__News__Travel/blob/dev/docs/threat-models/';
  const row = f => f.state === 'open'
    ? `<tr><td>${esc(f.title)}</td><td>${esc(f.severity)}</td><td colspan="4">Open: details published when fixed.</td><td>${esc(f.state)}</td></tr>`
    : `<tr><td><strong>${esc(f.title)}</strong><br><span class="meta">${esc(f.detail)}</span></td><td>${esc(f.severity)}</td><td>${esc(f.file)}</td><td>${esc(f.found)}, ${esc(f.found_by)}</td><td>${esc(f.fix)}</td><td>${f.commit ? a(`https://github.com/PrompTugal/PrompTugal__News__Travel/commit/${f.commit}`, f.commit) : ''}</td><td>${esc(f.state)}</td></tr>`;
  page({
    path: '/security/', title: 'Security', type: 'site',
    description: 'Every security finding on travel.promptugal.news, published: severity, where, how it was found, the fix and its commit; and the threat models of what runs on its own.',
    body: `<h1>Security</h1><p class="dek">Every vulnerability, bug and breach we find on this site is published here. Open findings show only their title, severity and state until they are fixed. The log for all PrompTugal sites: ${a(sec.central_log, 'promptugal.news/security')}. Found something? ${a('https://github.com/PrompTugal/PrompTugal__News__Travel/issues/new', 'Open an issue')}.</p>
<section aria-labelledby="h-find"><h2 id="h-find">Findings</h2><div class="table"><table class="ledger"><thead><tr><th>Finding</th><th>Severity</th><th>Where</th><th>Found</th><th>Fix</th><th>Commit</th><th>State</th></tr></thead><tbody>${sec.findings.map(row).join('')}</tbody></table></div></section>
<section aria-labelledby="h-tms"><h2 id="h-tms">Threat models</h2><ul>${TM.map(([f, t]) => `<li>${a(G + f, t)}</li>`).join('')}</ul><p>Each says what the automation reads, what it writes, what it trusts, what could go wrong and how that is limited. Reviewed by security@PrompTugal.dinis.</p></section>
<section aria-labelledby="h-how"><h2 id="h-how">How we look</h2><p>At every wake the lead agent runs a security review before and after the work, and an application-security review of any code change before it is committed. security@PrompTugal.dinis reviews every commit across the PrompTugal sites.</p></section>`,
    md: `Every vulnerability, bug and breach we find on this site is published here; open ones show only title, severity and state until fixed. All PrompTugal sites: ${sec.central_log}\n\n## Findings\n\n${sec.findings.map(f => f.state === 'open' ? `- **${mdesc(f.title)}** (${f.severity}): open.` : `- **${mdesc(f.title)}** (${f.severity}, ${f.state}): ${mdesc(f.detail)} Fix: ${mdesc(f.fix)} Commit ${f.commit}. Found ${f.found} by ${mdesc(f.found_by)}.`).join('\n')}\n\n## Threat models\n\n${TM.map(([f, t]) => `- ${ml(G + f, t)}`).join('\n')}`,
    provenance: prov({ agents: ['travel.b.security@PrompTugal.dinis (Sonnet) ran the application-security review of 18 Nov 2026'] }),
  });
}

// ---------- no reading account (Dinis, 18 Nov 2026 ~23:45 UTC; board/guidance/2026-11-18-billing-only-on-the-main-site.md):
// only promptugal.news bills, so this site has no meter, no top-up and no billing pages; the chip says the site is free.

// ---------- API, llms.txt, sitemap ----------
mkdirSync('_site/api/v1', { recursive: true });
writeFileSync('_site/api/v1/manifest.json', JSON.stringify(withLicJson({ license_ours: OURS, ...manifest }), null, 2) + '\n');
for (const [k, f] of [['events-algarve', 'data/research/events-algarve.json'], ['transport-algarve', 'data/research/transport-algarve.json'], ['disruptions', 'data/research/disruptions.json'], ['tourism', 'data/research/tourism.json'], ['holidays', 'data/editorial/holidays.json']]) if (existsSync(f)) writeFileSync(`_site/api/v1/${k}.json`, JSON.stringify(withLicJson({ license_ours: OURS, ...J(f) }), null, 2) + '\n');
if (existsSync('data/series/faro-airport.jsonl')) cpSync('data/series/faro-airport.jsonl', '_site/api/v1/faro-airport.jsonl');
if (existsSync('data/predictions/predictions.jsonl')) cpSync('data/predictions/predictions.jsonl', '_site/api/v1/predictions.jsonl');
writeFileSync('_site/api/v1/licences.json', JSON.stringify(LIC, null, 2) + '\n');
writeFileSync('_site/api/v1/travel.json', JSON.stringify(withLicJson({ license_ours: OURS, licences: '/api/v1/licences.json',
  about: 'travel.promptugal.news digest: what the front page shows, each value with its source.', version, built, data_read: manifest.read_at,
  faro_now: { station: faro.station, forecast: faro.forecast, warnings: faro.warnings, sea: faro.sea },
  faro_airport: airport ? { ...airport, airline: (airport.airline || []).map(f => ({ ...f, airline_name: airlineName(f.airline) })) } : null,
  disruptions_ahead: upcoming, holidays: holidays ? holidays.days : [],
}), null, 2) + '\n');
const listed = pages.filter(p => !p.noindex);
writeFileSync('_site/llms.txt', `# PrompTugal.news Travel\n\n> Travel and tourism in Portugal, the Algarve first: flights at Faro, getting around, strikes and disruptions, weather and sea for visitors, events by place, tourism statistics. Every value with its source and the time read. Independent, not official. Version ${version}.\n\n## Pages (markdown twins)\n\n${listed.map(p => `- [${p.title}](${SITE}${p.path}index.md): ${p.description}`).join('\n')}\n\n## Data\n\n- [Digest](${SITE}/api/v1/travel.json)\n- [Inputs manifest](${SITE}/api/v1/manifest.json)\n- [Faro airport series](${SITE}/api/v1/faro-airport.jsonl)\n- [Disruptions](${SITE}/api/v1/disruptions.json)\n- [Transport](${SITE}/api/v1/transport-algarve.json)\n- [Tourism](${SITE}/api/v1/tourism.json)\n`);
writeFileSync('_site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${listed.map(p => `<url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('_site/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// ---------- /preview.svg: this site's own live numbers, for the sites bar (Dinis, 18 Nov 2026 ~22:00 UTC;
// PrompTugal__News__Website board/guidance/2026-11-18-the-sites-bar.md). Values from files read at this build only.
{
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const weekEnd = addDays(today, 6);
  const overlaps = (s, e) => typeof s === 'string' && s.slice(0, 10) <= weekEnd && (typeof e === 'string' ? e : s).slice(0, 10) >= today;
  const seen = new Set();
  let eventsWeek = 0;
  for (const e of ((research.events || {}).events || [])) if (overlaps(e.start, e.end) && !seen.has(e.url || e.id)) { seen.add(e.url || e.id); eventsWeek++; }
  if (existsSync('data/inputs/events')) for (const f of readdirSync('data/inputs/events').filter(f => /^[a-z0-9-]{1,40}\.json$/.test(f))) {
    for (const e of (J(join('data/inputs/events', f)).events || [])) { const k = e.url || e.name + e.startDate; if (overlaps(e.startDate, e.endDate) && !seen.has(k)) { seen.add(k); eventsWeek++; } }
  }
  const flights = airport && Array.isArray(airport.airline) ? airport.airline.length : null;
  const rd = (faro.station || {}).reading || {};
  const temp = Number.isFinite(rd.temp_c) ? `${Math.round(rd.temp_c)}°C` : 'n/a';
  const figs = [
    [flights == null ? 'n/a' : String(flights), flights === 1 ? 'airline flight near Faro' : 'airline flights near Faro', airport ? `adsb.lol, ${lisbon(airport.at)}` : 'adsb.lol'],
    [String(upcoming.length), upcoming.length === 1 ? 'disruption ahead' : 'disruptions ahead', 'our research, see /disruptions/'],
    [String(eventsWeek), eventsWeek === 1 ? 'event this week' : 'events this week', 'councils, data.promptugal.news'],
    [temp, 'at Faro airport', rd.at ? `IPMA, ${lisbon(rd.at)}` : 'IPMA'],
  ];
  const W = 1200, H = 630, cw = 270;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`travel.promptugal.news today: ${figs.map(f => `${f[0]} ${f[1]}`).join('; ')}`)}">
<title>travel.promptugal.news today</title>
<rect width="${W}" height="${H}" fill="#f6f3ec"/>
<rect x="0" y="0" width="${W}" height="10" fill="#0b5c7a"/>
<text x="60" y="100" font-family="Georgia, 'Times New Roman', serif" font-size="56" fill="#121317">PrompTugal.news Travel</text>
<text x="60" y="150" font-family="Arial, sans-serif" font-size="26" fill="#666860">Flights, getting around, strikes, weather and events in the Algarve</text>
${figs.map((f, i) => { const x = 60 + i * (cw + 10); return `<rect x="${x}" y="200" width="${cw}" height="250" fill="#fffdf8" stroke="#d8d4cb"/>
<text x="${x + 24}" y="310" font-family="Georgia, serif" font-size="84" fill="${['#0b5c7a', '#c52830', '#006600', '#9a6a00'][i]}">${esc(f[0])}</text>
<text x="${x + 24}" y="360" font-family="Arial, sans-serif" font-size="22" fill="#121317">${esc(f[1])}</text>
<text x="${x + 24}" y="420" font-family="Arial, sans-serif" font-size="15" fill="#666860">${esc(f[2])}</text>`; }).join('\n')}
<text x="60" y="520" font-family="Arial, sans-serif" font-size="20" fill="#121317">Built ${esc(lisbon(built))} · version ${esc(version)} · data read ${esc(lisbon(manifest.read_at))}</text>
<text x="60" y="556" font-family="Arial, sans-serif" font-size="18" fill="#666860">Licence: CC BY 4.0 (this picture); adsb.lol data ODbL 1.0; IPMA data, IPMA's terms. Sources: travel.promptugal.news/api/v1/travel.json</text>
<text x="60" y="590" font-family="Arial, sans-serif" font-size="18" fill="#666860">Independent, not official. travel.promptugal.news</text>
</svg>
`;
  // the 1200 x 630 picture for social cards (rendered to /preview.png by scripts/preview-png.mjs)
  writeFileSync('_site/preview-card.svg', svg);
  // /preview.svg: the sites bar's pop-up card, 320 x 180, from designer@'s template (PrompTugal__News__Website
  // design/sites-bar/preview-template.svg.txt): no script, no external reference, system font fall-backs only.
  const rdAt = airport && airport.at ? new Date(airport.at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'not known';
  const card = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="${esc(`Travel: ${figs.map(f => `${f[0]} ${f[1]}`).join('; ')}`)}">
  <rect width="320" height="180" rx="6" fill="#f6f3ec"/>
  <rect x="0" y="0" width="320" height="4" fill="#0b5c7a"/>
  <text x="16" y="30" font-family="IBM Plex Mono, monospace" font-size="10.5" letter-spacing="1.2" fill="#666860">TRAVEL · NOW</text>
  <text x="16" y="84" font-family="Newsreader, Georgia, serif" font-size="46" fill="#121317">${esc(figs[0][0])}</text>
  <text x="16" y="104" font-family="IBM Plex Sans, Arial, sans-serif" font-size="12" fill="#3a3b40">${esc(figs[0][1])}</text>
  <text x="176" y="72" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${esc(figs[2][0])}</text>
  <text x="176" y="88" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">${esc(figs[2][1])}</text>
  <text x="176" y="120" font-family="Newsreader, Georgia, serif" font-size="26" fill="#121317">${esc(figs[3][0])}</text>
  <text x="176" y="136" font-family="IBM Plex Sans, Arial, sans-serif" font-size="11" fill="#3a3b40">${esc(figs[3][1])}</text>
  <line x1="16" y1="150" x2="304" y2="150" stroke="#d8d4cb"/>
  <text x="16" y="168" font-family="IBM Plex Mono, monospace" font-size="10" fill="#666860">read ${esc(rdAt)} · CC BY 4.0 · adsb.lol, IPMA</text>
</svg>
`;
  writeFileSync('_site/preview.svg', card);
  writeFileSync('_site/api/v1/preview.json', JSON.stringify({ license_ours: OURS, about: 'The numbers in /preview.svg, with where each came from.', built, version, data_read: manifest.read_at,
    figures: figs.map(([value, label, source]) => ({ value, label, source })), png: '/preview.png', card: '/preview-card.svg', png_note: 'preview.png is rendered from preview-card.svg by scripts/preview-png.mjs when a browser is available; it may be from an earlier build than the SVG.' }, null, 2) + '\n');
}

if (tzTableWithheld) rmSync('_site/assets/obs/tz-country.json', { force: true });
// a bar the registry no longer lists is not shipped at all, not only not linked (security post-review)
if (!sitesBarChecked) rmSync(`_site/assets/sites-bar/${SBV}`, { recursive: true, force: true });
// ---------- stamp the version (from the factory build) ----------
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built, data_read_at: manifest.read_at || null }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version}): ${pages.length} pages`);
