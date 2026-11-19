// Data in the browser (Dinis, 19 Nov 2026 ~01:13 UTC: "load the data in the browser"; PrompTugal__News__Website
// board/guidance/2026-11-19-load-the-data-in-the-browser.md). travel@ wrote the first version on 17 Nov; travel.b@
// rewrote it on 19 Nov to that rule:
// - reads the latest files from our own data host only (data.promptugal.news), with no cookie
//   and no referrer, when the page opens and every 10 minutes while it stays open;
// - replaces the built figures only with a file that passes its checks (its shape, a newer read time, values in
//   bounds); anything else leaves the built page as it is;
// - writes every value with textContent, never as HTML;
// - says on the page whether it shows the live file or the built copy, when the data was read, and marks it stale
//   when it is older than STALE_H hours.
(function () {
  if (!window.fetch || !window.Promise) return;
  var STALE_H = 3, EVERY_MS = 10 * 60 * 1000;
  var OPTS = { cache: 'no-cache', credentials: 'omit', referrerPolicy: 'no-referrer' };
  var NAMES = { EZY: 'easyJet', EJU: 'easyJet Europe', EZS: 'easyJet Switzerland', RYR: 'Ryanair', RUK: 'Ryanair UK', MAY: 'Malta Air (Ryanair)', TAP: 'TAP Air Portugal', TOM: 'TUI Airways', EXS: 'Jet2', BAW: 'British Airways', IBB: 'Binter (Iberia Regional)', IBE: 'Iberia', IBS: 'Iberia Express', RAM: 'Royal Air Maroc', VLG: 'Vueling', TRA: 'Transavia', TVF: 'Transavia France', DLH: 'Lufthansa', EWG: 'Eurowings', AFR: 'Air France', KLM: 'KLM', EIN: 'Aer Lingus', WZZ: 'Wizz Air', WUK: 'Wizz Air UK', SXS: 'SunExpress', LOG: 'Loganair' };
  var WMO = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'light showers', 81: 'showers', 82: 'heavy showers', 95: 'thunderstorm' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function q(s) { return document.querySelector(s); }
  function el(tag, text, cls) { var e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
  // a read time: ISO 8601 UTC only, and never more than 5 minutes in the future (security post-review, 19 Nov 2026)
  function ms(iso) { var n = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/.test(iso) ? Date.parse(iso) : NaN; return isNaN(n) || n > Date.now() + 5 * 60 * 1000 ? null : n; }
  function when(iso, zone, label) { try { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(iso)) + ' ' + label; } catch (e) { return ''; } }
  function num(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }
  function str(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
  function getJson(url) { return fetch(url, OPTS).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  // the page's status line: live file or built copy, when read, stale or not
  var status = q('[data-now="status"]');
  var shown = { at: null, from: null, limit: null };
  // how old is stale: 3 hours, or a file's own cadence plus an hour (data.b@'s London forecast is 6-hourly by design:
  // forecast.expected_cadence, 19 Nov 2026); seconds from 600 to 86400 only
  function cadence(c) { return c && typeof c.seconds === 'number' && c.seconds % 1 === 0 && c.seconds >= 600 && c.seconds <= 86400 ? (c.seconds + 3600) * 1000 : null; }
  function builtLimit() { var v = status ? Number(status.getAttribute('data-stale-s')) : NaN; return v % 1 === 0 && v >= 4200 && v <= 90000 ? v * 1000 : null; }
  function say() {
    if (!status) return;
    var at = shown.at || ms(status.getAttribute('data-read'));
    if (!at) return;
    var zone = status.getAttribute('data-zone') === 'london' ? ['Europe/London', 'London'] : ['Europe/Lisbon', 'Lisbon'];
    var lim = (shown.at ? shown.limit : builtLimit()) || STALE_H * 3600 * 1000, hrs = Math.round(lim / 3600000);
    var old = Date.now() - at > lim;
    status.textContent = (shown.from ? 'Live: figures updated in your browser from ' + shown.from + ', read ' : 'Built copy: figures read ') + when(new Date(at).toISOString(), zone[0], zone[1]) + '.' + (old ? ' Stale: older than ' + hrs + ' hours.' : '');
    status.className = 'live-status' + (old ? ' stale' : '');
  }
  function saw(at, from, limit) { if (!shown.at || at > shown.at) { shown.at = at; shown.from = from; shown.limit = limit || null; } say(); }

  // Faro airport and the Faro temperature (front page, flights, weather)
  var lead = q('[data-now="airport-lead"]'), rows = q('[data-now="airport-rows"]'), temp = q('[data-now="faro-temp"]');
  function okFaro(d) {
    if (!d || d.place !== 'faro' || !d.airport || !ms(d.airport.at)) return false;
    var a = d.airport, list = a.airline;
    if (!Array.isArray(list) || list.length > 300 || !num(a.within_nm, 1, 500)) return false;
    if (a.other_aircraft != null && !num(a.other_aircraft, 0, 5000)) return false;
    for (var i = 0; i < list.length; i++) { var f = list[i]; if (!f || !/^[A-Z0-9]{2,8}$/.test(f.callsign || '') || !/^[A-Z0-9]{2,4}$/.test(f.airline || '') || (f.type != null && !/^[A-Z0-9]{2,4}$/.test(f.type)) || (!f.on_ground && !num(f.alt_ft, 0, 70000))) return false; }
    return true;
  }
  function faro() {
    if (!lead && !temp) return Promise.resolve();
    var built = lead ? ms(lead.getAttribute('data-at')) : null;
    return Promise.all([['https://data.promptugal.news/api/v1/by-place/now/faro.json', 'data.promptugal.news']].map(function (s) { return getJson(s[0]).then(function (d) { return okFaro(d) ? { d: d, from: s[1] } : null; }); })).then(function (got) {
      var best = got.filter(Boolean).sort(function (x, y) { return ms(y.d.airport.at) - ms(x.d.airport.at); })[0];
      if (!best) return;
      var a = best.d.airport, at = ms(a.at), list = a.airline;
      if (built && at <= built) return;
      if (lead) {
        lead.setAttribute('data-at', a.at);
        lead.textContent = list.length + ' airline flight' + (list.length === 1 ? '' : 's') + ' seen within ' + a.within_nm + ' nautical miles of Faro airport at ' + when(a.at, 'Europe/Lisbon', 'Lisbon') + (a.other_aircraft ? ', and ' + a.other_aircraft + ' other aircraft (counted, not named).' : ', and no other aircraft.') + ' Source: adsb.lol (ODbL 1.0), via ' + best.from + '.';
      }
      if (rows) {
        while (rows.firstChild) rows.removeChild(rows.firstChild);
        list.forEach(function (f) {
          var tr = document.createElement('tr');
          tr.appendChild(el('td', f.callsign, 'mono'));
          tr.appendChild(el('td', NAMES[f.airline] || f.airline));
          tr.appendChild(el('td', f.type || '', 'mono'));
          tr.appendChild(el('td', f.on_ground ? 'on the ground' : (f.alt_ft < 10000 ? 'low: arriving or leaving' : 'cruising overhead')));
          tr.appendChild(el('td', f.on_ground ? 'ground' : String(f.alt_ft), 'num'));
          rows.appendChild(tr);
        });
      }
      var r = best.d.station && best.d.station.reading;
      if (temp && r && num(r.temp_c, -30, 55)) temp.textContent = r.temp_c + '°C';
      saw(at, best.from);
    });
  }

  // London: the forecast column and the flood alerts (/london/, /uk-portugal/)
  var lonCells = document.querySelectorAll('[data-now-london]'), floods = q('[data-now="london-floods"]');
  function okLondon(d) {
    if (!d || d.place !== 'london' || !d.forecast || !ms(d.forecast.at) || !Array.isArray(d.forecast.days) || d.forecast.days.length > 16) return false;
    for (var i = 0; i < d.forecast.days.length; i++) { var x = d.forecast.days[i]; if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '') || !num(x.t_min_c, -40, 50) || !num(x.t_max_c, -40, 50) || (x.rain_mm != null && !num(x.rain_mm, 0, 500))) return false; }
    if (d.floods) { var w = d.floods.warnings; if (!Array.isArray(w) || w.length > 200) return false; for (var j = 0; j < w.length; j++) if (!w[j] || !str(w[j].area, 200) || (w[j].severity != null && !str(w[j].severity, 60)) || !/^https:\/\/check-for-flooding\.service\.gov\.uk\/[A-Za-z0-9/_-]{0,120}$/.test(w[j].url || '')) return false; }
    return true;
  }
  function london() {
    if (!lonCells.length && !floods) return Promise.resolve();
    var built = status ? ms(status.getAttribute('data-london-read')) : null;
    return getJson('https://data.promptugal.news/api/v1/by-place/now/london.json').then(function (d) {
      if (!okLondon(d)) return;
      var at = ms(d.forecast.at);
      if (built && at <= built) return;
      var by = {}; d.forecast.days.forEach(function (x) { by[x.date] = x; });
      for (var i = 0; i < lonCells.length; i++) {
        var c = lonCells[i], x = by[c.getAttribute('data-now-london')];
        if (x) c.textContent = Math.round(x.t_min_c) + '°C to ' + Math.round(x.t_max_c) + '°C, ' + (Object.prototype.hasOwnProperty.call(WMO, x.weather_code) ? WMO[x.weather_code] : 'weather not known') + (x.rain_mm != null ? ', ' + x.rain_mm + ' mm rain' : '');
      }
      if (floods && d.floods) {
        while (floods.firstChild) floods.removeChild(floods.firstChild);
        if (!d.floods.warnings.length) floods.appendChild(el('li', 'None in force at the time read.'));
        d.floods.warnings.forEach(function (w) { var li = document.createElement('li'); li.appendChild(el('strong', w.severity || 'Notice')); li.appendChild(document.createTextNode(': ')); var a = el('a', w.area); a.href = w.url; a.rel = 'noopener noreferrer'; li.appendChild(a); floods.appendChild(li); });
      }
      saw(at, 'data.promptugal.news (Open-Meteo, CC BY 4.0; Environment Agency, OGL v3.0)', cadence(d.forecast.expected_cadence));
    });
  }

  function run() { return Promise.all([faro(), london()]).then(say, say); }
  say();
  run();
  setInterval(function () { if (!document.hidden) run(); }, EVERY_MS);
})();
