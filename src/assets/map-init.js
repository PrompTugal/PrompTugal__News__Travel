// Draws the shared map (ptmap 1.0.2) on the front page. The places come from the JSON block #ptmap-data, written at
// build from our own data; nothing is read from the network. Without this script the list inside #ptmap stays.
(function () {
  'use strict';
  var host = document.getElementById('ptmap'), data = document.getElementById('ptmap-data');
  if (!host || !data || !window.PTMap) return;
  var o;
  try { o = JSON.parse(data.textContent); } catch (e) { return; }
  if (!o || !Array.isArray(o.places)) return;
  window.PTMap.render(host, { places: o.places, london: o.london || null, eu: o.eu || null, label: o.label });
})();
