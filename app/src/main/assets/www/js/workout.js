/* Forge — live workout: set logging, rest timer, watch link (HR, reps, tempo), finishing & rewards. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, B = window.Bridge, F = window.F, A = F.actions;
  const S = () => F.S();
  let tick = null, restTick = null, lastHrSave = 0, liveHr = null, liveHrAt = 0;

  // ---------- Start ----------
  F.buildSession = (day, opts) => {
    opts = opts || {};
    const st = S(); const fat = F.fatigue();
    const items = day.items.map(it => {
      const sug = E.suggest(st.sessions, it, F.u());
      let sets = it.sets;
      const e = E.ex(it.exId);
      const pmF = e ? Math.max(...e.pm.map(m => fat[m] || 0)) : 0;
      let adapted = false;
      if (opts.adapt && pmF >= 55 && sets > 2) { sets -= 1; adapted = true; }
      const lowReady = opts.adapt && F.readiness().score < 55;
      const w = sug.w != null && lowReady ? E.round(sug.w * 0.9, E.increment(e, F.u()) || 1) : sug.w;
      return {
        exId: it.exId, repMin: it.repMin, repMax: it.repMax, rest: it.rest, note: sug.note + (adapted ? ' (1 set trimmed — muscle still recovering)' : ''),
        sets: Array.from({ length: sets }, () => ({ w: w, r: sug.r, done: false })),
      };
    });
    return { id: 's' + Date.now().toString(36), date: Date.now(), title: day.title, dayIdx: opts.dayIdx, planned: !!opts.planned, u: F.u(), items, cur: 0, hr: [], rest: null, watch: { reps: 0, tempo: [], peaks: [] }, setStart: Date.now() };
  };

  F.startWorkout = (dayIdx, opts) => {
    const st = S();
    if (st.active) { F.push({ t: 'workout' }); return; }
    const day = st.plan.days[dayIdx];
    st.active = F.buildSession(day, Object.assign({ dayIdx, planned: F.todayIdx() === dayIdx && !F.doneToday() }, opts || {}));
    F.save(true);
    F.push({ t: 'workout' });
    F.resumeWorkout();
    B.vibrate(60);
  };
  A.start = d => F.startWorkout(+d.idx, { adapt: d.adapt === '1' });
  A.resume = () => { F.push({ t: 'workout' }); F.resumeWorkout(); };

  F.resumeWorkout = () => {
    clearInterval(tick);
    tick = setInterval(() => {
      const a = S().active; if (!a) { clearInterval(tick); return; }
      const c = document.getElementById('wk-clock'); if (c) c.textContent = F.clock(Date.now() - a.date);
      const h = document.getElementById('wk-hr'); if (h) { const fresh = liveHr && Date.now() - liveHrAt < 15000; h.classList.toggle('off', !fresh); const v = h.querySelector('.v'); if (v) v.textContent = fresh ? liveHr : '--'; }
    }, 1000);
    if (S().settings.keepAwake) B.keepAwake(true);
    if (S().active && S().active.rest) startRestTicker();
    F.syncWatch();
  };
  F.minimizeWorkout = () => { F.UI.stack = F.UI.stack.filter(x => x.t !== 'workout'); F.render(); };
  A.minimize = () => F.minimizeWorkout();

  // ---------- Set editing ----------
  function cur() { const a = S().active; return a && a.items[a.cur]; }
  function curSetIdx(it) { const i = it.sets.findIndex(s => !s.done); return i < 0 ? it.sets.length : i; }
  F.curSetIdx = curSetIdx;

  A.wStep = d => {
    const a = S().active; const it = a.items[+d.i]; const s = it.sets[+d.j]; const e = E.ex(it.exId);
    const inc = E.increment(e, F.u()) || (F.u() === 'lb' ? 5 : 2.5);
    s.w = Math.max(0, E.round((s.w || 0) + (+d.dir) * inc, inc / 2));
    // propagate to following undone sets
    it.sets.slice(+d.j + 1).forEach(x => { if (!x.done) x.w = s.w; });
    F.save(); F.render();
  };
  A.rStep = d => {
    const it = S().active.items[+d.i]; const s = it.sets[+d.j];
    s.r = Math.max(0, (s.r || 0) + (+d.dir)); s.rEdited = true; F.save(); F.render();
  };
  A.wIn = (d, el) => { const it = S().active.items[+d.i]; const v = parseFloat(el.value); it.sets[+d.j].w = isNaN(v) ? null : v; it.sets.slice(+d.j + 1).forEach(x => { if (!x.done) x.w = it.sets[+d.j].w; }); F.save(); };
  A.rIn = (d, el) => { const it = S().active.items[+d.i]; const v = parseInt(el.value, 10); it.sets[+d.j].r = isNaN(v) ? null : v; it.sets[+d.j].rEdited = true; F.save(); };
  A.rpe = d => { const s = S().active.items[+d.i].sets[+d.j]; s.rpe = s.rpe === +d.v ? null : +d.v; F.save(); F.render(); };

  A.toggleSet = d => {
    const a = S().active; const it = a.items[+d.i]; const s = it.sets[+d.j];
    if (s.done) { s.done = false; delete s.t; F.save(); F.render(); F.syncWatch(); return; }
    completeSet(+d.i, +d.j);
  };

  function completeSet(i, j, fromWatch) {
    const a = S().active; const it = a.items[i]; const s = it.sets[j];
    if (s.w == null && E.ex(it.exId).eq !== 'bodyweight' && E.ex(it.exId).eq !== 'band') s.w = 0;
    if (!s.r) s.r = a.watch.reps || it.repMin;
    s.done = true; s.t = Date.now();
    // Heart-rate during the set
    const win = a.hr.filter(x => x[0] >= (a.setStart || a.date) && x[0] <= s.t).map(x => x[1]);
    if (win.length) { s.hrAvg = Math.round(win.reduce((x, y) => x + y, 0) / win.length); s.hrMax = Math.max(...win); }
    s.hrEnd = liveHr && Date.now() - liveHrAt < 15000 ? liveHr : null;
    // Watch motion: tempo + velocity-loss proxy
    if (a.watch.tempo.length >= 2) {
      s.tempo = a.watch.tempo.slice(0, 30);
      const pk = a.watch.peaks; const n = Math.min(2, Math.floor(pk.length / 2));
      if (n >= 1) {
        const first = pk.slice(0, n).reduce((x, y) => x + y, 0) / n; const last = pk.slice(-n).reduce((x, y) => x + y, 0) / n;
        s.vloss = first > 0 ? Math.max(0, Math.min(0.8, 1 - last / first)) : null;
      }
    }
    a.watch = { reps: 0, tempo: [], peaks: [] };
    // Live PR check
    const hist = E.exHistory(S().sessions, it.exId);
    if (hist.length && s.w > 0) {
      const prev = Math.max(...hist.map(h => h.best));
      if (E.e1rm(s.w, s.r) > prev * 1.005 && !it.prToast) { it.prToast = true; setTimeout(() => { F.toast('🏆 New PR on ' + E.ex(it.exId).n + '!'); F.confetti(); }, 150); }
    }
    B.vibrate(fromWatch ? 40 : 60);
    const moreHere = it.sets.some(x => !x.done);
    const lastOverall = !moreHere && a.items.slice(i + 1).every(x => x.sets.every(y => y.done)) && a.items.slice(0, i).every(x => x.sets.every(y => y.done));
    if (!moreHere && !lastOverall) { const nx = a.items.findIndex((x, k) => k > i && x.sets.some(y => !y.done)); a.cur = nx >= 0 ? nx : a.items.findIndex(x => x.sets.some(y => !y.done)); }
    if (!lastOverall) startRest(it.rest, { i, j }); else a.rest = null;
    F.save(true); F.render(); F.syncWatch();
    if (lastOverall) setTimeout(() => F.sheet({ t: 'finish' }), 300);
  }

  // ---------- Rest timer ----------
  function startRest(sec, from) {
    const a = S().active; a.rest = { until: Date.now() + sec * 1000, total: sec, from, hrStart: liveHr };
    startRestTicker();
  }
  function startRestTicker() {
    clearInterval(restTick);
    restTick = setInterval(() => {
      const a = S().active; if (!a || !a.rest) { clearInterval(restTick); return; }
      const left = a.rest.until - Date.now();
      const t = document.getElementById('rest-t'); if (t) t.textContent = F.clock(left);
      const ring = document.getElementById('rest-ring'); if (ring) { const C = 2 * Math.PI * 108; ring.style.strokeDashoffset = String(C * (1 - Math.max(0, left) / (a.rest.total * 1000))); }
      // HR recovery at 60 s
      if (a.rest.hrStart && !a.rest.hrr && Date.now() - (a.rest.until - a.rest.total * 1000) >= 60000 && liveHr) {
        a.rest.hrr = a.rest.hrStart - liveHr;
        const f = a.rest.from; const s = a.items[f.i] && a.items[f.i].sets[f.j]; if (s) s.hrr = a.rest.hrr;
      }
      if (left <= 0) endRest(true);
    }, 250);
  }
  function endRest(auto) {
    const a = S().active; if (!a || !a.rest) return;
    a.rest = null; a.setStart = Date.now(); clearInterval(restTick);
    if (auto && S().settings.restVibrate) B.vibrate(450);
    F.save(); F.render(); F.syncWatch();
  }
  A.skipRest = () => endRest(false);
  A.addRest = d => { const a = S().active; if (a.rest) { a.rest.until += (+d.s) * 1000; a.rest.total += (+d.s); F.save(); F.render(); } };

  // ---------- Exercise navigation & edits ----------
  A.curEx = d => { const a = S().active; a.cur = +d.i; F.UI.sheet = null; F.save(); F.render(); F.syncWatch(); const b = document.querySelector('.wk-body'); if (b) b.scrollTop = 0; };
  A.nextEx = d => { const a = S().active; a.cur = Math.max(0, Math.min(a.items.length - 1, a.cur + (+d.dir))); F.save(); F.render(); F.syncWatch(); const b = document.querySelector('.wk-body'); if (b) b.scrollTop = 0; };
  A.addSet = () => { const it = cur(); const last = it.sets[it.sets.length - 1] || {}; it.sets.push({ w: last.w, r: last.r || it.repMin, done: false }); F.save(); F.render(); };
  A.delSet = () => { const it = cur(); const i = it.sets.map(s => s.done).lastIndexOf(false); if (i >= 0 && it.sets.length > 1) it.sets.splice(i, 1); F.save(); F.render(); };
  A.wkList = () => F.sheet({ t: 'wkList' });
  A.wkSwap = () => F.sheet({ t: 'swap', mode: 'workout', i: S().active.cur });
  A.wkAdd = () => F.sheet({ t: 'pick', mode: 'workout' });

  // ---------- Watch link ----------
  F.syncWatch = () => {
    const a = S().active;
    if (!a) { B.call('watch.send', { phase: 'idle' }).catch(() => { }); return; }
    const it = a.items[a.cur]; const e = it && E.ex(it.exId); const j = it ? curSetIdx(it) : 0; const s = it && it.sets[Math.min(j, it.sets.length - 1)];
    const next = a.rest ? a.items[a.cur] : null;
    B.call('watch.send', {
      phase: a.rest ? 'rest' : 'work', title: a.title,
      ex: e ? e.n : '', set: Math.min(j + 1, it ? it.sets.length : 1), sets: it ? it.sets.length : 0,
      w: s ? s.w : null, r: s ? s.r : null, unit: a.u, restEnd: a.rest ? a.rest.until : 0,
      nextEx: next && E.ex(next.exId) ? E.ex(next.exId).n : '', started: a.date,
      exIdx: a.cur + 1, exCount: a.items.length,
    }).catch(() => { });
  };

  B.on('watch', msg => {
    const a = S().active; if (!msg) return;
    if (msg.type === 'hr') {
      liveHr = msg.bpm; liveHrAt = Date.now();
      if (a && (msg.t || Date.now()) - lastHrSave >= 2000) { a.hr.push([msg.t || Date.now(), msg.bpm]); lastHrSave = msg.t || Date.now(); if (a.hr.length % 15 === 0) F.save(); }
      const h = document.getElementById('wk-hr'); if (h) { h.classList.remove('off'); const v = h.querySelector('.v'); if (v) v.textContent = msg.bpm; }
    } else if (msg.type === 'rep' && a && !a.rest) {
      a.watch.reps = msg.n; if (msg.dur) a.watch.tempo.push(msg.dur); if (msg.peak) a.watch.peaks.push(msg.peak);
      const it = a.items[a.cur]; const j = curSetIdx(it);
      if (it.sets[j] && !it.sets[j].rEdited) it.sets[j].r = msg.n;
      const box = document.getElementById('wk-reps'); if (box) box.textContent = msg.n;
      const inp = document.querySelector('[data-rin="' + a.cur + '-' + j + '"]'); if (inp && !it.sets[j].rEdited) inp.value = msg.n;
    } else if (msg.type === 'setDone' && a) {
      const it = a.items[a.cur]; const j = curSetIdx(it);
      if (msg.reps != null && it.sets[j]) { it.sets[j].r = msg.reps; it.sets[j].rEdited = true; }
      if (it.sets[j]) completeSet(a.cur, j, true);
    } else if (msg.type === 'skipRest' && a) { endRest(false); }
    else if (msg.type === 'hello') { F.syncWatch(); }
  });

  // ---------- Finish ----------
  A.finishAsk = () => F.sheet({ t: 'finish' });
  A.discard = () => {
    if (!confirm('Discard this workout? Nothing will be saved.')) return;
    const st = S(); st.active = null; F.save(true); clearInterval(tick); clearInterval(restTick); B.keepAwake(false); F.syncWatch();
    F.UI.stack = []; F.UI.sheet = null; F.render();
  };
  A.finish = async () => {
    const st = S(); const a = st.active; if (!a) return;
    clearInterval(tick); clearInterval(restTick); B.keepAwake(false);
    a.end = Date.now(); a.rest = null;
    // keep only exercises with done sets
    a.items = a.items.filter(it => it.sets.some(s => s.done)).map(it => ({ exId: it.exId, repMin: it.repMin, repMax: it.repMax, rest: it.rest, sets: it.sets.filter(s => s.done).map(s => { const o = Object.assign({}, s); delete o.rEdited; return o; }) }));
    const session = { id: a.id, date: a.date, end: a.end, title: a.title, dayIdx: a.dayIdx, planned: a.planned, u: a.u, items: a.items, hr: a.hr, hrSource: a.hr.length ? 'watch' : null, synced: {} };
    if (!session.items.length) { st.active = null; F.save(true); F.UI.stack = []; F.UI.sheet = null; F.render(); F.syncWatch(); F.toast('No sets logged — workout discarded'); return; }
    session.prs = E.detectPRs(st.sessions, session);
    const before = G.levelOf(st.game.xp).level;
    const xp = G.sessionXp(session, session.prs, session.planned);
    session.xp = xp.total; session.xpLines = xp.lines;
    st.game.xp += xp.total;
    st.sessions.push(session); st.active = null;
    G.addMuscleXp(st, session);
    session.newAch = G.checkAchievements(st, session).map(x => x.id);
    session.quests = G.claimQuests(st).map(q => q.id);
    const after = G.levelOf(st.game.xp).level;
    F.save(true); F.syncWatch();
    F.UI.stack = [{ t: 'summary', id: session.id }]; F.UI.sheet = null; F.render();
    setTimeout(() => { if (after > before) F.levelUp(after); else F.confetti(); }, 350);
    // integrations
    const res = await F.syncSession(session, S().settings.autoStrava ? 'all' : 'hc');
    if (res.hc || res.strava) { G.checkAchievements(S(), session).forEach(a2 => { session.newAch.push(a2.id); }); F.save(); }
    if (res.hcErr) F.toast('Samsung Health: ' + res.hcErr);
    if (res.stravaErr) F.toast('Strava: ' + res.stravaErr);
    F.render();
  };
  A.syncNow = async d => {
    const s = S().sessions.find(x => x.id === d.id); if (!s) return;
    F.toast('Syncing…');
    const r = await F.syncSession(s, d.which);
    G.checkAchievements(S(), s); F.save();
    F.toast(r.hc || r.strava ? 'Synced ✓' : (r.hcErr || r.stravaErr || 'Nothing to sync'));
    F.render();
  };
})();
