/* Forge — app core: state, persistence, routing, shared helpers, integrations. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, B = window.Bridge;
  E.loadDb(window.EXDB || []);

  const F = window.F = {};
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
  F.DOW = DOW; F.DOW_ORDER = DOW_ORDER;

  // ---------- State ----------
  const DEFAULT = () => ({
    v: 1,
    profile: null,
    plan: null,
    sessions: [],
    cardio: [],
    body: [],
    addons: {},
    active: null,
    game: { xp: 0, ach: {}, mxp: {}, quests: null, lastLevel: 1 },
    health: null,
    settings: { autoHc: true, autoStrava: false, hcGranted: false, restVibrate: true, keepAwake: true, rpePrompt: true },
  });
  let S = DEFAULT();
  try { const raw = B.load(); if (raw) S = Object.assign(DEFAULT(), JSON.parse(raw)); } catch (e) { console.warn('state load failed', e); }
  S.game = Object.assign(DEFAULT().game, S.game || {});
  S.settings = Object.assign(DEFAULT().settings, S.settings || {});
  ['cardio', 'body'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; }); if (!S.addons) S.addons = {};
  F.S = () => S;
  F.setState = ns => { S = Object.assign(DEFAULT(), ns); save(true); };

  let saveT = null;
  function save(now) {
    clearTimeout(saveT);
    const go = () => B.save(JSON.stringify(S));
    if (now) go(); else saveT = setTimeout(go, 350);
  }
  F.save = save;

  // ---------- UI state (not persisted) ----------
  const UI = F.UI = { tab: 'home', stack: [], sheet: null, ob: 0, obDraft: null, lib: { q: '', m: null, mine: true }, bmSide: 'front', prog: 'overview', integrations: {} };

  // ---------- helpers ----------
  const esc = F.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  F.u = () => (S.profile && S.profile.units) || 'kg';
  F.fmtW = w => (w == null || w === '') ? '—' : (Math.round(w * 10) / 10) + '';
  F.fmtVol = v => v >= 10000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toLocaleString();
  F.fmtDur = min => min >= 60 ? Math.floor(min / 60) + 'h ' + (min % 60) + 'm' : min + ' min';
  F.fmtDate = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  F.clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
  F.mLabel = m => (E.MUSCLES[m] || { label: m }).label;
  F.thumb = (id, lg) => '<div class="thumb' + (lg ? ' lg' : '') + '" style="background-image:url(' + E.img(id, 0) + ')"><div class="b" style="background-image:url(' + E.img(id, 1) + ')"></div></div>';
  F.demo = (id, extra) => '<div class="demo"><img src="' + E.img(id, 0) + '" alt=""><img class="b" src="' + E.img(id, 1) + '" alt="">' + (extra || '') + '</div>';
  F.toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2700); };
  F.todayIdx = () => S.plan && S.plan.sched[new Date().getDay()] != null ? S.plan.sched[new Date().getDay()] : null;
  F.doneToday = () => S.sessions.some(s => E.startOfDay(s.date) === E.startOfDay(Date.now()));
  F.dayMuscles = day => { const v = {}; day.items.forEach(it => { const e = E.ex(it.exId); if (!e) return; const inv = E.involvement(e); for (const m in inv) v[m] = (v[m] || 0) + inv[m] * it.sets; }); const mx = Math.max(1, ...Object.values(v)); for (const m in v) v[m] = Math.max(0.25, v[m] / mx); return v; };
  F.repUnit = (exId, it) => { if (it && it.unit) return it.unit; const e = E.ex(exId); return e && e.f === 'stat' ? 'sec' : 'reps'; };
  F.dayMinutes = day => Math.round(day.items.reduce((a, it) => a + E.itemMinutes(it), 0));
  F.load48 = () => (S.cardio || []).filter(c => c.start > Date.now() - 48 * 3600e3).reduce((a, c) => a + window.Energy.cardioLoad(c, S.profile, S.health), 0);
  F.fatigue = () => E.muscleFatigue(S.sessions.concat(S.active ? [S.active] : []), Date.now(), S.health, S.cardio, S.profile, { load48: F.load48() });
  F.readiness = () => E.readiness(S.health, { load48: F.load48() });

  // ---------- Navigation ----------
  F.go = tab => { UI.tab = tab; UI.stack = []; UI.sheet = null; render(); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; };
  F.push = v => { UI.stack.push(v); UI.sheet = null; render(); };
  F.pop = () => { UI.stack.pop(); render(); };
  F.sheet = v => { UI.sheet = v; render(); };
  F.closeSheet = () => { UI.sheet = null; render(); };
  F.top = () => UI.stack[UI.stack.length - 1];

  // Android back button → native calls window.forgeBack(); return true if handled.
  window.forgeBack = function () {
    if (document.querySelector('.levelup')) { document.querySelector('.levelup').remove(); return true; }
    if (UI.sheet) { F.closeSheet(); return true; }
    if (UI.stack.length) {
      const t = F.top();
      if (t.t === 'workout') { F.minimizeWorkout(); return true; }
      F.pop(); return true;
    }
    if (!S.profile) { if (UI.ob > 0) { UI.ob--; render(); return true; } return false; }
    if (UI.tab !== 'home') { F.go('home'); return true; }
    return false;
  };

  // ---------- Render loop ----------
  const root = document.getElementById('root');
  let lastKey = '';
  function render() {
    const scrolls = {};
    document.querySelectorAll('[data-scroll]').forEach(el => { scrolls[el.dataset.scroll] = el.scrollTop; });
    const key = UI.tab + '|' + UI.stack.map(x => x.t + (x.id || x.idx || '')).join('/');
    root.innerHTML = F.views.root();
    if (key === lastKey) document.querySelectorAll('[data-scroll]').forEach(el => { if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll]; });
    lastKey = key;
    if (F.afterRender) F.afterRender();
  }
  F.render = render;

  // ---------- Event delegation ----------
  const A = F.actions = {};
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]');
    if (!el) { if (ev.target.classList && ev.target.classList.contains('sheet-bg')) F.closeSheet(); return; }
    const fn = A[el.dataset.a];
    if (fn) { ev.preventDefault(); fn(el.dataset, el, ev); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-ch]');
    if (el && A[el.dataset.ch]) A[el.dataset.ch](el.dataset, el, ev);
  });
  document.addEventListener('input', ev => {
    const el = ev.target.closest('[data-in]');
    if (el && A[el.dataset.in]) A[el.dataset.in](el.dataset, el, ev);
  });

  // ---------- Generic actions ----------
  A.tab = d => F.go(d.tab);
  A.back = () => F.pop();
  A.closeSheet = () => F.closeSheet();
  A.ex = d => F.push({ t: 'ex', id: d.id });
  A.bmSide = d => { UI.bmSide = d.side; render(); };
  A.noop = () => { };

  // ---------- Plan ops ----------
  F.regenerate = (keepSeed) => {
    const seed = keepSeed && S.plan ? S.plan.seed : undefined;
    S.plan = E.generatePlan(S.profile, seed);
    save();
  };

  // ---------- Health Connect / Samsung Health ----------
  F.refreshHealth = async (force) => {
    if (!S.settings.hcGranted) return;
    if (!force && S.health && Date.now() - (S.health.at || 0) < 20 * 60e3) return;
    try {
      const h = await B.call('hc.readRecovery', {});
      S.health = Object.assign({}, h, { at: Date.now() }); save(); render();
      if (F.importCardio) { F.importCardio(true); F.importBody(true); }
    } catch (e) { console.warn('health', e); }
  };
  F.connectHealth = async () => {
    try {
      const st = await B.call('hc.status', {});
      if (st.status !== 'available') { F.toast(st.status === 'update_required' ? 'Update Health Connect from the Play Store first' : 'Health Connect is not available on this device'); return; }
      const r = await B.call('hc.requestPermissions', {});
      S.settings.hcGranted = !!r.granted; save();
      F.toast(r.granted ? 'Samsung Health connected via Health Connect' : 'Some permissions were not granted');
      if (r.granted) F.refreshHealth(true);
      render();
    } catch (e) { F.toast(e.message); }
  };

  F.syncSession = async (s, which) => {
    s.synced = s.synced || {};
    const st = E.sessionStats(s);
    const lines = s.items.filter(it => it.sets.some(x => x.done)).map(it => {
      const e = E.ex(it.exId); const d = it.sets.filter(x => x.done);
      const top = Math.max(...d.map(x => x.w || 0));
      return (e ? e.n : it.exId) + ': ' + d.length + '×' + Math.round(d.reduce((a, x) => a + (x.r || 0), 0) / d.length) + (top ? ' @ ' + F.fmtW(top) + ' ' + (s.u || F.u()) : '');
    });
    const payload = {
      id: s.id, name: 'Forge · ' + s.title, start: s.date, end: s.end, kcal: (s.energy || window.Energy.strengthEnergy(s, S)).active, exerciseType: s.addon ? ({ yoga: 'yoga', mobility: 'stretching', cali: 'calisthenics', bootcamp: 'bootcamp', core: 'calisthenics' }[s.addon.prog] || 'strength') : 'strength', sportType: s.addon && (s.addon.prog === 'yoga' || s.addon.prog === 'mobility') ? 'Yoga' : 'WeightTraining',
      description: st.sets + ' sets · ' + F.fmtVol(st.vol) + ' ' + (s.u || F.u()) + ' volume · ' + (s.energy || window.Energy.strengthEnergy(s, S)).total + ' kcal incl. afterburn' + (st.hrAvg ? ' · avg HR ' + st.hrAvg : '') + '\n' + lines.join('\n') + ((s.prs || []).length ? '\n🏆 ' + s.prs.length + ' PR' + (s.prs.length > 1 ? 's' : '') : ''),
      hr: (s.hr || []).map(x => ({ t: x[0], bpm: x[1] })),
    };
    const res = {};
    if ((which === 'hc' || which === 'all') && S.settings.hcGranted && !s.synced.hc) {
      try {
        if (!(s.hr || []).length) {
          const r = await B.call('hc.readHeartRate', { start: s.date, end: s.end });
          if (r && r.samples && r.samples.length) { s.hr = r.samples.map(x => [x.t, x.bpm]); s.hrSource = 'health'; payload.hr = r.samples; payload.hrFromHc = true; }
        }
        await B.call('hc.writeWorkout', payload); s.synced.hc = Date.now(); res.hc = true;
      } catch (e) { res.hcErr = e.message; }
    }
    if ((which === 'strava' || which === 'all') && UI.integrations.strava && UI.integrations.strava.connected && !s.synced.strava) {
      try { const r = await B.call('strava.upload', payload); s.synced.strava = Date.now(); s.stravaId = r && r.activityId; res.strava = true; }
      catch (e) { res.stravaErr = e.message; }
    }
    save(); return res;
  };

  F.refreshIntegrations = async () => {
    try { UI.integrations.strava = await B.call('strava.status', {}); } catch (e) { UI.integrations.strava = { configured: false, connected: false }; }
    try { UI.integrations.watch = await B.call('watch.status', {}); } catch (e) { UI.integrations.watch = { connected: false }; }
    try { const h = await B.call('hc.status', {}); UI.integrations.hc = h; if (h && h.granted != null && h.granted !== S.settings.hcGranted) { S.settings.hcGranted = h.granted; save(); } } catch (e) { UI.integrations.hc = { status: 'unavailable' }; }
    render();
  };

  B.on('strava', v => { if (v && v.error) F.toast('Strava: ' + v.error); else { F.toast('Strava connected' + (v && v.athlete ? ' — hi ' + v.athlete : '')); } F.refreshIntegrations(); });
  B.on('resume', () => { F.refreshHealth(); F.refreshIntegrations(); if (S.active && F.syncWatch) F.syncWatch(); });

  // ---------- Celebrations ----------
  F.confetti = () => {
    const wrap = document.createElement('div'); wrap.className = 'confetti'; document.body.appendChild(wrap);
    const cols = ['#ff6a33', '#ffc94a', '#2fd3a8', '#6aa8ff', '#f2f0ea'];
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('i');
      const sz = 6 + Math.random() * 7;
      d.style.cssText = 'position:absolute;top:-20px;left:' + (Math.random() * 100) + '%;width:' + sz + 'px;height:' + (sz * 0.45) + 'px;background:' + cols[i % cols.length] + ';border-radius:2px';
      wrap.appendChild(d);
      d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + ((Math.random() - 0.5) * 240) + 'px,' + (window.innerHeight + 60) + 'px) rotate(' + (Math.random() * 900) + 'deg)', opacity: 0.9 }],
        { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(() => wrap.remove(), 4200);
  };
  F.levelUp = L => {
    const el = document.createElement('div'); el.className = 'levelup';
    el.innerHTML = '<div class="box"><div class="tiny" style="letter-spacing:.2em;color:var(--gold);font-weight:700">LEVEL UP</div><div class="lv">' + L + '</div><h2 style="margin:8px 0 4px">' + esc(G.title(L)) + '</h2><p class="muted small">Your forge burns hotter. Keep stacking sessions.</p><button class="btn primary block" style="margin-top:12px">Let’s go</button></div>';
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el); F.confetti(); B.vibrate(120);
  };

  // ---------- Boot ----------
  F.boot = () => {
    render();
    F.refreshIntegrations();
    F.refreshHealth();
    if (S.active) { UI.stack = [{ t: 'workout' }]; render(); if (F.resumeWorkout) F.resumeWorkout(); }
  };
})();
