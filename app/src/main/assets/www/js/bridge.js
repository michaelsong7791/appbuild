/* Forge — bridge between the web UI and the Android shell (ForgeNative). Falls back to a browser mock. */
(function () {
  'use strict';
  const N = window.ForgeNative || null;
  const pending = {}; const listeners = {};
  let seq = 0;

  window.__forgeResolve = function (id, ok, json) {
    const p = pending[id]; if (!p) return; delete pending[id];
    let v = null; try { v = json ? JSON.parse(json) : null; } catch (e) { v = json; }
    ok ? p.res(v) : p.rej(new Error((v && v.error) || v || 'Native call failed'));
  };
  window.__forgeEmit = function (type, json) {
    let v = null; try { v = json ? JSON.parse(json) : null; } catch (e) { v = json; }
    (listeners[type] || []).forEach(fn => { try { fn(v); } catch (e) { console.error(e); } });
  };

  function call(method, args) {
    if (!N) return Mock.call(method, args || {});
    return new Promise((res, rej) => {
      const id = 'c' + (++seq); pending[id] = { res, rej };
      try { N.call(method, JSON.stringify(args || {}), id); } catch (e) { delete pending[id]; rej(e); }
    });
  }
  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }

  // ---------- Browser mock (development / preview) ----------
  const Mock = {
    watchTimer: null,
    call(method, a) {
      const ok = v => Promise.resolve(v);
      switch (method) {
        case 'hc.status': return ok({ status: 'available', granted: localStorage.getItem('mock.hc') === '1' });
        case 'hc.requestPermissions': localStorage.setItem('mock.hc', '1'); return ok({ granted: true });
        case 'hc.readRecovery': return ok({ sleepH: 6.9, restingHr: 54, restingHrBase: 52, hrv: 61, hrvBase: 64, steps: 7421 });
        case 'hc.readHeartRate': return ok({ samples: [] });
        case 'hc.writeWorkout': case 'hc.writeCardio': case 'hc.writeBody': return ok({ ok: true });
        case 'hc.readSessions': return ok({ sessions: [{ id: 'm1', type: 'run', start: Date.now() - 26 * 3600e3, end: Date.now() - 26 * 3600e3 + 42 * 60e3, distM: 7600, hrAvg: 151, hrMax: 172, kcal: 520, title: 'Morning run' }] });
        case 'hc.readBody': return ok({ heightM: 1.78, entries: [{ t: Date.now() - 20 * 864e5, weightKg: 81.2, bf: 21.4 }, { t: Date.now() - 10 * 864e5, weightKg: 80.6, bf: 20.9 }, { t: Date.now() - 2 * 864e5, weightKg: 80.1, bf: 20.6, bmr: 1780 }] });
        case 'strava.streams': { const n = 300, d = [], a = [], t = [], hr = []; for (let i = 0; i < n; i++) { d.push(i * 9200 / n); a.push(40 + 120 * Math.sin(i / n * Math.PI) + 8 * Math.sin(i / 7)); t.push(i * 11); hr.push(140 + Math.round(20 * Math.sin(i / n * Math.PI))); } return ok({ distance: d, altitude: a, time: t, heartrate: hr }); }
        case 'strava.activities': return ok({ activities: [{ id: 99, type: 'cycle', start: Date.now() - 3 * 864e5, elapsed: 3900, moving: 3600, distM: 28500, elevM: 210, hrAvg: 138, watts: 182, kcal: 0, name: 'Han river ride' }, { id: 98, type: 'run', start: Date.now() - 5 * 864e5, elapsed: 3300, moving: 3200, distM: 9200, elevM: 240, hrAvg: 156, name: 'Seoraksan trail run' }] });
        case 'strava.status': return ok({ configured: !!localStorage.getItem('mock.stravaId'), connected: localStorage.getItem('mock.strava') === '1', athlete: localStorage.getItem('mock.strava') === '1' ? 'Michael' : null });
        case 'strava.configure': localStorage.setItem('mock.stravaId', a.clientId || ''); return ok({ ok: true });
        case 'strava.connect': localStorage.setItem('mock.strava', '1'); setTimeout(() => window.__forgeEmit('strava', JSON.stringify({ connected: true, athlete: 'Michael' })), 600); return ok({ opened: true });
        case 'strava.disconnect': localStorage.removeItem('mock.strava'); return ok({ ok: true });
        case 'strava.upload': return new Promise(r => setTimeout(() => r({ ok: true, activityId: 123 }), 900));
        case 'watch.status': return ok({ connected: true, name: 'Galaxy Watch9 (sim)' });
        case 'watch.send': Mock.simWatch(a); return ok({ ok: true });
        case 'share.backup': { const b = new Blob([a.json], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'forge-backup.json'; l.click(); return ok({ ok: true }); }
        case 'app.keepAwake': return ok({});
        case 'app.vibrate': if (navigator.vibrate) navigator.vibrate(a.ms || 80); return ok({});
        case 'app.openUrl': window.open(a.url, '_blank'); return ok({});
        default: return Promise.reject(new Error('Not available in preview: ' + method));
      }
    },
    simWatch(state) {
      if (!new URLSearchParams(location.search).has('simwatch')) return;
      clearInterval(Mock.watchTimer);
      if (!state || state.phase === 'idle') return;
      let hr = state.phase === 'work' ? 118 : 132;
      Mock.watchTimer = setInterval(() => {
        hr += (state.phase === 'work' ? 2.2 : -1.6) + (Math.random() - 0.5) * 3; hr = Math.max(85, Math.min(172, hr));
        window.__forgeEmit('watch', JSON.stringify({ type: 'hr', bpm: Math.round(hr), t: Date.now() }));
      }, 2000);
    },
  };

  window.Bridge = {
    native: !!N,
    call, on,
    save(json) { try { localStorage.setItem('forge.state', json); } catch (e) { } if (N && N.saveState) try { N.saveState(json); } catch (e) { } },
    load() {
      let s = null;
      if (N && N.loadState) { try { s = N.loadState(); } catch (e) { } }
      if (!s) { try { s = localStorage.getItem('forge.state'); } catch (e) { } }
      return s;
    },
    vibrate(ms) { if (N && N.vibrate) { try { N.vibrate(ms || 80); } catch (e) { } } else if (navigator.vibrate) navigator.vibrate(ms || 80); },
    keepAwake(on) { call('app.keepAwake', { on: !!on }).catch(() => { }); },
  };
})();
