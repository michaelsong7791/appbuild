/* Forge — main tab views: Today, Plan, Library, Progress, Profile. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, F = window.F, I = window.I, A = F.actions, esc = F.esc;
  const S = () => F.S();
  const V = F.views = {};

  V.root = () => {
    const st = S();
    if (!st.profile) return V.onboarding();
    const top = F.top();
    let html = '<div class="shell">' + nav() + '<main class="main" data-scroll="main">' + V[F.UI.tab]() + '</main></div>';
    if (top) html += V.screen(top);
    if (F.UI.sheet) html += '<div class="sheet-bg"><div class="sheet" data-scroll="sheet"><div class="grab"></div>' + V.sheet(F.UI.sheet) + '</div></div>';
    return html;
  };

  function nav() {
    const t = F.UI.tab; const b = (id, ic, lbl) => '<button data-a="tab" data-tab="' + id + '" class="' + (t === id ? 'on' : '') + '">' + I[ic] + '<span>' + lbl + '</span></button>';
    return '<nav class="nav"><div class="brand"><div class="logo">F<b>.</b></div></div>' + b('home', 'home', 'Today') + b('plan', 'plan', 'Plan') + b('library', 'lib', 'Exercises') + b('progress', 'chart', 'Progress') + b('profile', 'user', 'You') + '</nav>';
  }

  // ---------- small components ----------
  F.ring = (pct, size, stroke, color, track) => {
    const r = (size - stroke) / 2, C = 2 * Math.PI * r;
    return '<svg width="' + size + '" height="' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (track || 'var(--surface3)') + '" stroke-width="' + stroke + '"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - Math.max(0, Math.min(1, pct)))) + '"/></svg>';
  };
  function levelRing() {
    const L = G.levelOf(S().game.xp);
    return '<button class="lvl-ring" data-a="tab" data-tab="profile">' + F.ring(L.pct, 62, 5, 'url(#lg)') + '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="lg"><stop offset="0" stop-color="#ff6a33"/><stop offset="1" stop-color="#ffc94a"/></linearGradient></defs></svg><div class="n"><b>' + L.level + '</b><span>LEVEL</span></div></button>';
  }
  F.bodyPair = (vals, mode, cls) => '<div class="bm-wrap ' + (cls || '') + '">' + BodyMap.svg('front', vals, { mode }) + BodyMap.svg('back', vals, { mode }) + '</div>';
  F.musclesTxt = vals => Object.entries(vals).filter(([m, v]) => v >= 0.5 && E.MAJOR.includes(m)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => F.mLabel(m)).join(' · ');

  // ---------- TODAY ----------
  V.home = () => {
    const st = S(); const p = st.profile; const L = G.levelOf(st.game.xp); const ws = G.weekStreak(st);
    const hr = new Date().getHours(); const hi = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    let h = '<div class="page">';
    h += '<div class="row between"><div class="hello">' + levelRing() + '<div><div class="muted small">' + hi + (p.name ? ', ' + esc(p.name) : '') + '</div><h2>' + esc(G.title(L.level)) + '</h2><div class="tiny dim">' + L.into + ' / ' + L.need + ' XP to level ' + (L.level + 1) + '</div></div></div>';
    h += '<div class="streak" title="Weekly streak">' + I.flame.replace('<svg', '<svg width="18" height="18" style="color:var(--accent)"') + '<span class="num" style="font-size:18px">' + ws.streak + '</span><span class="tiny muted">WK</span></div></div>';
    h += '<div class="grid side"><div class="col" style="gap:var(--gap)">' + todayCard() + weekStrip() + '</div><div class="col" style="gap:var(--gap)">' + readinessCard() + recoveryCard() + '</div></div>';
    h += questsCard();
    return h + '</div>';
  };

  function todayCard() {
    const st = S();
    if (st.active) {
      const a = st.active; const done = a.items.reduce((x, it) => x + it.sets.filter(s => s.done).length, 0), tot = a.items.reduce((x, it) => x + it.sets.length, 0);
      return '<div class="card hero"><div class="hero-in"><div class="grow"><div class="kicker">In progress</div><h1>' + esc(a.title) + '</h1><div class="muted small">' + done + ' of ' + tot + ' sets · started ' + new Date(a.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div><div class="bar" style="margin:12px 0 14px"><i style="width:' + (100 * done / tot) + '%"></i></div><button class="btn primary lg block" data-a="resume">' + I.play + 'Resume workout</button></div></div></div>';
    }
    const idx = F.todayIdx(); const done = F.doneToday();
    if (idx == null || done) {
      const td = new Date().getDay(); const nextDow = [1, 2, 3, 4, 5, 6, 7].map(o => (td + o) % 7).find(d => st.plan.sched[d] != null);
      const nd = nextDow != null ? st.plan.days[st.plan.sched[nextDow]] : null;
      return '<div class="card hero"><div class="hero-in"><div class="grow"><div class="kicker">' + (done ? 'Done for today' : 'Rest day') + '</div><h1>' + (done ? 'Nice work.' : 'Recover &amp; grow') + '</h1><div class="muted small">' + (nd ? 'Next up: <b style="color:var(--text)">' + esc(nd.title) + '</b> on ' + F.DOW[nextDow] : 'No sessions scheduled.') + '</div><div class="row" style="margin-top:14px"><button class="btn ghost" data-a="startOther">' + I.bolt + 'Train anyway</button></div></div></div></div>';
    }
    const day = st.plan.days[idx]; const vals = F.dayMuscles(day); const fat = F.fatigue();
    const tired = Object.keys(vals).filter(m => vals[m] >= 0.5 && fat[m] >= 55);
    const rd = F.readiness();
    let warn = '';
    if (tired.length || rd.score < 55) warn = '<div class="card flat tight" style="margin-top:12px;background:color-mix(in oklab,var(--warm) 10%,var(--surface2))"><div class="small"><b style="color:var(--warm)">Heads up:</b> ' + (tired.length ? esc(tired.map(F.mLabel).join(', ')) + ' still recovering' : '') + (tired.length && rd.score < 55 ? ' and ' : '') + (rd.score < 55 ? 'readiness is low (' + rd.score + ')' : '') + '. Adaptive mode trims a set on tired muscles' + (rd.score < 55 ? ' and backs weights off 10%' : '') + '.</div><button class="btn sm" style="margin-top:8px" data-a="start" data-idx="' + idx + '" data-adapt="1">' + I.bolt + 'Start adapted</button></div>';
    return '<div class="card hero"><div class="hero-in"><div class="grow"><div class="kicker">Today · ' + F.DOW[new Date().getDay()] + '</div><h1>' + esc(day.title) + '</h1>' +
      '<div class="muted small">' + day.items.length + ' exercises · ~' + F.dayMinutes(day) + ' min · ' + day.items.reduce((a, i) => a + i.sets, 0) + ' sets</div>' +
      '<div class="small" style="margin-top:6px;color:#d8cfc6">' + esc(F.musclesTxt(vals)) + '</div>' +
      '<div class="row" style="margin-top:14px"><button class="btn primary lg grow" data-a="start" data-idx="' + idx + '">' + I.play + 'Start workout</button><button class="icon-btn" style="height:56px;width:56px;border-radius:16px" data-a="openDay" data-idx="' + idx + '">' + I.list + '</button></div>' + warn +
      '</div><div class="bm-mini">' + BodyMap.svg('front', vals, { mode: 'target' }) + BodyMap.svg('back', vals, { mode: 'target' }) + '</div></div></div>';
  }

  function weekStrip() {
    const st = S(); const sow = E.startOfWeek(Date.now());
    const done = new Set(st.sessions.map(s => E.startOfDay(s.date)));
    let h = '<div class="card tight"><div class="card-h" style="margin-bottom:8px"><h3>This week</h3><span class="small muted">' + G.weekStreak(st).thisWeek + ' / ' + st.profile.days.length + ' sessions</span></div><div class="weekstrip">';
    for (let i = 0; i < 7; i++) {
      const t = sow + i * E.DAY; const d = new Date(t); const dow = d.getDay();
      const planned = st.plan.sched[dow] != null; const isDone = done.has(t); const today = E.startOfDay(Date.now()) === t;
      h += '<div class="wd' + (planned ? ' plan' : '') + (isDone ? ' done' : '') + (today ? ' today' : '') + '">' + F.DOW[dow].slice(0, 1) + '<div class="dot">' + (isDone ? '✓' : d.getDate()) + '</div></div>';
    }
    return h + '</div></div>';
  }

  function readinessCard() {
    const st = S();
    if (!st.settings.hcGranted) {
      return '<div class="card"><div class="card-h"><h3>Readiness</h3>' + I.watch.replace('<svg', '<svg width="20" height="20" style="color:var(--muted)"') + '</div><p class="small muted" style="margin:0 0 12px">Connect Samsung Health (via Health Connect) to factor sleep, resting heart rate and HRV from your Galaxy Watch into recovery.</p><button class="btn block" data-a="connectHealth">Connect Samsung Health</button></div>';
    }
    const rd = F.readiness(); const col = rd.score >= 75 ? 'var(--fresh)' : rd.score >= 55 ? 'var(--warm)' : 'var(--hot)';
    const msg = rd.score >= 80 ? 'Primed — good day to push.' : rd.score >= 65 ? 'Solid. Train as planned.' : rd.score >= 50 ? 'A bit run down. Consider adaptive mode.' : 'Low — prioritise recovery.';
    let h = '<div class="card"><div class="card-h"><h3>Readiness</h3><button class="icon-btn sm" data-a="refreshHealth">' + I.refresh + '</button></div><div class="readiness"><div class="gauge">' + F.ring(rd.score / 100, 84, 8, col) + '<div class="v">' + rd.score + '</div></div><div class="grow"><div style="font-weight:600;margin-bottom:4px">' + msg + '</div>';
    rd.parts.forEach(p => { h += '<div class="kv"><span>' + p.k + '</span><span style="color:' + (p.good ? 'var(--text)' : 'var(--warm)') + '">' + p.v + '</span></div>'; });
    if (!rd.parts.length) h += '<div class="small muted">No sleep or heart data yet — wear your watch overnight.</div>';
    return h + '</div></div></div>';
  }

  function recoveryCard() {
    const fat = F.fatigue(); const vals = {}; Object.keys(fat).forEach(m => { vals[m] = fat[m] / 100; });
    const fresh = E.MAJOR.filter(m => fat[m] < 20).length;
    const worst = E.MAJOR.slice().sort((a, b) => fat[b] - fat[a]).slice(0, 3).filter(m => fat[m] >= 25);
    return '<div class="card"><div class="card-h"><h3>Muscle recovery</h3><span class="small muted">' + fresh + '/' + E.MAJOR.length + ' fresh</span></div>' + F.bodyPair(vals, 'fatigue') +
      '<div class="legend" style="margin-top:8px"><span><i style="background:var(--fresh)"></i>Fresh</span><span><i style="background:var(--warm)"></i>Recovering</span><span><i style="background:var(--hot)"></i>Fatigued</span></div>' +
      (worst.length ? '<div class="col" style="gap:6px;margin-top:12px">' + worst.map(m => '<div><div class="row between small"><span>' + F.mLabel(m) + '</span><span class="muted">' + (100 - fat[m]) + '% recovered</span></div><div class="bar fresh"><i style="width:' + (100 - fat[m]) + '%"></i></div></div>').join('') + '</div>' : '') + '</div>';
  }

  function questsCard() {
    const qs = G.weekQuests(S());
    let h = '<div class="card"><div class="card-h"><h3>Weekly quests</h3><span class="tag gold">Resets Monday</span></div>';
    qs.forEach(q => {
      h += '<div class="quest"><div class="qi">' + (q.done ? I.check : I.target) + '</div><div class="grow"><div class="row between"><b style="font-size:15px">' + esc(q.name) + '</b><span class="small" style="color:var(--gold);font-weight:700">+' + q.xp + ' XP</span></div><div class="small muted" style="margin-bottom:6px">' + esc(q.desc) + ' · ' + q.progress.toLocaleString() + ' / ' + q.target.toLocaleString() + '</div><div class="bar gold"><i style="width:' + (100 * q.progress / Math.max(1, q.target)) + '%"></i></div></div></div>';
    });
    return h + '</div>';
  }
  A.connectHealth = () => F.connectHealth();
  A.refreshHealth = () => { F.refreshHealth(true); F.toast('Refreshing health data…'); };
  A.startOther = () => F.sheet({ t: 'startOther' });
  A.openDay = d => F.push({ t: 'day', idx: +d.idx });

  // ---------- PLAN ----------
  V.plan = () => {
    const st = S(); const p = st.profile; const plan = st.plan;
    let h = '<div class="page"><div class="row between"><div><div class="muted small">' + esc(E.GOALS[p.goal].label) + ' · ' + esc(E.SPLIT_LABEL[plan.split]) + '</div><h1>Your plan</h1></div><button class="icon-btn" data-a="planSettings">' + I.gear + '</button></div>';
    h += '<div class="grid two">';
    F.DOW_ORDER.forEach(dow => {
      const idx = plan.sched[dow];
      if (idx == null) { h += '<div class="card flat tight row" style="opacity:.6"><div class="num" style="width:44px;font-size:18px;color:var(--dim)">' + F.DOW[dow].toUpperCase() + '</div><div class="muted">Rest</div></div>'; return; }
      const day = plan.days[idx]; const vals = F.dayMuscles(day);
      h += '<button class="card tight row li-btn" data-a="openDay" data-idx="' + idx + '"><div class="num" style="width:44px;font-size:18px;color:var(--accent-2)">' + F.DOW[dow].toUpperCase() + '</div><div class="grow"><b style="font-size:17px">' + esc(day.title) + '</b><div class="small muted ellipsis">' + day.items.length + ' exercises · ~' + F.dayMinutes(day) + ' min · ' + esc(F.musclesTxt(vals)) + '</div></div><div style="width:64px;display:flex">' + BodyMap.svg('front', vals, { mode: 'target' }).replace('class="bodymap"', 'class="bodymap" style="width:32px"') + BodyMap.svg('back', vals, { mode: 'target' }).replace('class="bodymap"', 'class="bodymap" style="width:32px"') + '</div>' + I.chev.replace('<svg', '<svg width="18" height="18" style="color:var(--dim)"') + '</button>';
    });
    h += '</div>';
    // weekly volume vs target
    const wk = E.weeklyMuscleSets(st.sessions); const planned = {};
    E.MAJOR.forEach(m => { planned[m] = 0; });
    Object.values(plan.sched).forEach(i => plan.days[i].items.forEach(it => { const e = E.ex(it.exId); if (!e) return; const inv = E.involvement(e); for (const m in inv) if (m in planned) planned[m] += it.sets * inv[m]; }));
    const [lo, hi] = E.GOALS[p.goal].weekly;
    h += '<div class="card"><div class="card-h"><h3>Weekly sets per muscle</h3><span class="small muted">target ' + lo + '–' + hi + '</span></div><div class="col" style="gap:8px">';
    E.MAJOR.forEach(m => {
      const pl = Math.round(planned[m]); const done = Math.round(wk[m]);
      const ok = pl >= lo && pl <= hi + 4;
      h += '<div class="inv" style="grid-template-columns:92px 1fr 64px"><span>' + F.mLabel(m) + '</span><div class="bar" style="position:relative;height:8px"><i style="width:' + Math.min(100, 100 * done / hi) + '%"></i><span style="position:absolute;top:-3px;bottom:-3px;left:' + Math.min(100, 100 * pl / hi) + '%;width:2px;background:var(--text);opacity:.6"></span></div><span class="small" style="text-align:right;color:' + (ok ? 'var(--muted)' : 'var(--warm)') + '">' + done + ' / ' + pl + '</span></div>';
    });
    h += '</div><div class="tiny dim" style="margin-top:8px">Bar = sets done this week · tick = planned. Secondary muscles count as half a set.</div></div>';
    h += '<div class="row wrap"><button class="btn" data-a="regen">' + I.refresh + 'Shuffle exercises</button><button class="btn ghost" data-a="planSettings">' + I.gear + 'Goals &amp; schedule</button></div>';
    return h + '</div>';
  };
  A.planSettings = () => F.push({ t: 'planSettings' });
  A.regen = () => { if (!confirm('Pick a fresh set of exercises for every day? Your schedule and goals stay the same.')) return; F.regenerate(false); F.toast('New exercise selection generated'); F.render(); };

  // ---------- LIBRARY ----------
  V.library = () => {
    const L = F.UI.lib; const st = S();
    const groups = ['chest', 'shoulders', 'triceps', 'biceps', 'lats', 'middle back', 'traps', 'forearms', 'abdominals', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'lower back', 'adductors', 'abductors'];
    let list = E.all().filter(e => (!L.m || e.pm.includes(L.m) || (L.sec && e.sm.includes(L.m))) && (!L.mine || E.hasEquip(e, st.profile.equipment)));
    if (L.q) { const q = L.q.toLowerCase(); list = list.filter(e => e.n.toLowerCase().includes(q) || e.eq.includes(q)); }
    list.sort((a, b) => b.t - a.t || a.n.localeCompare(b.n));
    let h = '<div class="page"><h1>Exercises</h1>';
    h += '<div class="row"><div class="grow" style="position:relative"><input class="input" style="padding-left:40px" placeholder="Search ' + E.all().length + ' exercises" value="' + esc(L.q) + '" data-in="libQ"><span style="position:absolute;left:12px;top:13px;width:20px;color:var(--dim)">' + I.search + '</span></div><button class="chip ' + (L.mine ? 'on' : '') + '" style="height:46px;border-radius:12px" data-a="libMine">My gear</button></div>';
    h += '<div class="chips"><button class="chip ' + (!L.m ? 'on' : '') + '" data-a="libM" data-m="">All</button>' + groups.map(m => '<button class="chip ' + (L.m === m ? 'on' : '') + '" data-a="libM" data-m="' + m + '">' + F.mLabel(m) + '</button>').join('') + '</div>';
    h += '<div class="small muted">' + list.length + ' results</div><div class="card tight" id="lib-list" style="padding-top:2px;padding-bottom:2px">';
    h += libRows(list.slice(0, 80));
    if (list.length > 80) h += '<button class="btn ghost block" style="margin:10px 0" data-a="libMore">Show all ' + list.length + '</button>';
    return h + '</div></div>';
  };
  function libRows(list) {
    const fav = new Set(S().profile.favorites || []);
    return list.map(e => '<button class="exrow" data-a="ex" data-id="' + e.id + '"><img class="thumb" loading="lazy" src="' + E.img(e.id, 0) + '" alt=""><div class="grow"><div class="nm ellipsis">' + (fav.has(e.id) ? '<span style="color:var(--accent)">♥ </span>' : '') + esc(e.n) + '</div><div class="sub ellipsis">' + esc(e.pm.map(F.mLabel).join(', ')) + (e.sm.length ? ' <span class="dim">+ ' + esc(e.sm.slice(0, 2).map(F.mLabel).join(', ')) + '</span>' : '') + '</div></div><span class="tag">' + esc(E.EQUIPMENT[e.eq]) + '</span></button>').join('');
  }
  F.libRows = libRows;
  let libT = null;
  A.libQ = (d, el) => { F.UI.lib.q = el.value; clearTimeout(libT); libT = setTimeout(() => { F.render(); const i = document.querySelector('[data-in="libQ"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 220); };
  A.libM = d => { F.UI.lib.m = d.m || null; F.render(); };
  A.libMine = () => { F.UI.lib.mine = !F.UI.lib.mine; F.render(); };
  A.libMore = (d, el) => {
    const L = F.UI.lib; const st = S();
    let list = E.all().filter(e => (!L.m || e.pm.includes(L.m)) && (!L.mine || E.hasEquip(e, st.profile.equipment)));
    if (L.q) { const q = L.q.toLowerCase(); list = list.filter(e => e.n.toLowerCase().includes(q)); }
    list.sort((a, b) => b.t - a.t || a.n.localeCompare(b.n));
    el.insertAdjacentHTML('beforebegin', libRows(list.slice(80))); el.remove();
  };

  // ---------- PROGRESS ----------
  V.progress = () => {
    const st = S(); const ss = st.sessions.slice().sort((a, b) => b.date - a.date);
    let h = '<div class="page"><h1>Progress</h1>';
    if (!ss.length) return h + '<div class="card" style="text-align:center;padding:40px 20px"><div style="font-size:44px">📈</div><h2 style="margin:8px 0">No workouts yet</h2><p class="muted">Finish your first session and your charts, PRs and history will appear here.</p></div></div>';
    const wk = E.startOfWeek(Date.now()); const thisW = ss.filter(s => s.date >= wk);
    const vol = thisW.reduce((a, s) => a + E.sessionStats(s).vol, 0); const mins = thisW.reduce((a, s) => a + E.sessionStats(s).dur, 0);
    h += '<div class="stats"><div class="stat"><div class="num">' + thisW.length + '</div><div class="lbl">Workouts</div></div><div class="stat"><div class="num">' + F.fmtVol(vol) + '</div><div class="lbl">' + F.u() + ' this week</div></div><div class="stat"><div class="num">' + F.fmtDur(mins) + '</div><div class="lbl">Time</div></div></div>';
    // weekly volume chart (8 weeks)
    const weeks = []; for (let i = 7; i >= 0; i--) { const a = wk - i * 7 * E.DAY; const b = a + 7 * E.DAY; weeks.push({ a, v: ss.filter(s => s.date >= a && s.date < b).reduce((x, s) => x + E.sessionStats(s).vol, 0) }); }
    h += '<div class="grid two"><div class="card"><div class="card-h"><h3>Weekly volume</h3><span class="small muted">' + F.u() + ' × reps</span></div>' + F.barChart(weeks.map(w => w.v), weeks.map(w => { const d = new Date(w.a); return (d.getMonth() + 1) + '/' + d.getDate(); })) + '</div>';
    // PRs
    const best = {}; ss.forEach(s => s.items.forEach(it => it.sets.forEach(x => { const v = E.e1rm(x.w, x.r); if (v > (best[it.exId] ? best[it.exId].v : 0)) best[it.exId] = { v, w: x.w, r: x.r, d: s.date }; })));
    const top = Object.entries(best).sort((a, b) => b[1].v - a[1].v).slice(0, 6);
    h += '<div class="card"><div class="card-h"><h3>Top lifts</h3><span class="small muted">est. 1-rep max</span></div>' + (top.length ? top.map(([id, b]) => { const e = E.ex(id); return '<button class="exrow" data-a="ex" data-id="' + id + '"><img class="thumb" style="width:44px;height:44px" src="' + E.img(id, 0) + '"><div class="grow"><div class="nm ellipsis">' + esc(e ? e.n : id) + '</div><div class="sub">' + F.fmtW(b.w) + ' × ' + b.r + ' · ' + F.fmtDate(b.d) + '</div></div><div class="num" style="font-size:22px">' + Math.round(b.v) + '<span class="tiny muted"> ' + F.u() + '</span></div></button>'; }).join('') : '<div class="muted small">Log weighted sets to see PRs.</div>') + '</div></div>';
    // history
    h += '<div class="card"><div class="card-h"><h3>History</h3><span class="small muted">' + ss.length + ' sessions</span></div>';
    ss.slice(0, 40).forEach(s => {
      const x = E.sessionStats(s);
      h += '<button class="exrow" data-a="session" data-id="' + s.id + '"><div class="thumb" style="width:48px;height:48px;background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="num" style="font-size:20px;line-height:1">' + new Date(s.date).getDate() + '</span><span class="tiny muted">' + new Date(s.date).toLocaleDateString(undefined, { month: 'short' }).toUpperCase() + '</span></div><div class="grow"><div class="nm">' + esc(s.title) + '</div><div class="sub">' + x.sets + ' sets · ' + F.fmtVol(x.vol) + ' ' + (s.u || F.u()) + ' · ' + x.dur + ' min' + (x.hrAvg ? ' · ♥ ' + x.hrAvg : '') + '</div></div>' + ((s.prs || []).length ? '<span class="tag gold">' + s.prs.length + ' PR</span>' : '') + '<span class="tag">+' + (s.xp || 0) + '</span></button>';
    });
    return h + '</div></div>';
  };
  A.session = d => F.push({ t: 'summary', id: d.id, past: true });

  F.barChart = (vals, labels) => {
    const W = 320, Hh = 150, pad = 22, max = Math.max(1, ...vals); const bw = (W - pad) / vals.length;
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (Hh + 18) + '">';
    [0.5, 1].forEach(f => { const y = Hh - (Hh - 10) * f; s += '<line class="grid-l" x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="0" y="' + (y + 3) + '">' + F.fmtVol(max * f) + '</text>'; });
    vals.forEach((v, i) => { const h = (Hh - 10) * v / max; const x = pad + i * bw + bw * 0.18; s += '<rect x="' + x + '" y="' + (Hh - h) + '" width="' + bw * 0.64 + '" height="' + Math.max(h, 1) + '" rx="4" fill="' + (i === vals.length - 1 ? 'var(--accent)' : 'var(--surface3)') + '"/><text x="' + (x + bw * 0.32) + '" y="' + (Hh + 14) + '" text-anchor="middle">' + labels[i] + '</text>'; });
    return s + '</svg>';
  };
  F.lineChart = (pts, opts) => {
    opts = opts || {}; if (pts.length < 2) return '<div class="small muted">Not enough data yet.</div>';
    const W = 320, Hh = opts.h || 120; const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs); const y0 = Math.min(...ys) * 0.95, y1 = Math.max(...ys) * 1.03;
    const X = x => 26 + (W - 30) * (x - x0) / Math.max(1, x1 - x0), Y = y => Hh - 6 - (Hh - 16) * (y - y0) / Math.max(1, y1 - y0);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');
    const col = opts.color || 'var(--accent)';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '"><text x="0" y="12">' + Math.round(y1) + '</text><text x="0" y="' + (Hh - 4) + '">' + Math.round(y0) + '</text><path d="' + d + 'L' + X(x1) + ',' + Hh + 'L' + X(x0) + ',' + Hh + 'Z" fill="' + col + '" opacity=".12"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/></svg>';
  };

  // ---------- PROFILE ----------
  V.profile = () => {
    const st = S(); const p = st.profile; const L = G.levelOf(st.game.xp); const I2 = F.UI.integrations;
    let h = '<div class="page">';
    h += '<div class="card hero"><div class="hero-in" style="align-items:center"><div class="lvl-ring" style="width:84px;height:84px">' + F.ring(L.pct, 84, 6, 'url(#lg2)') + '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="lg2"><stop offset="0" stop-color="#ff6a33"/><stop offset="1" stop-color="#ffc94a"/></linearGradient></defs></svg><div class="n"><b style="font-size:32px">' + L.level + '</b><span>LEVEL</span></div></div><div class="grow"><div class="kicker">' + esc(G.title(L.level)) + '</div><h1 style="font-size:30px">' + esc(p.name || 'Athlete') + '</h1><div class="small muted">' + st.game.xp.toLocaleString() + ' XP total · ' + (L.need - L.into) + ' to next level</div><div class="bar" style="margin-top:8px"><i style="width:' + (L.pct * 100) + '%"></i></div></div></div></div>';
    // achievements
    const got = Object.keys(st.game.ach).length;
    h += '<div class="card"><div class="card-h"><h3>Achievements</h3><span class="small muted">' + got + ' / ' + G.ACH.length + '</span></div><div class="ach-grid">' + G.ACH.map(a => '<div class="ach ' + (st.game.ach[a.id] ? '' : 'locked') + '" title="' + esc(a.desc) + '"><div class="em">' + a.icon + '</div><div class="t">' + esc(a.name) + '</div><div class="tiny muted" style="line-height:1.2">' + esc(a.desc) + '</div></div>').join('') + '</div></div>';
    // muscle mastery
    const mx = E.MAJOR.map(m => ({ m, xp: st.game.mxp[m] || 0, lv: G.muscleLevel(st.game.mxp[m]) })); const maxXp = Math.max(1, ...mx.map(x => x.xp));
    const mv = {}; mx.forEach(x => { mv[x.m] = x.xp / maxXp; });
    h += '<div class="grid two"><div class="card"><div class="card-h"><h3>Muscle mastery</h3></div>' + F.bodyPair(mv, 'mastery') + '<div class="col" style="gap:4px;margin-top:10px">' + mx.sort((a, b) => b.xp - a.xp).map(x => '<div class="inv" style="grid-template-columns:92px 1fr 46px"><span>' + F.mLabel(x.m) + '</span><div class="bar gold"><i style="width:' + (100 * x.xp / maxXp) + '%"></i></div><span class="small num" style="text-align:right;font-size:15px">Lv ' + x.lv + '</span></div>').join('') + '</div></div>';
    // integrations
    const sv = I2.strava || {}; const w = I2.watch || {};
    h += '<div class="col" style="gap:var(--gap)"><div class="card"><div class="card-h"><h3>Connected</h3><button class="icon-btn sm" data-a="refreshInt">' + I.refresh + '</button></div><div class="list">';
    h += intRow('💙', 'Samsung Health', st.settings.hcGranted ? 'Connected via Health Connect' : 'Sleep, heart rate, HRV, workouts', st.settings.hcGranted ? '<span class="tag fresh">On</span>' : '<button class="btn sm" data-a="connectHealth">Connect</button>');
    h += intRow('🧡', 'Strava', sv.connected ? 'Connected' + (sv.athlete ? ' as ' + esc(sv.athlete) : '') : sv.configured ? 'Ready to connect' : 'Needs your API app keys', sv.connected ? '<button class="btn sm ghost" data-a="stravaOff">Disconnect</button>' : '<button class="btn sm" data-a="stravaSetup">' + (sv.configured ? 'Connect' : 'Set up') + '</button>');
    h += intRow('⌚', 'Galaxy Watch', w.connected ? esc(w.name || 'Connected') : 'Install the Forge watch app', w.connected ? '<span class="tag fresh">Linked</span>' : '<span class="tag">Offline</span>');
    h += '</div></div>';
    h += '<div class="card"><div class="card-h"><h3>Settings</h3></div><div class="list">';
    h += setRow('Auto-save workouts to Samsung Health', 'autoHc'); h += setRow('Auto-upload workouts to Strava', 'autoStrava');
    h += setRow('Vibrate when rest ends', 'restVibrate'); h += setRow('Keep screen on during workouts', 'keepAwake');
    h += '<div class="li"><div class="grow">Units</div><div class="seg" style="width:140px"><button class="' + (p.units === 'kg' ? 'on' : '') + '" data-a="units" data-u="kg">kg</button><button class="' + (p.units === 'lb' ? 'on' : '') + '" data-a="units" data-u="lb">lb</button></div></div>';
    h += '<div class="li"><div class="grow">Bodyweight</div><input class="input" style="width:110px;text-align:center" type="number" inputmode="decimal" value="' + (p.bodyweight || '') + '" data-ch="bw"><span class="muted small">' + p.units + '</span></div>';
    h += '<div class="li"><div class="grow">Name</div><input class="input" style="width:160px" value="' + esc(p.name || '') + '" data-ch="pname"></div>';
    h += '</div></div>';
    h += '<div class="card"><div class="card-h"><h3>Your data</h3></div><div class="row wrap"><button class="btn" data-a="exportData">' + I.download + 'Export backup</button><label class="btn ghost">' + I.upload + 'Import<input type="file" accept="application/json,.json" style="display:none" data-ch="importData"></label><button class="btn danger" data-a="resetAll">Reset</button></div><p class="tiny dim" style="margin:10px 0 0">Everything stays on your phone. Exercise demos: Free Exercise DB (public domain).</p></div></div></div>';
    return h + '</div>';
  };
  const intRow = (ic, name, sub, right) => '<div class="li"><div style="font-size:24px;width:32px;text-align:center">' + ic + '</div><div class="grow"><b>' + name + '</b><div class="small muted">' + sub + '</div></div>' + right + '</div>';
  const setRow = (lbl, key) => '<div class="li"><div class="grow">' + lbl + '</div><button class="switch ' + (S().settings[key] ? 'on' : '') + '" data-a="toggleSet2" data-k="' + key + '"></button></div>';
  A.toggleSet2 = d => { const st = S(); st.settings[d.k] = !st.settings[d.k]; F.save(); F.render(); };
  A.refreshInt = () => F.refreshIntegrations();
  A.units = d => {
    const st = S(); const p = st.profile; if (p.units === d.u) return;
    const f = d.u === 'lb' ? 2.20462 : 0.453592; const conv = w => w == null ? w : Math.round(w * f * 2) / 2;
    st.sessions.forEach(s => { s.items.forEach(it => it.sets.forEach(x => { x.w = conv(x.w); })); s.u = d.u; (s.prs || []).forEach(pr => { pr.w = conv(pr.w); pr.val = conv(pr.val); }); });
    if (st.active) { st.active.items.forEach(it => it.sets.forEach(x => { x.w = conv(x.w); })); st.active.u = d.u; }
    p.bodyweight = conv(p.bodyweight); p.units = d.u; F.save(); F.render();
  };
  A.bw = (d, el) => { S().profile.bodyweight = parseFloat(el.value) || null; F.save(); };
  A.pname = (d, el) => { S().profile.name = el.value.trim(); F.save(); F.render(); };
  A.exportData = () => window.Bridge.call('share.backup', { json: JSON.stringify(S(), null, 1) }).catch(e => F.toast(e.message));
  A.importData = (d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { try { const ns = JSON.parse(r.result); if (!ns.profile || !Array.isArray(ns.sessions)) throw new Error('Not a Forge backup'); if (!confirm('Replace all current data with this backup (' + ns.sessions.length + ' workouts)?')) return; F.setState(ns); F.toast('Backup restored'); F.go('home'); } catch (e) { F.toast('Import failed: ' + e.message); } };
    r.readAsText(f);
  };
  A.resetAll = () => { if (!confirm('Delete ALL data — plan, history, XP? This cannot be undone.')) return; if (!confirm('Really reset everything?')) return; F.setState({}); location.reload(); };
  A.stravaSetup = () => { const sv = F.UI.integrations.strava || {}; if (sv.configured) A.stravaConnect(); else F.sheet({ t: 'strava' }); };
  A.stravaConnect = () => window.Bridge.call('strava.connect', {}).then(() => F.toast('Opening Strava…')).catch(e => F.toast(e.message));
  A.stravaOff = () => { if (!confirm('Disconnect Strava?')) return; window.Bridge.call('strava.disconnect', {}).then(() => F.refreshIntegrations()); };
})();
