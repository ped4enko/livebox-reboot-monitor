/*
 * Optical (GPON) module + uptime logger for Orange Spain "Livebox Fibra"
 * (Arcadyan PRV3399B, router with built-in ONT). Tested on that model only.
 *
 * What it does: once a minute it reads the same data the admin page shows
 * (support > information > GPON) and stores it in the browser's localStorage.
 * After a crash you can see whether temperature, laser bias, TX/RX power or
 * memory changed in the minutes before it.
 *
 * How to use:
 *   1. Log in to http://192.168.1.1 yourself and keep that tab open.
 *   2. Open DevTools (F12 / Cmd+Opt+I) > Console, paste this file, Enter.
 *   3. Later, in the same tab console:
 *        lbx.last()            // latest sample
 *        lbx.table(30)         // last 30 samples as a table
 *        lbx.csv()             // download everything as CSV
 *        lbx.stop()            // stop logging
 *        lbx.clear()           // delete stored samples
 *
 * Notes:
 *   - Only plain GET requests to two read-only data files, no settings touched.
 *   - Do NOT load admin pages in hidden iframes to scrape them: on this
 *     firmware their scripts end the admin session after a few minutes.
 *   - When the router reboots the session is lost: log in again and paste
 *     the script again (stored samples are kept).
 *   - Values: temp in C, voltage in V, bias in mA, TX/RX in dBm, uptime in s.
 *     Normal GPON RX is roughly -8 ... -27 dBm.
 */
(() => {
  const KEY = 'lbx_log';
  const MAX = 20000;
  const W = window.top;
  if (W.__lbxTimer) W.clearInterval(W.__lbxTimer);

  // The data files are JS calling addCfg(name, id, value); run them with a fake addCfg.
  const read = async (name, extra) => {
    const t = await (await fetch(`/cgi/cgi_${name}.js?${Date.now()}`, { cache: 'no-store' })).text();
    if (!/addCfg\(/.test(t)) return null; // not logged in
    const o = {};
    try {
      o.__x = new Function('addCfg', `${t}\n;return ${extra || 'null'};`)((k, id, v) => { o[k] = v; });
    } catch (e) { /* ignore */ }
    return o;
  };

  const load = () => { try { return JSON.parse(W.localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };

  const tick = async () => {
    const rec = { t: new Date().toLocaleString('sv-SE') };
    try {
      const a = await read('infoFtth');
      const b = await read('info', '[typeof CPU!=="undefined"?CPU:null, typeof memory!=="undefined"?memory:null]');
      if (!a || !b) {
        rec.state = 'noauth';
      } else {
        rec.temp = a.transceiver_temp / 1000;
        rec.vol = a.transceiver_vol / 100;
        rec.bias = a.transceiver_curBias / 100;
        rec.tx = (+a.transceiver_txPwr) / 1000;
        rec.rx = (+decodeURIComponent(a.transceiver_rxPwr)) / 1000;
        rec.up = +b.uptime;
        const x = b.__x || [];
        rec.cpu = x[0] != null ? +x[0] : null;
        if (x[1]) {
          const m = decodeURIComponent(x[1]).split(';'); // "total;free"
          rec.mem = Math.round((m[0] - m[1]) / m[0] * 100);
        }
      }
    } catch (e) {
      rec.state = 'unreachable';
    }
    let L = load();
    L.push(rec);
    if (L.length > MAX) L = L.slice(-MAX);
    W.localStorage.setItem(KEY, JSON.stringify(L));
  };

  W.lbx = {
    last: () => load().slice(-1)[0],
    table: (n = 30) => console.table(load().slice(-n)),
    stop: () => { W.clearInterval(W.__lbxTimer); W.__lbxTimer = null; return 'stopped'; },
    clear: () => { W.localStorage.removeItem(KEY); return 'cleared'; },
    csv: () => {
      const cols = ['t', 'state', 'temp', 'vol', 'bias', 'tx', 'rx', 'up', 'mem', 'cpu'];
      const rows = [cols.join(',')].concat(load().map(r => cols.map(c => r[c] ?? '').join(',')));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
      a.download = 'livebox-optics.csv';
      a.click();
    },
  };

  tick();
  W.__lbxTimer = W.setInterval(tick, 60000);
  return 'logging every 60 s; use lbx.last(), lbx.table(), lbx.csv(), lbx.stop()';
})();
