/* Forge — multi-day weight-free programs: categories, duration scaling, weekday scheduling (v1.7). */
(function () {
  'use strict';
  const E = window.Engine, F = window.F, I = window.I, A = F.actions, esc = F.esc, V = F.views, B = window.Bridge;
  const S = () => F.S();
  const ADD = () => window.ADDONS || [];
  const byId = id => ADD().find(p => p.id === id);

  const CATS = [
    ['all', 'All'], ['Yoga', '🧘 Yoga'], ['Pilates', '🩰 Pilates'], ['Mobility', '🤸 Mobility'], ['Core', '🧱 Core'],
    ['Calisthenics', '💪 Calisthenics'], ['Bodyweight', '🏠 Bodyweight'], ['Plyometrics', '⚡ Plyo & agility'], ['HIIT', '⏱️ HIIT'], ['Bands', '🎗️ Bands'], ['Cardio', '🫀 Low-impact'],
  ];
  const DURS = [10, 15, 20, 30, 45, 60];
  const CALM = ['Yoga', 'Mobility', 'Pilates'];

  F.progCfg = id => { const st = S(); st.addons[id] = st.addons[id] || { done: [] }; const c = st.addons[id]; if (!Array.isArray(c.days)) c.days = []; return c; };
  const cfgRO = id => S().addons[id] || { done: [], days: [] };

  // ---------- Time model ----------
  const workSec = it => (it[3] === 's' ? it[2] : it[2] * 3.5);
  const itemSec = (it, interval) => it[1] * (workSec(it) + it[4]) + (interval ? 5 : 15);
  const sessSec = (items, interval) => items.reduce((a, it) => a + itemSec(it, interval), 0);
  const isStretch = it => it[3] === 's' && it[4] <= 10;
  F.estMin = (items, interval) => Math.max(1, Math.round(sessSec(items, interval) / 60));

  // Pool of extra moves for a program: items from its other sessions, nearest sessions first.
  function pool(p, idx, have) {
    const out = []; const seen = new Set(have);
    const order = p.sessions.map((_, k) => k).filter(k => k !== idx).sort((a, b) => Math.abs(a - idx) - Math.abs(b - idx));
    order.forEach(k => p.sessions[k].items.forEach(it => { if (!seen.has(it[0])) { seen.add(it[0]); out.push(it.slice()); } }));
    return out;
  }

  // Scale one program session to a target duration (minutes). Returns { items, min, changes[] }.
  F.scaleSession = (p, idx, minutes) => {
    const base = p.sessions[idx].items.map(it => it.slice());
    const iv = !!p.interval;
    if (!minutes) return { items: base, min: F.estMin(base, iv), changes: [] };
    let items = base.map(it => it.slice());
    const T = minutes * 60; const changes = [];
    // Warm-up / cool-down for longer non-calm sessions
    if (!CALM.includes(p.cat) && minutes >= 30) {
      if (!items.some(it => it[0] === 'Worlds_Greatest_Stretch')) { items.unshift(['Worlds_Greatest_Stretch', 1, 6, 'r', 10, 'Warm-up: lunge & twist']); }
      if (!items.some(it => it[0] === 'Childs_Pose')) { items.push(['Childs_Pose', 1, 60, 's', 5, 'Cool-down']); }
      changes.push('warm-up & cool-down added');
    }
    const orig = items.map(it => it[1]);
    const minSets = (it, k) => Math.min(orig[k], isStretch(it) || it[3] === 's' ? 1 : 2);
    const maxSets = (it, k) => (iv ? Math.max(orig[k], 8) : isStretch(it) ? Math.max(orig[k], 3) : Math.min(6, orig[k] + 2));
    let cur = sessSec(items, iv);
    if (cur > T * 1.08) {
      // 1) trim sets round-robin, longest items first
      let changed = true;
      while (cur > T * 1.08 && changed) {
        changed = false;
        const order = items.map((it, k) => k).sort((a, b) => itemSec(items[b], iv) - itemSec(items[a], iv));
        for (const k of order) { if (cur <= T * 1.08) break; if (items[k][1] > minSets(items[k], k)) { items[k][1]--; changed = true; cur = sessSec(items, iv); } }
      }
      if (items.some((it, k) => it[1] < orig[k])) changes.push('fewer sets');
      // 2) drop middle items (keep first & last)
      let dropped = 0;
      while (cur > T * 1.08 && items.length > 3) { const mid = Math.floor(items.length / 2); items.splice(mid, 1); orig.splice(mid, 1); dropped++; cur = sessSec(items, iv); }
      if (dropped) changes.push(dropped + ' move' + (dropped > 1 ? 's' : '') + ' dropped');
      // 3) shorten holds
      if (cur > T * 1.08) { const f = Math.max(0.6, T / cur); items.forEach(it => { if (it[3] === 's' && !iv) it[2] = Math.max(15, Math.round(it[2] * f / 5) * 5); }); cur = sessSec(items, iv); changes.push('shorter holds'); }
    } else if (cur < T * 0.92) {
      // 1) extra rounds round-robin
      let changed = true;
      while (cur < T * 0.92 && changed) {
        changed = false;
        for (let k = 0; k < items.length; k++) { if (cur >= T * 0.92) break; if (items[k][1] < Math.min(maxSets(items[k], k), orig[k] + 1)) { items[k][1]++; changed = true; cur = sessSec(items, iv); } }
      }
      // 2) add moves from the rest of the program
      const extra = pool(p, idx, items.map(it => it[0])); let added = 0;
      const insertAt = () => (items.length && (items[items.length - 1][5] || '').startsWith('Cool-down') ? items.length - 1 : items.length);
      while (cur < T * 0.92 && extra.length && added < 10) { const it = extra.shift(); items.splice(insertAt(), 0, it); orig.splice(insertAt() - 1, 0, it[1]); added++; cur = sessSec(items, iv); }
      // 3) more rounds up to the cap
      changed = true;
      while (cur < T * 0.92 && changed) {
        changed = false;
        for (let k = 0; k < items.length; k++) { if (cur >= T * 0.92) break; if (items[k][1] < maxSets(items[k], k)) { items[k][1]++; changed = true; cur = sessSec(items, iv); } }
      }
      // 4) still short (calm flows run out of moves): lengthen holds / reps up to 2×
      if (cur < T * 0.92) {
        const f = Math.min(2, T / cur);
        items.forEach(it => { if (it[3] === 's') it[2] = Math.round(it[2] * f / 5) * 5; });
        cur = sessSec(items, iv); changes.push('longer holds');
      }
      if (items.some((it, k) => it[1] > orig[k])) changes.push('extra rounds');
      if (added) changes.push('+' + added + ' move' + (added > 1 ? 's' : '') + ' from the program');
    }
    return { items, min: F.estMin(items, iv), changes };
  };

  // ---------- Export types ----------
  const progOf = s => s.addon && byId(s.addon.prog);
  F.addonHcType = s => { const p = progOf(s); if (!p) return s.addon ? 'calisthenics' : 'strength'; return { Yoga: 'yoga', Pilates: 'pilates', Mobility: 'stretching', HIIT: 'hiit', Plyometrics: 'hiit', Cardio: 'hiit', Bands: 'strength', Core: 'calisthenics', Calisthenics: 'calisthenics', Bodyweight: 'calisthenics' }[p.cat] || (p.id === 'bootcamp' ? 'bootcamp' : 'calisthenics'); };
  F.addonStravaType = s => { const p = progOf(s); if (!p) return 'WeightTraining'; return { Yoga: 'Yoga', Pilates: 'Pilates', Mobility: 'Yoga', HIIT: 'HighIntensityIntervalTraining', Plyometrics: 'HighIntensityIntervalTraining', Cardio: 'Workout' }[p.cat] || 'WeightTraining'; };

  // ---------- Scheduling ----------
  const doneToday = id => { const c = cfgRO(id); return c.last && c.last >= E.startOfDay(Date.now()); };
  F.addonsOn = dow => ADD().filter(p => (cfgRO(p.id).days || []).includes(dow) && F.addonNext(p) >= 0);
  F.addonsToday = () => {
    const dow = new Date().getDay();
    const sched = F.addonsOn(dow).filter(p => !doneToday(p.id)).map(p => ({ p, sched: true }));
    const inProg = ADD().filter(p => { const c = cfgRO(p.id); return c.done.length && F.addonNext(p) >= 0 && !(c.days || []).length && !doneToday(p.id); }).map(p => ({ p, sched: false }));
    return sched.concat(inProg);
  };

  // ---------- List ----------
  V.addonsList = () => {
    const st = S(); const cat = F.UI.addonCat || 'all';
    const present = new Set(ADD().map(p => p.cat));
    let h = '<div class="chips">' + CATS.filter(([k]) => k === 'all' || present.has(k)).map(([k, l]) => '<button class="chip ' + (cat === k ? 'on' : '') + '" data-a="addonCat" data-c="' + k + '">' + l + '</button>').join('') + '</div>';
    const list = ADD().filter(p => cat === 'all' || p.cat === cat)
      .sort((a, b) => { const sa = cfgRO(a.id), sb = cfgRO(b.id); const ka = ((sa.days || []).length ? 2 : 0) + (sa.done.length && F.addonNext(a) >= 0 ? 1 : 0); const kb = ((sb.days || []).length ? 2 : 0) + (sb.done.length && F.addonNext(b) >= 0 ? 1 : 0); return kb - ka; });
    h += '<div class="grid two">' + list.map(p => {
      const pr = st.addons[p.id] || { done: [] }; const n = pr.done.length; const nx = F.addonNext(p);
      const mins = pr.minutes || p.min; const days = (pr.days || []).slice().sort((a, b) => F.DOW_ORDER.indexOf(a) - F.DOW_ORDER.indexOf(b));
      return '<button class="card tight li-btn" data-k="ad-' + p.id + '" data-a="addon" data-id="' + p.id + '" style="text-align:left"><div class="row"><div style="width:52px;height:52px;border-radius:14px;flex:none;display:flex;align-items:center;justify-content:center;font-size:26px;background:color-mix(in oklab,' + p.color + ' 18%,var(--surface2))">' + p.icon + '</div><div class="grow"><b style="font-size:16px">' + esc(p.name) + '</b><div class="small muted">' + p.sessions.length + ' sessions · ' + (pr.minutes ? mins + ' min' : '~' + mins + ' min') + ' · ' + esc(p.level) + '</div>' + (days.length ? '<div class="tiny" style="color:' + p.color + ';margin-top:2px;font-weight:700">' + days.map(d => F.DOW[d]).join(' · ') + '</div>' : '') + '<div class="bar" style="margin-top:8px"><i style="width:' + (100 * n / p.sessions.length) + '%;background:' + p.color + '"></i></div></div><div class="small muted" style="text-align:right;width:52px">' + (nx < 0 ? '✓ Done' : n + '/' + p.sessions.length) + '</div></div></button>';
    }).join('') + '</div>';
    return h;
  };
  A.addonCat = d => { F.UI.addonCat = d.c; F.render(); };

  // ---------- Program screen ----------
  function addonScreen(top) {
    const p = byId(top.id); if (!p) return '';
    const pr = cfgRO(p.id); const nx = F.addonNext(p); const mins = pr.minutes || 0; const days = pr.days || [];
    let h = '<div class="screen"><div class="top"><button class="icon-btn" data-a="back">' + I.back + '</button><h2>' + esc(p.name) + '</h2></div><div class="body" data-scroll="addon"><div class="page" style="max-width:820px">';
    h += '<div class="card hero" style="background:radial-gradient(120% 140% at 100% 0%, color-mix(in oklab,' + p.color + ' 30%,transparent), var(--surface) 60%)"><div class="hero-in"><div style="font-size:44px">' + p.icon + '</div><div class="grow"><div class="kicker" style="color:' + p.color + '">' + esc(p.cat || 'Program') + ' · ' + p.sessions.length + ' sessions</div><p style="margin:6px 0 0">' + esc(p.desc) + '</p><div class="small muted" style="margin-top:6px">' + pr.done.length + ' of ' + p.sessions.length + ' done' + (p.interval ? ' · timers auto-advance' : '') + '</div></div></div></div>';
    // Duration
    h += '<div class="card"><div class="card-h"><h3>Workout length</h3><span class="small muted">' + (mins ? mins + ' min' : 'Default ~' + p.min + ' min') + '</span></div><div class="chips wrap"><button class="chip ' + (!mins ? 'on' : '') + '" data-a="progMin" data-id="' + p.id + '" data-m="0">Default</button>' + DURS.map(m => '<button class="chip ' + (mins === m ? 'on' : '') + '" data-a="progMin" data-id="' + p.id + '" data-m="' + m + '">' + m + ' min</button>').join('') + '</div><div class="tiny dim" style="margin-top:8px">Every session is re-sized to fit: sets and moves are trimmed for short slots, or extra rounds and moves from the rest of the program are added for longer ones' + (CALM.includes(p.cat) ? '' : ' (plus a warm-up and cool-down from 30 min)') + '.</div></div>';
    // Schedule
    h += '<div class="card"><div class="card-h"><h3>Schedule</h3><span class="small muted">' + (days.length ? days.length + '× / week' : 'Any day') + '</span></div><div class="chips wrap">' + F.DOW_ORDER.map(d => '<button class="chip ' + (days.includes(d) ? 'on' : '') + '" data-a="progDay" data-id="' + p.id + '" data-d="' + d + '">' + F.DOW[d] + '</button>').join('') + '</div><div class="tiny dim" style="margin-top:8px">Scheduled days show the next session on your Today screen and in the 7-day plan. The program carries on from wherever you left off, so a missed day never breaks it.</div></div>';
    // Sessions
    h += '<div class="card tight" style="padding-top:2px;padding-bottom:2px">' + p.sessions.map((s, i) => {
      const done = pr.done.includes(i); const isNext = i === nx; const sc = F.scaleSession(p, i, mins);
      return '<div class="exrow" data-k="ps-' + i + '"><div class="thumb" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:' + (done ? 'var(--fresh)' : isNext ? p.color : 'var(--surface2)') + ';color:' + (done || isNext ? '#111' : 'var(--muted)') + ';font-family:var(--display);font-size:20px;font-weight:700">' + (done ? '✓' : i + 1) + '</div><div class="grow" data-a="progPeek" data-id="' + p.id + '" data-i="' + i + '"><div class="nm">' + esc(s.t) + ' <span class="small muted" style="font-weight:400">· ~' + sc.min + ' min · ' + sc.items.length + ' moves</span></div><div class="sub ellipsis">' + sc.items.map(it => esc(it[5] || (E.ex(it[0]) || {}).n || it[0])).join(' · ') + '</div></div><button class="btn sm ' + (isNext ? 'primary' : 'ghost') + '" data-a="startAddon" data-id="' + p.id + '" data-i="' + i + '">' + (done ? 'Redo' : 'Start') + '</button></div>';
    }).join('') + '</div>';
    if (pr.done.length) h += '<button class="btn ghost" data-a="resetAddon" data-id="' + p.id + '">' + I.refresh + 'Restart program</button>';
    return h + '</div></div></div>';
  }
  F.screens.addon = addonScreen;
  A.progMin = d => { const c = F.progCfg(d.id); c.minutes = +d.m || null; F.save(); F.render(); };
  A.progDay = d => { const c = F.progCfg(d.id); const k = +d.d; c.days = c.days.includes(k) ? c.days.filter(x => x !== k) : c.days.concat(k); F.save(); if (window.Schedule && window.Schedule.invalidate) window.Schedule.invalidate(); F.render(); };
  A.progPeek = d => F.sheet({ t: 'progPeek', id: d.id, i: +d.i });
  F.sheets = F.sheets || {};
  F.sheets.progPeek = d => {
    const p = byId(d.id); const pr = cfgRO(p.id); const sc = F.scaleSession(p, d.i, pr.minutes || 0);
    let h = '<h2>' + esc(p.sessions[d.i].t) + '</h2><div class="small muted" style="margin:4px 0 12px">~' + sc.min + ' min' + (sc.changes.length ? ' · ' + esc(sc.changes.join(', ')) : '') + '</div><div class="list">';
    sc.items.forEach(it => { const e = E.ex(it[0]) || { n: it[0] }; h += '<button class="li li-btn" data-a="ex" data-id="' + it[0] + '">' + F.thumb(it[0]) + '<div class="grow"><b>' + esc(it[5] || e.n) + '</b>' + (it[5] && it[5] !== e.n ? '<div class="tiny muted">' + esc(e.n) + '</div>' : '') + '</div><span class="small muted">' + it[1] + ' × ' + it[2] + (it[3] === 's' ? ' s' : '') + '</span></button>'; });
    return h + '</div><button class="btn primary block" style="margin-top:14px" data-a="startAddon" data-id="' + p.id + '" data-i="' + d.i + '">Start session</button>';
  };

  A.startAddon = d => {
    const st = S(); const p = byId(d.id); const i = +d.i; const s = p.sessions[i];
    if (st.active) { F.toast('Finish your current workout first'); return; }
    const pr = cfgRO(p.id); const sc = F.scaleSession(p, i, pr.minutes || 0);
    const day = { title: p.name + ' · ' + s.t, items: sc.items.map(it => ({ exId: it[0], sets: it[1], repMin: it[2], repMax: it[2], unit: it[3] === 's' ? 'sec' : 'reps', rest: it[4], alias: it[5] || null })) };
    st.active = F.buildSession(day, { addon: { prog: p.id, idx: i } });
    if (p.interval) { st.active.interval = true; st.active.items.forEach(it => { if (it.unit === 'sec') it.note = 'Interval — ' + it.repMax + ' s work / ' + it.rest + ' s rest. Tap ✓ once; timers then run automatically.'; }); }
    F.UI.sheet = null; F.save(true); F.UI.stack = [{ t: 'workout' }]; F.render(); F.resumeWorkout(); B.vibrate(60);
  };
})();
