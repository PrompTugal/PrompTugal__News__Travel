// Pull: read the published, public data this site is built from, into data/inputs/.
// travel@PrompTugal.dinis, 17 November 2026. Node 18+, no dependencies.
//
// This is not a collector. It reads files that other PrompTugal.news teams already publish
// (today PrompTugal__News__Website's data/by-place/, served at promptugal.news; later
// data.promptugal.news's APIs, owned by data@PrompTugal.dinis) and keeps a copy with the
// time read and its sha256, so every page can say where each value came from.
//
// From 18 November 2026 (travel.b@PrompTugal.dinis, at Dinis's word: "weather and travel read
// data.promptugal.news's /api/v1/by-place/now/<place>.json"): each place's "now" file is read from
// data.promptugal.news first. If that answer fails, or was read more than STALE_H hours before this pull,
// the same file at promptugal.news is read too and the newer of the two is kept. The manifest records,
// for every file, which source it came from and why. places.json and the place desks' <id>.json
// (events) still come from promptugal.news: data.promptugal.news does not publish them yet.
//
// Usage: node scripts/pull.mjs [--from <local clone of PrompTugal__News__Website>]
// Polite: one request every 2 seconds, a named client, no retries beyond one backoff.
import { writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const BASE = 'https://promptugal.news/data/by-place/';
const DATA = 'https://data.promptugal.news/api/v1/by-place/';
const STALE_H = 3;
const MAX_BYTES = 5 * 1024 * 1024; // security post-review, 18 Nov 2026: no unbounded bodies
const UA = 'travel.promptugal.news reader (+https://travel.promptugal.news/about/; a few requests an hour)';
const OUT = 'data/inputs/by-place';
const args = process.argv.slice(2);
const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// The first 40 hex digits of the sha256 (160 bits): the leak scan allows hex up to a git object id's length.
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 40);

async function read(path, base = BASE) {
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  if (from && base === BASE) {
    const f = join(from, 'data/by-place', path);
    const s = readFileSync(f, 'utf8');
    return { path, url: base + path, via: 'local clone', at, status: 200, body: s };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(base + path, { headers: { 'user-agent': UA, accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
      const body = await r.text();
      if (body.length > MAX_BYTES) return { path, url: base + path, via: 'https', at, status: 'too large', body: null };
      if (r.ok) return { path, url: base + path, via: 'https', at, status: r.status, body };
      if (r.status === 403 || r.status === 429) return { path, url: base + path, via: 'https', at, status: r.status, body: null };
    } catch (e) { if (attempt) return { path, url: base + path, via: 'https', at, status: 0, body: null, error: e.message }; }
    await sleep(5000);
  }
  return { path, url: base + path, via: 'https', at, status: 0, body: null };
}

mkdirSync(join(OUT, 'now'), { recursive: true });
const reads = [];
const chosen = {};
const places = await read('places.json');
reads.push(places);
if (!places.body) { console.error(`pull: places.json answered ${places.status}; nothing changed`); process.exit(1); }
writeFileSync(join(OUT, 'places.json'), places.body);
const list = JSON.parse(places.body).places.filter(p => p.id === 'algarve' || p.parent === 'algarve' || ['quarteira'].includes(p.id));
// Place ids become file paths and URL paths: only lower-case letters, digits and hyphens (security post-review, 18 Nov 2026).
const ids = [...new Set(list.map(p => p.id))].filter(id => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id));
for (const id of ids) {
  // the place desk (events): promptugal.news only
  if (!from) await sleep(2000);
  const r = await read(`${id}.json`);
  reads.push(r);
  if (r.body) { try { JSON.parse(r.body); writeFileSync(join(OUT, `${id}.json`), r.body); } catch { r.status = 'not json'; r.body = null; } }
  // now: data.promptugal.news first, promptugal.news when that fails or is stale
  const path = `now/${id}.json`;
  await sleep(2000);
  const d = await read(path, DATA);
  let dj = null; if (d.body) { try { dj = JSON.parse(d.body); } catch { d.status = 'not json'; d.body = null; } }
  const ageH = j => (j && j.read_at ? (Date.now() - Date.parse(j.read_at)) / 36e5 : Infinity);
  let use = d, why = 'data.promptugal.news, the source of record';
  if (ageH(dj) > STALE_H) {
    if (!from) await sleep(2000);
    const w = await read(path);
    let wj = null; if (w.body) { try { wj = JSON.parse(w.body); } catch { w.status = 'not json'; w.body = null; } }
    reads.push({ ...w, role: 'fallback' });
    if (wj && ageH(wj) < ageH(dj)) { use = w; why = `promptugal.news: data.promptugal.news's copy ${dj ? `was read ${dj.read_at}, more than ${STALE_H} h before this pull` : `did not answer (${d.status})`}, and this one is newer (${wj.read_at})`; }
    else why = dj ? `data.promptugal.news (stale, read ${dj.read_at}; promptugal.news's was no newer)` : 'neither source answered';
  }
  reads.push({ ...d, role: 'primary' });
  if (use.body) { writeFileSync(join(OUT, path), use.body); use.used = true; }
  chosen[id] = { from: use.body ? use.url : null, why };
}
// Events by place from data.promptugal.news (18 Nov 2026): reference use only (name the source, link the event),
// as the data site's own note says. One file per place, kept as read.
const EVENTS = 'https://data.promptugal.news/api/v1/events/by-place/';
mkdirSync('data/inputs/events', { recursive: true });
for (const id of ids) {
  if (!from) await sleep(2000);
  const r = await read(`${id}.json`, EVENTS);
  reads.push({ ...r, path: `events/${id}.json`, role: 'events' });
  if (r.body) { try { JSON.parse(r.body); writeFileSync(join('data/inputs/events', `${id}.json`), r.body); } catch { r.status = 'not json'; } }
}
const manifest = {
  about: `What scripts/pull.mjs read, when, and the first 40 hex digits of each answer's sha256. Each place's now file: data.promptugal.news/api/v1/by-place/now/ first, promptugal.news/data/by-place/now/ when that is stale or fails ("now" says which was used and why). places.json and the place desks (events): PrompTugal__News__Website data/by-place (public; each file signed beside it as <file>.sig), served at promptugal.news.`,
  by: 'scripts/pull.mjs (travel@PrompTugal.dinis; data.promptugal.news first since 18 Nov 2026, travel.b@PrompTugal.dinis)',
  read_at: reads[0].at,
  source: DATA + 'now/',
  fallback: BASE,
  stale_after_hours: STALE_H,
  now: chosen,
  repository: 'https://github.com/PrompTugal/PrompTugal__News__Website/tree/dev/data/by-place',
  places: ids,
  reads: reads.map(r => ({ path: r.path, url: r.url, via: r.via, at: r.at, status: r.status, ...(r.role ? { role: r.role, used: !!r.used } : {}), sha256_40: r.body ? sha(r.body) : null, ...(r.error ? { error: r.error } : {}) })),
};
writeFileSync('data/inputs/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// The Faro airport series: one line per pull, counts per airline only, never an aircraft's identity.
const faroPath = join(OUT, 'now/faro.json');
if (existsSync(faroPath)) {
  const a = JSON.parse(readFileSync(faroPath, 'utf8')).airport;
  if (a && typeof a.at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?Z$/.test(a.at)) {
    const seriesPath = 'data/series/faro-airport.jsonl';
    mkdirSync('data/series', { recursive: true });
    const seen = existsSync(seriesPath) ? readFileSync(seriesPath, 'utf8') : '';
    if (!seen.includes(`"at":"${a.at}"`)) {
      const by = {};
      for (const f of a.airline || []) if (/^[A-Z0-9]{2,4}$/.test(f.airline || '')) by[f.airline] = (by[f.airline] || 0) + 1;
      const num = x => (Number.isFinite(x) ? x : null);
      const row = { at: a.at, within_nm: num(a.within_nm), airline_total: (a.airline || []).length, on_ground: (a.airline || []).filter(f => f.on_ground).length, by_airline: by, other_aircraft: num(a.other_aircraft), source: a.source };
      appendFileSync(seriesPath, JSON.stringify(row) + '\n');
    }
  }
}
const bad = reads.filter(r => !r.body);
console.log(`pull: ${reads.length - bad.length} of ${reads.length} read${bad.length ? `; not read: ${bad.map(r => `${r.path} (${r.status})`).join(', ')}` : ''}`);
