/* Forge — weight prescription.
   1) First time on an exercise: estimate from your own related lifts (strength transfer between exercises),
      or from bodyweight × strength standards × experience × sex. Deliberately conservative (≈4 reps in reserve).
   2) Calibration: rate the first set ("how many more reps could you do?") → remaining sets re-set to the exact target.
   3) After that: estimated 1-rep max (e1RM) from recent sessions (reps + reps-in-reserve, recency-weighted,
      detraining-adjusted) → weight for today's target reps at the goal's target effort, with progressive overload.
   4) In-session autoregulation: every rated set re-tunes the following sets. */
(function () {
  'use strict';
  const E = () => window.Engine;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DAY = 864e5;

  // Epley with reps-in-reserve: e1RM = w · (1 + (reps + RIR) / 30)
  const e1rm = (w, r, rir) => (w > 0 && r > 0) ? w * (1 + Math.min(r + (rir || 0), 20) / 30) : 0;
  const weightFor = (oneRm, reps, rir) => oneRm / (1 + Math.min(reps + rir, 20) / 30);
  const rirOf = s => s.rpe ? clamp(10 - s.rpe, 0, 6) : s.vloss != null ? clamp(10 - E().estRpeFromVloss(s.vloss), 0, 4) : null;

  // Load relative to a barbell for the same movement (per hand for dumbbells/kettlebells).
  const EQF = { barbell: 1, ezbar: 0.95, machine: 0.95, cable: 0.75, dumbbell: 0.42, kettlebell: 0.38 };
  const MIN = { kg: { barbell: 20, ezbar: 10, dumbbell: 2, kettlebell: 8, cable: 5, machine: 10 }, lb: { barbell: 45, ezbar: 20, dumbbell: 5, kettlebell: 18, cable: 10, machine: 20 } };

  /** Movement "family" + bodyweight ratio of an intermediate man's barbell-equivalent 1RM. */
  function standard(e) {
    const n = e.n.toLowerCase(); const has = (...k) => k.some(x => n.includes(x)); const pm = e.pm[0];
    if (has('leg press')) return { fam: 'legpress', r: 2.0, lower: 1 };
    if (has('hack squat')) return { fam: 'hack', r: 1.2, lower: 1 };
    if (has('front squat', 'goblet')) return { fam: 'frontsquat', r: 1.0, lower: 1 };
    if (e.pat === 'squat') return { fam: 'squat', r: 1.25, lower: 1 };
    if (has('romanian', 'stiff', 'good morning')) return { fam: 'rdl', r: 1.1, lower: 1 };
    if (has('hip thrust', 'glute bridge')) return { fam: 'thrust', r: 1.5, lower: 1 };
    if (has('swing')) return { fam: 'swing', r: 0.45, lower: 1 };
    if (e.pat === 'hinge') return { fam: 'deadlift', r: 1.5, lower: 1 };
    if (e.pat === 'lunge') return { fam: 'lunge', r: 0.65, lower: 1 };
    if (has('leg extension')) return { fam: 'legext', r: 0.75, lower: 1, ref: 'machine' };
    if (has('leg curl', 'glute ham')) return { fam: 'legcurl', r: 0.55, lower: 1, ref: 'machine' };
    if (pm === 'calves') return { fam: 'calf', r: has('seated') ? 0.8 : 1.2, lower: 1, ref: 'machine' };
    if (pm === 'adductors' || pm === 'abductors') return { fam: 'hipmachine', r: 0.8, lower: 1, ref: 'machine' };
    if (e.pat === 'hpush') return { fam: has('incline') ? 'incline' : has('decline') ? 'decline' : 'bench', r: has('incline') ? 0.85 : has('decline') ? 1.05 : 1.0 };
    if (e.pat === 'vpush') return { fam: 'ohp', r: 0.62 };
    if (e.pat === 'hpull') return { fam: 'row', r: 0.8 };
    if (e.pat === 'vpull') return { fam: 'pulldown', r: 0.75, ref: 'cable_as_bar' };
    if (has('fly', 'flye', 'crossover', 'butterfly')) return { fam: 'fly', r: 0.18, ref: 'dumbbell' };
    if (has('pullover')) return { fam: 'pullover', r: 0.3, ref: 'dumbbell' };
    if (has('face pull')) return { fam: 'facepull', r: 0.35, ref: 'cable' };
    if (has('rear delt', 'reverse fly', 'reverse flyes', 'reverse machine')) return { fam: 'reardelt', r: 0.09, ref: 'dumbbell' };
    if (has('upright')) return { fam: 'upright', r: 0.45 };
    if (has('shrug')) return { fam: 'shrug', r: 1.0 };
    if (has('lateral', 'deltoid raise')) return { fam: 'lateral', r: 0.11, ref: 'dumbbell' };
    if (has('raise') && pm === 'shoulders') return { fam: 'frontraise', r: 0.12, ref: 'dumbbell' };
    if (pm === 'biceps') return has('hammer') ? { fam: 'hammer', r: 0.2, ref: 'dumbbell' } : { fam: 'curl', r: 0.42 };
    if (pm === 'triceps') return has('pushdown') ? { fam: 'pushdown', r: 0.4, ref: 'cable' } : has('overhead', 'extension') ? { fam: 'triext', r: 0.3, ref: 'ezbar' } : has('kickback') ? { fam: 'kickback', r: 0.08, ref: 'dumbbell' } : { fam: 'skull', r: 0.35, ref: 'ezbar' };
    if (pm === 'forearms') return { fam: 'wrist', r: 0.35 };
    if (pm === 'abdominals') return { fam: 'abs', r: has('cable') ? 0.6 : 0.45, ref: has('cable') ? 'cable' : 'machine' };
    if (pm === 'traps') return { fam: 'shrug', r: 1.0 };
    return { fam: 'other:' + pm, r: 0.3 };
  }

  /** Factor converting this exercise's per-implement load to the family's reference load. */
  function eqFactor(e, st) {
    if (st.ref === 'dumbbell' || st.ref === 'cable' || st.ref === 'ezbar' || st.ref === 'machine') return (EQF[e.eq] || 1) / (EQF[st.ref] || 1);
    if (st.ref === 'cable_as_bar') return e.eq === 'cable' || e.eq === 'machine' ? 1 : EQF[e.eq] || 1;
    let f = EQF[e.eq] || 1;
    if (e.req.includes('smith')) f = 0.95;
    if (/one-arm|one arm|single|alternat/i.test(e.n) && (e.eq === 'cable' || e.eq === 'machine')) f *= 0.5;
    return f;
  }

  function roundW(w, e, units) {
    const inc = E().increment(e, units) || (units === 'lb' ? 5 : 2.5);
    const step = e.eq === 'dumbbell' ? (units === 'lb' ? 5 : (w < 10 ? 1 : 2)) : e.eq === 'barbell' || e.eq === 'ezbar' ? (units === 'lb' ? 5 : 2.5) : inc;
    const min = (MIN[units] || MIN.kg)[e.eq] || 0;
    return Math.max(min, Math.floor(w / step + 0.3) * step);
  }

  const goalRir = prof => (E().GOALS[prof.goal] || {}).rir || 2;
  const bwKg = prof => E().toKg(prof.bodyweight || (prof.sex === 'f' ? 62 : 78), prof.units);

  /** Recency-weighted e1RM from own history. */
  function ownE1rm(sessions, exId) {
    const out = [];
    sessions.forEach(s => s.items.forEach(it => {
      if (it.exId !== exId) return;
      let best = 0, rated = false;
      it.sets.forEach(x => { if (!x.done || !(x.w > 0) || !(x.r > 0)) return; const r = rirOf(x); if (r != null) rated = true; best = Math.max(best, e1rm(x.w, x.r, r != null ? r : (x.r < it.repMin ? 0 : 2))); });
      if (best) out.push({ t: s.date, v: best, rated });
    }));
    if (!out.length) return null;
    out.sort((a, b) => a.t - b.t);
    const recent = out.slice(-4).reverse(); const wts = [1, 0.55, 0.3, 0.15];
    let num = 0, den = 0; recent.forEach((x, i) => { num += x.v * wts[i]; den += wts[i]; });
    let v = num / den;
    const days = (Date.now() - out[out.length - 1].t) / DAY;
    const detrain = days > 14 ? clamp((days - 14) / 7 * 0.012, 0, 0.12) : 0;
    v *= 1 - detrain;
    // trend over the last 5 sessions (for plateau detection)
    const last = out.slice(-5); const slope = last.length >= 4 ? (last[last.length - 1].v - last[0].v) / last[0].v : null;
    return { v, n: out.length, days: Math.round(days), detrain, slope, lastRated: out[out.length - 1].rated };
  }

  /** e1RM transferred from related exercises you've done (same family / same main muscle & movement). */
  function transferE1rm(st, e) {
    const fam = standard(e); const ff = eqFactor(e, fam); let best = null;
    const ids = new Set(); st.sessions.forEach(s => s.items.forEach(it => ids.add(it.exId)));
    ids.forEach(id => {
      if (id === e.id) return; const o = E().ex(id); if (!o || o.eq === 'bodyweight' || o.eq === 'band') return;
      const of = standard(o); let sim = 0;
      if (of.fam === fam.fam) sim = 1;
      else if (o.pm[0] === e.pm[0] && o.pat === e.pat && e.pat !== 'iso') sim = 0.8;
      else return;
      const h = ownE1rm(st.sessions, id); if (!h) return;
      // convert: their load → barbell-equivalent → this exercise's implement (and family ratio if different family)
      let v = h.v / eqFactor(o, of) * ff * (of.fam === fam.fam ? 1 : fam.r / of.r);
      const conf = sim * Math.min(1, h.n / 3);
      if (!best || conf > best.conf) best = { v: v * (sim < 1 ? 0.92 : 0.97), conf, from: o.n };
    });
    return best;
  }

  function standardE1rm(prof, e) {
    const s = standard(e); const kg = bwKg(prof);
    const exp = { beginner: 0.6, intermediate: 1, advanced: 1.3 }[prof.experience] || 1;
    const sex = prof.sex === 'f' ? (s.lower ? 0.72 : 0.55) : 1;
    const age = (prof.age || 30) > 50 ? 0.88 : (prof.age || 30) > 40 ? 0.95 : 1;
    const one = kg * s.r * exp * sex * age * eqFactor(e, s);
    return { v: prof.units === 'lb' ? one * 2.20462 : one };
  }

  /** Main entry: { w, r, note, basis, calib, e1rm, rir } — or null for exercises without external load. */
  function prescribe(st, item) {
    const e = E().ex(item.exId); if (!e) return null;
    if (item.unit === 'sec' || e.f === 'stat' || e.eq === 'bodyweight' || e.eq === 'band' || e.cat === 'st') return null;
    const prof = st.profile; const units = prof.units || 'kg'; const rir = goalRir(prof);
    const repMin = item.repMin, repMax = item.repMax; const own = ownE1rm(st.sessions, e.id);
    const fit = (one, rirT) => {
      // heaviest rounded weight that still allows at least repMin at the target effort, aiming for the upper-middle of the range
      const aim = Math.round(repMin + (repMax - repMin) * 0.6);
      let w = roundW(weightFor(one, aim, rirT), e, units);
      let r = clamp(Math.floor(30 * (one / w - 1) - rirT), repMin, repMax);
      if (30 * (one / w - 1) - rirT < repMin - 0.5) { w = roundW(weightFor(one, repMin, rirT), e, units); r = repMin; }
      return { w, r };
    };
    if (own) {
      // progressive overload: +1.5% (lower body 2%) when the last session was rated easy or reps hit the top
      const lowerBody = !!standard(e).lower;
      const h = E().exHistory(st.sessions, e.id); const last = h[h.length - 1];
      const lastRirs = last.sets.map(rirOf).filter(x => x != null);
      const avgRir = lastRirs.length ? lastRirs.reduce((a, b) => a + b, 0) / lastRirs.length : null;
      const topHit = last.sets.filter(s => s.r >= repMax).length >= Math.ceil(last.sets.length / 2);
      let bump = 0, why = '';
      if ((avgRir != null && avgRir >= rir + 1) || (avgRir == null && topHit)) { bump = lowerBody ? 0.025 : 0.015; why = 'last time felt easy → small increase'; }
      else if (avgRir != null && avgRir < rir - 1) { bump = -0.02; why = 'last time was near failure → slight back-off'; }
      const one = own.v * (1 + bump);
      const { w, r } = fit(one, rir);
      const prevTop = Math.max(...last.sets.map(s => s.w || 0));
      let note = w > prevTop ? '↑ ' + w + ' ' + units + ' (+' + Math.round((w - prevTop) * 10) / 10 + ') — ' : w < prevTop ? '↓ ' + w + ' ' + units + ' — ' : 'Same weight — ';
      note += why || 'aim for ' + r + ' reps with ~' + rir + ' left in the tank';
      if (own.detrain > 0.02) note = 'Welcome back (' + own.days + ' days) — eased ' + Math.round(own.detrain * 100) + '% for the layoff. ' + note;
      if (own.slope != null && own.slope <= 0.005 && own.n >= 5) note += '. Plateau over 5 sessions — consider a deload week or swapping variation.';
      return { w, r, note, basis: 'history', e1rm: Math.round(own.v), rir, calib: !own.lastRated && own.n < 2 };
    }
    // first time: transfer from related lifts, else strength standards; start conservative (≈4 RIR) and calibrate
    const tr = transferE1rm(st, e);
    const base = tr && tr.conf >= 0.5 ? tr : standardE1rm(prof, e);
    const startRir = tr && tr.conf >= 0.8 ? 3 : 4;
    const { w, r } = fit(base.v, startRir);
    const why = tr && tr.conf >= 0.5 ? 'based on your ' + tr.from : 'estimated from your bodyweight (' + (prof.bodyweight || '?') + ' ' + units + ') and ' + prof.experience + ' level';
    return { w, r, note: 'First time — start at ' + w + ' ' + units + ' (' + why + '). Rate set 1 and Forge sets the rest.', basis: tr && tr.conf >= 0.5 ? 'transfer' : 'standard', e1rm: Math.round(base.v), rir, calib: true };
  }

  /** Re-tune the remaining sets of an exercise from a rated (or failed) set. Returns a message or null. */
  function autoregulate(st, it, j) {
    const e = E().ex(it.exId); const s = it.sets[j]; if (!e || !s || !s.done || !(s.w > 0) || !(s.r > 0)) return null;
    if (e.eq === 'bodyweight' || e.eq === 'band') return null;
    const units = st.profile.units || 'kg'; const rirT = goalRir(st.profile);
    let r = rirOf(s); if (r == null) { if (s.r < it.repMin) r = 0; else return null; }
    const one = e1rm(s.w, s.r, r);
    const rest = it.sets.map((x, k) => ({ x, k })).filter(o => o.k > j && !o.x.done && !o.x.wEdited);
    if (!rest.length) return null;
    const aim = Math.round(it.repMin + (it.repMax - it.repMin) * 0.6);
    let w = roundW(weightFor(one, aim, rirT), e, units);
    let reps = clamp(Math.floor(30 * (one / w - 1) - rirT), it.repMin, it.repMax);
    const cur = rest[0].x.w || 0;
    // only change when it matters (>= one plate step or effort far off)
    const diffEffort = Math.abs(r - rirT);
    if (Math.abs(w - cur) < (E().increment(e, units) || 2.5) * 0.99 && diffEffort < 2) return null;
    if (!it.calib && Math.abs(w - cur) / Math.max(1, cur) > 0.2) w = roundW(cur * (w > cur ? 1.2 : 0.8), e, units); // cap jumps for known lifts
    rest.forEach(o => { o.x.w = w; o.x.r = reps; o.x.auto = true; });
    it.e1rmLive = Math.round(one);
    const first = rest[0].k + 1, lastK = rest[rest.length - 1].k + 1;
    return (it.calib && j === 0 ? 'Calibrated' : 'Adjusted') + ': set' + (first === lastK ? ' ' + first : 's ' + first + '–' + lastK) + ' → ' + w + ' ' + units + ' × ' + reps;
  }

  /** Realistic weekly sets for a muscle: each plan exercise at the set count you last actually did. */
  function plannedWeekly(st, m) {
    const plan = st.plan; if (!plan || !plan.days.length) return null;
    const per = (st.profile.perWeek || (st.profile.days || []).length || 3) / plan.days.length; let tot = 0;
    plan.days.forEach(d => d.items.forEach(it => {
      const e = E().ex(it.exId); if (!e) return; const inv = E().involvement(e)[m] || 0; if (!inv) return;
      const h = E().exHistory(st.sessions, e.id); const n = h.length ? h[h.length - 1].nSets : (it.sets || 3);
      tot += n * inv * per;
    }));
    return tot;
  }

  /** Working sets for today: standard 3 for a new exercise, then tuned from that exercise's latest history
      (how it felt, rep drop-off, plateaus, realistic weekly volume for the muscle, current recovery). Max ±1 per session. */
  function prescribeSets(st, item, fat) {
    const base = item.sets || 3; const e = E().ex(item.exId);
    if (!e || item.unit === 'sec' || item.finisher || e.cat === 'st') return { sets: base, why: [] };
    const h = E().exHistory(st.sessions, e.id); const why = [];
    if (!h.length) return { sets: 3, why: ['standard 3 sets for a new exercise'] };
    const last = h[h.length - 1]; const lastN = clamp(last.nSets || base, 2, 5); let n = lastN;
    const lbl = (E().MUSCLES[e.pm[0]] || { label: e.pm[0] }).label;
    if (last.feel === 'easy') { n = lastN + 1; why.push('+1: felt easy last time'); }
    else if (last.feel === 'max') { n = lastN - 1; why.push('−1: felt like too much last time'); }
    else {
      const sameW = last.sets.filter(x => x.w === last.sets[0].w);
      if (sameW.length >= 3 && sameW[sameW.length - 1].r < sameW[0].r * 0.7) { n = lastN - 1; why.push('−1: reps dropped off sharply last time'); }
    }
    if (n === lastN) {
      const own = ownE1rm(st.sessions, e.id);
      const g = E().GOALS[st.profile.goal] || E().GOALS.general; const pw = plannedWeekly(st, e.pm[0]);
      if (own && own.slope != null && own.slope <= 0.005 && own.n >= 5 && lastN < base + 2) { n = lastN + 1; why.push('+1: progress has stalled — adding volume'); }
      else if (pw != null && pw < g.weekly[0] - 1 && lastN < base + 1) { n = lastN + 1; why.push('+1: ' + lbl + ' weekly volume below target (' + Math.round(pw) + '/' + g.weekly[0] + ' sets)'); }
      else if (pw != null && pw > g.weekly[1] + 4 && lastN > base - 1) { n = lastN - 1; why.push('−1: ' + lbl + ' weekly volume already high'); }
    }
    if (fat && Math.max(...e.pm.map(x => fat[x] || 0)) >= 60 && n > 2) { n--; why.push('−1: ' + lbl + ' still recovering'); }
    n = clamp(n, Math.max(2, lastN - 1), Math.min(5, lastN + 1));
    if (!why.length) why.push('same as last time');
    return { sets: n, why };
  }

  window.Load = { prescribe, prescribeSets, plannedWeekly, autoregulate, e1rm, weightFor, ownE1rm, standard, rirOf };
})();
