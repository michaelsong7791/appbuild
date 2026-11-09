/* Forge — energy & body: cardio types, calorie models (HR / ACSM / MET), afterburn (EPOC),
   BMR, body-composition math and body-composition-driven training insights. */
(function () {
  'use strict';
  const E = () => window.Engine;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Cardio types ----------
  // mets: [easy, moderate, hard] (Compendium of Physical Activities 2024 ballpark)
  // mus: relative muscle involvement (1 = prime mover)
  const CARDIO = {
    run:          { label: 'Running', icon: '🏃', dist: true, mets: [8, 9.8, 11.8], mus: { quadriceps: 1, calves: 1, hamstrings: 0.8, glutes: 0.7, abdominals: 0.3 }, strava: 'Run' },
    run_tread:    { label: 'Treadmill run', icon: '🏃', dist: true, mets: [7.5, 9.3, 11.5], mus: { quadriceps: 1, calves: 1, hamstrings: 0.7, glutes: 0.6, abdominals: 0.3 }, strava: 'Run' },
    walk:         { label: 'Walking', icon: '🚶', dist: true, mets: [2.8, 3.5, 4.8], mus: { quadriceps: 0.5, calves: 0.6, glutes: 0.4, hamstrings: 0.3 }, strava: 'Walk' },
    hike:         { label: 'Hiking', icon: '🥾', dist: true, mets: [5.3, 6.5, 7.8], mus: { quadriceps: 0.8, glutes: 0.8, calves: 0.7, hamstrings: 0.5, 'lower back': 0.2 }, strava: 'Hike' },
    cycle:        { label: 'Cycling (outdoor)', icon: '🚴', dist: true, mets: [6, 8, 10.5], mus: { quadriceps: 1, glutes: 0.6, calves: 0.5, hamstrings: 0.4 }, strava: 'Ride' },
    cycle_indoor: { label: 'Indoor cycling', icon: '🚲', dist: false, mets: [5.5, 7, 10.5], mus: { quadriceps: 1, glutes: 0.6, calves: 0.5, hamstrings: 0.4 }, strava: 'VirtualRide' },
    swim:         { label: 'Swimming', icon: '🏊', dist: true, mets: [5.8, 8.3, 10], mus: { lats: 1, shoulders: 1, triceps: 0.6, chest: 0.6, 'middle back': 0.5, abdominals: 0.4, quadriceps: 0.3 }, strava: 'Swim' },
    row:          { label: 'Rowing', icon: '🚣', dist: true, mets: [4.8, 7, 8.5], mus: { lats: 0.9, 'middle back': 0.9, quadriceps: 0.8, hamstrings: 0.6, glutes: 0.6, biceps: 0.5, 'lower back': 0.4, shoulders: 0.3 }, strava: 'Rowing' },
    elliptical:   { label: 'Elliptical', icon: '⚙️', dist: false, mets: [5, 7, 9], mus: { quadriceps: 0.7, glutes: 0.6, hamstrings: 0.4, calves: 0.4, shoulders: 0.2 }, strava: 'Elliptical' },
    stairs:       { label: 'Stair climber', icon: '🪜', dist: false, mets: [4, 8.8, 9.5], mus: { quadriceps: 0.9, glutes: 0.9, calves: 0.7, hamstrings: 0.4 }, strava: 'StairStepper' },
    hiit:         { label: 'HIIT', icon: '⚡', dist: false, mets: [6, 8, 10], mus: { quadriceps: 0.6, glutes: 0.4, shoulders: 0.3, chest: 0.3, abdominals: 0.4, calves: 0.4 }, strava: 'HighIntensityIntervalTraining' },
    yoga:         { label: 'Yoga / pilates', icon: '🧘', dist: false, mets: [2.5, 3, 4], mus: { abdominals: 0.2 }, strava: 'Yoga' },
    sport:        { label: 'Sports', icon: '⚽', dist: false, mets: [5, 7, 9], mus: { quadriceps: 0.6, calves: 0.6, hamstrings: 0.5, glutes: 0.4 }, strava: 'Workout' },
    other:        { label: 'Other', icon: '✨', dist: false, mets: [4, 6, 8], mus: { quadriceps: 0.3 }, strava: 'Workout' },
  };

  // ---------- Physiology helpers ----------
  const kgOf = p => E().toKg(p.bodyweight || 75, p.units);
  const hrMax = p => p.hrMax || Math.round(208 - 0.7 * (p.age || 30)); // Tanaka
  const hrRest = (p, health) => (health && health.restingHr) || p.hrRest || 62;

  /** Latest body entry merged with profile. */
  function bodyNow(st) {
    const b = (st.body || []).slice().sort((a, c) => c.t - a.t);
    const pick = k => { const e = b.find(x => x[k] != null && x[k] !== ''); return e ? e[k] : null; };
    return { weight: pick('weight') ?? st.profile.bodyweight, bf: pick('bf'), smm: pick('smm'), lbm: pick('lbm'), waist: pick('waist'), hips: pick('hips'), neck: pick('neck'), chest: pick('chest'), arm: pick('arm'), thigh: pick('thigh'), bmr: pick('bmr') };
  }

  /** Body fat from Navy tape method (cm) if no measured value. */
  function navyBf(sex, heightCm, waist, neck, hips) {
    if (!heightCm || !waist || !neck || waist <= neck) return null;
    if (sex === 'f') { if (!hips) return null; return 495 / (1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.221 * Math.log10(heightCm)) - 450; }
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  }

  function composition(st) {
    const p = st.profile; const b = bodyNow(st);
    const kg = E().toKg(b.weight || 75, p.units); const h = p.height; // cm
    let bf = b.bf, bfSrc = bf != null ? 'measured' : null;
    if (bf == null) { const nb = navyBf(p.sex, h, b.waist, b.neck, b.hips); if (nb != null && nb > 2 && nb < 60) { bf = Math.round(nb * 10) / 10; bfSrc = 'tape'; } }
    const lbmKg = b.lbm != null ? E().toKg(b.lbm, p.units) : bf != null ? kg * (1 - bf / 100) : null;
    const m = h ? h / 100 : null;
    return {
      kg, heightCm: h, bf, bfSrc, lbmKg, smmKg: b.smm != null ? E().toKg(b.smm, p.units) : null,
      bmi: m ? kg / (m * m) : null,
      ffmi: m && lbmKg ? lbmKg / (m * m) + 6.1 * (1.8 - m) : null, // height-normalised FFMI
      measuredBmr: b.bmr,
    };
  }

  /** Resting metabolic rate kcal/day: measured (Samsung Health/HC) → Katch-McArdle (lean mass) → Mifflin-St Jeor. */
  function bmr(st) {
    const c = composition(st); const p = st.profile;
    if (c.measuredBmr) return { kcal: Math.round(c.measuredBmr), method: 'measured' };
    if (c.lbmKg) return { kcal: Math.round(370 + 21.6 * c.lbmKg), method: 'Katch-McArdle (lean mass)' };
    const h = c.heightCm || (p.sex === 'f' ? 163 : 176); const a = p.age || 30;
    return { kcal: Math.round(10 * c.kg + 6.25 * h - 5 * a + (p.sex === 'f' ? -161 : 5)), method: 'Mifflin-St Jeor' + (c.heightCm ? '' : ' (add height for accuracy)') };
  }

  /** Keytel 2005 HR→energy, gross kcal/min. */
  function keytel(hr, p, kg) {
    const a = p.age || 30;
    return p.sex === 'f' ? (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * a) / 4.184
                         : (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * a) / 4.184;
  }
  /** Integrate HR samples ([t,bpm]) into gross kcal; below ~rest+15 bpm Keytel is unreliable → use resting rate. */
  function hrKcal(samples, p, kg, restRate, health) {
    if (!samples || samples.length < 5) return null;
    const rest = hrRest(p, health); let kcal = 0, covered = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = Math.min(60, (samples[i][0] - samples[i - 1][0]) / 1000) / 60; if (dt <= 0) continue;
      const hr = (samples[i][1] + samples[i - 1][1]) / 2;
      kcal += (hr > rest + 15 ? Math.max(restRate, keytel(hr, p, kg)) : restRate) * dt; covered += dt;
    }
    return { kcal, minutes: covered };
  }

  /** %HR reserve 0..1 */
  function hrr(avg, p, health) { if (!avg) return null; const r = hrRest(p, health); return clamp((avg - r) / (hrMax(p) - r), 0, 1.2); }

  /** Map effort (RPE 1–10, or %HRR) to tier 0 easy / 1 moderate / 2 hard. */
  function tierOf(rpe, hrrv) {
    if (hrrv != null) return hrrv < 0.5 ? 0 : hrrv < 0.72 ? 1 : 2;
    if (rpe) return rpe <= 4 ? 0 : rpe <= 7 ? 1 : 2;
    return 1;
  }

  /** Minetti et al. 2002 net energy cost (J·kg⁻¹·m⁻¹) vs gradient i (−0.45…0.45). */
  const minettiRun = i => 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  const minettiWalk = i => 280.5 * i ** 5 - 58.7 * i ** 4 - 76.8 * i ** 3 + 51.9 * i ** 2 + 19.6 * i + 2.5;
  /** Net kcal over a distance/altitude profile (arrays in metres). Smooths altitude over ~50 m to suppress GPS noise. */
  function profileKcal(dist, alt, kg, walking) {
    if (!dist || !alt || dist.length < 10 || dist.length !== alt.length) return null;
    const f = walking ? minettiWalk : minettiRun; let J = 0, up = 0, down = 0, segStart = 0;
    for (let i = 1; i < dist.length; i++) {
      const dd = dist[i] - dist[segStart];
      if (dd < 50 && i < dist.length - 1) continue;
      if (dd <= 0) { segStart = i; continue; }
      const dh = alt[i] - alt[segStart]; const g = Math.max(-0.45, Math.min(0.45, dh / dd));
      J += f(g) * kg * dd; if (dh > 0) up += dh; else down -= dh; segStart = i;
    }
    return { kcal: J / 4184, up, down };
  }

  /** Cardio METs from pace/power where possible (ACSM metabolic equations), else type × effort. */
  function cardioMet(c, p) {
    const T = CARDIO[c.type] || CARDIO.other; const min = c.min || 1;
    const tier = tierOf(c.rpe, hrr(c.hrAvg, p));
    const vMmin = c.distKm ? c.distKm * 1000 / min : null; // m/min
    // average uphill grade from total elevation gain (gain spread over the route; ACSM is linear so this equals half the route at 2× grade)
    const grade = c.grade != null ? c.grade : (c.elevM && c.distKm ? Math.min(0.15, c.elevM / (c.distKm * 1000)) : 0);
    if ((c.type === 'run' || c.type === 'run_tread') && vMmin && vMmin > 100) return { met: (0.2 * vMmin + 0.9 * vMmin * grade + 3.5) / 3.5, how: 'ACSM running equation (pace' + (grade ? ' + ' + Math.round(c.elevM) + ' m climb' : '') + ')' };
    if ((c.type === 'walk' || c.type === 'hike') && vMmin && vMmin <= 134) return { met: (0.1 * vMmin + 1.8 * vMmin * (grade || (c.type === 'hike' && !c.elevM ? 0.05 : 0)) + 3.5) / 3.5, how: 'ACSM walking equation (pace' + (grade ? ' + ' + Math.round(c.elevM) + ' m climb' : '') + ')' };
    if ((c.type === 'cycle' || c.type === 'cycle_indoor') && c.watts) return { kcalPerMin: c.watts * 60 / 4184 / 0.24, how: 'power (24% efficiency)' };
    if (c.type === 'row' && c.watts) return { kcalPerMin: (4 * c.watts + 350) / 60, how: 'rowing power (Concept2 formula)' };
    if (c.type === 'cycle' && vMmin) { const kmh = vMmin * 0.06; const met = kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 25 ? 10 : kmh < 30 ? 12 : 15.8; if (c.elevM) { const climb = (kgOf(p) + 10) * 9.81 * c.elevM / 0.24 / 4184 * 0.6; return { met, extraKcal: climb, how: 'cycling speed table + ' + Math.round(c.elevM) + ' m climbing work' }; } return { met, how: 'cycling speed table' }; }
    if (c.type === 'swim' && vMmin) { const per100 = 100 / vMmin; return { met: per100 > 3 ? 6 : per100 > 2.2 ? 8.3 : per100 > 1.75 ? 10 : 11, how: 'swim pace table' }; }
    return { met: T.mets[tier], how: 'MET table × effort' };
  }

  /** EPOC fraction of active kcal by intensity (0..1) and modality. Literature: ~6–15 % of exercise energy. */
  function epocFrac(intensity, kind, minutes) {
    let f = kind === 'strength' ? 0.07 + 0.08 * intensity : intensity < 0.45 ? 0.04 : intensity < 0.72 ? 0.07 : 0.12;
    if (kind === 'hiit') f += 0.03;
    if (minutes > 50 && intensity > 0.6) f *= 1.15;
    return clamp(f, 0.03, 0.18);
  }
  const epocHours = intensity => Math.round(2 + 14 * intensity * intensity);

  /** Strength-session energy. Blends HR (Keytel overshoots during lifting) with intensity-scaled METs. */
  function strengthEnergy(s, st) {
    const p = st.profile; const kg = kgOf(p); const B = bmr(st).kcal; const rest = B / 1440;
    const sst = E().sessionStats(s); const min = sst.dur;
    const rpes = []; s.items.forEach(it => it.sets.forEach(x => { if (x.done) rpes.push(x.rpe || E().estRpeFromVloss(x.vloss) || 7.5); }));
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 7.5;
    const density = clamp(sst.sets / Math.max(1, min) * 3, 0.4, 1.3); // sets per 3 min
    const met = clamp(3.5 + (avgRpe - 6) * 0.9, 3, 6.5) * (0.75 + 0.25 * density);
    const metGross = met * kg * min / 60;
    const hk = hrKcal(s.hr, p, kg, rest, st.health);
    let gross, method;
    if (hk && hk.minutes > min * 0.5) { const hrGross = hk.kcal + rest * Math.max(0, min - hk.minutes); gross = 0.5 * hrGross + 0.5 * metGross; method = 'Heart rate + effort model'; }
    else { gross = metGross; method = 'Effort model (no heart rate)'; }
    const active = Math.max(0, gross - rest * min);
    const intensity = clamp((avgRpe - 5) / 5, 0, 1);
    const epoc = active * epocFrac(intensity, 'strength', min);
    return { active: Math.round(active), epoc: Math.round(epoc), total: Math.round(active + epoc), gross: Math.round(gross), epocH: epocHours(intensity), method, min };
  }

  /** Cardio energy: device value if supplied (Samsung Health/Strava) → HR → pace/power/MET. */
  function cardioEnergy(c, st) {
    const p = st.profile; const kg = kgOf(p); const B = bmr(st).kcal; const rest = B / 1440; const min = c.min || 1;
    const hrrv = hrr(c.hrAvg, p, st.health);
    let active, method;
    const m = cardioMet(c, p);
    const modelGross = (m.kcalPerMin ? m.kcalPerMin * min + rest * min * 0.2 : m.met * kg * min / 60) + (m.extraKcal || 0);
    const walking = c.type === 'walk' || c.type === 'hike';
    const prof = (c.type === 'run' || c.type === 'run_tread' || walking) && c.profile ? profileKcal(c.profile.d, c.profile.a, kg, walking) : null;
    if (prof && prof.kcal > 0) { active = prof.kcal; method = 'Minetti grade model (' + Math.round(prof.up) + ' m up / ' + Math.round(prof.down) + ' m down)'; }
    else if (c.hr && c.hr.length > 10) { const hk = hrKcal(c.hr, p, kg, rest, st.health); active = Math.max(0, hk.kcal - rest * hk.minutes); method = 'Heart-rate samples'; }
    else if (c.hrAvg) { const g = Math.max(rest, keytel(c.hrAvg, p, kg)) * min; active = Math.max(0, 0.7 * g + 0.3 * modelGross - rest * min); method = 'Average HR + ' + m.how; }
    else { active = Math.max(0, modelGross - rest * min); method = m.how; }
    if (c.deviceKcal) { active = c.deviceKcal; method = 'From ' + (c.src === 'strava' ? 'Strava' : 'Samsung Health'); }
    const intensity = hrrv != null ? hrrv : [0.4, 0.62, 0.82][tierOf(c.rpe, null)];
    const epoc = active * epocFrac(intensity, c.type === 'hiit' ? 'hiit' : 'cardio', min);
    return { active: Math.round(active), epoc: Math.round(epoc), total: Math.round(active + epoc), epocH: epocHours(intensity), method, intensity };
  }

  /** Training impulse (Banister TRIMP) or session-RPE load for readiness. */
  function cardioLoad(c, p, health) {
    const h = hrr(c.hrAvg, p, health);
    if (h != null) return (c.min || 0) * h * 0.64 * Math.exp((p.sex === 'f' ? 1.67 : 1.92) * h);
    return (c.min || 0) * ((c.rpe || 5) / 10) * 1.2;
  }

  /** Cardio → pseudo "hard set" stimulus per muscle (feeds the fatigue model). */
  function cardioMuscleSets(c, p) {
    const T = CARDIO[c.type] || CARDIO.other; const tier = tierOf(c.rpe, hrr(c.hrAvg, p));
    const f = [0.4, 0.7, 1.0][tier] * (c.min || 0) / 15;
    const g = c.elevM && c.distKm ? Math.min(0.12, c.elevM / (c.distKm * 1000)) : 0; // hills load glutes/calves/quads more
    const out = {}; for (const m in T.mus) out[m] = T.mus[m] * f * (g && ['glutes', 'calves', 'quadriceps', 'hamstrings'].includes(m) ? 1 + g * 5 : 1); return out;
  }

  /** Daily energy estimate (today). */
  function today(st) {
    const B = bmr(st); const p = st.profile; const kg = kgOf(p);
    const now = new Date(); const sod = E().startOfDay(Date.now()); const fracDay = (Date.now() - sod) / 864e5;
    const steps = (st.health && st.health.steps) || 0;
    const stepK = Math.round(steps * 0.00057 * kg); // ~0.04 kcal/step @70 kg
    let work = 0, epoc = 0;
    (st.sessions || []).filter(s => s.date >= sod).forEach(s => { const e = s.energy || strengthEnergy(s, st); work += e.active; epoc += e.epoc; });
    (st.cardio || []).filter(c => c.start >= sod).forEach(c => { const e = cardioEnergy(c, st); work += e.active; epoc += e.epoc; });
    // carry-over afterburn from yesterday evening
    return { bmrDay: B.kcal, bmrSoFar: Math.round(B.kcal * fracDay), bmrMethod: B.method, steps, stepK, work, epoc, total: Math.round(B.kcal * fracDay + stepK + work + epoc), projected: Math.round(B.kcal + stepK / Math.max(0.3, fracDay) * 0.85 + work + epoc), hour: now.getHours() };
  }

  // ---------- Body-composition insights → plan adjustments ----------
  function trend(st, key, days) {
    const since = Date.now() - days * 864e5;
    const pts = (st.body || []).filter(b => b[key] != null && b[key] !== '' && b.t >= since).sort((a, b) => a.t - b.t);
    if (pts.length < 2) return null;
    return { delta: pts[pts.length - 1][key] - pts[0][key], days: (pts[pts.length - 1].t - pts[0].t) / 864e5 };
  }
  function lbmSeries(st) {
    return (st.body || []).filter(b => b.weight && (b.bf != null || b.lbm != null)).map(b => ({ t: b.t, v: b.lbm != null ? b.lbm : b.weight * (1 - b.bf / 100) })).sort((a, b) => a.t - b.t);
  }

  function insights(st) {
    const p = st.profile; const c = composition(st); const out = [];
    const f = p.sex === 'f';
    const bfCat = c.bf == null ? null : f ? (c.bf < 18 ? 'lean' : c.bf < 28 ? 'healthy' : c.bf < 32 ? 'above' : 'high') : (c.bf < 10 ? 'lean' : c.bf < 20 ? 'healthy' : c.bf < 25 ? 'above' : 'high');
    const ffCat = c.ffmi == null ? null : f ? (c.ffmi < 14.5 ? 'low' : c.ffmi < 16.5 ? 'average' : c.ffmi < 18.5 ? 'good' : 'high') : (c.ffmi < 18 ? 'low' : c.ffmi < 20 ? 'average' : c.ffmi < 22 ? 'good' : 'high');
    const wT = trend(st, 'weight', 35), bfT = trend(st, 'bf', 35);
    const ls = lbmSeries(st).filter(x => x.t >= Date.now() - 35 * 864e5);
    const lbmD = ls.length >= 2 ? E().toKg(ls[ls.length - 1].v - ls[0].v, p.units) : null;
    const cardioMin = (st.cardio || []).filter(x => x.start >= Date.now() - 7 * 864e5).reduce((a, x) => a + (x.min || 0), 0);

    if (c.bf == null && !c.heightCm) out.push({ id: 'need', tone: 'info', title: 'Add your body data', text: 'Log height plus a body-fat reading (your Galaxy Watch body-composition scan in Samsung Health syncs automatically) — or waist & neck for a tape estimate — to unlock body-composition planning.' });

    if ((bfCat === 'high' || bfCat === 'above') && p.goal !== 'fatloss' && !(p.finisher && (p.cardioTarget || 0) >= 2)) {
      out.push({ id: 'cut', tone: 'warm', title: 'Body fat is ' + (bfCat === 'high' ? 'high' : 'above the healthy range') + ' (' + c.bf.toFixed(1) + '%)', text: 'Keep lifting heavy to hold muscle, and add 2–3 cardio sessions plus short conditioning finishers to raise weekly energy burn.', actions: [{ k: 'recomp', label: 'Add cardio + finishers' }, { k: 'goalFat', label: 'Switch goal to fat loss' }] });
    }
    if (ffCat === 'low' && p.goal !== 'hypertrophy' && p.goal !== 'strength') {
      out.push({ id: 'build', tone: 'info', title: 'Muscle mass is on the low side (FFMI ' + c.ffmi.toFixed(1) + ')', text: 'More muscle raises resting metabolism and strength. A muscle-building block with more weekly volume would pay off most.', actions: [{ k: 'goalMuscle', label: 'Switch goal to build muscle' }] });
    }
    if (lbmD != null && lbmD < -0.6) {
      out.push({ id: 'lbm', tone: 'hot', title: 'Losing lean mass (' + lbmD.toFixed(1) + ' kg in 5 weeks)', text: 'Protect muscle: keep compound lifts in the 5–8 rep range, trim one cardio session, and keep protein around 1.6–2.2 g per kg bodyweight.', actions: [{ k: 'preserve', label: 'Apply muscle-preserve mode' }] });
    }
    if (bfT && bfT.delta > 1.2 && (p.goal === 'hypertrophy' || p.goal === 'strength')) {
      out.push({ id: 'bfup', tone: 'warm', title: 'Body fat rising fast (+' + bfT.delta.toFixed(1) + '% in ' + Math.round(bfT.days) + ' days)', text: 'Your surplus may be larger than needed. One extra easy cardio session keeps the gain leaner.', actions: [{ k: 'cardioUp', label: 'Add 1 cardio session' }] });
    }
    if (wT && p.goal === 'fatloss' && Math.abs(wT.delta) < 0.3 && wT.days > 20) {
      out.push({ id: 'stall', tone: 'info', title: 'Weight is flat for ' + Math.round(wT.days) + ' days', text: 'If fat loss is the aim, adding conditioning finishers is the simplest lever on the training side.', actions: [{ k: 'finisher', label: 'Add finishers' }] });
    }
    if (cardioMin > 240 && (p.goal === 'hypertrophy' || p.goal === 'strength')) {
      out.push({ id: 'interf', tone: 'info', title: cardioMin + ' min of cardio this week', text: 'High cardio volume can blunt strength & size gains. Keep hard cardio away from leg days — Forge already counts it in your leg recovery.' });
    }
    if (!out.length && c.bf != null) out.push({ id: 'ok', tone: 'fresh', title: 'Body composition looks on track', text: 'Body fat ' + c.bf.toFixed(1) + '%' + (c.ffmi ? ' · FFMI ' + c.ffmi.toFixed(1) : '') + '. Keep following the plan.' });
    return { comp: c, bfCat, ffCat, list: out, lbmD };
  }

  window.Energy = { profileKcal, CARDIO, bodyNow, composition, bmr, strengthEnergy, cardioEnergy, cardioLoad, cardioMuscleSets, today, insights, navyBf, hrMax, tierOf, lbmSeries };
})();
