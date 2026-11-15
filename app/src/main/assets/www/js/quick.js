/* Forge — Quick log: one-off exercises outside the plan (e.g. morning band curls).
   Log it after the fact in a few taps, or start it as a mini-workout with timers.
   One-offs count for recovery, progression, muscle mastery, calories and XP, but don't use up a planned session. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, F = window.F, I = window.I, A = F.actions, esc = F.esc, B = window.Bridge;
  const S = () => F.S();
  const BANDS = [['Extra light', 3], ['Light', 7], ['Medium', 11], ['Heavy', 16], ['X-heavy', 23]];
  F.BANDS = BANDS;
  const isBand = e => e && e.eq === 'band';
  const isTimed = e => e && (e.f === 'stat' || e.cat === 'st');
  const QUICK_PICKS = ['v_band_curl', 'Pushups', 'Plank', 'Bodyweight_Squat', 'Pullups', 'Dumbbell_Bicep_Curl', 'Crunches', 'v_band_facepull', 'Lateral_Raise_-_With_Bands', 'Bench_Dips', 'Dumbbell_Lunges', 'Hamstring_Stretch'];

  function lastSetsFor(exId) {
    const h = E.exHistory(S().sessions, exId); if (!h.length) return null;
    return h[h.length - 1].sets.map(s => ({ r: s.r, w: s.w, band: s.band }));
  }
  function newItem(exId) {
    const e = E.ex(exId); const last = lastSetsFor(exId);
    if (last) return { exId, sets: last.map(s => Object.assign({}, s)), rir: null };
    const timed = isTimed(e);
    const sug = !timed && !isBand(e) && e.eq !== 'bodyweight' ? E.suggest(S().sessions, { exId, repMin: 10, repMax: 12, sets: 3 }, F.u(), S()) : null;
    return { exId, rir: null, sets: Array.from({ length: timed ? 2 : 3 }, () => ({ r: timed ? 30 : 12, w: sug && sug.w != null ? sug.w : null, band: isBand(e) ? 2 : undefined })) };
  }
  function recents() {
    const seen = new Set(), out = [];
    S().sessions.slice().sort((a, b) => b.date - a.date).forEach(s => s.items.forEach(it => { if (!seen.has(it.exId) && E.ex(it.exId)) { seen.add(it.exId); out.push(it.exId); } }));
    return out;
  }

  // ---------- Entry points ----------
  A.quickLog = d => {
    F.UI.qDraft = { items: d && d.id ? [newItem(d.id)] : [], when: 'now', time: null, title: '' };
    F.sheet(d && d.id ? { t: 'quick' } : { t: 'quickPick' });
  };

  // ---------- Exercise picker ----------
  F.sheets.quickPick = sh => {
    const st = S(); const q = (sh.q || '').toLowerCase(); const rec = recents().slice(0, 8);
    let h = '<h2>' + (F.UI.qDraft && F.UI.qDraft.items.length ? 'Add exercise' : 'Quick log') + '</h2><div class="small muted" style="margin:4px 0 10px">Log a one-off exercise — e.g. morning band curls. Pick one to start:</div>';
    h += '<input class="input" placeholder="Search ' + E.all().length + ' exercises (try “band”)" value="' + esc(sh.q || '') + '" data-in="qpQ">';
    if (!q) {
      h += '<div class="tiny muted" style="margin:14px 0 6px;font-weight:700;letter-spacing:.08em">QUICK PICKS</div><div class="chips wrap">' + QUICK_PICKS.filter(id => E.ex(id)).map(id => '<button class="chip" data-a="qpAdd" data-id="' + id + '">' + esc(E.ex(id).n) + '</button>').join('') + '</div>';
      if (rec.length) h += '<div class="tiny muted" style="margin:14px 0 2px;font-weight:700;letter-spacing:.08em">RECENT</div>' + rec.map(row).join('');
      h += '<button class="btn ghost block" style="margin-top:12px" data-a="qCustom">' + I.plus + 'Create a custom exercise</button>';
    } else {
      const list = E.all().filter(e => e.n.toLowerCase().includes(q) || E.EQUIPMENT[e.eq].toLowerCase().includes(q) || e.pm.some(m => F.mLabel(m).toLowerCase().includes(q))).sort((a, b) => b.t - a.t || a.n.localeCompare(b.n)).slice(0, 40);
      h += '<div id="qp-list">' + (list.length ? list.map(row).join('') : '<div class="small muted" style="padding:12px 0">No match.</div>') + '</div><button class="btn ghost block" style="margin-top:12px" data-a="qCustom">' + I.plus + 'Create “' + esc(sh.q) + '” as a custom exercise</button>';
    }
    return h;
  };
  const row = id => { const e = typeof id === 'string' ? E.ex(id) : id; return '<button class="exrow" data-a="qpAdd" data-id="' + e.id + '">' + F.thumb(e.id) + '<div class="grow"><div class="nm ellipsis">' + esc(e.n) + '</div><div class="sub ellipsis">' + esc(E.EQUIPMENT[e.eq]) + ' · ' + esc(F.topSubs(e, 2)) + '</div></div>' + I.plus.replace('<svg', '<svg width="20" height="20" style="color:var(--accent)"') + '</button>'; };
  let qpT = null;
  A.qpQ = (d, el) => { F.UI.sheet.q = el.value; clearTimeout(qpT); qpT = setTimeout(() => { F.render(); const i = document.querySelector('[data-in="qpQ"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  A.qpAdd = d => { if (!F.UI.qDraft) F.UI.qDraft = { items: [], when: 'now' }; F.UI.qDraft.items.push(newItem(d.id)); F.sheet({ t: 'quick' }); };

  // ---------- Custom exercise ----------
  A.qCustom = () => { F.UI.cDraft = { n: (F.UI.sheet && F.UI.sheet.q) || '', eq: 'band', base: null, q: '' }; F.sheet({ t: 'custom' }); };
  F.sheets.custom = () => {
    const d = F.UI.cDraft; const q = d.q.toLowerCase();
    let h = '<h2>Custom exercise</h2><div class="field" style="margin-top:12px"><label>Name</label><input class="input" value="' + esc(d.n) + '" placeholder="e.g. Band curls" data-in="cuName"></div>';
    h += '<div class="field" style="margin-top:12px"><label>Equipment</label><div class="chips wrap">' + ['band', 'dumbbell', 'kettlebell', 'bodyweight', 'barbell', 'cable', 'machine'].map(k => '<button class="chip ' + (d.eq === k ? 'on' : '') + '" data-a="cuEq" data-k="' + k + '">' + E.EQUIPMENT[k] + '</button>').join('') + '</div></div>';
    h += '<div class="field" style="margin-top:12px"><label>Works the same muscles as…</label>' + (d.base ? '<div class="exrow">' + F.thumb(d.base) + '<div class="grow"><div class="nm">' + esc(E.ex(d.base).n) + '</div><div class="sub">' + esc(F.topSubs(E.ex(d.base), 3)) + '</div></div><button class="btn sm ghost" data-a="cuBase" data-id="">Change</button></div>' : '<input class="input" placeholder="Search a similar exercise" value="' + esc(d.q) + '" data-in="cuQ"><div id="cd-list">' + (q ? E.all().filter(e => !e.variant && e.n.toLowerCase().includes(q)).sort((a, b) => b.t - a.t || a.n.length - b.n.length).slice(0, 8).map(e => '<button class="exrow" data-a="cuBase" data-id="' + e.id + '">' + F.thumb(e.id) + '<div class="grow"><div class="nm ellipsis">' + esc(e.n) + '</div><div class="sub ellipsis">' + esc(F.topSubs(e, 2)) + '</div></div></button>').join('') : '<div class="tiny muted" style="margin-top:6px">Used for muscle tracking, recovery and the demo animation.</div>') + '</div>') + '</div>';
    h += '<button class="btn primary block" style="margin-top:16px" data-a="cuSave"' + (d.base && d.n ? '' : ' disabled style="margin-top:16px;opacity:.5"') + '>Save & add</button>';
    return h;
  };
  A.cuName = (d, el) => { F.UI.cDraft.n = el.value; const b = document.querySelector('[data-a="cuSave"]'); if (b && F.UI.cDraft.base && el.value.trim()) { b.disabled = false; b.style.opacity = 1; } };
  let cdT = null;
  A.cuQ = (d, el) => { F.UI.cDraft.q = el.value; clearTimeout(cdT); cdT = setTimeout(() => { F.render(); const i = document.querySelector('[data-in="cuQ"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  A.cuEq = d => { F.UI.cDraft.eq = d.k; F.render(); };
  A.cuBase = d => { F.UI.cDraft.base = d.id || null; F.render(); };
  A.cuSave = () => {
    const d = F.UI.cDraft; if (!d.base || !d.n.trim()) return; const st = S();
    const c = { id: 'c_' + Date.now().toString(36), n: d.n.trim().slice(0, 40), base: d.base, eq: d.eq };
    st.custom = st.custom || []; st.custom.push(c); E.addVariant(c.id, c.base, c.n, c.eq); F.save();
    A.qpAdd({ id: c.id });
  };

  // ---------- Main sheet ----------
  F.sheets.quick = () => {
    const d = F.UI.qDraft; if (!d || !d.items.length) return F.sheets.quickPick({});
    let h = '<div class="row between"><h2>Quick log</h2><span class="tag">One-off</span></div><div class="small muted" style="margin:4px 0 12px">Counts toward recovery, progress & XP — doesn’t use up a planned session.</div>';
    d.items.forEach((it, i) => {
      const e = E.ex(it.exId); const timed = isTimed(e); const band = isBand(e); const pair = E.implCount(e) === 2;
      h += '<div class="card tight" style="margin-bottom:10px"><div class="row">' + F.thumb(e.id) + '<div class="grow"><b class="ellipsis" style="display:block">' + esc(e.n) + '</b><div class="tiny muted ellipsis">' + esc(F.topSubs(e, 3)) + '</div></div><button class="icon-btn sm" data-a="qDel" data-i="' + i + '" aria-label="Remove">' + I.x + '</button></div>';
      h += '<div class="col" style="gap:6px;margin-top:10px">';
      it.sets.forEach((s, k) => {
        h += '<div class="row" style="gap:8px"><span class="num muted" style="width:18px;font-size:16px">' + (k + 1) + '</span>';
        if (band) h += '<div class="mini-step grow"><button data-a="qBand" data-i="' + i + '" data-k="' + k + '" data-d="-1">−</button><span class="grow" style="text-align:center">' + BANDS[s.band != null ? s.band : 2][0] + ' band</span><button data-a="qBand" data-i="' + i + '" data-k="' + k + '" data-d="1">+</button></div>';
        else if (!timed && e.eq !== 'bodyweight') h += '<div class="mini-step grow"><button data-a="qW" data-i="' + i + '" data-k="' + k + '" data-d="-1">−</button><span class="grow" style="text-align:center">' + (s.w != null ? F.fmtW(s.w) : '0') + ' ' + F.u() + (pair ? ' ea' : '') + '</span><button data-a="qW" data-i="' + i + '" data-k="' + k + '" data-d="1">+</button></div>';
        h += '<div class="mini-step grow"><button data-a="qR" data-i="' + i + '" data-k="' + k + '" data-d="-1">−</button><span class="grow" style="text-align:center">' + s.r + (timed ? ' s' : ' reps') + '</span><button data-a="qR" data-i="' + i + '" data-k="' + k + '" data-d="1">+</button></div>';
        h += (it.sets.length > 1 ? '<button class="icon-btn sm" data-a="qDelSet" data-i="' + i + '" data-k="' + k + '" aria-label="Remove set">' + I.minus + '</button>' : '') + '</div>';
      });
      h += '<button class="link-btn" style="align-self:flex-start" data-a="qAddSet" data-i="' + i + '">+ add set</button></div>';
      if (!timed) h += '<div class="tiny muted" style="margin:8px 0 6px">Effort — reps left in the tank (optional)</div><div class="rir">' + [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']].map(([v, l]) => '<button class="' + (it.rir === v ? 'on' : '') + '" data-a="qRir" data-i="' + i + '" data-v="' + v + '">' + l + '</button>').join('') + '</div>';
      h += '</div>';
    });
    h += '<button class="btn ghost block" data-a="qMore">' + I.plus + 'Add another exercise</button>';
    h += '<div class="field" style="margin-top:14px"><label>When</label><div class="seg">' + [['now', 'Just now'], ['earlier', 'Earlier today'], ['yday', 'Yesterday']].map(([k, l]) => '<button class="' + (d.when === k ? 'on' : '') + '" data-a="qWhen" data-k="' + k + '">' + l + '</button>').join('') + '</div>' + (d.when !== 'now' ? '<input class="input" type="time" style="margin-top:8px" value="' + (d.time || '07:00') + '" data-ch="qTime">' : '') + '</div>';
    h += '<div class="row" style="margin-top:16px"><button class="btn ghost grow" data-a="qStart">' + I.play + 'Do it now</button><button class="btn primary grow" data-a="qSave">' + I.check + 'Log it</button></div>';
    h += '<div class="tiny dim" style="margin-top:8px;text-align:center">“Do it now” opens the workout player with rest timer & watch tracking.</div>';
    return h;
  };
  const QD = () => F.UI.qDraft;
  A.qMore = () => F.sheet({ t: 'quickPick' });
  A.qDel = d => { QD().items.splice(+d.i, 1); F.render(); };
  A.qAddSet = d => { const it = QD().items[+d.i]; const l = it.sets[it.sets.length - 1]; it.sets.push(Object.assign({}, l)); F.render(); };
  A.qDelSet = d => { QD().items[+d.i].sets.splice(+d.k, 1); F.render(); };
  A.qR = d => { const it = QD().items[+d.i]; const e = E.ex(it.exId); const s = it.sets[+d.k]; const step = isTimed(e) ? 5 : 1; s.r = Math.max(1, (s.r || 0) + (+d.d) * step); it.sets.slice(+d.k + 1).forEach(x => { x.r = s.r; }); F.render(); };
  A.qW = d => { const it = QD().items[+d.i]; const e = E.ex(it.exId); const s = it.sets[+d.k]; const inc = E.increment(e, F.u()) || (F.u() === 'lb' ? 5 : 2.5); s.w = Math.max(0, E.round((s.w || 0) + (+d.d) * inc, inc / 2)); it.sets.slice(+d.k + 1).forEach(x => { x.w = s.w; }); F.render(); };
  A.qBand = d => { const it = QD().items[+d.i]; const s = it.sets[+d.k]; s.band = Math.max(0, Math.min(BANDS.length - 1, (s.band != null ? s.band : 2) + (+d.d))); it.sets.slice(+d.k + 1).forEach(x => { x.band = s.band; }); F.render(); };
  A.qRir = d => { const it = QD().items[+d.i]; it.rir = it.rir === +d.v ? null : +d.v; F.render(); };
  A.qWhen = d => { QD().when = d.k; F.render(); };
  A.qTime = (d, el) => { QD().time = el.value; };

  function startTime(d) {
    const now = Date.now(); if (d.when === 'now') return null;
    const [hh, mm] = (d.time || '07:00').split(':').map(Number);
    const base = E.startOfDay(now) - (d.when === 'yday' ? 864e5 : 0);
    return Math.min(now - 60e3, base + (hh * 60 + mm) * 60e3);
  }
  const title = d => d.items.length === 1 ? 'Quick · ' + E.ex(d.items[0].exId).n : 'Quick log · ' + d.items.length + ' exercises';

  /** Log immediately (after the fact). */
  A.qSave = async () => {
    const d = QD(); const st = S(); if (!d || !d.items.length) return;
    const dur = d.items.reduce((a, it) => a + it.sets.reduce((b, s) => b + (isTimed(E.ex(it.exId)) ? s.r : s.r * 3.5) + 60, 0), 0) * 1000;
    const end = startTime(d) != null ? startTime(d) + dur : Date.now(); const start = end - dur;
    let t = start;
    const items = d.items.map(it => {
      const e = E.ex(it.exId);
      return { exId: it.exId, repMin: it.sets[0].r, repMax: it.sets[0].r, rest: 60, unit: isTimed(e) ? 'sec' : undefined, sets: it.sets.map(s => { t += 60e3; const o = { r: s.r, done: true, t }; if (isBand(e)) { o.band = s.band != null ? s.band : 2; o.w = null; } else if (s.w != null && e.eq !== 'bodyweight' && !isTimed(e)) o.w = s.w; if (it.rir != null) o.rpe = 10 - it.rir; return o; }) };
    });
    const session = { id: 'q' + Date.now().toString(36), date: start, end, title: title(d), oneoff: true, u: F.u(), items, hr: [], synced: {} };
    session.prs = E.detectPRs(st.sessions, session);
    session.energy = window.Energy.strengthEnergy(session, st);
    const before = G.levelOf(st.game.xp).level;
    const xp = G.sessionXp(session, session.prs, false); session.xp = xp.total; session.xpLines = xp.lines; st.game.xp += xp.total;
    st.sessions.push(session); st.sessions.sort((a, b) => a.date - b.date);
    G.addMuscleXp(st, session);
    session.newAch = G.checkAchievements(st, session).map(x => x.id);
    G.claimQuests(st);
    F.UI.qDraft = null; F.UI.sheet = null; F.save(true); if (window.Schedule) window.Schedule.invalidate(); F.render();
    B.vibrate(60);
    F.snack('Logged · +' + xp.total + ' XP' + (session.prs.length ? ' · 🏆 PR!' : ''), 'View', () => F.push({ t: 'summary', id: session.id, past: true }));
    if (session.prs.length || session.newAch.length) F.confetti();
    const after = G.levelOf(st.game.xp).level; if (after > before) setTimeout(() => F.levelUp(after), 400);
    if (st.settings.hcGranted && st.settings.autoHc) { try { await F.syncSession(session, 'hc'); F.save(); } catch (e) { } }
  };

  /** Start as a mini-workout in the player. */
  A.qStart = () => {
    const d = QD(); const st = S(); if (!d || !d.items.length) return;
    if (st.active) { F.toast('Finish your current workout first'); return; }
    const day = { title: title(d), items: d.items.map(it => { const e = E.ex(it.exId); const s0 = it.sets[0]; return { exId: it.exId, sets: it.sets.length, repMin: s0.r, repMax: s0.r, rest: isTimed(e) ? 30 : 60, unit: isTimed(e) ? 'sec' : undefined }; }) };
    st.active = F.buildSession(day, { oneoff: true });
    st.active.items.forEach((x, i) => { const src = d.items[i]; x.sets.forEach((s, k) => { const q = src.sets[k] || src.sets[0]; if (isBand(E.ex(x.exId))) { s.band = q.band != null ? q.band : 2; s.w = null; } else if (q.w != null) s.w = q.w; s.r = q.r; }); });
    F.UI.qDraft = null; F.UI.sheet = null; F.save(true); F.UI.stack = [{ t: 'workout' }]; F.render(); F.resumeWorkout(); B.vibrate(60);
  };
})();
