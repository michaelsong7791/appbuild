/* Forge — smart scheduler.
   Simulates the next 7 days: projects each muscle's recovery from ALL training (weights, add-ons, runs, rides,
   swims…), sleep/HRV readiness and planned cardio, then picks which days to lift and which workout to do,
   so each session lands when its target muscles are recovered while still hitting your weekly session count. */
(function () {
  'use strict';
  const E = () => window.Engine, F = () => window.F;
  const DAY = 864e5, H = 36e5;
  let cache = { key: '', val: null };

  function synthSession(day, t, idx) {
    return { id: 'sim' + t, date: t, end: t + 55 * 60e3, dayIdx: idx, sim: true, items: day.items.filter(it => it.unit !== 'sec').map((it, k) => ({ exId: it.exId, sets: Array.from({ length: it.sets }, (_, j) => ({ done: true, w: 1, r: it.repMax, rpe: 8, t: t + (k * 4 + j) * 60e3 })) })) };
  }

  /** Weighted recovery (0–100) of a workout's target muscles at time t. */
  function readinessFor(day, fat) {
    const v = F().dayMuscles(day); let num = 0, den = 0, worst = 100, worstM = null; const parts = [];
    for (const m in v) {
      const w = v[m] * v[m]; const rec = 100 - (fat[m] || 0); num += w * rec; den += w;
      if (v[m] >= 0.6) { parts.push({ m, rec, w: v[m] }); if (rec < worst) { worst = rec; worstM = m; } }
    }
    parts.sort((a, b) => b.w - a.w);
    return { score: den ? num / den : 100, worst, worstM, parts };
  }

  function preferredCardio(st) {
    const c = {}; (st.cardio || []).slice(-15).forEach(x => { c[x.type] = (c[x.type] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'run';
  }

  function compute(st) {
    const p = st.profile, plan = st.plan; if (!p || !plan) return null;
    const now = Date.now(); const today0 = E().startOfDay(now);
    const key = [today0, Math.floor(now / (30 * 60e3)), st.sessions.length, (st.cardio || []).length, plan.created, plan.seed, JSON.stringify(p.days), p.perWeek, p.smartSched, p.cardioTarget, p.experience, (st.health || {}).at, plan.days.map(d => d.items.length).join()].join('|');
    if (cache.key === key) return cache.val;

    const avail = new Set(p.days || []);
    const perWeek = Math.min(p.perWeek || avail.size, avail.size || 7);
    const maxConsec = p.experience === 'beginner' ? 2 : 3;
    const nT = plan.days.length;
    const real = st.sessions.filter(s => !s.addon && !s.oneoff);
    const liftDays = new Set(real.map(s => E().startOfDay(s.date)));
    const lastDone = {}; real.forEach(s => { if (s.dayIdx != null) lastDone[s.dayIdx] = Math.max(lastDone[s.dayIdx] || 0, s.date); });
    const lastIdx = (() => { const r = real.filter(s => s.dayIdx != null).sort((a, b) => b.date - a.date)[0]; return r ? r.dayIdx : null; })();

    function run(cardioPlan) {
      const sim = st.sessions.slice(); const simCardio = (st.cardio || []).slice();
      cardioPlan.forEach(t => simCardio.push({ type: preferredCardio(st), start: t, end: t + 35 * 60e3, min: 35, rpe: 5, sim: true }));
      const ld = Object.assign({}, lastDone); let prevIdx = lastIdx; const liftSet = new Set(liftDays);
      const days = [];
      for (let k = 0; k < 7; k++) {
        const d0 = today0 + k * DAY; const dow = new Date(d0).getDay();
        const evalT = k === 0 ? Math.max(now, d0 + 7 * H) : d0 + 17.5 * H;
        const wk0 = E().startOfWeek(d0); const wk1 = wk0 + 7 * DAY;
        const doneThisWeek = [...liftSet].filter(t => t >= wk0 && t < wk1 && t < d0 + DAY).length;
        const entry = { t: d0, dow, k, cardio: cardioPlan.some(t => t >= d0 && t < d0 + DAY), cardioType: preferredCardio(st) };
        if (k === 0 && liftDays.has(today0)) { entry.kind = 'done'; entry.reason = 'Workout done today'; days.push(entry); continue; }
        if (!avail.has(dow)) { entry.kind = 'rest'; entry.reason = 'Not a training day for you'; days.push(entry); continue; }
        // remaining availability this week (including today)
        let remainAvail = 0; for (let j = k; j < 7 && today0 + j * DAY < wk1; j++) if (avail.has(new Date(today0 + j * DAY).getDay())) remainAvail++;
        const need = perWeek - doneThisWeek;
        if (need <= 0) { entry.kind = 'rest'; entry.reason = 'Weekly target of ' + perWeek + ' already reached'; days.push(entry); continue; }
        let consec = 0; for (let j = 1; j <= maxConsec; j++) if (liftSet.has(d0 - j * DAY)) consec++; else break;
        if (consec >= maxConsec) { entry.kind = 'rest'; entry.reason = consec + ' lifting days in a row — recovery day'; days.push(entry); continue; }
        const fat = E().muscleFatigue(sim, evalT, st.health, simCardio, p, { load48: simCardio.filter(c => c.start > evalT - 48 * H && c.start < evalT).reduce((a, c) => a + window.Energy.cardioLoad(c, p, st.health), 0) });
        const order = [...Array(nT).keys()].sort((x, y) => (ld[x] || 0) - (ld[y] || 0));
        const evals = order.map(i => Object.assign({ i }, readinessFor(plan.days[i], fat)));
        const okFn = r => r.worst >= 72 && r.score >= 80;
        const must = remainAvail <= need;
        // rotation first: the workout waiting longest whose muscles are ready (never the same one twice in a row)
        let best = evals.find(r => okFn(r) && (r.i !== prevIdx || nT === 1));
        const ok = !!best;
        if (!best) best = evals.slice().sort((x, y) => (y.score * 0.6 + y.worst * 0.4 - (y.i === prevIdx && nT > 1 ? 25 : 0)) - (x.score * 0.6 + x.worst * 0.4 - (x.i === prevIdx && nT > 1 ? 25 : 0)))[0];
        if (!must && !ok) { entry.kind = 'rest'; entry.reason = 'Waiting for ' + F().mLabel(best.worstM || 'quadriceps') + ' to recover (' + Math.round(best.worst) + '%)'; entry.alt = best.i; days.push(entry); continue; }
        entry.kind = 'lift'; entry.idx = best.i; entry.recovery = Math.round(best.score); entry.worst = Math.round(best.worst);
        entry.parts = best.parts.slice(0, 3).map(x => ({ m: x.m, rec: Math.round(x.rec) }));
        entry.reason = (ok ? '' : 'Needed to hit ' + perWeek + '/week — ') + entry.parts.map(x => F().mLabel(x.m) + ' ' + x.rec + '%').join(' · ') + ' recovered';
        entry.forced = !ok;
        days.push(entry);
        sim.push(synthSession(plan.days[best.i], evalT, best.i)); ld[best.i] = evalT; prevIdx = best.i; liftSet.add(d0);
      }
      return days;
    }

    // pass 1: lifting without future cardio → choose cardio days → pass 2 with cardio included
    let days = run([]);
    const nC = p.cardioTarget || 0; let cardioPlan = [];
    if (nC) {
      const loggedThisWeek = (st.cardio || []).filter(c => c.start >= E().startOfWeek(now)).length;
      const want = Math.max(0, Math.min(nC - loggedThisWeek + nC, 7));
      const legDay = i => { const v = F().dayMuscles(plan.days[i]); return (v.quadriceps || 0) + (v.hamstrings || 0) + (v.glutes || 0) > 1.4; };
      const cand = days.filter(d => d.kind !== 'done' && !(d.k === 0 && (st.cardio || []).some(c => c.start >= today0)))
        .map(d => { const next = days[d.k + 1]; let s = d.kind === 'rest' ? 10 : 2; if (next && next.kind === 'lift' && legDay(next.idx)) s -= 6; if (d.kind === 'lift' && legDay(d.idx)) s -= 3; return { d, s }; })
        .sort((a, b) => b.s - a.s || a.d.k - b.d.k);
      const picked = []; const thisWeekEnd = E().startOfWeek(now) + 7 * DAY;
      let needThis = Math.max(0, nC - loggedThisWeek), needNext = nC;
      cand.forEach(({ d }) => { if (picked.some(x => Math.abs(x - d.k) < 1)) return; if (d.t < thisWeekEnd ? needThis-- > 0 : needNext-- > 0) picked.push(d.k); });
      void want;
      cardioPlan = picked.map(k => today0 + k * DAY + 7.5 * H);
      days = run(cardioPlan);
    }
    const val = { days, perWeek, today: days[0], next: days.find(d => d.kind === 'lift' && d.k > 0) || null, cardioDows: days.filter(d => d.cardio).map(d => d.dow) };
    cache = { key, val };
    return val;
  }

  window.Schedule = { compute, invalidate: () => { cache.key = ''; } };
})();
