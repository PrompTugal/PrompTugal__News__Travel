// /london/: redraw "Rain in London: what we said and what happened" from the latest files when the page opens and every
// 10 minutes while it is visible (Dinis, 19 Nov 2026 ~01:13 UTC, "load the data in the browser"). travel.b@, 19 Nov 2026.
// - reads data.promptugal.news's history/weather/london.json and by-place/now/london.json only, with no cookie, no
//   referrer and no stored state (same options and read-time rule as now.js);
// - redraws only when the history file's data_read_at is newer than the one built into the page, and only when both
//   files pass their checks; anything else leaves the built chart as it is;
// - draws with createElementNS, setAttribute (names and values checked by okAttr in past-chart.mjs) and textContent;
//   never innerHTML, outerHTML or insertAdjacentHTML.
import { model, tree, TAGS, okAttr } from '/assets/past-chart.mjs';

const EVERY_MS = 10 * 60 * 1000, NS = 'http://www.w3.org/2000/svg';
const OPTS = { cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer' };
const HIST = 'https://data.promptugal.news/api/v1/history/weather/london.json';
const NOW = 'https://data.promptugal.news/api/v1/by-place/now/london.json';
// a read time: ISO 8601 UTC only, and never more than 5 minutes in the future (as now.js)
const ms = iso => { const n = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/.test(iso) ? Date.parse(iso) : NaN; return isNaN(n) || n > Date.now() + 5 * 60 * 1000 ? null : n; };
const getJson = url => fetch(url, OPTS).then(r => (r.ok ? r.json() : null)).catch(() => null);

function draw(n) {
  if (n.text !== undefined) return document.createTextNode(String(n.text));
  if (!TAGS.includes(n.t)) throw new Error('tag');
  const e = document.createElementNS(NS, n.t);
  for (const [k, v] of Object.entries(n.a)) { if (!okAttr(n.t, k, v)) throw new Error('attribute'); e.setAttribute(k, String(v)); }
  for (const c of n.c) e.appendChild(draw(c));
  return e;
}
function validForecast(d) {
  if (!d || d.place !== 'london' || !d.forecast || !ms(d.forecast.at) || !Array.isArray(d.forecast.days) || d.forecast.days.length > 16) return null;
  for (const x of d.forecast.days) if (!x || typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || (x.rain_mm != null && !(typeof x.rain_mm === 'number' && isFinite(x.rain_mm) && x.rain_mm >= 0 && x.rain_mm <= 500))) return null;
  return d.forecast.days;
}

async function run() {
  const fig = document.querySelector('[data-now="rain-chart"]'), body = document.querySelector('[data-now="rain-table"]');
  if (!fig || !body) return;
  const wrap = fig.querySelector('.chart-wide'), cap = fig.querySelector('figcaption');
  if (!wrap || !cap) return;
  const [h, now] = await Promise.all([getJson(HIST), getJson(NOW)]);
  if (!h || h.place !== 'london' || !Array.isArray(h.rows) || h.rows.length > 400) return;
  const at = ms(h.data_read_at), built = ms(fig.getAttribute('data-read'));
  if (!at || !built || at <= built) return;   // no valid built time: leave the built chart (AppSec post-review, low)
  const days = validForecast(now);
  if (!days) return;
  let svg, m;
  try {
    m = model(h, days, new Date().toISOString().slice(0, 10));
    if (!m) return;
    svg = draw(tree(m));
  } catch { return; }
  const rows = m.table.map(r => { const tr = document.createElement('tr'); for (const v of [r.day, r.meas, r.said, r.diff, r.fc]) { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); } return tr; });
  wrap.replaceChildren(svg);
  cap.textContent = m.track;
  body.replaceChildren(...rows);
  fig.setAttribute('data-read', h.data_read_at);
  // the note's read time follows the file drawn (travel.b@ review), in London time, as text
  const rd = document.querySelector('[data-now="rain-read"]');
  if (rd) { try { rd.textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(at)) + ' London, in your browser'; } catch {} }
}

if (window.fetch && Element.prototype.replaceChildren) {
  const go = () => run().catch(() => {});
  go();
  setInterval(() => { if (!document.hidden) go(); }, EVERY_MS);
}
