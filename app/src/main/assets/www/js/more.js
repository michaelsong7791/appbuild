/* Forge — add-on programs, cardio log/import, body measurements, energy views. */
(function () {
  'use strict';
  const E = window.Engine, N = window.Energy, F = window.F, I = window.I, A = F.actions, esc = F.esc, V = F.views, B = window.Bridge;
  const S = () => F.S();
  const ADD = () => window.ADDONS || [];
  const cmUnit = () => (F.u() === 'lb' ? 'in' : 'cm');
  const toCm = v => (F.u() === 'lb' ? v * 2.54 : v);
  const fromCm = v => (v == null ? null : F.u() === 'lb' ? Math.round(v / 2.54 * 10) / 10 : Math.round(v * 10) / 10);
  const distU = () => (F.u() === 'lb' ? 'mi' : 'km');
  const toKm = v => (F.u() === 'lb' ? v * 1.609344 : v);
  const fromKm = v => (v == null ? null : F.u() === 'lb' ? v / 1.609344 : v);
  const energyCard = (e, title) => '<div class="card"><div class="card-h"><h3>' + (title || 'Calories') + '</h3><span class="tag">' + esc(e.method) + '</span></div><div class="stats"><div class="stat"><div class="num">' + e.active + '</div><div class="lbl">Active kcal</div></div><div class="stat"><div class="num" style="color:var(--gold)">+' + e.epoc + '</div><div class="lbl">Afterburn</div></div><div class="stat"><div class="num">' + e.total + '</div><div class="lbl">Total</div></div></div><div class="tiny dim" style="margin-top:8px">Afterburn (EPOC) = extra calories your body burns recovering over the next ~' + e.epocH + ' h. Active excludes your resting metabolism, so it matches what Samsung Health calls active calories.</div></div>';
  F.energyCard = energyCard;

  // =====================================================================
  // ADD-ON PROGRAMS
  // =====================================================================
  F.addonNext = p => { const pr = S().addons[p.id] || { done: [] }; const i = p.sessions.findIndex((s, k) => !pr.done.includes(k)); return i; };
  V.addonsList = () => {
    const st = S();
    return '<div class="grid two">' + ADD().map(p => {
      const pr = st.addons[p.id] || { done: [] }; const n = pr.done.length; const nx = F.addonNext(p);
      return '<button class="card tight li-btn" data-a="addon" data-id="' + p.id + '" style="text-align:left"><div class="row"><div style="width:52px;height:52px;border-radius:14px;flex:none;display:flex;align-items:center;justify-content:center;font-size:26px;background:color-mix(in oklab,' + p.color + ' 18%,var(--surface2))">' + p.icon + '</div><div class="grow"><b style="font-size:16px">' + esc(p.name) + '</b><div class="small muted">' + p.sessions.length + ' sessions · ~' + p.min + ' min · ' + esc(p.level) + '</div><div class="bar" style="margin-top:8px"><i style="width:' + (100 * n / p.sessions.length) + '%;background:' + p.color + '"></i></div></div><div class="small muted" style="text-align:right;width:52px">' + (nx < 0 ? '✓ Done' : n + '/' + p.sessions.length) + '</div></div></button>';
    }).join('') + '</div>';
  };
  A.addon = d => F.push({ t: 'addon', id: d.id });
  function addonScreen(top) {
    const p = ADD().find(x => x.id === top.id); if (!p) return '';
    const pr = S().addons[p.id] || { done: [] }; const nx = F.addonNext(p);
    let h = '<div class="screen"><div class="top"><button class="icon-btn" data-a="back">' + I.back + '</button><h2>' + esc(p.name) + '</h2></div><div class="body" data-scroll="addon"><div class="page" style="max-width:820px">';
    h += '<div class="card hero" style="background:radial-gradient(120% 140% at 100% 0%, color-mix(in oklab,' + p.color + ' 30%,transparent), var(--surface) 60%)"><div class="hero-in"><div style="font-size:44px">' + p.icon + '</div><div class="grow"><div class="kicker" style="color:' + p.color + '">Add-on program</div><p style="margin:6px 0 0">' + esc(p.desc) + '</p><div class="small muted" style="margin-top:6px">' + pr.done.length + ' of ' + p.sessions.length + ' sessions done · do one at a time, any day</div></div></div></div>';
    h += '<div class="card tight" style="padding-top:2px;padding-bottom:2px">' + p.sessions.map((s, i) => {
      const done = pr.done.includes(i); const isNext = i === nx;
      return '<div class="exrow"><div class="thumb" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:' + (done ? 'var(--fresh)' : isNext ? p.color : 'var(--surface2)') + ';color:' + (done || isNext ? '#111' : 'var(--muted)') + ';font-family:var(--display);font-size:20px;font-weight:700">' + (done ? '✓' : i + 1) + '</div><div class="grow"><div class="nm">' + esc(s.t) + '</div><div class="sub ellipsis">' + s.items.map(it => esc(it[5] || (E.ex(it[0]) || {}).n || it[0])).join(' · ') + '</div></div><button class="btn sm ' + (isNext ? 'primary' : 'ghost') + '" data-a="startAddon" data-id="' + p.id + '" data-i="' + i + '">' + (done ? 'Redo' : 'Start') + '</button></div>';
    }).join('') + '</div>';
    if (pr.done.length) h += '<button class="btn ghost" data-a="resetAddon" data-id="' + p.id + '">' + I.refresh + 'Restart program</button>';
    return h + '</div></div></div>';
  }
  F.screens = F.screens || {}; F.screens.addon = addonScreen;
  A.startAddon = d => {
    const st = S(); const p = ADD().find(x => x.id === d.id); const s = p.sessions[+d.i];
    if (st.active) { F.toast('Finish your current workout first'); return; }
    const day = { title: p.name + ' · ' + s.t, items: s.items.map(it => ({ exId: it[0], sets: it[1], repMin: it[2], repMax: it[2], unit: it[3] === 's' ? 'sec' : 'reps', rest: it[4], alias: it[5] || null })) };
    st.active = F.buildSession(day, { addon: { prog: p.id, idx: +d.i } });
    F.save(true); F.UI.stack = [{ t: 'workout' }]; F.render(); F.resumeWorkout(); B.vibrate(60);
  };
  A.resetAddon = d => { if (!confirm('Restart this program from session 1?')) return; S().addons[d.id] = { done: [] }; F.save(); F.render(); };

  // =====================================================================
  // CARDIO
  // =====================================================================
  A.logCardio = () => { F.UI.cdDraft = { type: 'run', min: 30, distKm: null, hrAvg: null, rpe: 5, when: 'now' }; F.sheet({ t: 'cardio' }); };
  F.sheets = F.sheets || {};
  F.sheets.cardio = () => {
    const d = F.UI.cdDraft; const T = N.CARDIO[d.type];
    const preview = N.cardioEnergy(cardioFromDraft(d), S());
    let h = '<h2>Log cardio</h2><div class="chips wrap" style="margin:12px 0">' + Object.keys(N.CARDIO).map(k => '<button class="chip ' + (d.type === k ? 'on' : '') + '" data-a="cdSet" data-k="type" data-v="' + k + '">' + N.CARDIO[k].icon + ' ' + esc(N.CARDIO[k].label) + '</button>').join('') + '</div>';
    h += '<div class="row"><div class="field grow"><label>Duration (min)</label><input class="input" type="number" inputmode="numeric" value="' + (d.min || '') + '" data-in="cdIn" data-k="min"></div>' + (T.dist ? '<div class="field grow"><label>Distance (' + distU() + ')</label><input class="input" type="number" inputmode="decimal" step="0.01" value="' + (d.distKm != null ? Math.round(fromKm(d.distKm) * 100) / 100 : '') + '" data-in="cdIn" data-k="dist"></div>' : '') + '</div>' + (['run', 'walk', 'hike', 'cycle'].includes(d.type) ? '<div class="field" style="margin-top:10px"><label>Elevation gain (' + (F.u() === 'lb' ? 'ft' : 'm') + ', optional)</label><input class="input" type="number" inputmode="numeric" value="' + (d.elevM != null ? Math.round(F.u() === 'lb' ? d.elevM * 3.281 : d.elevM) : '') + '" data-in="cdIn" data-k="elev"></div>' : '') + (d.type === 'run_tread' ? '<div class="field" style="margin-top:10px"><label>Treadmill incline (%)</label><input class="input" type="number" inputmode="decimal" value="' + (d.incline || '') + '" data-in="cdIn" data-k="incline"></div>' : '');
    h += '<div class="row" style="margin-top:10px"><div class="field grow"><label>Avg heart rate (optional)</label><input class="input" type="number" inputmode="numeric" value="' + (d.hrAvg || '') + '" data-in="cdIn" data-k="hrAvg"></div>' + ((d.type === 'cycle' || d.type === 'cycle_indoor' || d.type === 'row') ? '<div class="field grow"><label>Avg power W (optional)</label><input class="input" type="number" inputmode="numeric" value="' + (d.watts || '') + '" data-in="cdIn" data-k="watts"></div>' : '') + '</div>';
    h += '<div class="field" style="margin-top:12px"><label>Effort</label><div class="seg">' + [[3, 'Easy'], [5, 'Moderate'], [7, 'Hard'], [9, 'Max']].map(([v, l]) => '<button class="' + (d.rpe === v ? 'on' : '') + '" data-a="cdSet" data-k="rpe" data-v="' + v + '" data-num="1">' + l + '</button>').join('') + '</div></div>';
    h += '<div class="field" style="margin-top:12px"><label>When</label><div class="seg">' + [['now', 'Just finished'], ['today', 'Earlier today'], ['yday', 'Yesterday']].map(([v, l]) => '<button class="' + (d.when === v ? 'on' : '') + '" data-a="cdSet" data-k="when" data-v="' + v + '">' + l + '</button>').join('') + '</div></div>';
    h += '<div class="card flat tight" style="margin-top:14px"><div class="row between"><span class="small muted">Estimated burn</span><span><b class="num" style="font-size:22px">' + preview.active + '</b> <span class="small muted">kcal + ' + preview.epoc + ' afterburn</span></span></div><div class="tiny dim">' + esc(preview.method) + '</div></div>';
    h += '<button class="btn primary block" style="margin-top:14px" data-a="cdSave">Save</button>';
    return h;
  };
  function cardioFromDraft(d) {
    const now = Date.now(); const min = Math.max(1, +d.min || 1);
    let end = d.when === 'now' ? now : d.when === 'today' ? Math.max(E.startOfDay(now) + 60 * 60e3, now - 3 * 3600e3) : E.startOfDay(now) - 6 * 3600e3;
    return { id: 'c' + now.toString(36), type: d.type, start: end - min * 60e3, end, min, distKm: d.distKm || null, elevM: d.elevM || null, grade: d.type === 'run_tread' && d.incline ? d.incline / 100 : null, hrAvg: +d.hrAvg || null, watts: +d.watts || null, rpe: d.rpe, src: 'forge' };
  }
  A.cdSet = d => { F.UI.cdDraft[d.k] = d.num ? +d.v : d.v; F.render(); };
  let cdT = null;
  A.cdIn = (d, el) => { const v = parseFloat(el.value); const D = F.UI.cdDraft; if (d.k === 'dist') D.distKm = isNaN(v) ? null : toKm(v); else if (d.k === 'elev') D.elevM = isNaN(v) ? null : (F.u() === 'lb' ? v / 3.281 : v); else D[d.k] = isNaN(v) ? null : v; clearTimeout(cdT); cdT = setTimeout(() => { const keep = document.activeElement && document.activeElement.dataset.k; F.render(); if (keep) { const i = document.querySelector('[data-in="cdIn"][data-k="' + keep + '"]'); if (i) { i.focus(); const L = i.value.length; try { i.setSelectionRange(L, L); } catch (e) { } } } }, 600); };
  A.cdSave = async () => {
    const st = S(); const c = cardioFromDraft(F.UI.cdDraft);
    c.energy = N.cardioEnergy(c, st);
    st.cardio.push(c); F.UI.sheet = null; F.save(true);
    const xp = Math.round(Math.min(120, c.min * 1.5 + (c.energy.active / 10))); c.xp = xp; st.game.xp += xp;
    F.toast('+' + xp + ' XP · ' + N.CARDIO[c.type].label + ' logged'); F.render();
    if (st.settings.hcGranted && st.settings.autoHc) { try { await B.call('hc.writeCardio', cardioPayload(c)); c.synced = Object.assign(c.synced || {}, { hc: Date.now() }); F.save(); } catch (e) { } }
  };
  const cardioPayload = c => ({ id: c.id, type: c.type, start: c.start, end: c.end, distM: c.distKm ? Math.round(c.distKm * 1000) : 0, kcal: (c.energy || {}).active || 0, name: 'Forge · ' + N.CARDIO[c.type].label, sportType: N.CARDIO[c.type].strava });

  /** Import from Samsung Health (Health Connect) and Strava, de-duplicated by start time. */
  const hcToCardio = x => ({ id: 'hc:' + x.id, type: x.type, start: x.start, end: x.end, min: Math.round((x.end - x.start) / 60000), distKm: x.distM ? x.distM / 1000 : null, elevM: x.elevM || null, hrAvg: x.hrAvg || null, hrMax: x.hrMax || null, deviceKcal: x.kcal || null, title: x.title, src: 'hc' });
  const stravaToCardio = x => ({ id: 'strava:' + x.id, sid: x.id, type: x.type, start: x.start, end: x.start + x.elapsed * 1000, min: Math.round(x.moving / 60) || Math.round(x.elapsed / 60), distKm: x.distM ? x.distM / 1000 : null, elevM: x.elevM || null, hrAvg: x.hrAvg || null, watts: x.watts || null, deviceKcal: x.type.startsWith('cycle') ? (x.kcal || null) : null, title: x.name, src: 'strava' });

  /** Merge activities (from live calls or the background-sync inbox) into the cardio log, de-duplicated by start time. */
  async function ingestCardio(hcList, stravaList) {
    const st = S(); let added = 0; const newOnes = [];
    const exists = start => st.cardio.some(c => Math.abs(c.start - start) < 3 * 60e3) || st.sessions.some(s => Math.abs(s.date - start) < 3 * 60e3);
    const add = c => { if (c.min < 3 || exists(c.start)) return; c.energy = N.cardioEnergy(c, st); st.cardio.push(c); newOnes.push(c); added++; };
    (hcList || []).forEach(x => add(hcToCardio(x)));
    for (const x of (stravaList || [])) {
      const c = stravaToCardio(x);
      if (exists(c.start)) continue;
      if (['run', 'walk', 'hike'].includes(c.type) && c.distKm) await attachStreams(c, x.streams);
      add(c);
    }
    if (added) { st.cardio.sort((a, b) => a.start - b.start); const xp = newOnes.reduce((a, c) => a + Math.round(Math.min(120, c.min * 1.5 + c.energy.active / 10)), 0); st.game.xp += xp; }
    return added;
  }

  F.importCardio = async (quiet) => {
    const st = S(); const since = Date.now() - 21 * 864e5; let hc = [], sa = [];
    if (st.settings.hcGranted) { try { hc = (await B.call('hc.readSessions', { since })).sessions || []; } catch (e) { if (!quiet) F.toast('Samsung Health: ' + e.message); } }
    if ((F.UI.integrations.strava || {}).connected) { try { sa = (await B.call('strava.activities', { since })).activities || []; } catch (e) { if (!quiet) F.toast('Strava: ' + e.message); } }
    const added = await ingestCardio(hc, sa);
    F.save(); if (!quiet || added) F.toast(added ? 'Imported ' + added + ' activit' + (added > 1 ? 'ies' : 'y') : 'No new activities found');
    F.render(); return added;
  };

  /** Pull everything the background sync collected while Forge was closed. */
  F.mergeInbox = async () => {
    let box; try { box = await B.call('sync.inbox', {}); } catch (e) { return 0; }
    if (!box) return 0;
    const n = await ingestCardio(box.sessions, box.activities);
    const nb = (box.body && box.body.length) ? ingestBody({ entries: box.body, heightM: box.heightM }) : 0;
    if (n || nb) { F.save(); F.toast('Synced in background: ' + [n ? n + ' activit' + (n > 1 ? 'ies' : 'y') : '', nb ? nb + ' body reading' + (nb > 1 ? 's' : '') : ''].filter(Boolean).join(' · ')); F.render(); }
    return n + nb;
  };

  /** One sync pass: health metrics + activities + body. Throttled unless forced. */
  let syncing = false;
  F.syncAll = async (force) => {
    const st = S(); if (!st.profile || syncing) return;
    if (!force && Date.now() - (F.UI.lastSync || 0) < 3 * 60e3) return;
    syncing = true; F.UI.syncing = true;
    try {
      await F.mergeInbox();
      if (st.settings.hcGranted) await F.refreshHealth(true);
      await F.importCardio(!force);
      await F.importBody(!force);
      F.UI.lastSync = Date.now(); st.settings.lastSync = Date.now(); F.save();
    } finally { syncing = false; F.UI.syncing = false; F.render(); }
  };
  A.syncAll = () => { F.toast('Syncing Samsung Health & Strava…'); F.syncAll(true); };
  setInterval(() => { if (document.visibilityState !== 'hidden') F.syncAll(false); }, 5 * 60e3);

  /** Background sync (Android WorkManager) — runs even when Forge is closed. */
  F.scheduleSync = async () => {
    const st = S();
    try { await B.call('sync.schedule', { on: st.settings.bgSync !== false, minutes: st.settings.bgMinutes || 15, notify: st.settings.bgNotify !== false }); } catch (e) { }
  };
  A.bgMin = d => { const st = S(); st.settings.bgMinutes = +d.m; F.save(); F.scheduleSync(); F.render(); };

  /** Altitude/distance (+HR) streams → grade-by-grade energy and HR-based calories. Downsampled to keep storage small. */
  async function attachStreams(c, pre) {
    try {
      const s = pre || await B.call('strava.streams', { id: c.sid });
      if (s.distance && s.altitude && s.distance.length > 10) {
        const step = Math.max(1, Math.floor(s.distance.length / 600)); const d = [], a = [];
        for (let i = 0; i < s.distance.length; i += step) { d.push(Math.round(s.distance[i])); a.push(Math.round(s.altitude[i] * 10) / 10); }
        c.profile = { d, a };
      }
      if (s.heartrate && s.time && s.heartrate.length > 10) {
        const step = Math.max(1, Math.floor(s.time.length / 400)); c.hr = [];
        for (let i = 0; i < s.time.length; i += step) c.hr.push([c.start + s.time[i] * 1000, s.heartrate[i]]);
      }
    } catch (e) { }
  }
  A.importCardio = () => { F.toast('Checking Samsung Health & Strava…'); F.importCardio(false); };

  V.cardioPanel = () => {
    const st = S(); const p = st.profile; const plan = st.plan;
    const wk = E.startOfWeek(Date.now()); const thisW = st.cardio.filter(c => c.start >= wk);
    const min = thisW.reduce((a, c) => a + c.min, 0); const kcal = thisW.reduce((a, c) => a + (c.energy || N.cardioEnergy(c, st)).total, 0);
    let h = '<div class="stats"><div class="stat"><div class="num">' + thisW.length + (p.cardioTarget ? '<span class="small muted">/' + p.cardioTarget + '</span>' : '') + '</div><div class="lbl">Sessions</div></div><div class="stat"><div class="num">' + min + '</div><div class="lbl">Minutes</div></div><div class="stat"><div class="num">' + kcal + '</div><div class="lbl">kcal</div></div></div>';
    h += '<div class="card"><div class="card-h"><h3>Weekly cardio target</h3></div><div class="row between"><div class="small muted grow">' + (p.cardioTarget ? 'Suggested days: <b style="color:var(--text)">' + ((plan.cardioDays || []).map(d => F.DOW[d]).join(', ') || '—') + '</b> (rest days first, away from leg days when possible)' : 'Off — add sessions to have Forge schedule them.') + '</div><div class="stepper" style="width:130px"><button data-a="cardioTgt" data-d="-1">−</button><div class="vc"><span class="num" style="font-size:22px">' + (p.cardioTarget || 0) + '</span><span class="u">per week</span></div><button data-a="cardioTgt" data-d="1">+</button></div></div></div>';
    h += '<div class="row wrap"><button class="btn primary" data-a="logCardio">' + I.plus + 'Log cardio</button><button class="btn ghost" data-a="importCardio">' + I.sync + 'Import from Samsung Health / Strava</button></div>';
    const list = st.cardio.slice().sort((a, b) => b.start - a.start).slice(0, 30);
    h += '<div class="card tight" style="padding-top:2px;padding-bottom:2px">' + (list.length ? list.map(cardioRow).join('') : '<div class="small muted" style="padding:14px 0">No cardio yet. Log one, or import runs/rides/swims your Galaxy Watch recorded in Samsung Health.</div>') + '</div>';
    h += '<div class="tiny dim">Cardio counts toward muscle recovery (e.g. a hard run tires quads & calves) and your readiness score, so weight sessions adapt automatically.</div>';
    return h;
  };
  function cardioRow(c) {
    const T = N.CARDIO[c.type] || N.CARDIO.other; const e = c.energy || N.cardioEnergy(c, S());
    return '<button class="exrow" data-a="cardioDetail" data-id="' + c.id + '"><div class="thumb" style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--surface2)">' + T.icon + '</div><div class="grow"><div class="nm ellipsis">' + esc(c.title || T.label) + '</div><div class="sub">' + F.fmtDate(c.start) + ' · ' + c.min + ' min' + (c.distKm ? ' · ' + (Math.round(fromKm(c.distKm) * 100) / 100) + ' ' + distU() : '') + (c.elevM ? ' · ⛰ ' + Math.round(F.u() === 'lb' ? c.elevM * 3.281 : c.elevM) + (F.u() === 'lb' ? ' ft' : ' m') : '') + (c.hrAvg ? ' · ♥ ' + Math.round(c.hrAvg) : '') + '</div></div><div style="text-align:right"><div class="num" style="font-size:18px">' + e.total + '</div><div class="tiny muted">kcal</div></div>' + (c.src !== 'forge' ? '<span class="tag" style="margin-left:6px">' + (c.src === 'strava' ? 'Strava' : 'S Health') + '</span>' : '') + '</button>';
  }
  A.cardioTgt = d => { const st = S(); st.profile.cardioTarget = Math.max(0, Math.min(7, (st.profile.cardioTarget || 0) + (+d.d))); st.plan.cardioDays = E.cardioDays(st.profile, st.plan.sched); F.save(); F.render(); };
  A.cardioDetail = d => F.push({ t: 'cardio', id: d.id });
  F.screens.cardio = top => {
    const st = S(); const c = st.cardio.find(x => x.id === top.id); if (!c) return '';
    const T = N.CARDIO[c.type] || N.CARDIO.other; const e = N.cardioEnergy(c, st); const ms = N.cardioMuscleSets(c, st.profile);
    const mx = Math.max(0.01, ...Object.values(ms)); const vals = {}; for (const m in ms) vals[m] = ms[m] / mx;
    let h = '<div class="screen"><div class="top"><button class="icon-btn" data-a="back">' + I.back + '</button><h2>' + T.icon + ' ' + esc(c.title || T.label) + '</h2><button class="icon-btn" data-a="delCardio" data-id="' + c.id + '" style="color:#ff8a8a">' + I.trash + '</button></div><div class="body" data-scroll="cd"><div class="page"><div class="muted small">' + F.fmtDate(c.start) + ' · ' + new Date(c.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + (c.src !== 'forge' ? ' · from ' + (c.src === 'strava' ? 'Strava' : 'Samsung Health') : '') + '</div>';
    const pace = c.distKm && (c.type === 'run' || c.type === 'run_tread' || c.type === 'walk' || c.type === 'hike') ? c.min / fromKm(c.distKm) : null;
    h += '<div class="stats"><div class="stat"><div class="num">' + c.min + '</div><div class="lbl">Minutes</div></div><div class="stat"><div class="num">' + (c.distKm ? (Math.round(fromKm(c.distKm) * 100) / 100) : '—') + '</div><div class="lbl">' + distU() + '</div></div><div class="stat"><div class="num">' + (pace ? Math.floor(pace) + ':' + String(Math.round(pace % 1 * 60)).padStart(2, '0') : c.hrAvg ? Math.round(c.hrAvg) : '—') + '</div><div class="lbl">' + (pace ? 'min/' + distU() : 'avg HR') + '</div></div></div>';
    if (c.elevM || c.profile) { const up = c.profile ? N.profileKcal(c.profile.d, c.profile.a, 70, false) : null; const gain = up ? up.up : c.elevM; h += '<div class="card tight row"><div style="font-size:24px">⛰️</div><div class="grow"><b>' + Math.round(F.u() === 'lb' ? gain * 3.281 : gain) + ' ' + (F.u() === 'lb' ? 'ft' : 'm') + ' climbed</b>' + (up ? ' · ' + Math.round(F.u() === 'lb' ? up.down * 3.281 : up.down) + ' ' + (F.u() === 'lb' ? 'ft' : 'm') + ' descended' : '') + '<div class="small muted">' + (c.profile ? 'Calories computed slope-by-slope from the Strava elevation profile' : 'Average gradient ' + (c.distKm ? (c.elevM / c.distKm / 10).toFixed(1) + '%' : '') + ' included in calories and leg muscle load') + '</div></div></div>' + (c.profile ? '<div class="card"><div class="card-h"><h3>Elevation</h3></div>' + F.lineChart(c.profile.d.map((x, i) => [x, c.profile.a[i]]), { color: 'var(--fresh)', h: 100 }) + '</div>' : ''); }
    h += '<div class="grid two">' + energyCard(e) + '<div class="card"><div class="card-h"><h3>Muscle load</h3><span class="small muted">feeds your recovery map</span></div>' + F.bodyPair(vals, 'target') + '</div></div>';
    const syn = c.synced || {};
    if (c.src === 'forge') h += '<div class="card"><div class="card-h"><h3>Sync</h3></div><div class="list"><div class="li"><span style="font-size:22px">💙</span><div class="grow">Samsung Health</div>' + (syn.hc ? '<span class="tag fresh">Saved</span>' : '<button class="btn sm" data-a="cdSync" data-id="' + c.id + '" data-w="hc">Save</button>') + '</div><div class="li"><span style="font-size:22px">🧡</span><div class="grow">Strava</div>' + (syn.strava ? '<span class="tag fresh">Uploaded</span>' : '<button class="btn sm" data-a="cdSync" data-id="' + c.id + '" data-w="strava">Upload</button>') + '</div></div></div>';
    return h + '</div></div></div>';
  };
  A.delCardio = d => { if (!confirm('Delete this activity?')) return; const st = S(); st.cardio = st.cardio.filter(c => c.id !== d.id); F.save(); F.pop(); };
  A.cdSync = async d => {
    const st = S(); const c = st.cardio.find(x => x.id === d.id); if (!c) return; c.synced = c.synced || {};
    try {
      if (d.w === 'hc') { if (!st.settings.hcGranted) { F.connectHealth(); return; } await B.call('hc.writeCardio', cardioPayload(c)); c.synced.hc = Date.now(); }
      else { await B.call('strava.upload', Object.assign(cardioPayload(c), { description: c.min + ' min · ' + c.energy.total + ' kcal (Forge)', hr: [] })); c.synced.strava = Date.now(); }
      F.save(); F.toast('Synced ✓'); F.render();
    } catch (e) { F.toast(e.message); }
  };

  // =====================================================================
  // BODY MEASUREMENTS
  // =====================================================================
  const FIELDS = [['weight', 'Weight', 'w'], ['bf', 'Body fat', '%'], ['smm', 'Skeletal muscle', 'w'], ['waist', 'Waist', 'c'], ['hips', 'Hips', 'c'], ['chest', 'Chest', 'c'], ['arm', 'Arm', 'c'], ['thigh', 'Thigh', 'c'], ['neck', 'Neck', 'c']];
  const unitOf = k => ({ w: F.u(), '%': '%', c: cmUnit() })[k];
  A.logBody = () => { const b = N.bodyNow(S()); F.UI.bdDraft = { weight: b.weight, height: fromCm(S().profile.height) }; F.sheet({ t: 'body' }); };
  F.sheets.body = () => {
    const d = F.UI.bdDraft; const p = S().profile;
    let h = '<h2>Log measurements</h2><p class="small muted" style="margin:4px 0 12px">Fill in what you have. Galaxy Watch body-composition scans in Samsung Health (weight, body fat) import automatically when Samsung Health is connected; skeletal muscle can be copied from the same screen.</p><div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">';
    h += '<div class="field"><label>Height (' + cmUnit() + ')</label><input class="input" type="number" inputmode="decimal" value="' + (d.height ?? '') + '" data-in="bdIn" data-k="height"></div>';
    FIELDS.forEach(([k, l, u]) => { h += '<div class="field"><label>' + l + ' (' + unitOf(u) + ')</label><input class="input" type="number" inputmode="decimal" step="0.1" value="' + (d[k] ?? '') + '" data-in="bdIn" data-k="' + k + '"></div>'; });
    h += '</div><button class="btn primary block" style="margin-top:14px" data-a="bdSave">Save</button>';
    if (S().settings.hcGranted) h += '<button class="btn ghost block" style="margin-top:8px" data-a="bodyImport">' + I.sync + 'Import from Samsung Health</button>';
    return h;
  };
  A.bdIn = (d, el) => { const v = parseFloat(el.value); F.UI.bdDraft[d.k] = isNaN(v) ? null : v; };
  A.bdSave = async () => {
    const st = S(); const d = F.UI.bdDraft; const e = { t: Date.now(), src: 'manual' };
    FIELDS.forEach(([k, , u]) => { if (d[k] != null) e[k] = u === 'c' ? toCm(d[k]) : d[k]; });
    if (d.height) st.profile.height = toCm(d.height);
    if (Object.keys(e).length > 2) st.body.push(e);
    if (e.weight) st.profile.bodyweight = e.weight;
    F.UI.sheet = null; F.save(true); F.toast('Measurements saved'); F.render();
    if (st.settings.hcGranted && (e.weight || e.bf || d.height)) { try { await B.call('hc.writeBody', { weightKg: e.weight ? E.toKg(e.weight, st.profile.units) : null, bf: e.bf || null, heightM: st.profile.height ? st.profile.height / 100 : null }); } catch (err) { } }
  };
  function ingestBody(r) {
    const st = S(); let n = 0;
    const toU = kg => st.profile.units === 'lb' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10;
    (r.entries || []).forEach(x => {
      if (st.body.some(b => Math.abs(b.t - x.t) < 10 * 60e3 && b.src === 'hc')) return;
      const e = { t: x.t, src: 'hc' }; if (x.weightKg) e.weight = toU(x.weightKg); if (x.bf != null) e.bf = Math.round(x.bf * 10) / 10; if (x.lbmKg) e.lbm = toU(x.lbmKg); if (x.bmr) e.bmr = Math.round(x.bmr);
      if (Object.keys(e).length > 2) { st.body.push(e); n++; }
    });
    if (r.heightM && !st.profile.height) st.profile.height = Math.round(r.heightM * 1000) / 10;
    const lw = st.body.filter(b => b.weight).sort((a, b) => b.t - a.t)[0]; if (lw) st.profile.bodyweight = lw.weight;
    return n;
  }
  F.importBody = async (quiet) => {
    const st = S(); if (!st.settings.hcGranted) return 0;
    try {
      const r = await B.call('hc.readBody', { since: Date.now() - 365 * 864e5 });
      const n = ingestBody(r);
      F.save(); if (!quiet) F.toast(n ? 'Imported ' + n + ' body readings' : 'No new body readings in Samsung Health'); F.render(); return n;
    } catch (e) { if (!quiet) F.toast('Samsung Health: ' + e.message); return 0; }
  };
  A.bodyImport = () => { F.UI.sheet = null; F.importBody(false); };

  V.bodyPanel = () => {
    const st = S(); const ins = N.insights(st); const c = ins.comp; const p = st.profile;
    const disp = kg => kg == null ? '—' : (p.units === 'lb' ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10);
    let h = '<div class="row wrap"><button class="btn primary" data-a="logBody">' + I.plus + 'Log measurements</button>' + (st.settings.hcGranted ? '<button class="btn ghost" data-a="bodyImport">' + I.sync + 'Import from Samsung Health</button>' : '<button class="btn ghost" data-a="connectHealth">Connect Samsung Health</button>') + '</div>';
    h += '<div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr))">' +
      stat(disp(c.kg), 'Weight ' + p.units) + stat(c.bf != null ? c.bf.toFixed(1) + '%' : '—', 'Body fat' + (c.bfSrc === 'tape' ? ' (tape)' : '')) + stat(disp(c.lbmKg), 'Lean mass ' + p.units) + stat(c.smmKg != null ? disp(c.smmKg) : '—', 'Muscle ' + p.units) + stat(c.bmi ? c.bmi.toFixed(1) : '—', 'BMI') + stat(c.ffmi ? c.ffmi.toFixed(1) : '—', 'FFMI') + '</div>';
    h += '<div class="card"><div class="card-h"><h3>Insights for your training</h3></div>' + ins.list.map(x => '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="font-weight:700;color:var(--' + ({ warm: 'warm', hot: 'hot', fresh: 'fresh', info: 'text' })[x.tone] + ')">' + esc(x.title) + '</div><div class="small muted" style="margin:4px 0 8px">' + esc(x.text) + '</div>' + (x.actions || []).map(a => '<button class="btn sm" style="margin-right:6px" data-a="applyInsight" data-k="' + a.k + '">' + esc(a.label) + '</button>').join('') + '</div>').join('') + flags() + '</div>';
    const ws = st.body.filter(b => b.weight).sort((a, b) => a.t - b.t);
    const bs = st.body.filter(b => b.bf != null).sort((a, b) => a.t - b.t);
    const ls = N.lbmSeries(st);
    h += '<div class="grid two"><div class="card"><div class="card-h"><h3>Weight</h3><span class="small muted">' + p.units + '</span></div>' + F.lineChart(ws.map(b => [b.t, b.weight]), { color: 'var(--info)' }) + '</div><div class="card"><div class="card-h"><h3>Body fat & lean mass</h3></div>' + F.lineChart(bs.map(b => [b.t, b.bf]), { color: 'var(--warm)', h: 90 }) + '<div style="height:6px"></div>' + F.lineChart(ls.map(b => [b.t, b.v]), { color: 'var(--fresh)', h: 90 }) + '<div class="legend"><span><i style="background:var(--warm)"></i>Body fat %</span><span><i style="background:var(--fresh)"></i>Lean mass</span></div></div></div>';
    const recent = st.body.slice().sort((a, b) => b.t - a.t).slice(0, 12);
    if (recent.length) h += '<div class="card"><div class="card-h"><h3>Log</h3></div><div class="list">' + recent.map(b => '<div class="li small"><span class="muted" style="width:92px">' + F.fmtDate(b.t) + '</span><span class="grow">' + FIELDS.filter(([k]) => b[k] != null).map(([k, l, u]) => l + ' ' + (u === 'c' ? fromCm(b[k]) : b[k]) + (u === '%' ? '%' : '')).join(' · ') + (b.lbm ? ' · Lean ' + b.lbm : '') + '</span>' + (b.src === 'hc' ? '<span class="tag">S Health</span>' : '<button class="icon-btn sm" data-a="delBody" data-t="' + b.t + '">' + I.trash + '</button>') + '</div>').join('') + '</div></div>';
    return h;
  };
  const stat = (v, l) => '<div class="stat"><div class="num">' + v + '</div><div class="lbl">' + l + '</div></div>';
  function flags() {
    const p = S().profile; const on = [];
    if (p.cardioTarget) on.push(p.cardioTarget + '× cardio / week');
    if (p.finisher) on.push('conditioning finishers');
    if (p.preserve) on.push('muscle-preserve rep ranges');
    return on.length ? '<div class="small" style="padding-top:10px">Active plan adjustments: <b>' + on.join(' · ') + '</b> <button class="btn sm ghost" style="margin-left:6px" data-a="clearAdj">Reset</button></div>' : '';
  }
  A.delBody = d => { const st = S(); st.body = st.body.filter(b => String(b.t) !== d.t); F.save(); F.render(); };
  A.applyInsight = d => {
    const st = S(); const p = st.profile; const msg = [];
    if (d.k === 'recomp') { p.cardioTarget = Math.max(p.cardioTarget || 0, 2); p.finisher = true; msg.push('Added 2 cardio sessions + finishers'); }
    if (d.k === 'goalFat') { p.goal = 'fatloss'; p.cardioTarget = Math.max(p.cardioTarget || 0, 2); msg.push('Goal → fat loss'); }
    if (d.k === 'goalMuscle') { p.goal = 'hypertrophy'; msg.push('Goal → build muscle'); }
    if (d.k === 'preserve') { p.preserve = true; p.cardioTarget = Math.max(0, (p.cardioTarget || 0) - 1); msg.push('Muscle-preserve mode on'); }
    if (d.k === 'cardioUp') { p.cardioTarget = Math.min(7, (p.cardioTarget || 0) + 1); msg.push('Cardio target ' + p.cardioTarget + '/wk'); }
    if (d.k === 'finisher') { p.finisher = true; msg.push('Finishers added'); }
    F.regenerate(true); F.toast(msg.join(' · ') + ' — plan rebuilt'); F.render();
  };
  A.clearAdj = () => { const p = S().profile; p.finisher = false; p.preserve = false; p.cardioTarget = 0; F.regenerate(true); F.toast('Plan adjustments cleared'); F.render(); };

  // =====================================================================
  // ENERGY (calories)
  // =====================================================================
  V.energyPanel = () => {
    const st = S(); const t = N.today(st); const B0 = N.bmr(st);
    let h = '<div class="card hero"><div class="hero-in"><div class="grow"><div class="kicker">Today so far</div><h1 style="font-size:46px">' + t.total.toLocaleString() + ' <span style="font-size:20px;color:var(--muted)">kcal</span></h1><div class="small muted">Projected for the day ≈ ' + t.projected.toLocaleString() + ' kcal</div></div></div></div>';
    h += '<div class="card"><div class="card-h"><h3>Breakdown</h3></div>' + [['Resting metabolism (so far)', t.bmrSoFar, B0.method], ['Steps' + (t.steps ? ' (' + t.steps.toLocaleString() + ')' : ''), t.stepK, t.steps ? 'from Samsung Health' : 'connect Samsung Health'], ['Workouts — active', t.work, ''], ['Afterburn (EPOC)', t.epoc, 'recovery after training']].map(r => '<div class="xpline"><span>' + r[0] + (r[2] ? '<div class="tiny dim">' + esc(r[2]) + '</div>' : '') + '</span><b style="color:var(--text)">' + r[1].toLocaleString() + '</b></div>').join('') + '<div class="tiny dim" style="margin-top:8px">Resting metabolism: ' + B0.kcal.toLocaleString() + ' kcal/day. Adding height, body fat or a Samsung Health BMR reading improves accuracy.</div></div>';
    // last 14 days training kcal
    const days = []; for (let i = 13; i >= 0; i--) { const a = E.startOfDay(Date.now()) - i * 864e5; const b = a + 864e5; let k = 0; st.sessions.filter(s => s.date >= a && s.date < b).forEach(s => { k += (s.energy || N.strengthEnergy(s, st)).total; }); st.cardio.filter(c => c.start >= a && c.start < b).forEach(c => { k += (c.energy || N.cardioEnergy(c, st)).total; }); days.push({ a, k }); }
    h += '<div class="card"><div class="card-h"><h3>Training calories · 14 days</h3><span class="small muted">active + afterburn</span></div>' + F.barChart(days.map(d => d.k), days.map((d, i) => i % 2 ? '' : new Date(d.a).getDate() + '')) + '</div>';
    h += '<div class="card"><div class="card-h"><h3>How Forge estimates calories</h3></div><ul class="small muted" style="margin:0;padding-left:18px;line-height:1.55"><li><b>Weights:</b> heart rate from your watch (Keytel equation, using your age, sex and weight) blended 50/50 with an effort model from your RPE and set density — pure heart-rate formulas overestimate lifting.</li><li><b>Cardio:</b> device calories from Samsung Health/Strava when available; otherwise heart-rate samples, or ACSM pace equations for running/walking, power for bikes and rowers, MET tables for the rest.</li><li><b>Afterburn:</b> 6–15% of active calories depending on intensity, per published EPOC research.</li><li><b>Active vs total:</b> active excludes resting metabolism (Katch-McArdle when lean mass is known, else Mifflin-St Jeor).</li></ul><div class="tiny dim" style="margin-top:8px">All wrist-based calorie numbers carry roughly ±15–25% error; trends are more reliable than single values.</div></div>';
    return h;
  };
})();
