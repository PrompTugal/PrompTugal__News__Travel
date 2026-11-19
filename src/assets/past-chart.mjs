// "Rain in London: what we said and what happened": the logic and the drawing, shared by the build (scripts/build.mjs)
// and the browser (past-chart-live.mjs). No dependencies. Moved out of build.mjs on 19 Nov 2026 (travel.b@, Dinis's rule
// "load the data in the browser"); behaviour unchanged.
// model(history, forecastDays, today) checks the data and returns the items, the track-record text and the table rows,
// or null when the history is not usable. tree(model) returns a plain node tree: {t, a, c} for an element and {text}
// for text. Attribute values are numbers or fixed strings from this module; no data string ever becomes a tag name,
// an attribute name, an href, a style or an event attribute (okAttr below is the one check both sides use).

export const TAGS = ['svg', 'title', 'desc', 'defs', 'pattern', 'line', 'rect', 'text', 'g'];
export const ATTRS = ['viewBox', 'width', 'height', 'role', 'aria-labelledby', 'id', 'patternUnits', 'patternTransform', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'rx', 'style', 'text-anchor', 'font-size', 'font-weight', 'transform'];
// every style the drawing uses: fixed strings
export const STYLES = [
  'fill:var(--ink)', 'fill:var(--muted)', 'fill:var(--sand)', 'stroke:var(--ink);stroke-width:1.5', 'stroke:var(--rule)',
  'fill:none;stroke:var(--green);stroke-width:2', 'fill:url(#lon-hatch);stroke:var(--ink);stroke-width:1.5',
  'fill:none;stroke:var(--ink);stroke-width:1.5;stroke-dasharray:3 3',
];
const STRING_ATTR = {
  role: /^img$/, 'aria-labelledby': /^lon-rain-t lon-rain-d$/, id: /^(lon-rain-t|lon-rain-d|lon-hatch)$/,
  viewBox: /^0 0 \d{1,4} \d{1,4}$/, width: /^100%$/, patternUnits: /^userSpaceOnUse$/, patternTransform: /^rotate\(45\)$/,
  'text-anchor': /^(middle|end)$/, 'font-weight': /^700$/, transform: /^translate\(-?\d{1,5}(\.\d)? -?\d{1,5}(\.\d)?\)$/,
};
// one check for an attribute, used by the build's serialiser and the browser's drawing
export function okAttr(tag, name, value) {
  if (!TAGS.includes(tag) || !ATTRS.includes(name)) return false;
  if (name === 'style') return typeof value === 'string' && STYLES.includes(value);
  if (typeof value === 'number') return Number.isFinite(value) && name !== 'viewBox' && name !== 'role';
  return typeof value === 'string' && !!STRING_ATTR[name] && STRING_ATTR[name].test(value);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cl = v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(500, Math.max(0, v)) : null);
const r1 = v => Math.round(v * 10) / 10;
export const day = iso => { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d) ? iso : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d); };

export function model(h, forecastDays, today) {
  if (!h || typeof h !== 'object' || h.place !== 'london' || !Array.isArray(h.rows) || h.rows.length > 400 || typeof today !== 'string' || !DATE.test(today)) return null;
  // one row per date (the last one in the file wins; AppSec post-review, low), oldest first
  const rows = [...new Map(h.rows.filter(r => r && typeof r.date === 'string' && DATE.test(r.date)).map(r => [r.date, r])).values()].sort((x, y) => x.date.localeCompare(y.date));
  const byDate = Object.fromEntries(rows.map(r => [r.date, r]));
  // the record's first day: a date from 1 Nov 2026 (before any keeping began) to today, else the first row (AppSec post-review, low)
  const first = typeof h.first_day === 'string' && DATE.test(h.first_day) && h.first_day >= '2026-11-01' && h.first_day <= today ? h.first_day : (rows[0] ? rows[0].date : null);
  if (!first) return null;
  const mk = (date, kind) => {
    const r = byDate[date] || {}; const o = r.observed && typeof r.observed === 'object' ? r.observed : null;
    const d1 = r.forecast && r.forecast.d1 && typeof r.forecast.d1 === 'object' ? r.forecast.d1 : null;
    return { date, kind, obs: o ? cl(o.rain_mm_mean) : null, complete: !!(o && o.complete === true), said: d1 ? cl(d1.rain_mm) : null, fc: null };
  };
  const past = rows.filter(r => r.date < today && r.date >= first).slice(-7).map(r => mk(r.date, 'past'));
  const items = [...past, mk(today, 'today')];
  for (const f of Array.isArray(forecastDays) ? forecastDays.slice(0, 16) : []) { if (f && typeof f.date === 'string' && DATE.test(f.date) && f.date > today) items.push({ date: f.date, kind: 'future', obs: null, complete: false, said: null, fc: cl(f.rain_mm) }); }
  // a difference only for a complete day: today and part days are not over, so they are not scored (travel.b@ review)
  const diff = it => (it.complete && it.obs != null && it.said != null ? r1(it.obs - it.said) : null);
  const diffTxt = it => { const d = diff(it); return d == null ? (it.said != null ? `said ${it.said} mm` : null) : d === 0 ? '✓' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} mm`; };
  const diffSigned = it => { const d = diff(it); return d == null ? (it.said != null && it.obs != null ? 'not scored: the day is not complete' : '') : d === 0 ? '✓ (equal)' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} mm (measured minus said)`; };
  // the track record, computed
  const scored = past.filter(it => it.complete && it.obs != null && it.said != null);
  const hits = scored.filter(it => Math.abs(it.obs - it.said) <= 1 + 1e-9).length;
  const track = scored.length
    ? `${hits} of ${scored.length} past complete days within 1 mm of what we said the day before, since ${day(first)}.`
    : 'No complete day yet has a forecast we kept, so there is no track record yet. It begins as days are kept.';
  const labels = items.map(it => (it.kind === 'future' ? null : it.obs == null ? 'no reading' : it.said == null ? 'not kept' : diffTxt(it)));
  const table = items.map(it => {
    const fut = it.kind === 'future', mm = v => (v == null ? null : `${v} mm`);
    return { day: day(it.date) + (it.kind === 'today' ? ' (today)' : ''),
      meas: fut ? '' : it.obs == null ? 'no reading' : `${it.obs} mm${it.complete ? '' : it.kind === 'today' ? ' (so far)' : ' (part day)'}`,
      said: fut ? '' : mm(it.said) || 'not kept', diff: fut ? '' : diffSigned(it), fc: fut ? mm(it.fc) || 'none' : '' };
  });
  return { first, items, labels, track, table };
}

const el = (t, a, c) => ({ t, a: a || {}, c: c || [] });
const tx = s => ({ text: String(s) });

export function tree(m) {
  const { items, first, track, labels } = m;
  const W = 640, L = 40, R = 8, T = 46, base = 258, H = 350, n = items.length;
  const colW = (W - L - R) / n, bw = Math.min(20, colW / 2 - 3);
  const top = Math.max(5, Math.ceil(Math.max(0, ...items.flatMap(it => [it.obs, it.said, it.fc]).filter(v => v != null)) / 5) * 5);
  const Y = v => base - (base - T) * v / top, f1 = v => v.toFixed(1);
  const N = v => Number(f1(v));
  const bar = (x, v, cls, tip) => {
    const hgt = Math.max(1.5, base - Y(v)), rx = Math.min(4, hgt / 2);
    const st = cls === 'obs' ? STYLES[0] : cls === 'said' ? STYLES[5] : STYLES[6];
    return el('rect', { x: N(x), y: N(base - hgt), width: N(bw), height: N(hgt), rx: N(rx), style: st }, [el('title', {}, [tx(tip)])]);
  };
  const gap = (x, tip) => el('rect', { x: N(x), y: base - 16, width: N(bw), height: 16, rx: 4, style: STYLES[7] }, [el('title', {}, [tx(tip)])]);
  const txt = (x, y, s, bold) => el('text', bold ? { x: N(x), y, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': '700', style: STYLES[0] } : { x: N(x), y, 'text-anchor': 'middle', 'font-size': 11, style: STYLES[0] }, [tx(s)]);
  const shortDay = iso => { const t = day(iso).split(' '); return `${t[0]} ${t[1]}`; };
  const g = [];
  items.forEach((it, i) => {
    const cx = L + colW * (i + 0.5);
    if (it.kind === 'today') g.push(el('rect', { x: N(L + colW * i), y: T - 12, width: N(colW), height: base - T + 66, style: STYLES[2] }), txt(cx, 38, 'Today', true));
  });
  const out = [];
  items.forEach((it, i) => {
    const cx = L + colW * (i + 0.5), nm = day(it.date);
    const s = [];
    if (it.kind === 'future') {
      if (it.fc != null) s.push(bar(cx - bw / 2, it.fc, 'fc', `Forecast for ${nm}: ${it.fc} mm of rain (${it.date}), not yet measured`));
      s.push(txt(cx, base + 28, 'forecast'));
    } else {
      const part = !it.complete && it.obs != null;
      if (it.said != null) s.push(bar(cx - bw - 1, it.said, 'said', `What we said the day before, for ${nm}: ${it.said} mm of rain (${it.date})`));
      if (it.obs != null) s.push(bar(cx + 1, it.obs, 'obs', `Measured on ${nm}: ${it.obs} mm of rain (${it.date})${part ? (it.kind === 'today' ? ', so far' : ', part day') : ''}`));
      else s.push(gap(cx + 1, `No reading for ${nm} (${it.date}); nothing is filled in`));
      s.push(txt(cx, base + 28, labels[i]));
      if (part) s.push(txt(cx, base + 42, it.kind === 'today' ? 'so far' : 'part day'));
    }
    s.push(txt(cx, base + 14, shortDay(it.date)));
    out.push(el('g', {}, s));
  });
  const grid = [];
  for (const v of [0, top / 2, top]) {
    grid.push(el('line', { x1: L, x2: W - R, y1: N(Y(v)), y2: N(Y(v)), style: 'stroke:var(--rule)' }));
    grid.push(el('text', { x: L - 6, y: N(Y(v) + 4), 'text-anchor': 'end', 'font-size': 11, style: STYLES[0] }, [tx(v % 1 ? v.toFixed(1) : v)]));
  }
  grid.push(el('text', { x: 4, y: T - 22, 'font-size': 11, style: STYLES[1] }, [tx('mm')]));
  const lg = (x, style, label) => el('g', { transform: `translate(${x} ${H - 18})` }, [el('rect', { width: 16, height: 12, rx: 3, style }), el('text', { x: 22, y: 11, 'font-size': 11, style: STYLES[0] }, [tx(label)])]);
  const legend = [lg(L, STYLES[0], 'measured'), lg(L + 100, STYLES[5], 'what we said'), lg(L + 220, STYLES[6], 'forecast'), lg(L + 320, STYLES[7], 'no reading')];
  const ttl = 'Rain in London, what we said beside what was measured, with the forecast ahead';
  const desc = items.map(it => it.kind === 'future' ? `${day(it.date)}: forecast ${it.fc != null ? it.fc + ' mm' : 'none'}` : `${day(it.date)}: measured ${it.obs != null ? it.obs + ' mm' : 'no reading'}, said ${it.said != null ? it.said + ' mm' : 'not kept'}`).join('; ');
  return el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-labelledby': 'lon-rain-t lon-rain-d' }, [
    el('title', { id: 'lon-rain-t' }, [tx(ttl)]),
    el('desc', { id: 'lon-rain-d' }, [tx(`Millimetres of rain per day, past days first, then today, then the forecast. ${desc}. ${track}`)]),
    el('defs', {}, [el('pattern', { id: 'lon-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [el('line', { x1: 0, y1: 0, x2: 0, y2: 6, style: STYLES[3] })])]),
    ...g, ...grid, el('text', { x: L, y: 14, 'font-size': 11, style: STYLES[0] }, [tx(`Record begins ${day(first)}`)]),
    ...out, ...legend,
  ]);
}
