// Refresh the "now" values from the PrompTugal.news place data when it is newer than the build.
// travel@PrompTugal.dinis, 17 November 2026. No third-party code; fails quietly to the built page.
// From 18 November 2026 (travel.b@PrompTugal.dinis): reads data.promptugal.news's API and promptugal.news's place
// data, both public with CORS, and keeps the one read most recently.
(function () {
  var SOURCES = [['https://data.promptugal.news/api/v1/by-place/now/faro.json', 'data.promptugal.news'], ['https://promptugal.news/data/by-place/now/faro.json', 'the PrompTugal.news place data']];
  var NAMES = { EZY: 'easyJet', EJU: 'easyJet Europe', RYR: 'Ryanair', TAP: 'TAP Air Portugal', TOM: 'TUI Airways', EXS: 'Jet2', BAW: 'British Airways', IBB: 'Binter (Iberia Regional)', VLG: 'Vueling', TRA: 'Transavia', DLH: 'Lufthansa', EWG: 'Eurowings', KLM: 'KLM', EIN: 'Aer Lingus', WZZ: 'Wizz Air' };
  function t(iso) { try { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }).format(new Date(iso)) + ' Lisbon'; } catch (e) { return iso; } }
  function el(tag, text, cls) { var e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; }
  var lead = document.querySelector('[data-now="airport-lead"]');
  if (!lead || !window.fetch) return;
  function get(src) { return fetch(src[0], { cache: 'no-cache', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && d.airport && d.airport.at ? { d: d, from: src[1] } : null; }).catch(function () { return null; }); }
  Promise.all(SOURCES.map(get)).then(function (got) {
    var best = got.filter(Boolean).sort(function (x, y) { return Date.parse(y.d.airport.at) - Date.parse(x.d.airport.at); })[0];
    if (!best) return;
    var d = best.d;
    var a = d.airport, list = a.airline || [];
    if (lead.textContent.indexOf(t(a.at)) !== -1) return;
    lead.textContent = list.length + ' airline flight' + (list.length === 1 ? '' : 's') + ' seen within ' + a.within_nm + ' nautical miles of Faro airport at ' + t(a.at) + (a.other_aircraft ? ', and ' + a.other_aircraft + ' other aircraft (counted, not named).' : ', and no other aircraft.') + ' (Updated in your browser from ' + best.from + '.)';
    var body = document.querySelector('[data-now="airport-rows"]');
    if (body) {
      while (body.firstChild) body.removeChild(body.firstChild);
      list.forEach(function (f) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', f.callsign, 'mono'));
        tr.appendChild(el('td', NAMES[f.airline] || f.airline));
        tr.appendChild(el('td', f.type || '', 'mono'));
        tr.appendChild(el('td', f.on_ground ? 'on the ground' : (f.alt_ft < 10000 ? 'low: arriving or leaving' : 'cruising overhead')));
        tr.appendChild(el('td', f.on_ground ? 'ground' : String(f.alt_ft), 'num'));
        body.appendChild(tr);
      });
    }
    var temp = document.querySelector('[data-now="faro-temp"]');
    if (temp && d.station && d.station.reading && d.station.reading.temp_c != null) temp.textContent = d.station.reading.temp_c + '°C';
  }).catch(function () {});
})();
