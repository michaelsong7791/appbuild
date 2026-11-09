/* Forge — training engine: muscles, fatigue/recovery model, planner, progression. */
(function () {
  'use strict';
  const H = 3600e3, DAY = 24 * H;

  // ---------- Muscles ----------
  const MUSCLES = {
    chest:        { label: 'Chest',      tau: 30, group: 'push' },
    shoulders:    { label: 'Shoulders',  tau: 26, group: 'push' },
    triceps:      { label: 'Triceps',    tau: 22, group: 'push' },
    lats:         { label: 'Lats',       tau: 30, group: 'pull' },
    'middle back':{ label: 'Upper back', tau: 28, group: 'pull' },
    traps:        { label: 'Traps',      tau: 24, group: 'pull' },
    biceps:       { label: 'Biceps',     tau: 22, group: 'pull' },
    forearms:     { label: 'Forearms',   tau: 18, group: 'pull' },
    'lower back': { label: 'Lower back', tau: 40, group: 'legs' },
    abdominals:   { label: 'Core',       tau: 18, group: 'core' },
    quadriceps:   { label: 'Quads',      tau: 36, group: 'legs' },
    hamstrings:   { label: 'Hamstrings', tau: 36, group: 'legs' },
    glutes:       { label: 'Glutes',     tau: 32, group: 'legs' },
    calves:       { label: 'Calves',     tau: 20, group: 'legs' },
    adductors:    { label: 'Adductors',  tau: 26, group: 'legs' },
    abductors:    { label: 'Abductors',  tau: 22, group: 'legs' },
    neck:         { label: 'Neck',       tau: 20, group: 'pull' },
  };
  const MAJOR = ['chest', 'shoulders', 'triceps', 'lats', 'middle back', 'biceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals'];
  const CAPACITY = 5; // hard-set equivalents to reach ~63% fatigue

  const EQUIPMENT = {
    barbell: 'Barbell', dumbbell: 'Dumbbells', cable: 'Cable station', machine: 'Machines',
    kettlebell: 'Kettlebells', band: 'Resistance bands', ezbar: 'EZ bar', bodyweight: 'Bodyweight',
    bench: 'Bench', pullupbar: 'Pull-up bar', smith: 'Smith machine',
  };

  const GOALS = {
    hypertrophy: { label: 'Build muscle',  c: [6, 10, 3, 120], i: [10, 15, 3, 75], weekly: [10, 20] },
    strength:    { label: 'Get stronger',  c: [4, 6, 4, 180],  i: [8, 10, 3, 90],  weekly: [6, 12] },
    fatloss:     { label: 'Lose fat',      c: [8, 12, 3, 75],  i: [12, 15, 3, 45], weekly: [8, 14] },
    endurance:   { label: 'Endurance',     c: [12, 15, 3, 60], i: [15, 20, 2, 45], weekly: [8, 14] },
    general:     { label: 'General fitness', c: [8, 10, 3, 90], i: [10, 12, 3, 60], weekly: [8, 14] },
  };

  let DB = [], BY = {};
  function loadDb(list) { DB = list; BY = {}; list.forEach(e => { BY[e.id] = e; }); }
  const ex = id => BY[id];
  const img = (id, n) => 'img/' + id + '__' + (n || 0) + '.webp';

  function involvement(e) {
    const m = {};
    e.sm.forEach(x => { m[x] = 0.5; });
    e.pm.forEach(x => { m[x] = 1; });
    return m;
  }

  // ---------- Effort & fatigue ----------
  function setEffort(s) {
    if (s.rpe) return 0.35 + 0.65 * clamp((s.rpe - 5) / 5, 0, 1);
    if (s.vloss != null) return 0.35 + 0.65 * clamp(s.vloss / 0.35, 0.3, 1); // watch-estimated
    return 0.85;
  }
  function estRpeFromVloss(v) { if (v == null) return null; return v > 0.35 ? 9.5 : v > 0.25 ? 9 : v > 0.15 ? 8 : 7; }

  function readiness(health, extra) {
    // 0..100. Missing data → neutral 75.
    extra = extra || {};
    if (!health && !extra.load48) return { score: 75, parts: [] };
    health = health || {};
    let score = health.sleepH == null && health.restingHr == null ? 78 : 85; const parts = [];
    if (extra.load48) {
      const pen = Math.min(18, Math.max(0, (extra.load48 - 60) / 12));
      score -= pen; parts.push({ k: 'Cardio load 48h', v: Math.round(extra.load48) + ' TRIMP', good: pen < 6 });
    }
    if (health.sleepH != null) {
      const d = health.sleepH - 7.5; const p = d < 0 ? Math.min(30, -d * 9) : Math.min(5, d * 2) * -1;
      score -= p; parts.push({ k: 'Sleep', v: health.sleepH.toFixed(1) + ' h', good: d > -0.75 });
    }
    if (health.restingHr != null && health.restingHrBase) {
      const d = health.restingHr - health.restingHrBase; score -= clamp(d * 2.5, -5, 20);
      parts.push({ k: 'Resting HR', v: Math.round(health.restingHr) + ' bpm', good: d <= 3 });
    }
    if (health.hrv != null && health.hrvBase) {
      const r = health.hrv / health.hrvBase; score -= clamp((1 - r) * 60, -5, 25);
      parts.push({ k: 'HRV', v: Math.round(health.hrv) + ' ms', good: r >= 0.9 });
    }
    return { score: Math.round(clamp(score, 5, 100)), parts };
  }

  /** Per-muscle fatigue 0..100 at time `now`. */
  function muscleFatigue(sessions, now, health, cardio, prof, extra) {
    now = now || Date.now();
    const r = readiness(health, extra).score;
    const tauMul = clamp(1 + (70 - r) / 100, 0.85, 1.35);
    const F = {}; Object.keys(MUSCLES).forEach(m => { F[m] = 0; });
    const horizon = now - 8 * DAY;
    sessions.forEach(s => {
      if ((s.end || s.date) < horizon) return;
      s.items.forEach(it => {
        const e = ex(it.exId); if (!e) return;
        const inv = involvement(e);
        it.sets.forEach(st => {
          if (!st.done) return;
          const t = st.t || s.date; const dtH = Math.max(0, (now - t) / H);
          const eff = setEffort(st) * (e.cat === 'st' ? 0.1 : e.cat === 'p' ? 0.8 : 1);
          for (const m in inv) F[m] += inv[m] * eff * Math.exp(-dtH / (MUSCLES[m].tau * tauMul));
        });
      });
    });
    (cardio || []).forEach(c => {
      const t = c.end || c.start; if (t < horizon || !window.Energy) return;
      const ms = window.Energy.cardioMuscleSets(c, prof || {}); const dtH = Math.max(0, (now - t) / H);
      for (const m in ms) if (m in F) F[m] += ms[m] * 0.85 * Math.exp(-dtH / (MUSCLES[m].tau * tauMul));
    });
    const out = {};
    for (const m in F) out[m] = Math.round(100 * (1 - Math.exp(-F[m] / CAPACITY)));
    return out;
  }

  // ---------- Planner ----------
  const S = (m, pat, kw, opt) => Object.assign({ m, pat, kw: kw || [] }, opt || {});
  const TEMPLATES = {
    full: [
      { title: 'Full Body A', slots: [S('quadriceps', 'squat'), S('chest', 'hpush'), S('middle back', 'hpull'), S('hamstrings', 'hinge'), S('shoulders', 'iso', ['lateral']), S('biceps', 'iso', ['curl'], { low: 1 }), S('abdominals', 'iso', [], { low: 1 })] },
      { title: 'Full Body B', slots: [S('hamstrings', 'hinge', ['deadlift', 'romanian']), S('shoulders', 'vpush', ['press']), S('lats', 'vpull'), S('quadriceps', 'lunge'), S('chest', 'iso', ['fly', 'flye', 'crossover', 'butterfly']), S('triceps', 'iso', [], { low: 1 }), S('calves', 'iso', [], { low: 1 })] },
      { title: 'Full Body C', slots: [S('quadriceps', 'squat', ['front', 'goblet', 'leg press']), S('chest', 'hpush', ['incline']), S('lats', 'vpull', ['pulldown', 'chin']), S('glutes', 'hinge', ['thrust', 'bridge']), S('shoulders', 'iso', ['rear', 'face pull', 'reverse']), S('triceps', 'iso', [], { low: 1 }), S('abdominals', 'iso', [], { low: 1 })] },
    ],
    ul: [
      { title: 'Upper A', slots: [S('chest', 'hpush'), S('middle back', 'hpull'), S('shoulders', 'vpush'), S('lats', 'vpull'), S('shoulders', 'iso', ['lateral']), S('biceps', 'iso', ['curl'], { low: 1 }), S('triceps', 'iso', [], { low: 1 })] },
      { title: 'Lower A', slots: [S('quadriceps', 'squat'), S('hamstrings', 'hinge', ['romanian', 'deadlift']), S('quadriceps', 'lunge'), S('hamstrings', 'iso', ['curl']), S('calves', 'iso'), S('abdominals', 'iso', [], { low: 1 })] },
      { title: 'Upper B', slots: [S('shoulders', 'vpush', ['press']), S('lats', 'vpull'), S('chest', 'hpush', ['incline']), S('middle back', 'hpull', ['cable', 'dumbbell']), S('chest', 'iso', ['fly', 'flye', 'crossover']), S('triceps', 'iso', ['overhead', 'extension'], { low: 1 }), S('biceps', 'iso', ['hammer'], { low: 1 })] },
      { title: 'Lower B', slots: [S('hamstrings', 'hinge'), S('quadriceps', 'squat', ['front', 'leg press', 'hack', 'goblet']), S('glutes', 'hinge', ['thrust', 'bridge']), S('quadriceps', 'iso', ['extension']), S('calves', 'iso', ['seated']), S('abdominals', 'iso', [], { low: 1 })] },
    ],
    ppl: [
      { title: 'Push', slots: [S('chest', 'hpush'), S('shoulders', 'vpush'), S('chest', 'hpush', ['incline']), S('shoulders', 'iso', ['lateral']), S('triceps', 'iso', ['pushdown']), S('triceps', 'iso', ['overhead', 'extension'], { low: 1 })] },
      { title: 'Pull', slots: [S('lats', 'vpull'), S('middle back', 'hpull'), S('middle back', 'hpull', ['cable', 'dumbbell']), S('shoulders', 'iso', ['face pull', 'rear', 'reverse']), S('biceps', 'iso', ['curl']), S('biceps', 'iso', ['hammer', 'incline'], { low: 1 }), S('traps', 'iso', [], { low: 1 })] },
      { title: 'Legs', slots: [S('quadriceps', 'squat'), S('hamstrings', 'hinge', ['romanian']), S('quadriceps', 'squat', ['leg press', 'hack', 'lunge']), S('hamstrings', 'iso', ['curl']), S('calves', 'iso'), S('abdominals', 'iso', [], { low: 1 })] },
    ],
    bro: [
      { title: 'Chest & Core', slots: [S('chest', 'hpush'), S('chest', 'hpush', ['incline']), S('chest', 'iso', ['fly', 'flye']), S('chest', 'iso', ['crossover', 'butterfly']), S('abdominals', 'iso'), S('abdominals', 'iso', ['plank', 'twist'], { low: 1 })] },
      { title: 'Back', slots: [S('lats', 'vpull'), S('middle back', 'hpull'), S('lats', 'vpull', ['pulldown']), S('middle back', 'hpull', ['dumbbell', 'cable']), S('lower back', 'hinge', [], { low: 1 }), S('traps', 'iso', [], { low: 1 })] },
      { title: 'Shoulders', slots: [S('shoulders', 'vpush'), S('shoulders', 'iso', ['lateral']), S('shoulders', 'iso', ['rear', 'reverse', 'face pull']), S('shoulders', 'iso', ['front']), S('traps', 'iso', ['shrug'], { low: 1 })] },
      { title: 'Arms', slots: [S('triceps', 'hpush', ['close-grip']), S('biceps', 'iso', ['barbell', 'ez']), S('triceps', 'iso', ['pushdown']), S('biceps', 'iso', ['hammer']), S('triceps', 'iso', ['overhead']), S('forearms', 'iso', [], { low: 1 })] },
      { title: 'Legs', slots: [S('quadriceps', 'squat'), S('hamstrings', 'hinge'), S('quadriceps', 'squat', ['leg press', 'lunge']), S('hamstrings', 'iso', ['curl']), S('glutes', 'hinge', ['thrust']), S('calves', 'iso', [], { low: 1 })] },
    ],
  };
  const SPLIT_LABEL = { full: 'Full body', ul: 'Upper / Lower', ppl: 'Push / Pull / Legs', bro: 'Body-part split' };

  function autoSplit(nDays, exp) {
    if (nDays <= 3) return (nDays === 3 && exp === 'advanced') ? 'ppl' : 'full';
    if (nDays === 4) return 'ul';
    if (nDays === 5) return exp === 'beginner' ? 'ul' : 'bro';
    return 'ppl';
  }

  function hasEquip(e, eq) {
    const set = new Set(eq);
    if (!set.has(e.eq)) return false;
    return e.req.every(r => r === 'smith' ? (set.has('smith') || set.has('machine')) : set.has(r));
  }

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  function candidates(slot, prof, used, opts) {
    opts = opts || {};
    const eq = prof.equipment; const lvl = prof.experience;
    const kw = slot.kw.map(k => k.toLowerCase());
    const blocked = new Set(prof.blocked || []); const fav = new Set(prof.favorites || []);
    const r = opts.rand || Math.random;
    return DB.filter(e => (!e.cat || e.cat === 's') && e.pm.includes(slot.m) && hasEquip(e, eq) && !blocked.has(e.id))
      .map(e => {
        const n = e.n.toLowerCase(); let sc = e.t * 12;
        if (kw.some(k => n.includes(k))) sc += 16;
        if (slot.pat !== 'iso' && e.pat === slot.pat) sc += 10;
        if (slot.pat !== 'iso' && e.mech === 'c') sc += 6;
        if (slot.pat === 'iso' && e.mech === 'i') sc += 6;
        if (lvl === 'beginner' && e.lv === 'b') sc += 4;
        if (lvl === 'beginner' && e.lv === 'i') sc -= 3;
        if (prof.goal === 'strength' && (e.eq === 'barbell') && slot.pat !== 'iso') sc += 6;
        if (fav.has(e.id)) sc += 20;
        if (used && used.has(e.id)) sc -= 100;
        sc += r() * 6;
        return { e, sc };
      }).sort((a, b) => b.sc - a.sc);
  }

  function scheme(goal, exp, isCompound, preserve) {
    const g = GOALS[goal] || GOALS.general;
    let [lo, hi, sets, rest] = isCompound ? g.c : g.i;
    if (preserve && isCompound) { lo = 5; hi = 8; rest = Math.max(rest, 150); }
    let s = sets;
    if (exp === 'beginner') s = Math.max(2, s - (isCompound ? 0 : 1));
    if (exp === 'advanced' && isCompound) s += 1;
    return { sets: s, repMin: lo, repMax: hi, rest };
  }

  function itemMinutes(it) { return (it.sets * (it.rest + 45) + 75) / 60; }

  function buildDay(tpl, prof, used, rand) {
    const items = [];
    let slots = tpl.slots.slice();
    // Focus muscles: add an extra isolation slot if not already well covered.
    (prof.focus || []).forEach(fm => {
      const n = slots.filter(s => s.m === fm).length;
      const relevant = slots.some(s => MUSCLES[s.m] && MUSCLES[fm] && MUSCLES[s.m].group === MUSCLES[fm].group);
      if (relevant && n < 2) slots.splice(Math.max(1, slots.length - 1), 0, S(fm, 'iso', [], { focus: 1 }));
    });
    slots.forEach(sl => {
      const c = candidates(sl, prof, used, { rand });
      if (!c.length) return;
      const e = c[0].e; used.add(e.id);
      const sc = e.f === 'stat' ? { sets: 3, repMin: 30, repMax: 60, rest: 60 } : scheme(prof.goal, prof.experience, e.mech === 'c' && sl.pat !== 'iso', prof.preserve);
      if (sl.focus || (prof.focus || []).includes(sl.m)) sc.sets += 1;
      items.push(Object.assign({ exId: e.id, m: sl.m, low: !!sl.low, slot: sl }, sc));
    });
    // Fit to session length: drop low-priority items first, then trim sets.
    const budget = prof.sessionMin || 60;
    const total = () => items.reduce((a, it) => a + itemMinutes(it), 0);
    while (total() > budget && items.some(i => i.low)) items.splice(items.map(i => i.low).lastIndexOf(true), 1);
    let guard = 30;
    while (total() > budget && guard--) { const big = items.slice().sort((a, b) => b.sets - a.sets)[0]; if (big.sets <= 2) break; big.sets--; }
    while (total() > budget && items.length > 3) items.pop();
    items.forEach(i => { delete i.slot; delete i.low; });
    if (prof.finisher) {
      const pool = ['Mountain_Climbers', 'Star_Jump', 'One-Arm_Kettlebell_Swings', 'Rope_Jumping', 'Freehand_Jump_Squat', 'Battling_Ropes'].filter(id => BY[id] && (BY[id].eq === 'bodyweight' || hasEquip(BY[id], prof.equipment)));
      const pick = pool[Math.floor(rand() * pool.length)];
      if (pick) items.push({ exId: pick, m: BY[pick].pm[0], sets: 4, repMin: 30, repMax: 30, rest: 30, unit: 'sec', finisher: true });
    }
    return { title: tpl.title, items };
  }

  function generatePlan(prof, seed) {
    seed = seed || (Date.now() & 0xffffff);
    const split = prof.split && prof.split !== 'auto' ? prof.split : autoSplit(prof.days.length, prof.experience);
    const tpls = TEMPLATES[split];
    const used = new Set(); const rand = rng(seed);
    const days = tpls.map(t => buildDay(t, prof, used, rand));
    // map weekdays -> template index (rotating)
    const sched = {};
    prof.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).forEach((dow, i) => { sched[dow] = i % days.length; });
    return { split, seed, created: Date.now(), days, sched, cardioDays: cardioDays(prof, sched) };
  }

  /** Spread N cardio sessions over the week: rest days first (not the day before a leg-heavy day if avoidable). */
  function cardioDays(prof, sched) {
    const n = Math.min(7, prof.cardioTarget || 0); if (!n) return [];
    const order = [1, 2, 3, 4, 5, 6, 0];
    const rest = order.filter(d => sched[d] == null);
    const lift = order.filter(d => sched[d] != null);
    const pickSpread = (list, k) => { if (k >= list.length) return list.slice(); const out = []; for (let i = 0; i < k; i++) out.push(list[Math.floor((i + 0.5) * list.length / k)]); return out; };
    const a = pickSpread(rest, n); return a.concat(pickSpread(lift, n - a.length));
  }

  function alternatives(exId, prof, limit) {
    const e = ex(exId); if (!e) return [];
    const sl = S(e.pm[0], e.mech === 'c' ? e.pat : 'iso', []);
    return candidates(sl, prof, new Set([exId]), { rand: () => 0.5 }).filter(c => c.e.id !== exId).slice(0, limit || 12).map(c => c.e);
  }

  // ---------- History, progression, PRs ----------
  const e1rm = (w, r) => (w > 0 && r > 0) ? w * (1 + Math.min(r, 15) / 30) : 0;

  function exHistory(sessions, exId) {
    const out = [];
    sessions.forEach(s => s.items.forEach(it => {
      if (it.exId !== exId) return;
      const done = it.sets.filter(x => x.done);
      if (!done.length) return;
      const best = done.reduce((b, x) => Math.max(b, e1rm(x.w, x.r)), 0);
      out.push({ date: s.date, sets: done, best, vol: done.reduce((a, x) => a + (x.w || 0) * (x.r || 0), 0) });
    }));
    return out.sort((a, b) => a.date - b.date);
  }

  function increment(e, units) {
    const lower = ['quadriceps', 'hamstrings', 'glutes', 'lower back', 'calves'].includes(e.pm[0]);
    const kg = { barbell: lower ? 5 : 2.5, dumbbell: 2, kettlebell: 4, cable: 2.5, machine: lower ? 5 : 2.5, ezbar: 2.5, band: 0, bodyweight: 0 }[e.eq] ?? 2.5;
    return units === 'lb' ? (kg >= 4 ? 10 : 5) : kg;
  }

  /** Suggest weight & reps for next time based on last performance (double progression). */
  function suggest(sessions, item, units) {
    const e = ex(item.exId); const h = exHistory(sessions, item.exId);
    if (!h.length) return { w: null, r: item.repMax, note: 'First time — pick a weight you could lift ' + (item.repMax + 2) + ' times.' };
    const last = h[h.length - 1].sets;
    const top = Math.max(...last.map(s => s.w || 0));
    const work = last.filter(s => (s.w || 0) >= top * 0.95);
    const allTop = work.length >= Math.ceil(Math.min(item.sets, last.length) / 2) && work.every(s => s.r >= item.repMax);
    const rpes = work.map(s => s.rpe || estRpeFromVloss(s.vloss)).filter(Boolean);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 8;
    const misses = work.filter(s => s.r < item.repMin).length;
    const inc = increment(e, units);
    if (e.f === 'stat' && !top) { const bestR = Math.max(...last.map(s => s.r || 0)); return { w: null, r: Math.min(bestR + 5, item.repMax + 30), note: 'Hold 5 seconds longer than last time.' }; }
    if (e.eq === 'bodyweight' || e.eq === 'band' || inc === 0) {
      const bestR = Math.max(...last.map(s => s.r || 0));
      return { w: top || null, r: Math.min(bestR + 1, item.repMax + 5), note: allTop ? 'You owned it last time — add reps or slow the tempo.' : 'Aim for one more rep than last time.' };
    }
    if (allTop && avgRpe <= 9) return { w: round(top + inc, inc), r: item.repMin, note: 'Hit the top of the range last time → +' + inc + ' ' + units + '.', up: true };
    if (misses >= 2) {
      const prevMiss = h.length > 1 && h[h.length - 2].sets.filter(s => s.r < item.repMin).length >= 2;
      if (prevMiss) return { w: round(top * 0.9, inc || 1), r: item.repMax, note: 'Two tough sessions in a row → back off 10% and rebuild.', down: true };
      return { w: top, r: item.repMin, note: 'Same weight — beat last time’s reps.' };
    }
    const bestR = Math.max(...work.map(s => s.r || 0));
    return { w: top, r: Math.min(item.repMax, bestR + 1), note: 'Same weight, aim for ' + Math.min(item.repMax, bestR + 1) + ' reps.' };
  }

  function detectPRs(sessions, session) {
    const prior = sessions.filter(s => s.id !== session.id && s.date < session.date);
    const prs = [];
    session.items.forEach(it => {
      const done = it.sets.filter(s => s.done && s.w > 0 && s.r > 0);
      if (!done.length) return;
      const h = exHistory(prior, it.exId);
      if (!h.length) return;
      const prevBest = Math.max(...h.map(x => x.best));
      const prevW = Math.max(...h.flatMap(x => x.sets.map(s => s.w || 0)));
      const best = done.reduce((b, s) => e1rm(s.w, s.r) > e1rm(b.w, b.r) ? s : b, done[0]);
      const topW = Math.max(...done.map(s => s.w));
      if (e1rm(best.w, best.r) > prevBest * 1.005) prs.push({ exId: it.exId, kind: 'e1rm', w: best.w, r: best.r, val: Math.round(e1rm(best.w, best.r)) });
      else if (topW > prevW) prs.push({ exId: it.exId, kind: 'weight', w: topW, val: topW });
    });
    return prs;
  }

  function sessionStats(s) {
    let vol = 0, sets = 0, reps = 0; const mus = {};
    s.items.forEach(it => {
      const e = ex(it.exId); const inv = e ? involvement(e) : {};
      it.sets.forEach(x => {
        if (!x.done) return; sets++; reps += x.r || 0; vol += (x.w || 0) * (x.r || 0);
        for (const m in inv) mus[m] = (mus[m] || 0) + inv[m];
      });
    });
    const dur = Math.max(1, Math.round(((s.end || Date.now()) - s.date) / 60000));
    const hrs = (s.hr || []).map(x => x[1]);
    const hrAvg = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
    return { vol, sets, reps, mus, dur, hrAvg, hrMax: hrs.length ? Math.max(...hrs) : null };
  }

  /** Rough active energy estimate (kcal). Uses HR when available (Keytel-style), else MET 5. */
  function kcal(s, prof) {
    const st = sessionStats(s); const kg = toKg(prof.bodyweight || 75, prof.units); const age = prof.age || 30;
    if (st.hrAvg) {
      const male = prof.sex !== 'f';
      const perMin = male ? (-55.0969 + 0.6309 * st.hrAvg + 0.1988 * kg + 0.2017 * age) / 4.184
                          : (-20.4022 + 0.4472 * st.hrAvg - 0.1263 * kg + 0.074 * age) / 4.184;
      return Math.max(0, Math.round(perMin * st.dur));
    }
    return Math.round(5 * kg * st.dur / 60);
  }

  function weeklyMuscleSets(sessions, now) {
    const start = startOfWeek(now || Date.now());
    const out = {}; MAJOR.forEach(m => { out[m] = 0; });
    sessions.filter(s => s.date >= start).forEach(s => {
      s.items.forEach(it => { const e = ex(it.exId); if (!e) return; const inv = involvement(e); const n = it.sets.filter(x => x.done).length; for (const m in inv) if (m in out) out[m] += n * inv[m]; });
    });
    return out;
  }

  // ---------- utils ----------
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function round(x, step) { step = step || 0.5; return Math.round(x / step) * step; }
  function toKg(w, units) { return units === 'lb' ? w * 0.4536 : w; }
  function startOfWeek(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); const dow = (d.getDay() + 6) % 7; return d.getTime() - dow * DAY; }
  function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function isoWeek(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4); return d.getFullYear() + '-W' + String(1 + Math.round(((d - w1) / DAY - 3 + (w1.getDay() + 6) % 7) / 7)).padStart(2, '0'); }

  window.Engine = {
    MUSCLES, MAJOR, EQUIPMENT, GOALS, TEMPLATES, SPLIT_LABEL, DAY, H,
    loadDb, ex, img, involvement, all: () => DB,
    readiness, muscleFatigue, setEffort, estRpeFromVloss,
    generatePlan, cardioDays, autoSplit, alternatives, candidates, scheme, itemMinutes, hasEquip,
    exHistory, suggest, detectPRs, sessionStats, kcal, weeklyMuscleSets, e1rm, increment,
    clamp, round, startOfWeek, startOfDay, isoWeek, toKg,
  };
})();
