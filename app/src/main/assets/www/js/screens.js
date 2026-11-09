/* Forge — overlay screens (exercise, day editor, workout, summary, plan settings), sheets, onboarding. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, F = window.F, I = window.I, A = F.actions, esc = F.esc, V = F.views;
  const S = () => F.S();

  V.screen = top => {
    const fn = Object.assign({ ex: exScreen, day: dayScreen, workout: workoutScreen, summary: summaryScreen, planSettings: planSettingsScreen }, F.screens || {})[top.t];
    return fn ? fn(top) : '';
  };
  const topbar = (title, right) => '<div class="top"><button class="icon-btn" data-a="back">' + I.back + '</button><h2>' + title + '</h2>' + (right || '') + '</div>';

  // ---------- Exercise detail ----------
  function exScreen(top) {
    const e = E.ex(top.id); if (!e) return '';
    const st = S(); const fav = (st.profile.favorites || []).includes(e.id); const blk = (st.profile.blocked || []).includes(e.id);
    const inv = E.involvement(e); const hist = E.exHistory(st.sessions, e.id);
    let h = '<div class="screen">' + topbar(esc(e.n), '<button class="icon-btn" data-a="fav" data-id="' + e.id + '" style="color:' + (fav ? 'var(--accent)' : 'inherit') + '">' + (fav ? I.heart : I.heartO) + '</button>') + '<div class="body" data-scroll="ex"><div class="page"><div class="grid two"><div class="col" style="gap:var(--gap)">';
    h += F.demo(e.id, '<span class="badge tag accent">Demo</span>');
    h += '<div class="row wrap"><span class="tag accent">' + esc(E.EQUIPMENT[e.eq]) + '</span><span class="tag">' + (e.mech === 'c' ? 'Compound' : 'Isolation') + '</span><span class="tag">' + ({ b: 'Beginner', i: 'Intermediate', e: 'Expert' }[e.lv]) + '</span>' + (e.f !== 'stat' ? '<span class="tag">' + (e.f === 'push' ? 'Push' : 'Pull') + '</span>' : '') + e.req.map(r => '<span class="tag">Needs ' + esc(E.EQUIPMENT[r]) + '</span>').join('') + '</div>';
    h += '<div class="card"><div class="card-h"><h3>Muscles worked</h3></div>' + F.bodyPair(inv, 'target') + '<div style="margin-top:10px">' + Object.entries(inv).sort((a, b) => b[1] - a[1]).map(([m, v]) => '<div class="inv"><span>' + F.mLabel(m) + '</span><div class="bar"><i style="width:' + v * 100 + '%"></i></div><span class="small muted" style="text-align:right">' + (v === 1 ? 'Main' : 'Assist') + '</span></div>').join('') + '</div></div>';
    h += '</div><div class="col" style="gap:var(--gap)"><div class="card"><div class="card-h"><h3>How to</h3></div><ol class="steps">' + e.ins.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div>';
    if (hist.length) {
      const best = hist.reduce((b, x) => x.best > b.best ? x : b, hist[0]);
      h += '<div class="card"><div class="card-h"><h3>Your history</h3><span class="small muted">' + hist.length + ' sessions</span></div><div class="stats" style="margin-bottom:12px"><div class="stat"><div class="num">' + Math.round(best.best) + '</div><div class="lbl">Best e1RM</div></div><div class="stat"><div class="num">' + F.fmtW(Math.max(...hist.flatMap(x => x.sets.map(s => s.w || 0)))) + '</div><div class="lbl">Top ' + F.u() + '</div></div><div class="stat"><div class="num">' + F.fmtVol(hist.reduce((a, x) => a + x.vol, 0)) + '</div><div class="lbl">Volume</div></div></div>' + F.lineChart(hist.map(x => [x.date, x.best])) +
        '<div class="list" style="margin-top:8px">' + hist.slice(-4).reverse().map(x => '<div class="li small"><span class="muted" style="width:96px">' + F.fmtDate(x.date) + '</span><span class="grow">' + x.sets.map(s => F.fmtW(s.w) + '×' + s.r).join(', ') + '</span></div>').join('') + '</div></div>';
    }
    h += '<div class="row wrap"><button class="btn primary" data-a="addToDaySheet" data-id="' + e.id + '">' + I.plus + 'Add to a plan day</button><button class="btn ghost" data-a="block" data-id="' + e.id + '">' + (blk ? 'Allow in plans' : 'Never suggest') + '</button></div>';
    return h + '</div></div></div></div></div>';
  }
  A.fav = d => { const p = S().profile; p.favorites = p.favorites || []; const i = p.favorites.indexOf(d.id); i >= 0 ? p.favorites.splice(i, 1) : p.favorites.push(d.id); F.save(); F.render(); };
  A.block = d => { const p = S().profile; p.blocked = p.blocked || []; const i = p.blocked.indexOf(d.id); i >= 0 ? p.blocked.splice(i, 1) : p.blocked.push(d.id); F.save(); F.toast(i >= 0 ? 'Will be suggested again' : 'Won’t be suggested in new plans'); F.render(); };
  A.addToDaySheet = d => F.sheet({ t: 'addToDay', id: d.id });

  // ---------- Day editor ----------
  function dayScreen(top) {
    const st = S(); const day = st.plan.days[top.idx]; if (!day) return '';
    const dows = Object.keys(st.plan.sched).filter(k => st.plan.sched[k] === top.idx).map(k => F.DOW[k]);
    const vals = F.dayMuscles(day);
    let h = '<div class="screen">' + topbar(esc(day.title), '<button class="icon-btn" data-a="renameDay" data-idx="' + top.idx + '">' + I.edit + '</button>') + '<div class="body" data-scroll="day"><div class="page"><div class="grid side"><div class="col" style="gap:var(--gap)">';
    h += '<div class="row wrap"><span class="tag accent">' + (dows.join(' · ') || 'Unscheduled') + '</span><span class="tag">' + day.items.length + ' exercises</span><span class="tag">~' + F.dayMinutes(day) + ' min</span><span class="tag">' + day.items.reduce((a, i) => a + i.sets, 0) + ' sets</span></div>';
    h += '<div class="card tight" style="padding-top:2px;padding-bottom:2px">';
    day.items.forEach((it, i) => {
      const e = E.ex(it.exId); if (!e) return;
      const sug = E.suggest(st.sessions, it, F.u());
      h += '<div class="exrow" style="align-items:flex-start"><button data-a="ex" data-id="' + e.id + '">' + F.thumb(e.id) + '</button><div class="grow" style="padding-top:2px"><div class="nm">' + esc(e.n) + '</div><div class="sub">' + it.sets + ' × ' + it.repMin + (it.repMax !== it.repMin ? '–' + it.repMax : '') + (F.repUnit(it.exId) === 'sec' ? ' sec' : '') + ' · rest ' + it.rest + 's' + (sug.w ? ' · next ' + F.fmtW(sug.w) + ' ' + F.u() : '') + '</div><div class="row" style="gap:6px;margin-top:8px"><button class="icon-btn sm" data-a="editItem" data-d="' + top.idx + '" data-i="' + i + '">' + I.edit + '</button><button class="icon-btn sm" data-a="swapItem" data-d="' + top.idx + '" data-i="' + i + '">' + I.swap + '</button><button class="icon-btn sm" data-a="moveItem" data-d="' + top.idx + '" data-i="' + i + '" data-dir="-1">' + I.up + '</button><button class="icon-btn sm" data-a="moveItem" data-d="' + top.idx + '" data-i="' + i + '" data-dir="1">' + I.down + '</button><button class="icon-btn sm" data-a="delItem" data-d="' + top.idx + '" data-i="' + i + '" style="color:#ff8a8a">' + I.trash + '</button></div></div></div>';
    });
    h += '</div><button class="btn ghost block" data-a="pickAdd" data-d="' + top.idx + '">' + I.plus + 'Add exercise</button></div>';
    h += '<div class="col" style="gap:var(--gap)"><div class="card"><div class="card-h"><h3>Targets</h3></div>' + F.bodyPair(vals, 'target') + '<div class="small muted" style="text-align:center;margin-top:8px">' + esc(F.musclesTxt(vals)) + '</div></div></div></div></div></div>';
    h += '<div class="foot"><button class="btn primary lg grow" data-a="start" data-idx="' + top.idx + '">' + I.play + 'Start this workout</button></div></div>';
    return h;
  }
  A.renameDay = d => { const day = S().plan.days[+d.idx]; const n = prompt('Rename workout', day.title); if (n && n.trim()) { day.title = n.trim().slice(0, 32); F.save(); F.render(); } };
  A.editItem = d => F.sheet({ t: 'editItem', d: +d.d, i: +d.i });
  A.swapItem = d => F.sheet({ t: 'swap', mode: 'plan', d: +d.d, i: +d.i });
  A.moveItem = d => { const items = S().plan.days[+d.d].items; const i = +d.i, j = i + (+d.dir); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; F.save(); F.render(); };
  A.delItem = d => { const items = S().plan.days[+d.d].items; if (items.length <= 1) { F.toast('A workout needs at least one exercise'); return; } items.splice(+d.i, 1); F.save(); F.render(); };
  A.pickAdd = d => F.sheet({ t: 'pick', mode: 'plan', d: +d.d });

  // ---------- Workout player ----------
  function workoutScreen() {
    const st = S(); const a = st.active; if (!a) return '';
    const it = a.items[a.cur]; const e = E.ex(it.exId); const j = F.curSetIdx(it); const unit = F.repUnit(it.exId, it); const hold = F.hold();
    let h = '<div class="screen" style="animation:none">';
    h += '<div class="wk-top"><button class="icon-btn" data-a="minimize">' + I.down + '</button><div class="grow"><div class="tiny muted" style="letter-spacing:.1em;font-weight:700">' + esc(a.title.toUpperCase()) + '</div><div class="wk-clock" id="wk-clock">' + F.clock(Date.now() - a.date) + '</div></div><div class="hrpill off" id="wk-hr">' + I.heart + '<span class="v">--</span></div><button class="icon-btn" data-a="wkList">' + I.list + '</button></div>';
    h += '<div class="wk-progress">' + a.items.map((x, k) => '<i class="' + (x.sets.every(s => s.done) ? 'done' : k === a.cur ? 'cur' : '') + '"></i>').join('') + '</div>';
    h += '<div class="wk-body" data-scroll="wk"><div class="wk-layout"><div class="demo-col col" style="gap:12px">' + F.demo(e.id) + '<div><div class="row between"><div class="tiny muted" style="font-weight:700;letter-spacing:.1em">EXERCISE ' + (a.cur + 1) + ' OF ' + a.items.length + '</div><button class="small" style="color:var(--accent-2);font-weight:700" data-a="ex" data-id="' + e.id + '">How to ›</button></div><h2 style="font-size:26px;margin-top:2px">' + esc(it.alias || e.n) + '</h2>' + (it.alias ? '<div class="small muted">' + esc(e.n) + '</div>' : '') + '<div class="target" style="margin-top:6px"><span class="tag accent">' + it.sets.length + ' × ' + it.repMin + (it.repMax !== it.repMin ? '–' + it.repMax : '') + ' ' + unit + '</span><span class="tag">Rest ' + it.rest + 's</span><span class="tag">' + esc(e.pm.map(F.mLabel).join(', ')) + '</span></div>' + (it.note ? '<div class="small muted" style="margin-top:8px">💡 ' + esc(it.note) + '</div>' : '') + '</div>';
    if (unit !== 'sec') h += '<div class="watchbox">' + I.watch.replace('<svg', '<svg width="22" height="22" style="color:var(--accent-2)"') + '<div class="grow">Watch reps <b id="wk-reps">' + (a.watch.reps || 0) + '</b><div class="tiny muted">Auto-counted from wrist motion · tap ✓ on the watch to log</div></div></div>';
    h += '</div>';
    h += '<div class="col" style="gap:10px"><div class="sets">';
    it.sets.forEach((s, k) => {
      const isCur = k === j; const u = a.u; const holding = hold && hold.i === a.cur && hold.j === k;
      h += '<div class="set' + (s.done ? ' done' : isCur ? ' cur' : '') + '"><div class="idx">' + (k + 1) + '</div>' +
        (unit === 'sec' ? '<div class="stepper" style="justify-content:center">' + (holding ? '<span class="num" id="hold-t" style="font-size:24px;color:var(--accent-2)">' + Math.max(0, Math.ceil(hold.secs - (Date.now() - hold.start) / 1000)) + 's</span>' : '<span class="small muted">' + (s.done ? 'held' : 'timed hold') + '</span>') + '</div>' : '<div class="stepper"><button data-a="wStep" data-i="' + a.cur + '" data-j="' + k + '" data-dir="-1">−</button><div class="vc"><input type="number" inputmode="decimal" value="' + (s.w == null ? '' : s.w) + '" placeholder="–" data-ch="wIn" data-i="' + a.cur + '" data-j="' + k + '"><span class="u">' + u + '</span></div><button data-a="wStep" data-i="' + a.cur + '" data-j="' + k + '" data-dir="1">+</button></div>') +
        '<div class="stepper"><button data-a="rStep" data-i="' + a.cur + '" data-j="' + k + '" data-dir="-1">−</button><div class="vc"><input type="number" inputmode="numeric" value="' + (s.r == null ? '' : s.r) + '" data-rin="' + a.cur + '-' + k + '" data-ch="rIn" data-i="' + a.cur + '" data-j="' + k + '"><span class="u">' + unit + '</span></div><button data-a="rStep" data-i="' + a.cur + '" data-j="' + k + '" data-dir="1">+</button></div>' +
        '<button class="check" data-a="toggleSet" data-i="' + a.cur + '" data-j="' + k + '"' + (holding ? ' style="background:var(--gold);color:#221"' : '') + '>' + (unit === 'sec' && !s.done && !holding ? I.timer : I.check) + '</button>';
      if (s.done) {
        const meta = [];
        if (s.hrAvg) meta.push('♥ avg ' + s.hrAvg + (s.hrMax ? ' · peak ' + s.hrMax : ''));
        if (s.hrr != null) meta.push('HR recovery −' + s.hrr + ' bpm/60s');
        if (s.tempo && s.tempo.length) meta.push('tempo ' + (s.tempo.reduce((x, y) => x + y, 0) / s.tempo.length / 1000).toFixed(1) + 's/rep');
        if (s.vloss != null) meta.push('speed drop ' + Math.round(s.vloss * 100) + '%' + (s.vloss > 0.3 ? ' — near failure' : ''));
        if (meta.length) h += '<div class="meta">' + meta.map(esc).join('<span class="dim">·</span>') + '</div>';
        if (st.settings.rpePrompt && (k === j - 1 || (j === it.sets.length && k === it.sets.length - 1) || s.rpe)) h += '<div class="rpe"><span class="tiny muted" style="align-self:center;width:34px;text-align:center">RPE</span>' + [6, 7, 8, 9, 10].map(v => '<button class="' + (s.rpe === v ? 'on' : '') + '" data-a="rpe" data-i="' + a.cur + '" data-j="' + k + '" data-v="' + v + '">' + v + '</button>').join('') + '</div>';
      }
      h += '</div>';
    });
    h += '</div><div class="row"><button class="btn sm ghost" data-a="addSet">' + I.plus + 'Set</button><button class="btn sm ghost" data-a="delSet">' + I.minus + 'Set</button><button class="btn sm ghost" data-a="wkSwap">' + I.swap + 'Swap</button><button class="btn sm ghost" data-a="wkAdd">' + I.plus + 'Exercise</button></div>';
    h += '<div class="tiny dim">RPE = effort (10 = no reps left). It sharpens your recovery map and next-session weights.</div></div></div></div>';
    h += '<div class="wk-foot"><button class="icon-btn" style="height:56px;width:56px;border-radius:16px" data-a="nextEx" data-dir="-1">' + I.back + '</button><button class="btn primary lg grow" data-a="finishAsk">Finish workout</button><button class="icon-btn" style="height:56px;width:56px;border-radius:16px" data-a="nextEx" data-dir="1">' + I.chev + '</button></div>';
    if (a.rest) {
      const left = a.rest.until - Date.now(); const C = 2 * Math.PI * 108; const nx = a.items[a.cur]; const ne = E.ex(nx.exId); const nj = F.curSetIdx(nx); const ns = nx.sets[Math.min(nj, nx.sets.length - 1)];
      h += '<div class="rest"><div class="tiny" style="letter-spacing:.2em;font-weight:700;color:var(--muted)">REST</div><div class="rest-ring"><svg width="240" height="240"><circle cx="120" cy="120" r="108" fill="none" stroke="var(--surface3)" stroke-width="10"/><circle id="rest-ring" cx="120" cy="120" r="108" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - Math.max(0, left) / (a.rest.total * 1000))) + '"/></svg><div class="t"><b id="rest-t">' + F.clock(left) + '</b><span class="small muted">of ' + F.clock(a.rest.total * 1000) + '</span></div></div>' +
        '<div class="row"><button class="btn" data-a="addRest" data-s="-15">−15s</button><button class="btn primary" data-a="skipRest">' + I.skip + 'Skip</button><button class="btn" data-a="addRest" data-s="30">+30s</button></div>' +
        '<div class="next-up">' + F.thumb(ne.id) + '<div class="grow"><div class="tiny muted" style="font-weight:700;letter-spacing:.1em">UP NEXT · SET ' + (nj + 1) + '</div><div style="font-weight:600" class="ellipsis">' + esc(ne.n) + '</div><div class="small muted">' + (ns && ns.w != null ? F.fmtW(ns.w) + ' ' + a.u + ' × ' : '') + (ns ? ns.r : '') + ' reps</div></div></div></div>';
    }
    return h + '</div>';
  }

  // ---------- Summary ----------
  function summaryScreen(top) {
    const st = S(); const s = st.sessions.find(x => x.id === top.id); if (!s) return '';
    const x = E.sessionStats(s); const vals = {}; const mx = Math.max(1, ...Object.values(x.mus)); for (const m in x.mus) vals[m] = x.mus[m] / mx;
    const ints = F.UI.integrations; const sv = ints.strava || {};
    let h = '<div class="screen">' + (top.past ? topbar(esc(s.title), '<button class="icon-btn" data-a="delSession" data-id="' + s.id + '" style="color:#ff8a8a">' + I.trash + '</button>') : '<div class="top"><h2>Workout complete</h2><button class="icon-btn" data-a="closeSummary">' + I.x + '</button></div>') + '<div class="body" data-scroll="sum"><div class="page">';
    if (!top.past) h += '<div class="celebrate"><div class="tiny muted" style="letter-spacing:.2em;font-weight:700">' + esc(s.title.toUpperCase()) + '</div><div class="big">+' + (s.xp || 0) + ' XP</div><div class="muted small" style="margin-top:6px">' + F.fmtDate(s.date) + '</div></div>';
    else h += '<div class="muted small">' + F.fmtDate(s.date) + ' · ' + new Date(s.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</div>';
    h += '<div class="stats"><div class="stat"><div class="num">' + x.dur + '</div><div class="lbl">Minutes</div></div><div class="stat"><div class="num">' + F.fmtVol(x.vol) + '</div><div class="lbl">' + (s.u || F.u()) + ' volume</div></div><div class="stat"><div class="num">' + x.sets + '</div><div class="lbl">Sets</div></div></div>';
    h += '<div class="grid two"><div class="col" style="gap:var(--gap)">';
    if ((s.prs || []).length) h += '<div class="card"><div class="card-h"><h3>Personal records</h3><span class="tag gold">🏆 ' + s.prs.length + '</span></div>' + s.prs.map(p => { const e = E.ex(p.exId); return '<div class="exrow">' + F.thumb(p.exId) + '<div class="grow"><div class="nm">' + esc(e ? e.n : p.exId) + '</div><div class="sub">' + (p.kind === 'e1rm' ? F.fmtW(p.w) + ' × ' + p.r + ' → e1RM ' + p.val : 'Heaviest: ' + F.fmtW(p.w)) + ' ' + (s.u || F.u()) + '</div></div></div>'; }).join('') + '</div>';
    const newA = (s.newAch || []).map(id => G.ACH.find(a => a.id === id)).filter(Boolean);
    if (newA.length) h += '<div class="card"><div class="card-h"><h3>Unlocked</h3></div><div class="ach-grid">' + newA.map(a => '<div class="ach new"><div class="em">' + a.icon + '</div><div class="t">' + esc(a.name) + '</div></div>').join('') + '</div></div>';
    if (s.xpLines) h += '<div class="card"><div class="card-h"><h3>XP earned</h3></div>' + s.xpLines.map(l => '<div class="xpline"><span>' + esc(l.k) + '</span><b>+' + l.v + '</b></div>').join('') + ((s.quests || []).length ? '<div class="xpline"><span>Quest complete</span><b>✓</b></div>' : '') + '</div>';
    h += F.energyCard(s.energy || window.Energy.strengthEnergy(s, st));
    if ((s.hr || []).length > 5) h += '<div class="card"><div class="card-h"><h3>Heart rate</h3><span class="small muted">avg ' + x.hrAvg + ' · max ' + x.hrMax + (s.hrSource === 'health' ? ' · from Samsung Health' : '') + '</span></div>' + F.lineChart(s.hr.map(p => [p[0], p[1]]), { color: 'var(--hot)' }) + '</div>';
    h += '</div><div class="col" style="gap:var(--gap)"><div class="card"><div class="card-h"><h3>Muscles worked</h3></div>' + F.bodyPair(vals, 'target') + '</div>';
    h += '<div class="card"><div class="card-h"><h3>Exercises</h3></div>' + s.items.map(it => { const e = E.ex(it.exId); return '<button class="exrow" data-a="ex" data-id="' + it.exId + '"><img class="thumb" style="width:44px;height:44px" src="' + E.img(it.exId, 0) + '"><div class="grow"><div class="nm ellipsis">' + esc(e ? e.n : it.exId) + '</div><div class="sub">' + it.sets.map(z => F.fmtW(z.w) + '×' + z.r + (z.rpe ? '@' + z.rpe : '')).join('  ') + '</div></div></button>'; }).join('') + '</div>';
    const syn = s.synced || {};
    h += '<div class="card"><div class="card-h"><h3>Sync</h3></div><div class="list">' +
      '<div class="li"><span style="font-size:22px">💙</span><div class="grow">Samsung Health</div>' + (syn.hc ? '<span class="tag fresh">Saved</span>' : st.settings.hcGranted ? '<button class="btn sm" data-a="syncNow" data-id="' + s.id + '" data-which="hc">Save</button>' : '<button class="btn sm ghost" data-a="connectHealth">Connect</button>') + '</div>' +
      '<div class="li"><span style="font-size:22px">🧡</span><div class="grow">Strava</div>' + (syn.strava ? '<span class="tag fresh">Uploaded</span>' : sv.connected ? '<button class="btn sm" data-a="syncNow" data-id="' + s.id + '" data-which="strava">Upload</button>' : '<button class="btn sm ghost" data-a="stravaSetup">Set up</button>') + '</div></div></div>';
    h += '</div></div>';
    if (!top.past) h += '<button class="btn primary lg block" data-a="closeSummary">Done</button>';
    return h + '</div></div></div>';
  }
  A.closeSummary = () => { F.UI.stack = []; F.UI.tab = 'home'; F.render(); };
  A.delSession = d => { if (!confirm('Delete this workout from history? XP already earned is kept.')) return; const st = S(); st.sessions = st.sessions.filter(s => s.id !== d.id); F.save(); F.pop(); };

  // ---------- Plan settings ----------
  function planSettingsScreen() {
    const p = F.UI.psDraft || (F.UI.psDraft = JSON.parse(JSON.stringify(S().profile)));
    let h = '<div class="screen">' + topbar('Goals &amp; schedule') + '<div class="body" data-scroll="ps"><div class="page" style="max-width:720px">';
    h += section('Goal', goalOpts(p, 'ps'));
    h += section('Training days', dayPick(p, 'ps') + '<div class="small muted" style="margin-top:8px">' + p.days.length + ' days → ' + esc(E.SPLIT_LABEL[E.autoSplit(p.days.length, p.experience)]) + ' recommended</div>');
    h += section('Split', '<div class="chips wrap">' + ['auto', 'full', 'ul', 'ppl', 'bro'].map(k => '<button class="chip ' + ((p.split || 'auto') === k ? 'on' : '') + '" data-a="psSet" data-k="split" data-v="' + k + '">' + (k === 'auto' ? 'Auto' : E.SPLIT_LABEL[k]) + '</button>').join('') + '</div>');
    h += section('Session length', '<div class="seg">' + [30, 45, 60, 75, 90].map(m => '<button class="' + (p.sessionMin === m ? 'on' : '') + '" data-a="psSet" data-k="sessionMin" data-v="' + m + '" data-num="1">' + m + '′</button>').join('') + '</div>');
    h += section('Experience', '<div class="seg">' + ['beginner', 'intermediate', 'advanced'].map(m => '<button class="' + (p.experience === m ? 'on' : '') + '" data-a="psSet" data-k="experience" data-v="' + m + '">' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '</div>');
    h += section('Equipment', equipPick(p, 'ps'));
    h += section('Focus muscles (extra volume)', focusPick(p, 'ps'));
    h += '</div></div><div class="foot"><button class="btn ghost" data-a="back">Cancel</button><button class="btn primary grow" data-a="psSave">Save &amp; rebuild plan</button></div></div>';
    return h;
  }
  const section = (t, body) => '<div class="card"><div class="card-h"><h3>' + t + '</h3></div>' + body + '</div>';
  const GOAL_IC = { hypertrophy: '💪', strength: '🏋️', fatloss: '🔥', endurance: '🫀', general: '⚡' };
  const GOAL_SUB = { hypertrophy: '6–15 reps, moderate rest, high weekly volume', strength: '4–6 reps on big lifts, long rest', fatloss: 'Denser sessions, shorter rest', endurance: '12–20 reps, short rest', general: 'Balanced strength & muscle' };
  function goalOpts(p, ns) { return Object.keys(E.GOALS).map(g => '<button class="opt ' + (p.goal === g ? 'on' : '') + '" data-a="' + ns + 'Set" data-k="goal" data-v="' + g + '"><div class="oi">' + GOAL_IC[g] + '</div><div><b>' + E.GOALS[g].label + '</b><span>' + GOAL_SUB[g] + '</span></div></button>').join(''); }
  function dayPick(p, ns) { return '<div class="daypick">' + F.DOW_ORDER.map(d => '<button class="' + (p.days.includes(d) ? 'on' : '') + '" data-a="' + ns + 'Day" data-d="' + d + '">' + F.DOW[d].slice(0, 2) + '</button>').join('') + '</div>'; }
  const EQ_KEYS = ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'smith', 'pullupbar', 'kettlebell', 'ezbar', 'band', 'bodyweight'];
  function equipPick(p, ns) { return '<div class="chips wrap">' + EQ_KEYS.map(k => '<button class="chip ' + (p.equipment.includes(k) ? 'on' : '') + '" data-a="' + ns + 'Eq" data-k="' + k + '">' + E.EQUIPMENT[k] + '</button>').join('') + '</div><div class="row" style="margin-top:10px"><button class="btn sm ghost" data-a="' + ns + 'EqPreset" data-p="gym">Full gym</button><button class="btn sm ghost" data-a="' + ns + 'EqPreset" data-p="home">Home dumbbells</button><button class="btn sm ghost" data-a="' + ns + 'EqPreset" data-p="min">Bodyweight + bands</button></div>'; }
  function focusPick(p, ns) { return '<div class="chips wrap">' + E.MAJOR.map(m => '<button class="chip ' + ((p.focus || []).includes(m) ? 'on' : '') + '" data-a="' + ns + 'Focus" data-m="' + m + '">' + F.mLabel(m) + '</button>').join('') + '</div>'; }
  const PRESETS = { gym: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'smith', 'pullupbar', 'kettlebell', 'ezbar', 'band', 'bodyweight'], home: ['dumbbell', 'bench', 'band', 'bodyweight', 'pullupbar'], min: ['bodyweight', 'band'] };
  function mkSetters(ns, get) {
    A[ns + 'Set'] = d => { get()[d.k] = d.num ? +d.v : d.v; F.render(); };
    A[ns + 'Day'] = d => { const p = get(); const v = +d.d; const i = p.days.indexOf(v); i >= 0 ? p.days.splice(i, 1) : p.days.push(v); F.render(); };
    A[ns + 'Eq'] = d => { const p = get(); const i = p.equipment.indexOf(d.k); i >= 0 ? p.equipment.splice(i, 1) : p.equipment.push(d.k); F.render(); };
    A[ns + 'EqPreset'] = d => { get().equipment = PRESETS[d.p].slice(); F.render(); };
    A[ns + 'Focus'] = d => { const p = get(); p.focus = p.focus || []; const i = p.focus.indexOf(d.m); i >= 0 ? p.focus.splice(i, 1) : (p.focus.length < 3 ? p.focus.push(d.m) : F.toast('Pick up to 3')); F.render(); };
  }
  mkSetters('ps', () => F.UI.psDraft);
  mkSetters('ob', () => F.UI.obDraft);
  A.psSave = () => {
    const p = F.UI.psDraft; if (!p.days.length) { F.toast('Pick at least one training day'); return; }
    if (!p.equipment.length) p.equipment = ['bodyweight'];
    S().profile = p; F.UI.psDraft = null; F.regenerate(false); F.UI.stack = []; F.UI.tab = 'plan'; F.toast('Plan rebuilt'); F.render();
  };

  // ---------- Sheets ----------
  V.sheet = sh => {
    const st = S();
    if (F.sheets && F.sheets[sh.t]) return F.sheets[sh.t](sh);
    if (sh.t === 'startOther') {
      return '<h2 style="margin-bottom:12px">Choose a workout</h2>' + st.plan.days.map((d, i) => '<button class="opt" data-a="start" data-idx="' + i + '"><div class="oi">' + I.play.replace('<svg', '<svg width="20" height="20" style="color:var(--accent)"') + '</div><div class="grow"><b>' + esc(d.title) + '</b><span>' + d.items.length + ' exercises · ~' + F.dayMinutes(d) + ' min · ' + esc(F.musclesTxt(F.dayMuscles(d))) + '</span></div></button>').join('') + recommendFresh();
    }
    if (sh.t === 'swap') {
      const exId = sh.mode === 'plan' ? st.plan.days[sh.d].items[sh.i].exId : st.active.items[sh.i].exId;
      const alts = E.alternatives(exId, st.profile, 14);
      return '<h2>Swap exercise</h2><div class="small muted" style="margin:4px 0 10px">Same main muscle, with your equipment</div>' + alts.map(e => '<button class="exrow" data-a="doSwap" data-id="' + e.id + '">' + F.thumb(e.id) + '<div class="grow"><div class="nm">' + esc(e.n) + '</div><div class="sub">' + esc(E.EQUIPMENT[e.eq]) + ' · ' + esc(e.pm.concat(e.sm).slice(0, 3).map(F.mLabel).join(', ')) + '</div></div></button>').join('') + '<button class="btn ghost block" style="margin-top:10px" data-a="swapSearch">' + I.search + 'Search all exercises</button>';
    }
    if (sh.t === 'pick') {
      const q = (sh.q || '').toLowerCase();
      let list = E.all().filter(e => E.hasEquip(e, st.profile.equipment) && (!q || e.n.toLowerCase().includes(q) || e.pm.some(m => F.mLabel(m).toLowerCase().includes(q))));
      list.sort((a, b) => b.t - a.t || a.n.localeCompare(b.n));
      return '<h2>' + (sh.replace ? 'Replace with' : 'Add exercise') + '</h2><input class="input" style="margin:10px 0" placeholder="Search by name or muscle" value="' + esc(sh.q || '') + '" data-in="pickQ" autofocus><div id="pick-list">' + pickRows(list.slice(0, 60)) + '</div>';
    }
    if (sh.t === 'editItem') {
      const it = st.plan.days[sh.d].items[sh.i]; const e = E.ex(it.exId);
      const stp = (k, lbl, step, suffix) => '<div class="li"><div class="grow">' + lbl + '</div><div class="stepper" style="width:150px"><button data-a="itemStep" data-k="' + k + '" data-s="' + (-step) + '">−</button><div class="vc"><span class="num" style="font-size:22px">' + it[k] + '</span><span class="u">' + suffix + '</span></div><button data-a="itemStep" data-k="' + k + '" data-s="' + step + '">+</button></div></div>';
      return '<div class="row" style="margin-bottom:10px">' + F.thumb(e.id) + '<div><h2 style="font-size:19px">' + esc(e.n) + '</h2><div class="small muted">Customize sets, reps and rest</div></div></div><div class="list">' + stp('sets', 'Sets', 1, 'sets') + stp('repMin', 'Min reps', 1, 'reps') + stp('repMax', 'Max reps', 1, 'reps') + stp('rest', 'Rest', 15, 'sec') + '</div><button class="btn primary block" style="margin-top:14px" data-a="closeSheet">Done</button>';
    }
    if (sh.t === 'addToDay') {
      return '<h2 style="margin-bottom:12px">Add to which workout?</h2>' + st.plan.days.map((d, i) => '<button class="opt" data-a="doAddToDay" data-idx="' + i + '" data-id="' + sh.id + '"><div class="oi">' + I.plus + '</div><div><b>' + esc(d.title) + '</b><span>' + d.items.length + ' exercises</span></div></button>').join('');
    }
    if (sh.t === 'wkList') {
      const a = st.active;
      return '<h2 style="margin-bottom:8px">Exercises</h2>' + a.items.map((it, i) => { const e = E.ex(it.exId); const d = it.sets.filter(s => s.done).length; return '<button class="exrow" data-a="curEx" data-i="' + i + '">' + F.thumb(it.exId) + '<div class="grow"><div class="nm" style="' + (i === a.cur ? 'color:var(--accent-2)' : '') + '">' + esc(e.n) + '</div><div class="sub">' + d + ' / ' + it.sets.length + ' sets</div></div>' + (d === it.sets.length ? '<span class="tag fresh">Done</span>' : '') + '</button>'; }).join('') + '<button class="btn danger block" style="margin-top:14px" data-a="discard">Discard workout</button>';
    }
    if (sh.t === 'finish') {
      const a = st.active; const done = a.items.reduce((x, it) => x + it.sets.filter(s => s.done).length, 0); const tot = a.items.reduce((x, it) => x + it.sets.length, 0);
      return '<h2>Finish workout?</h2><p class="muted">' + done + ' of ' + tot + ' sets logged' + (done < tot ? ' — unlogged sets won’t be saved.' : '. Every set done. 🔥') + '</p>' + (st.settings.hcGranted && st.settings.autoHc ? '<div class="small muted" style="margin-bottom:6px">💙 Will save to Samsung Health</div>' : '') + (st.settings.autoStrava && (F.UI.integrations.strava || {}).connected ? '<div class="small muted" style="margin-bottom:6px">🧡 Will upload to Strava</div>' : '') + '<div class="row" style="margin-top:12px"><button class="btn ghost grow" data-a="closeSheet">Keep going</button><button class="btn primary grow" data-a="finish">Finish &amp; save</button></div>';
    }
    if (sh.t === 'strava') {
      return '<h2>Connect Strava</h2><p class="small muted">Strava requires every app to use its own free API keys. One-time setup (≈2 min):</p><ol class="steps small"><li>Open <b>strava.com/settings/api</b> and create an app (any name, e.g. “Forge”).</li><li>Set <b>Authorization Callback Domain</b> to <b>localhost</b>.</li><li>Copy the <b>Client ID</b> and <b>Client Secret</b> below.</li></ol><button class="btn sm ghost" style="margin-bottom:12px" data-a="openStravaApi">Open strava.com/settings/api</button><div class="col"><div class="field"><label>Client ID</label><input class="input" id="sv-id" inputmode="numeric" placeholder="e.g. 123456"></div><div class="field"><label>Client Secret</label><input class="input" id="sv-secret" placeholder="40-character secret"></div></div><button class="btn primary block" style="margin-top:14px" data-a="stravaSave">Save &amp; connect</button><p class="tiny dim" style="margin-top:10px">Keys are stored only on this phone.</p>';
    }
    return '';
  };
  function recommendFresh() {
    const st = S(); const fat = F.fatigue();
    const scored = st.plan.days.map((d, i) => { const v = F.dayMuscles(d); const ms = Object.keys(v).filter(m => v[m] >= 0.5); const avg = ms.length ? ms.reduce((a, m) => a + fat[m], 0) / ms.length : 0; return { i, avg, d }; }).sort((a, b) => a.avg - b.avg);
    const b = scored[0]; if (!b) return '';
    return '<div class="small muted" style="margin-top:6px">💡 Freshest option right now: <b style="color:var(--text)">' + esc(b.d.title) + '</b> (target muscles ' + Math.round(100 - b.avg) + '% recovered)</div>';
  }
  function pickRows(list) { return list.map(e => '<button class="exrow" data-a="doPick" data-id="' + e.id + '"><img class="thumb" loading="lazy" src="' + E.img(e.id, 0) + '"><div class="grow"><div class="nm ellipsis">' + esc(e.n) + '</div><div class="sub">' + esc(E.EQUIPMENT[e.eq]) + ' · ' + esc(e.pm.map(F.mLabel).join(', ')) + '</div></div>' + I.plus.replace('<svg', '<svg width="20" height="20" style="color:var(--accent)"') + '</button>').join(''); }
  let pickT = null;
  A.pickQ = (d, el) => { F.UI.sheet.q = el.value; clearTimeout(pickT); pickT = setTimeout(() => { const st = S(); const q = el.value.toLowerCase(); let list = E.all().filter(e => E.hasEquip(e, st.profile.equipment) && (!q || e.n.toLowerCase().includes(q) || e.pm.some(m => F.mLabel(m).toLowerCase().includes(q)))); list.sort((a, b) => b.t - a.t || a.n.localeCompare(b.n)); const box = document.getElementById('pick-list'); if (box) box.innerHTML = pickRows(list.slice(0, 60)); }, 180); };
  A.swapSearch = () => { const sh = F.UI.sheet; F.sheet(Object.assign({}, sh, { t: 'pick', replace: true })); };
  A.doSwap = d => applySwap(F.UI.sheet, d.id);
  function applySwap(sh, id) {
    const st = S();
    if (sh.mode === 'plan') { st.plan.days[sh.d].items[sh.i].exId = id; }
    else { const it = st.active.items[sh.i]; const sug = E.suggest(st.sessions, { exId: id, repMin: it.repMin, repMax: it.repMax, sets: it.sets.length }, F.u()); it.exId = id; it.note = sug.note; it.sets.forEach(s => { if (!s.done) { s.w = sug.w; s.r = sug.r; } }); F.syncWatch(); }
    F.save(); F.UI.sheet = null; F.render();
  }
  A.doPick = d => {
    const sh = F.UI.sheet; const st = S(); const e = E.ex(d.id);
    if (sh.replace) return applySwap(sh, d.id);
    const sc = e.f === 'stat' ? { sets: 3, repMin: 30, repMax: 60, rest: 60 } : E.scheme(st.profile.goal, st.profile.experience, e.mech === 'c');
    if (sh.mode === 'plan') { st.plan.days[sh.d].items.push(Object.assign({ exId: e.id, m: e.pm[0] }, sc)); F.toast('Added ' + e.n); }
    else { const sug = E.suggest(st.sessions, Object.assign({ exId: e.id }, sc), F.u()); st.active.items.push({ exId: e.id, repMin: sc.repMin, repMax: sc.repMax, rest: sc.rest, note: sug.note, sets: Array.from({ length: sc.sets }, () => ({ w: sug.w, r: sug.r, done: false })) }); st.active.cur = st.active.items.length - 1; F.syncWatch(); }
    F.save(); F.UI.sheet = null; F.render();
  };
  A.itemStep = d => { const sh = F.UI.sheet; const it = S().plan.days[sh.d].items[sh.i]; const lim = { sets: [1, 10], repMin: [1, 50], repMax: [1, 50], rest: [15, 600] }[d.k]; it[d.k] = Math.max(lim[0], Math.min(lim[1], it[d.k] + (+d.s))); if (it.repMax < it.repMin) { if (d.k === 'repMin') it.repMax = it.repMin; else it.repMin = it.repMax; } F.save(); F.render(); };
  A.doAddToDay = d => { const st = S(); const e = E.ex(d.id); const sc = e.f === 'stat' ? { sets: 3, repMin: 30, repMax: 60, rest: 60 } : E.scheme(st.profile.goal, st.profile.experience, e.mech === 'c'); st.plan.days[+d.idx].items.push(Object.assign({ exId: e.id, m: e.pm[0] }, sc)); F.save(); F.UI.sheet = null; F.toast('Added to ' + st.plan.days[+d.idx].title); F.render(); };
  A.openStravaApi = () => window.Bridge.call('app.openUrl', { url: 'https://www.strava.com/settings/api' }).catch(() => { });
  A.stravaSave = async () => {
    const id = (document.getElementById('sv-id') || {}).value, sec = (document.getElementById('sv-secret') || {}).value;
    if (!id || !sec) { F.toast('Enter both Client ID and Secret'); return; }
    try { await window.Bridge.call('strava.configure', { clientId: id.trim(), clientSecret: sec.trim() }); F.closeSheet(); await window.Bridge.call('strava.connect', {}); } catch (e) { F.toast(e.message); }
  };

  // ---------- Onboarding ----------
  const OB_STEPS = ['welcome', 'goal', 'exp', 'days', 'equip', 'focus', 'body'];
  V.onboarding = () => {
    const UI = F.UI;
    if (!UI.obDraft) UI.obDraft = { name: '', goal: 'hypertrophy', experience: 'intermediate', days: [1, 3, 5], sessionMin: 60, split: 'auto', equipment: PRESETS.gym.slice(), focus: [], units: 'kg', bodyweight: null, age: null, sex: 'm', favorites: [], blocked: [] };
    const p = UI.obDraft; const step = OB_STEPS[UI.ob];
    if (UI.obBuilding) return '<div class="splash"><div class="forge-anim"></div><h2>Forging your plan…</h2><div class="muted small">Matching ' + E.all().length + ' exercises to your goals & gear</div></div>';
    let body = '', cta = 'Continue';
    if (step === 'welcome') { body = '<div style="padding-top:8vh"><div class="logo" style="font-size:44px">FORGE<b>.</b></div><h1 style="margin-top:22px">Train smarter.<br>Recover harder.</h1><p class="muted" style="font-size:16px">A planner that reads your Galaxy Watch and Samsung Health, tracks every muscle’s recovery, and adapts each session — with XP, streaks and quests to keep you coming back.</p><div class="field" style="margin-top:24px"><label>What should we call you?</label><input class="input" placeholder="Your name" value="' + esc(p.name) + '" data-ch="obName"></div></div>'; cta = 'Let’s build your plan'; }
    if (step === 'goal') body = '<h1>Main goal</h1><p class="muted">Sets your rep ranges, rest and weekly volume.</p>' + goalOpts(p, 'ob');
    if (step === 'exp') body = '<h1>Experience</h1><p class="muted">How long have you been lifting consistently?</p>' + [['beginner', '🌱', 'Under 1 year', 'Simpler moves, fewer sets to start'], ['intermediate', '🔩', '1–3 years', 'Standard volume, varied exercises'], ['advanced', '⚙️', '3+ years', 'Extra volume on compound lifts']].map(([k, ic, t, s]) => '<button class="opt ' + (p.experience === k ? 'on' : '') + '" data-a="obSet" data-k="experience" data-v="' + k + '"><div class="oi">' + ic + '</div><div><b>' + t + '</b><span>' + s + '</span></div></button>').join('');
    if (step === 'days') body = '<h1>Schedule</h1><p class="muted">Pick the days you’ll train. Workouts are planned on exactly these days.</p>' + dayPick(p, 'ob') + '<div class="small muted" style="margin:10px 0 24px">' + p.days.length + ' days/week → <b style="color:var(--text)">' + E.SPLIT_LABEL[E.autoSplit(p.days.length, p.experience)] + '</b></div><div class="field"><label>Session length</label><div class="seg">' + [30, 45, 60, 75, 90].map(m => '<button class="' + (p.sessionMin === m ? 'on' : '') + '" data-a="obSet" data-k="sessionMin" data-v="' + m + '" data-num="1">' + m + ' min</button>').join('') + '</div></div>';
    if (step === 'equip') body = '<h1>Your gear</h1><p class="muted">Only exercises you can actually do will be planned.</p>' + equipPick(p, 'ob');
    if (step === 'focus') body = '<h1>Priorities</h1><p class="muted">Optional: up to 3 muscles to give extra volume.</p>' + focusPick(p, 'ob');
    if (step === 'body') { body = '<h1>About you</h1><p class="muted">Used for calorie estimates and bodyweight milestones.</p><div class="col" style="gap:14px"><div class="field"><label>Units</label><div class="seg"><button class="' + (p.units === 'kg' ? 'on' : '') + '" data-a="obSet" data-k="units" data-v="kg">kg</button><button class="' + (p.units === 'lb' ? 'on' : '') + '" data-a="obSet" data-k="units" data-v="lb">lb</button></div></div><div class="row"><div class="field grow"><label>Height (' + (p.units === 'lb' ? 'in' : 'cm') + ')</label><input class="input" type="number" inputmode="decimal" value="' + (p.heightIn || '') + '" data-ch="obH"></div><div class="field grow"><label>Bodyweight (' + p.units + ')</label><input class="input" type="number" inputmode="decimal" value="' + (p.bodyweight || '') + '" data-ch="obBw"></div><div class="field grow"><label>Age</label><input class="input" type="number" inputmode="numeric" value="' + (p.age || '') + '" data-ch="obAge"></div></div><div class="field"><label>Sex (for calorie formula)</label><div class="seg"><button class="' + (p.sex === 'm' ? 'on' : '') + '" data-a="obSet" data-k="sex" data-v="m">Male</button><button class="' + (p.sex === 'f' ? 'on' : '') + '" data-a="obSet" data-k="sex" data-v="f">Female</button></div></div></div>'; cta = 'Forge my plan'; }
    return '<div class="ob"><div class="ob-top">' + OB_STEPS.map((s, i) => '<i class="' + (i <= UI.ob ? 'on' : '') + '"></i>').join('') + '</div><div class="ob-body" data-scroll="ob">' + body + '</div><div class="ob-foot">' + (UI.ob > 0 ? '<button class="btn ghost" data-a="obBack">Back</button>' : '') + '<button class="btn primary lg grow" data-a="obNext">' + cta + '</button></div></div>';
  };
  A.obName = (d, el) => { F.UI.obDraft.name = el.value.trim(); };
  A.obBw = (d, el) => { F.UI.obDraft.bodyweight = parseFloat(el.value) || null; };
  A.obAge = (d, el) => { F.UI.obDraft.age = parseInt(el.value, 10) || null; };
  A.obH = (d, el) => { const v = parseFloat(el.value); F.UI.obDraft.heightIn = v || null; F.UI.obDraft.height = v ? (F.UI.obDraft.units === 'lb' ? v * 2.54 : v) : null; };
  A.obBack = () => { F.UI.ob = Math.max(0, F.UI.ob - 1); F.render(); };
  A.obNext = () => {
    const UI = F.UI; const p = UI.obDraft; const step = OB_STEPS[UI.ob];
    const nm = document.querySelector('[data-ch="obName"]'); if (nm) p.name = nm.value.trim();
    if (step === 'days' && !p.days.length) { F.toast('Pick at least one day'); return; }
    if (step === 'equip' && !p.equipment.length) p.equipment = ['bodyweight'];
    if (UI.ob < OB_STEPS.length - 1) { UI.ob++; F.render(); return; }
    ['obBw', 'obAge', 'obH'].forEach(k => { const el = document.querySelector('[data-ch="' + k + '"]'); if (el) A[k]({}, el); });
    UI.obBuilding = true; F.render();
    setTimeout(() => {
      const st = S(); st.profile = p; st.plan = E.generatePlan(p); UI.obDraft = null; UI.obBuilding = false; UI.ob = 0; F.save(true);
      F.render(); F.toast('Your plan is ready 🔥');
    }, 1300);
  };
})();
