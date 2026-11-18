// Build: src/ (static files) + data/ (inputs and research) -> _site/ pages, markdown twins,
// llms.txt, sitemap.xml, version.json and the site's own JSON at /api/v1/.
// travel@PrompTugal.dinis, 17 November 2026, from the factory's copy-and-stamp build.
// SITE_VERSION is set by CI only (v0.1.N); a local build says "dev". Node 18+, no dependencies.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

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
const mdesc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
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
const a = (url, text) => (url ? `<a href="${esc(url)}">${esc(text ?? host(url))}</a>` : esc(text));
const ml = (url, text) => (url ? `[${mdesc(text ?? host(url))}](${url})` : mdesc(text));
const today = built.slice(0, 10);
const firstSentence = s => { const m = String(s || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : s; };

// IPMA's weather types (https://api.ipma.pt/open-data/weather-type-classe.json), in English.
const WT = { 0: 'no information', 1: 'clear sky', 2: 'partly cloudy', 3: 'sunny intervals', 4: 'cloudy', 5: 'cloudy (high cloud)', 6: 'showers', 7: 'light showers', 8: 'heavy showers', 9: 'rain or showers', 10: 'light rain', 11: 'heavy rain', 12: 'intermittent rain', 13: 'intermittent light rain', 14: 'intermittent heavy rain', 15: 'drizzle', 16: 'mist', 17: 'fog', 18: 'snow', 19: 'thunderstorms', 20: 'showers and thunderstorms', 21: 'hail', 22: 'frost', 23: 'rain and thunderstorms', 24: 'convective clouds', 25: 'partly cloudy', 26: 'fog', 27: 'cloudy' };
const WIND = { 1: 'N', 2: 'NE', 3: 'E', 4: 'SE', 5: 'S', 6: 'SW', 7: 'W', 8: 'NW', 9: 'N' };
// ICAO airline designators seen near Faro, from ICAO Doc 8585 as published by the airlines themselves.
const AIRLINES = { EZY: 'easyJet', EJU: 'easyJet Europe', EZS: 'easyJet Switzerland', RYR: 'Ryanair', RUK: 'Ryanair UK', MAY: 'Malta Air (Ryanair)', TAP: 'TAP Air Portugal', TOM: 'TUI Airways', TFL: 'TUI fly Netherlands', JAF: 'TUI fly Belgium', TUI: 'TUIfly', EXS: 'Jet2', BAW: 'British Airways', IBB: 'Binter (Iberia Regional)', IBE: 'Iberia', IBS: 'Iberia Express', RAM: 'Royal Air Maroc', VLG: 'Vueling', TRA: 'Transavia', TVF: 'Transavia France', DLH: 'Lufthansa', EWG: 'Eurowings', AFR: 'Air France', KLM: 'KLM', SAS: 'SAS', NAX: 'Norwegian', NSZ: 'Norwegian', WZZ: 'Wizz Air', WUK: 'Wizz Air UK', EIN: 'Aer Lingus', BEL: 'Brussels Airlines', SWR: 'Swiss', CFG: 'Condor', LOG: 'Loganair', SXS: 'SunExpress', PGA: 'Portugalia', SAT: 'SATA Azores Airlines', RZO: 'Azores Airlines', LGL: 'Luxair', BTI: 'airBaltic', FIN: 'Finnair', ENT: 'Enter Air', AEA: 'Air Europa', EDW: 'Edelweiss', TAY: 'ASL Airlines Belgium', ABR: 'ASL Airlines Ireland' };
const airlineName = c => AIRLINES[c] || c;

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
  ['/weather/', 'Weather and sea'], ['/events/', "What's on"], ['/tourism/', 'Tourism'], ['/about/', 'How it is made'],
];
const pages = [];
// The PrompTugal.news sites, as promptugal.news's rail (PrompTugal__News__Website assets/top/top.tmpl, em-net).
const SITES = [['Weather', 'https://weather.promptugal.news/'], ['Civic', 'https://civic.promptugal.news/'], ['Startups', 'https://startups.promptugal.news/'], ['Travel', 'https://travel.promptugal.news/'], ['Data', 'https://data.promptugal.news/']];
const siteLinks = () => SITES.map(([n, u]) => n === 'Travel' ? `<a href="/" aria-current="true">${n}</a>` : `<a href="${u}" rel="noopener">${n}</a>`).join('');
// type: the meter's page type (data 1p, site 1p, account 0). ipma: built on IPMA data, so free, outside the meter
// (IPMA's terms rule out profit-making use; account-B fix 4, until Dinis decides).
function page({ path, title, description, body, md, provenance, variant = '', script = '', noindex = false, type = 'data', ipma = false }) {
  const pageType = ipma ? 'free' : type;
  const isHome = path === '/';
  const fullTitle = isHome ? 'PrompTugal.news Travel' : `${title} · PrompTugal.news Travel`;
  const p = provenance || prov();
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
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" type="text/markdown" href="${SITE}${path}index.md">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/meter/meter.css">
<meta name="page-type" content="${pageType}">
<meta name="page-date" content="${today}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}</head>
<body class="${esc(variant)}">
<a class="skip" href="#main">Skip to the content</a>
<header class="masthead">
<div class="bar"><span class="version" data-version="${esc(version)}">Version ${esc(version)}</span><span>Independent: not an official site. Your airline or operator decides whether your service runs: its site or app has the latest.</span><span class="tools" id="nr-tools"><a class="tool meter" id="nr-meter-chip" href="/account/"><span class="meter-label">Pay for what you read</span></a></span></div>
<div class="brand"><a class="wordmark" href="/" aria-label="PrompTugal.news Travel, the front page"><img class="light" src="/assets/brand/promptugal-wordmark-light.svg" alt="PrompTugal.news" width="220" height="36"><img class="dark" src="/assets/brand/promptugal-wordmark-dark.svg" alt="" width="220" height="36"><span class="sub">· Travel</span></a>
<p class="tagline">Travel and tourism in Portugal, the Algarve first. Every value with its source and the time it was read.</p></div>
<nav aria-label="Sections"><ul>${NAV.map(([h, t]) => `<li><a href="${h}"${h === path ? ' aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}</ul></nav>
</header>
<nav class="em-net" aria-label="The PrompTugal.news sites"><span>Also from PrompTugal.news</span>${siteLinks()}</nav>
<main id="main">
<div class="body">
${body}
</div>
${ipma ? `<p class="free-note"><strong>Free to read.</strong> This page is built on ${a('https://www.ipma.pt/', 'IPMA')} data, whose terms rule out profit-making use, so it is outside the reading meter.</p>\n` : ''}${provHtml}
</main>
<footer class="foot"><p>${a('https://promptugal.news/', 'PrompTugal.news')}: Portugal, town by town. Raw data from ${a('https://data.promptugal.news/', 'data.promptugal.news')} and from ${a('https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/data/by-place', 'PrompTugal.news place data')}. Not a warning service: follow ${a('https://www.ipma.pt/', 'IPMA')} and ${a('https://prociv.gov.pt/', 'ANEPC')}.</p>
<p class="sites">Also from PrompTugal.news: ${siteLinks()}</p>
<p class="obs-row">Version ${esc(version)} · ${a('https://github.com/PrompTugal/PrompTugal__News__Travel', 'Source')} · Code Apache-2.0, text CC BY 4.0 · ${a('/llms.txt', 'llms.txt')} · ${a('/version.json', 'version.json')} · ${a('/account/', 'Your reading account')}</p></footer>
${script ? `<script src="${script}" defer></script>\n` : ''}<script src="/assets/meter/meter.js" defer></script>
<script src="/assets/obs/obs.js" defer></script>
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

${ipma ? 'Free to read: built on IPMA data, whose terms rule out profit-making use, so outside the reading meter.\n\n' : ''}Independent: not an official site. Your airline or operator decides whether your service runs: its site or app has the latest. Version ${version}. Code Apache-2.0, text CC BY 4.0.
`;
  const dir = join('_site', path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), nodash(html));
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
    html: `<p class="lead" data-now="airport-lead">${esc(lead)}</p>${tbl}<p class="meta">Source: ${a(airport.source, 'adsb.lol')} community receivers (data under ODbL 1.0), as read by the PrompTugal.news place data. Airline flights by callsign; other aircraft only counted. A snapshot, not a departures board. ${a(airport.page, 'The live map at adsb.lol')}</p>`,
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
  const sHtml = series.length ? `<table><caption>Our readings so far (one row per pull, counts only)</caption><thead><tr><th scope="col">Read at</th><th scope="col" class="num">Airline flights</th><th scope="col" class="num">On the ground</th><th scope="col" class="num">Other aircraft</th><th scope="col">By airline</th></tr></thead><tbody>${series.slice(-24).reverse().map(r => `<tr><td>${esc(lisbon(r.at))}</td><td class="num">${r.airline_total}</td><td class="num">${r.on_ground}</td><td class="num">${r.other_aircraft}</td><td>${esc(Object.entries(r.by_airline).map(([k, v]) => `${airlineName(k)} ${v}`).join(', '))}</td></tr>`).join('')}</tbody></table>` : '';
  const strikeAir = upcoming.filter(d => d.mode === 'air' || d.mode === 'border');
  page({
    path: '/flights/', title: 'Flights: Faro airport',
    description: 'Faro airport (LPFR): airline flights seen nearby now, by callsign, with strikes and border checks that affect flying from the Algarve. Sourced, with the time read.',
    script: '/assets/now.js',
    body: `<h1>Flights: Faro airport</h1><p class="dek">Faro (LPFR) is the Algarve's airport, run by ANA (VINCI Airports). What we show is what community receivers saw in the sky near it at one moment, not the airport's departures board.</p>
<section aria-labelledby="h-seen"><h2 id="h-seen">Seen near Faro</h2>${ap.html}${byRows.length ? `<p>By airline: ${esc(byRows.map(([k, v]) => `${airlineName(k)} ${v}`).join(', '))}.</p>` : ''}</section>
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
  const item = x => `<li id="${esc(x.id)}"><h3>${esc(x.title)}</h3><p class="meta"><strong>${esc(dateRange(x))}</strong> · ${esc(x.where)} · ${esc(x.who)} · <span class="status s-${esc(x.status)}">${esc(x.status)}</span>${x.algarve ? ' · the Algarve' : ''}</p><p>${esc(x.what)}</p><p class="meta">Sources: ${srcList(x.sources)}</p></li>`;
  const itemMd = x => `### ${x.title}\n\n${dateRange(x)} · ${x.where} · ${x.who} · ${x.status}\n\n${x.what}\n\nSources: ${srcMd(x.sources)}`;
  const hol = (holidays || {}).days || [];
  page({
    path: '/disruptions/', title: 'Strikes and disruptions',
    description: 'Strikes, planned disruptions and public holidays that affect travel in Portugal and the Algarve, each with its sources and status.',
    provenance: prov({ agents: ['travel.research.disruptions@PrompTugal.dinis (Sonnet) searched official notices and news reports'] }),
    body: `<h1>Strikes and disruptions</h1><p class="dek">What may stop or slow a journey in Portugal, the Algarve first: strikes called, border checks, storms and holidays. Each item has its status and its sources. Your airline or operator decides whether your service runs: its site or app has the latest.</p>
<section aria-labelledby="h-up"><h2 id="h-up">Ahead and in force</h2>${upcoming.length ? `<ul class="items long">${upcoming.map(item).join('')}</ul>` : '<p>None found.</p>'}</section>
<section aria-labelledby="h-hol"><h2 id="h-hol">Public holidays</h2>${hol.length ? `<ul>${hol.filter(h => h.date >= today).map(h => `<li><strong>${esc(longDay(h.date))}</strong>: ${esc(h.name)}</li>`).join('')}</ul><p class="meta">${esc(holidays.note || '')} ${a(holidays.source, holidays.source_title)}</p>` : '<p>Not listed yet.</p>'}</section>
<section aria-labelledby="h-past"><h2 id="h-past">Recently</h2>${past.length ? `<ul class="items long">${past.map(item).join('')}</ul>` : '<p>None listed.</p>'}</section>
<section aria-labelledby="h-gap"><h2 id="h-gap">What we looked for and did not find</h2><p>Not finding a strike is not proof there is none. These were searched for on ${esc((d.read_at || '').slice(0, 10))}:</p><ul>${(d.gaps || []).map(g => `<li><strong>${esc(g.what)}</strong>: ${esc(g.why)}</li>`).join('')}</ul></section>`,
    md: `What may stop or slow a journey in Portugal, the Algarve first. Your airline or operator decides whether your service runs: its site or app has the latest.\n\n## Ahead and in force\n\n${upcoming.map(itemMd).join('\n\n') || 'None found.'}\n\n## Public holidays\n\n${hol.filter(h => h.date >= today).map(h => `- **${longDay(h.date)}**: ${h.name}`).join('\n')}\n\n${holidays ? `${holidays.note || ''} ${ml(holidays.source, holidays.source_title)}` : ''}\n\n## Recently\n\n${past.map(itemMd).join('\n\n')}\n\n## What we looked for and did not find\n\n${(d.gaps || []).map(g => `- **${g.what}**: ${g.why}`).join('\n')}`,
  });
}

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
    script: '/assets/now.js',
    body: `<h1>Weather and sea for visitors</h1><p class="dek">Each Algarve municipality: the latest station reading, today and tomorrow, the sea on its coast, UV and fire risk. From IPMA's open data, via the PrompTugal.news place data, read ${esc(lisbon(faro.read_at))}. For storms and warnings, ${a('https://weather.promptugal.news/', 'PrompTugal.news Weather')} goes deeper.</p>
<section aria-labelledby="h-w"><h2 id="h-w">Warnings in force</h2>${w.html}</section>
<section aria-labelledby="h-coast"><h2 id="h-coast">The sea, coast by coast</h2><ul class="coasts">${Object.values(coasts).map(s => `<li><strong>${esc(s.coast)}</strong>: waves up to ${esc(cell(s.waves_max_m))} m, swell up to ${esc(cell(s.sea_max_m))} m, sea temperature up to ${esc(cell(s.sea_temp_max_c))}°C (${esc(s.date)}). ${a(s.page, 'IPMA')}</li>`).join('')}</ul><p class="meta">The Faro coast faces south (Olhão to Vila Real de Santo António, Albufeira, Quarteira); the Sagres coast covers the west and the Barlavento (Lagos, Portimão, Aljezur, Vila do Bispo), as IPMA groups them.</p></section>
<section aria-labelledby="h-places"><h2 id="h-places">Place by place</h2><div class="scroll"><table class="places"><thead><tr><th scope="col">Place</th><th scope="col" class="num">Now (°C)</th><th scope="col">Today</th><th scope="col">Tomorrow</th><th scope="col" class="num">UV</th><th scope="col">Fire risk</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${esc(r.name)}<span class="meta"> ${esc(r.station || '')}</span></th><td class="num">${esc(cell(r.temp))}</td><td>${esc(r.today.t_max_c != null ? `${Math.round(r.today.t_max_c)}° / ${Math.round(r.today.t_min_c)}°, ${WT[r.today.weather_type] || ''}, rain ${r.today.rain_prob_pct}%` : 'n/a')}</td><td>${esc(r.tomorrow.t_max_c != null ? `${Math.round(r.tomorrow.t_max_c)}° / ${Math.round(r.tomorrow.t_min_c)}°, ${WT[r.tomorrow.weather_type] || ''}, rain ${r.tomorrow.rain_prob_pct}%` : 'n/a')}</td><td class="num">${esc(r.uv ? r.uv.index : 'n/a')}</td><td>${esc(r.fire ? r.fire.level : 'n/a')}</td></tr>`).join('')}</tbody></table></div>
<p class="meta">"Now" is the nearest IPMA station with a reading; n/a means that station sent none in the hour read. Forecasts: IPMA's daily forecast for the nearest town. ${a('https://www.ipma.pt/en/otempo/prev.localidade.hora/', 'IPMA forecasts')} · ${a('https://www.ipma.pt/en/riscoincendio/rcm.pt/', 'IPMA fire risk')} · ${a('https://www.ipma.pt/en/otempo/prev.uv/', 'IPMA UV')}</p></section>`,
    md: `Each Algarve municipality, from IPMA's open data via the PrompTugal.news place data, read ${lisbon(faro.read_at)}.\n\n## Warnings in force\n\n${w.md}\n\n## The sea\n\n${Object.values(coasts).map(s => `- **${s.coast}**: waves up to ${cell(s.waves_max_m)} m, sea temperature up to ${cell(s.sea_temp_max_c)}°C (${s.date}).`).join('\n')}\n\n## Place by place\n\n| Place | Now (°C) | Today | Tomorrow | UV | Fire risk |\n|---|---|---|---|---|---|\n${rows.map(r => `| ${r.name} | ${cell(r.temp)} | ${r.today.t_max_c != null ? `${r.today.t_max_c}/${r.today.t_min_c}, ${WT[r.today.weather_type] || ''}, rain ${r.today.rain_prob_pct}%` : 'n/a'} | ${r.tomorrow.t_max_c != null ? `${r.tomorrow.t_max_c}/${r.tomorrow.t_min_c}, ${WT[r.tomorrow.weather_type] || ''}, rain ${r.tomorrow.rain_prob_pct}%` : 'n/a'} | ${r.uv ? r.uv.index : 'n/a'} | ${r.fire ? r.fire.level : 'n/a'} |`).join('\n')}\n\nSource: IPMA open data (api.ipma.pt).`,
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
<section aria-labelledby="h-pay"><h2 id="h-pay">Pay for what you read</h2><p>PrompTugal.news asks readers to pay for what they read. The chip at the top of every page shows your reading credit here; ${a('/account/', 'your reading account')} shows what you read, what each page cost and your reading graph, all kept in your browser. Pages built on IPMA data (the front page, weather and sea) are free: IPMA's terms rule out profit-making use. ${a('/account/billing/', 'How pages are priced')}.</p></section>
<section aria-labelledby="h-obs"><h2 id="h-obs">What is counted</h2><p>Page views and reading time are counted, publicly, in PrompTugal.news's observability lane for this site ("travel"), as on promptugal.news: the page, the time to the minute, the screen size class, the browser's language and time zone, and the town your browser's own lookup gives. No IP address, no cookie, no fingerprint. Do Not Track, Global Privacy Control and Pause in the footer turn it off. ${a('https://promptugal.news/newsroom/observability/index.html', 'The report')}.</p></section>`,
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

## Pay for what you read

The chip at the top of every page shows your reading credit on this site; ${SITE}/account/ shows what you read, what each page cost and your reading graph, kept in your browser. Pages built on IPMA data (the front page, weather and sea) are free: IPMA's terms rule out profit-making use. How pages are priced: ${SITE}/account/billing/

## What is counted

Page views and reading time, publicly, in PrompTugal.news's observability lane for this site ("travel"): no IP address, no cookie, no fingerprint. Do Not Track, Global Privacy Control and Pause in the footer turn it off. https://promptugal.news/newsroom/observability/index.html`,
  });
}


// ---------- the reading account (account-B fix 3: promptugal.news's meter, assets/meter/, here) ----------
{
  const mc = J('data/editorial/meter.json');
  const meterProv = prov({ code: ['assets/meter/meter.js and sg-meter-core.js (vendored from PrompTugal__News__Website, Apache-2.0) draw this in your browser from your browser\'s own storage'] });
  const kept = 'Everything here is kept in this browser only: nothing is sent anywhere. A browser keeps each website\'s storage apart, so the credit on this site is not the one on promptugal.news; one account across the PrompTugal sites and your devices is being built with vaults.';
  const noJs = '<p class="notice">Your reading account is drawn by a script in your browser from your browser\'s own storage. With scripts off, nothing is counted or charged.</p>';
  page({
    path: '/account/', title: 'Your reading account', type: 'account',
    description: 'Your reading credit on travel.promptugal.news, the pages you read and what each cost, and your reading graph: kept in your browser only.',
    body: `<h1>Your reading account</h1><p class="dek">Pay for what you read: each page costs a penny or so, for the share of it you read, and a rating can make it free or double. ${esc(kept)}</p>
<div id="nr-account" class="nr-mount">${noJs}</div>
<p class="meta">${a('/account/billing/', 'How pages are priced')} · ${a('/account/top-up/', 'Top up')}</p>`,
    md: `Pay for what you read: each page costs a penny or so, for the share of it you read; a rating can make it free or double. ${kept}\n\nYour balance, history and reading graph are drawn in your browser at ${SITE}/account/. How pages are priced: ${SITE}/account/billing/`,
    provenance: meterProv,
  });
  page({
    path: '/account/top-up/', title: 'Top up your reading credit', type: 'account', noindex: true,
    description: 'Add reading credit on travel.promptugal.news: one payment on Stripe\'s own page.',
    body: `<h1>Top up your reading credit</h1><p class="dek">${esc(mc.symbol)}${(mc.topup.amount / 100).toFixed(2)} on Stripe's own page; this site never sees your card. ${esc(kept)}</p>
<div id="nr-topup" class="nr-mount">${noJs}</div>`,
    md: `${mc.symbol}${(mc.topup.amount / 100).toFixed(2)} on Stripe's own page; this site never sees your card. ${kept}`,
    provenance: meterProv,
  });
  page({
    path: '/account/topped-up/', title: 'Topped up', type: 'account', noindex: true,
    description: 'The page a top-up returns to: it adds the credit once per payment reference, in this browser.',
    body: `<h1>Topped up</h1><p class="dek">This page adds a payment's credit to this browser, once per payment reference. A static page cannot check a payment with Stripe, so it trusts the reference, as promptugal.news does.</p>
<div id="nr-topped" class="nr-mount">${noJs}</div>`,
    md: 'This page adds a payment\'s credit to this browser, once per payment reference. A static page cannot check a payment with Stripe, so it trusts the reference, as promptugal.news does.',
    provenance: meterProv,
  });
  const rows = Object.entries(mc.types).map(([t, v]) => [t, mc.prices[t], v.why || ({ data: 'Reference pages assembled from public sources: flights, getting around, strikes, events, tourism.', site: 'The site\'s account of itself.', account: 'The meter\'s own pages. Charging a reader to see their bill is not a price.' })[t] || '']);
  page({
    path: '/account/billing/', title: 'How pages are priced', type: 'account',
    description: 'The prices of travel.promptugal.news\'s pages under PrompTugal.news\'s reading meter, and why pages built on IPMA data are free.',
    body: `<h1>How pages are priced</h1><p class="dek">PrompTugal.news's reading meter (sg-meter, as on promptugal.news): a page's price times the share of it you read, never less than the minimum, charged once per page per visit. A rating sets the final price: not useful is free, excellent is double. You start with ${esc(mc.symbol)}${(mc.start / 100).toFixed(2)} of credit; nothing is ever blocked.</p>
<table class="ledger"><thead><tr><th>Kind of page</th><th class="num">Price</th><th>Why</th></tr></thead><tbody>${rows.map(([t, p, w]) => `<tr><td>${esc(t)}</td><td class="num">${esc(p)}p</td><td>${esc(w)}</td></tr>`).join('')}</tbody></table>
<p class="meta">From ${a('/api/v1/billing/meter.json', 'this site\'s meter config')}, taken from ${a(mc.source.url, 'promptugal.news\'s')} (${esc(mc.source.version)}, read ${esc(mc.source.read_at)}).</p>`,
    md: `A page's price times the share of it you read, never less than the minimum, once per page per visit; a rating sets the final price (not useful is free, excellent double). Start: ${mc.symbol}${(mc.start / 100).toFixed(2)}. Nothing is blocked.\n\n| Kind of page | Price | Why |\n|---|---|---|\n${rows.map(([t, p, w]) => `| ${t} | ${p}p | ${mdesc(w)} |`).join('\n')}\n\nConfig: ${SITE}/api/v1/billing/meter.json`,
    provenance: meterProv,
  });
  mkdirSync('_site/api/v1/billing', { recursive: true });
  writeFileSync('_site/api/v1/billing/meter.json', JSON.stringify({ ...mc, version }, null, 2) + '\n');
}

// ---------- API, llms.txt, sitemap ----------
mkdirSync('_site/api/v1', { recursive: true });
cpSync('data/inputs/manifest.json', '_site/api/v1/manifest.json');
for (const [k, f] of [['events-algarve', 'data/research/events-algarve.json'], ['transport-algarve', 'data/research/transport-algarve.json'], ['disruptions', 'data/research/disruptions.json'], ['tourism', 'data/research/tourism.json'], ['holidays', 'data/editorial/holidays.json']]) if (existsSync(f)) cpSync(f, `_site/api/v1/${k}.json`);
if (existsSync('data/series/faro-airport.jsonl')) cpSync('data/series/faro-airport.jsonl', '_site/api/v1/faro-airport.jsonl');
writeFileSync('_site/api/v1/travel.json', JSON.stringify({
  about: 'travel.promptugal.news digest: what the front page shows, each value with its source.', version, built, data_read: manifest.read_at,
  faro_now: { station: faro.station, forecast: faro.forecast, warnings: faro.warnings, sea: faro.sea },
  faro_airport: airport ? { ...airport, airline: (airport.airline || []).map(f => ({ ...f, airline_name: airlineName(f.airline) })) } : null,
  disruptions_ahead: upcoming, holidays: holidays ? holidays.days : [],
}, null, 2) + '\n');
const listed = pages.filter(p => !p.noindex);
writeFileSync('_site/llms.txt', `# PrompTugal.news Travel\n\n> Travel and tourism in Portugal, the Algarve first: flights at Faro, getting around, strikes and disruptions, weather and sea for visitors, events by place, tourism statistics. Every value with its source and the time read. Independent, not official. Version ${version}.\n\n## Pages (markdown twins)\n\n${listed.map(p => `- [${p.title}](${SITE}${p.path}index.md): ${p.description}`).join('\n')}\n\n## Data\n\n- [Digest](${SITE}/api/v1/travel.json)\n- [Inputs manifest](${SITE}/api/v1/manifest.json)\n- [Faro airport series](${SITE}/api/v1/faro-airport.jsonl)\n- [Disruptions](${SITE}/api/v1/disruptions.json)\n- [Transport](${SITE}/api/v1/transport-algarve.json)\n- [Tourism](${SITE}/api/v1/tourism.json)\n`);
writeFileSync('_site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${listed.map(p => `<url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('_site/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// ---------- stamp the version (from the factory build) ----------
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('_site')) {
  if (!/\.(html|js|css|json|md|txt)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8');
  if (s.includes('__VERSION__')) writeFileSync(f, s.replaceAll('__VERSION__', version));
}
writeFileSync('_site/version.json', JSON.stringify({ version, commit: process.env.GITHUB_SHA || 'local', built }, null, 2) + '\n');
writeFileSync('_site/.nojekyll', '');
console.log(`built _site/ (${version}): ${pages.length} pages`);
