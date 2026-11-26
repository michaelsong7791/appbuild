/* Forge v1.9 — warm-up sets, deload weeks, supersets, pain flags, automatic backups, home-screen widget,
   progress photos and the monthly report. */
(function () {
  'use strict';
  const E = window.Engine, G = window.Game, F = window.F, A = F.actions, B = window.Bridge, I = window.I, esc = F.esc, V = F.views;
  const S = () => F.S();
  const DAY = 864e5;
  const ago = t => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

  // =====================================================================
  // WARM-UP SETS
  // =====================================================================
  /** Ramp-up sets before the first heavy compound for each main muscle. Kept in item.warm — never counted as work. */
  F.addWarmups = (items, st) => {
    if (st.settings.warmups === false) return;
    const seen = new Set(); const u = F.u(); const kg = u !== 'lb';
    items.forEach(it => {
      const e = E.ex(it.exId); if (!e || it.unit === 'sec' || E.noLoad(e) || e.mech !== 'c') return;
      const w = it.sets[0] && it.sets[0].w; if (!(w > 0)) return;
      const g = e.pm[0]; if (seen.has(g)) return; seen.add(g);
      const barbell = e.eq === 'barbell' || e.eq === 'ezbar';
      const heavy = barbell ? w >= (kg ? 40 : 95) : e.eq === 'dumbbell' || e.eq === 'kettlebell' ? w >= (kg ? 16 : 35) : w >= (kg ? 40 : 90);
      if (!heavy) return;
      const inc = E.increment(e, u) || (kg ? 2.5 : 5); const bar = e.eq === 'barbell' ? (kg ? 20 : 45) : e.eq === 'ezbar' ? (kg ? 10 : 20) : 0;
      const rnd = x => Math.max(bar, E.round(x, inc));
      const steps = barbell ? [[bar, 10], [0.5, 5], [0.7, 3]] : [[0.5, 8], [0.75, 4]];
      if (e.eq === 'barbell' && w >= (kg ? 100 : 225)) steps.push([0.85, 1]);
      const warm = [];
      steps.forEach(([f, r]) => { const ww = f > 1 ? f : rnd(w * f); if (!(ww > 0) || ww >= w) return; if (warm.length && warm[warm.length - 1].w >= ww) return; warm.push({ w: ww, r, done: false }); });
      if (warm.length) it.warm = warm;
    });
  };
  const warmLeft = it => (it.warm || []).findIndex(x => !x.done);
  F.warmPending = it => !!(it && it.warm && warmLeft(it) >= 0 && !it.sets.some(s => s.done) && !it.warmSkip);
  A.warmToggle = d => { const a = S().active; const w = a.items[+d.i].warm[+d.k]; w.done = !w.done; B.vibrate(30); F.save(); F.render(); };
  A.logWarm = () => { const a = S().active; const it = a.items[a.cur]; const k = warmLeft(it); if (k < 0) return; it.warm[k].done = true; B.vibrate(30); F.save(); F.render(); if (warmLeft(it) < 0) F.toast('Warm-up done — working sets next'); };
  A.skipWarm = () => { const a = S().active; a.items[a.cur].warmSkip = true; F.save(); F.render(); };
  F.warmBlock = (a, it, wu) => {
    if (!it.warm || !it.warm.length || it.warmSkip) return '';
    const pend = warmLeft(it);
    return '<div class="warm"><div class="row between"><span class="tiny" style="font-weight:800;letter-spacing:.12em;color:var(--info)">WARM-UP' + (pend < 0 ? ' ✓' : '') + '</span>' + (pend >= 0 && !it.sets.some(s => s.done) ? '<button class="link-btn tiny" data-a="skipWarm">Skip</button>' : '') + '</div><div class="row wrap" style="gap:6px;margin-top:6px">' +
      it.warm.map((x, k) => '<button class="wchip' + (x.done ? ' done' : k === pend ? ' cur' : '') + '" data-a="warmToggle" data-i="' + a.cur + '" data-k="' + k + '">' + (x.done ? '✓ ' : '') + F.fmtW(x.w) + ' × ' + x.r + '</button>').join('') + '</div><div class="tiny muted" style="margin-top:6px">Easy ramp-up sets — not counted as work. No need to rest long between them.</div></div>';
  };

  // =====================================================================
  // DELOAD WEEKS
  // =====================================================================
  const realSessions = st => st.sessions.filter(s => !s.addon && !s.oneoff);
  F.deloadActive = () => {
    const st = S(); const d = st.deload; if (!d) return false;
    if (Date.now() >= d.end) { st.deloadLast = d.end; delete st.deload; F.save(); return false; }
    return true;
  };
  /** Is a deload week due? → { reason } or null */
  F.deloadDue = () => {
    const st = S(); if (st.settings.deload === false || F.deloadActive()) return null;
    if (st.deloadSnooze && Date.now() < st.deloadSnooze) return null;
    const rs = realSessions(st); if (rs.length < 8) return null;
    const anchor = Math.max(st.deloadLast || 0, Math.min(...rs.map(x => x.date)));
    const weeks = (Date.now() - anchor) / (7 * DAY); const since = rs.filter(s => s.date >= anchor).length;
    const every = st.settings.deloadWeeks || 6;
    if (weeks >= every && since >= 8) return { reason: Math.floor(weeks) + ' weeks of hard training since your last easy week' };
    // stalls: main lifts with ≥5 rated sessions and no e1RM progress
    if (weeks >= 3 && window.Load) {
      const ids = new Set(); st.plan.days.forEach(dd => dd.items.forEach(it => { if (it.main) ids.add(it.exId); }));
      const stalled = [...ids].filter(id => { const o = window.Load.ownE1rm(rs, id, st.profile.units); return o && o.slope != null && o.slope <= 0.005 && o.n >= 5; });
      if (stalled.length >= 2) return { reason: stalled.length + ' main lifts have stalled (' + stalled.slice(0, 2).map(id => E.ex(id).n).join(', ') + ')' };
    }
    return null;
  };
  A.deloadStart = () => { const st = S(); st.deload = { start: Date.now(), end: E.startOfDay(Date.now()) + 7 * DAY }; delete st.deloadSnooze; F.save(); F.toast('Deload week started — lighter weights, fewer sets for 7 days'); F.render(); };
  A.deloadSnooze = () => { S().deloadSnooze = Date.now() + 7 * DAY; F.save(); F.render(); };
  A.deloadEnd = () => { const st = S(); st.deloadLast = Date.now(); delete st.deload; F.save(); F.toast('Deload ended — back to normal training'); F.render(); };

  // =====================================================================
  // PAIN / INJURY FLAGS
  // =====================================================================
  const pain = () => { const st = S(); st.profile.pain = st.profile.pain || {}; const p = st.profile.pain; for (const m in p) if (p[m].lvl === 'sore' && Date.now() - p[m].t > 5 * DAY) delete p[m]; return p; };
  F.applyPain = (items, st, notes) => {
    const p = pain(); const inj = Object.keys(p).filter(m => p[m].lvl === 'injured'); const sore = Object.keys(p).filter(m => p[m].lvl === 'sore');
    if (!inj.length && !sore.length) return items;
    const used = new Set(items.map(i => i.exId)); const out = [];
    items.forEach(it => {
      const e = E.ex(it.exId); if (!e) { out.push(it); return; }
      const inv = E.involvement(e);
      const hit = inj.filter(m => e.pm.includes(m) || (inv[m] || 0) >= 0.5);
      if (hit.length) {
        const alt = E.alternatives(it.exId, st.profile, 40).find(x => !used.has(x.id) && !x.pm.some(m => inj.includes(m)) && inj.every(m => (E.involvement(x)[m] || 0) < 0.25));
        const lbl = hit.map(F.mLabel).join(' & ');
        if (alt) { used.add(alt.id); out.push(Object.assign({}, it, { exId: alt.id, alias: null, painNote: '🩹 Swapped in for ' + e.n + ' — your ' + lbl + ' is flagged injured.' })); }
        else notes.push(e.n + ' skipped (' + lbl + ' injured)');
        return;
      }
      const s = sore.find(m => e.pm.includes(m));
      out.push(s ? Object.assign({}, it, { painSore: F.mLabel(s) }) : it);
    });
    return out;
  };
  F.painButtons = m => {
    const cur = (pain()[m] || {}).lvl || 'ok';
    return '<div class="tiny muted" style="margin:14px 0 6px;font-weight:700;letter-spacing:.08em">HOW DOES IT FEEL?</div><div class="seg">' +
      [['ok', 'Fine'], ['sore', '😣 Sore'], ['injured', '🩹 Injured']].map(([k, l]) => '<button class="' + (cur === k ? 'on' : '') + '" data-a="painSet" data-m="' + m + '" data-v="' + k + '">' + l + '</button>').join('') +
      '</div><div class="tiny dim" style="margin-top:6px">Sore: that muscle\'s exercises get 1 fewer set and ~10% less weight for up to 5 days. Injured: exercises that load it are swapped or skipped until you clear it. Not medical advice — see a professional for real pain.</div>';
  };
  A.painSet = d => { const p = pain(); if (d.v === 'ok') delete p[d.m]; else p[d.m] = { lvl: d.v, t: Date.now() }; F.save(); F.toast(d.v === 'ok' ? F.mLabel(d.m) + ' cleared' : F.mLabel(d.m) + ' flagged ' + d.v); F.render(); };
  F.painCard = () => {
    const p = pain(); const ks = Object.keys(p); if (!ks.length) return '';
    return '<div class="card"><div class="card-h"><h3>Pain flags</h3></div><div class="list">' + ks.map(m => '<div class="li"><div class="grow"><b>' + esc(F.mLabel(m)) + '</b><div class="small muted">' + (p[m].lvl === 'injured' ? '🩹 Injured — exercises loading it are swapped' : '😣 Sore — eased for up to 5 days') + ' · since ' + ago(p[m].t) + '</div></div><button class="btn sm" data-a="painSet" data-m="' + m + '" data-v="ok">Clear</button></div>').join('') + '</div></div>';
  };

  // =====================================================================
  // TODAY: deload + pain banners
  // =====================================================================
  F.todayExtras = () => {
    const st = S(); let h = '';
    if (F.deloadActive()) {
      const dd = st.deload; const day = Math.min(7, Math.floor((Date.now() - dd.start) / DAY) + 1);
      h += '<div class="card tight row" style="background:color-mix(in oklab,var(--info) 12%,var(--surface))"><div style="font-size:28px">🌊</div><div class="grow"><b>Deload week · day ' + day + ' of 7</b><div class="small muted">~10% lighter, about 40% fewer sets. Recover, keep the habit — strength comes back stronger.</div></div><button class="btn sm ghost" data-a="deloadEnd">End early</button></div>';
    } else {
      const due = F.deloadDue();
      if (due) h += '<div class="card tight"><div class="row"><div style="font-size:28px">🌊</div><div class="grow"><b>Time for a deload week</b><div class="small muted">' + esc(due.reason) + '. A lighter week lets fatigue clear so progress resumes.</div></div></div><div class="row" style="gap:8px;margin-top:10px"><button class="btn sm primary" data-a="deloadStart">Start deload week</button><button class="btn sm ghost" data-a="deloadSnooze">Next week</button></div></div>';
    }
    const p = pain(); const ks = Object.keys(p);
    if (ks.length) h += '<div class="card tight row"><div style="font-size:26px">🩹</div><div class="grow"><b>' + esc(ks.map(F.mLabel).join(', ')) + '</b><div class="small muted">' + (ks.some(m => p[m].lvl === 'injured') ? 'Exercises that load injured muscles are swapped automatically.' : 'Sore muscles get lighter work for a few days.') + '</div></div><button class="btn sm ghost" data-a="tab" data-tab="profile">Manage</button></div>';
    return h;
  };

  // =====================================================================
  // SUPERSETS (day editor)
  // =====================================================================
  const LET = 'ABCDEFGH';
  function normSS(day) {
    // groups must be contiguous runs of ≥2; relabel A, B, C…
    let n = 0; const items = day.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i].ss; if (!g) continue;
      let j = i; while (j + 1 < items.length && items[j + 1].ss === g) j++;
      if (j === i) { delete items[i].ss; continue; }
      const L = LET[n++ % LET.length]; for (let k = i; k <= j; k++) items[k].ss = '_' + L; i = j;
    }
    items.forEach(it => { if (it.ss) it.ss = it.ss.replace('_', ''); });
  }
  A.ssLink = d => {
    const day = S().plan.days[+d.d]; const i = +d.i; const a = day.items[i], b = day.items[i + 1]; if (!a || !b) return;
    if (a.ss && a.ss === b.ss) { b.ss = 'x' + Date.now(); }        // split the group here
    else { const g = a.ss || b.ss || ('n' + Date.now()); a.ss = g; if (b.ss && b.ss !== g) { const old = b.ss; day.items.forEach(x => { if (x.ss === old) x.ss = g; }); } else b.ss = g; }
    normSS(day); F.save(); F.render();
  };
  F.ssTag = it => it.ss ? '<span class="tag" style="background:color-mix(in oklab,var(--info) 18%,var(--surface2));color:var(--info)">Superset ' + esc(it.ss) + '</span>' : '';

  // =====================================================================
  // AUTOMATIC BACKUPS
  // =====================================================================
  F.UI.backup = F.UI.backup || null;
  const refreshBackup = async () => { try { F.UI.backup = await B.call('backup.status', {}); } catch (e) { F.UI.backup = { unavailable: true }; } };
  F.autoBackup = async (force) => {
    const st = S(); const every = st.settings.backupDays == null ? 7 : st.settings.backupDays;
    if (!force && !every) return null;
    await refreshBackup(); const bs = F.UI.backup || {};
    if (bs.unavailable) return null;
    if (!force && bs.last && Date.now() - bs.last < every * DAY - 3600e3) return null;
    if (!force && !st.sessions.length) return null;
    try { const r = await B.call('backup.write', { json: JSON.stringify(st), keep: 8 }); await refreshBackup(); if (force) F.toast('Backed up ✓'); F.render(); return r; }
    catch (e) { if (force) F.toast('Backup failed: ' + e.message); return null; }
  };
  const WHERE = { app: 'app storage (+ Android\'s Google backup)', downloads: 'Downloads › Forge', folder: 'your chosen folder' };
  F.backupCard = () => {
    const st = S(); const bs = F.UI.backup; if (bs == null) { refreshBackup().then(F.render); }
    const every = st.settings.backupDays == null ? 7 : st.settings.backupDays;
    let h = '<div class="card"><div class="card-h"><h3>Backups</h3><span class="tag ' + (bs && bs.last && Date.now() - bs.last < 8 * DAY ? 'fresh' : 'warm') + '">' + (bs && bs.last ? 'Last: ' + ago(bs.last) : 'No backup yet') + '</span></div>';
    h += '<div class="li" style="padding-top:0"><div class="grow">Automatic backup</div><div class="seg" style="width:220px">' + [[1, 'Daily'], [7, 'Weekly'], [0, 'Off']].map(([v, l]) => '<button class="' + (every === v ? 'on' : '') + '" data-a="bkEvery" data-v="' + v + '">' + l + '</button>').join('') + '</div></div>';
    if (bs && bs.lastWhere) h += '<div class="small muted">Saved to ' + bs.lastWhere.split(',').map(k => WHERE[k] || k).join(', ') + '.</div>';
    h += '<div class="small muted" style="margin-top:4px">' + (bs && bs.folder ? '📁 Also copying to <b>' + esc(bs.folder) + '</b>' : 'Tip: pick a cloud-synced folder (e.g. OneDrive or a Drive-synced folder) to keep a copy off the phone.') + '</div>';
    h += '<div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm primary" data-a="bkNow">' + I.download + 'Back up now</button><button class="btn sm" data-a="bkFolder">' + (bs && bs.folder ? 'Change folder' : 'Choose folder…') + '</button>' + (bs && bs.folder ? '<button class="btn sm ghost" data-a="bkNoFolder">Stop folder copy</button>' : '') + '<button class="btn sm ghost" data-a="bkRestore">Restore…</button></div>';
    h += '<div class="tiny dim" style="margin-top:8px">Keeps the 8 most recent backups. Progress photos stay private on the phone and aren\'t included.</div></div>';
    return h;
  };
  A.bkEvery = d => { S().settings.backupDays = +d.v; F.save(); F.render(); if (+d.v) F.autoBackup(false); };
  A.bkNow = () => F.autoBackup(true);
  A.bkFolder = async () => { try { F.UI.backup = await B.call('backup.pickFolder', {}); if (F.UI.backup.folder) F.autoBackup(true); F.render(); } catch (e) { F.toast(e.message); } };
  A.bkNoFolder = async () => { try { F.UI.backup = await B.call('backup.clearFolder', {}); F.render(); } catch (e) { F.toast(e.message); } };
  A.bkRestore = async () => { await refreshBackup(); F.sheet({ t: 'restore' }); };
  F.sheets.restore = () => {
    const bs = F.UI.backup || {}; const list = bs.private || [];
    let h = '<h2>Restore a backup</h2><div class="small muted" style="margin:4px 0 12px">This replaces everything currently in the app.</div><div class="list">';
    h += list.length ? list.map(n => '<button class="li li-btn" data-a="bkRestoreOne" data-n="' + esc(n) + '"><div class="grow"><b>' + esc(n.replace('forge-backup-', '').replace('.json', '')) + '</b><div class="tiny muted">Saved on this phone</div></div>' + I.chev.replace('<svg', '<svg width="16" height="16"') + '</button>').join('') : '<div class="small muted">No backups saved on this phone yet.</div>';
    return h + '</div><label class="btn block" style="margin-top:12px">' + I.upload + 'From a file (Downloads, Drive…)<input type="file" accept="application/json,.json" style="display:none" data-ch="importData"></label>';
  };
  A.bkRestoreOne = async d => {
    try {
      const r = await B.call('backup.readPrivate', { name: d.n }); const ns = JSON.parse(r.json);
      if (!ns.profile || !Array.isArray(ns.sessions)) throw new Error('Not a Forge backup');
      if (!confirm('Replace all current data with the backup from ' + d.n.replace('forge-backup-', '').replace('.json', '') + ' (' + ns.sessions.length + ' workouts)?')) return;
      F.setState(ns); F.UI.sheet = null; F.toast('Backup restored'); F.go('home');
    } catch (e) { F.toast('Restore failed: ' + e.message); }
  };

  // =====================================================================
  // HOME-SCREEN WIDGET
  // =====================================================================
  let wTimer = null, wLast = '';
  F.pushWidget = () => {
    const st = S(); if (!st.plan || !st.profile) return;
    const dow = F.DOW[new Date().getDay()]; let d;
    const rd = F.readiness().score; const streak = G.weekStreak(st).streak;
    if (st.active) d = { kicker: 'IN PROGRESS', title: st.active.title, sub: st.active.items.filter(x => x.sets.every(s => s.done)).length + ' of ' + st.active.items.length + ' exercises done', btn: 'Resume', canStart: true };
    else {
      const idx = F.todayIdx(); const done = F.doneToday();
      if (idx != null && !done) { const day = st.plan.days[idx]; d = { kicker: 'TODAY · ' + dow.toUpperCase() + (F.deloadActive() ? ' · DELOAD' : ''), title: day.title, sub: day.items.length + ' exercises · ~' + F.dayMinutes(day) + ' min · ' + F.musclesTxt(F.dayMuscles(day)), btn: 'Start', canStart: true }; }
      else { const sc = F.sched && F.sched(); const nx = sc && sc.next; d = { kicker: done ? 'DONE FOR TODAY' : 'REST DAY', title: done ? 'Nice work 💪' : 'Recover & grow', sub: nx ? 'Next: ' + st.plan.days[nx.idx].title + (nx.k === 1 ? ' tomorrow' : ' on ' + F.DOW[nx.dow]) : '', btn: 'Open', canStart: false }; }
    }
    d.ready = String(rd); d.streak = String(streak);
    const j = JSON.stringify(d); if (j === wLast) return; wLast = j;
    B.call('widget.update', d).catch(() => { });
  };
  const schedWidget = () => { clearTimeout(wTimer); wTimer = setTimeout(F.pushWidget, 1500); };
  const _save = F.save; F.save = function () { const r = _save.apply(this, arguments); schedWidget(); return r; };
  B.on('widgetStart', () => {
    const st = S(); if (st.active) { A.resume(); return; }
    const idx = F.todayIdx(); if (idx != null && !F.doneToday()) F.startWorkout(idx); else F.go('home');
  });
  B.on('resume', () => { schedWidget(); F.autoBackup(false); });
  setTimeout(() => { F.pushWidget(); F.autoBackup(false); }, 4000);

  // =====================================================================
  // PROGRESS PHOTOS
  // =====================================================================
  const POSES = [['front', 'Front'], ['side', 'Side'], ['back', 'Back']];
  const bodyAt = t => { const b = (S().body || []).filter(x => x.weight || x.bf).sort((a, c) => Math.abs(a.t - t) - Math.abs(c.t - t))[0]; return b && Math.abs(b.t - t) < 10 * DAY ? b : null; };
  V.photosPanel = () => {
    const st = S(); const ph = (st.photos || []).slice().sort((a, b) => b.t - a.t); const pose = F.UI.photoPose || 'front';
    let h = '<div class="card"><div class="card-h"><h3>Progress photos</h3><span class="tag">🔒 Private</span></div><div class="small muted">Same pose, same spot, same light — every 2–4 weeks. Photos stay in Forge\'s private storage on this phone (not in your gallery, not in backups).</div>';
    h += '<div class="seg" style="margin-top:12px">' + POSES.map(([k, l]) => '<button class="' + (pose === k ? 'on' : '') + '" data-a="photoPose" data-p="' + k + '">' + l + '</button>').join('') + '</div>';
    h += '<div class="row wrap" style="gap:8px;margin-top:10px"><label class="btn primary">📷 Take photo<input type="file" accept="image/*" capture="environment" style="display:none" data-ch="photoAdd"></label><label class="btn">🖼️ From gallery<input type="file" accept="image/*" style="display:none" data-ch="photoAdd"></label></div></div>';
    const same = ph.filter(p => p.pose === pose);
    if (same.length >= 2) {
      const sel = F.UI.photoCmp || [same[same.length - 1].id, same[0].id];
      const a = same.find(p => p.id === sel[0]) || same[same.length - 1], b = same.find(p => p.id === sel[1]) || same[0];
      const cap = p => { const bd = bodyAt(p.t); return F.fmtDate(p.t) + (bd && bd.weight ? ' · ' + bd.weight + ' ' + F.u() : '') + (bd && bd.bf ? ' · ' + bd.bf + '% fat' : ''); };
      h += '<div class="card"><div class="card-h"><h3>Compare</h3><span class="small muted">' + Math.round((b.t - a.t) / DAY) + ' days apart</span></div><div class="grid two" style="gap:8px">' +
        [a, b].map(p => '<div><img src="' + p.url + '" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;display:block"><div class="tiny muted" style="margin-top:4px;text-align:center">' + esc(cap(p)) + '</div></div>').join('') + '</div><div class="tiny dim" style="margin-top:8px">Tap photos below to choose which two to compare.</div></div>';
    }
    if (ph.length) {
      h += '<div class="card"><div class="card-h"><h3>' + POSES.find(x => x[0] === pose)[1] + ' · ' + same.length + '</h3></div><div class="photo-grid">' + same.map(p => '<button class="ph' + ((F.UI.photoCmp || []).includes(p.id) ? ' sel' : '') + '" data-a="photoPick" data-id="' + p.id + '"><img src="' + p.url + '" alt=""><span>' + F.fmtDate(p.t) + '</span></button>').join('') + '</div>';
      if (same.length) h += '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-a="photoDel">' + I.trash + 'Delete selected</button></div>';
      h += '</div>';
    }
    return h;
  };
  A.photoPose = d => { F.UI.photoPose = d.p; F.UI.photoCmp = null; F.render(); };
  A.photoPick = d => { const c = (F.UI.photoCmp || []).filter(x => x !== d.id); if (c.length === (F.UI.photoCmp || []).length) c.push(d.id); F.UI.photoCmp = c.slice(-2).sort((x, y) => { const P = S().photos; return P.find(p => p.id === x).t - P.find(p => p.id === y).t; }); F.render(); };
  A.photoDel = async () => {
    const st = S(); const ids = F.UI.photoCmp || []; if (!ids.length) { F.toast('Tap a photo to select it first'); return; }
    if (!confirm('Delete ' + ids.length + ' photo' + (ids.length > 1 ? 's' : '') + '?')) return;
    for (const id of ids) { try { await B.call('photos.delete', { id }); } catch (e) { } }
    st.photos = (st.photos || []).filter(p => !ids.includes(p.id)); F.UI.photoCmp = null; F.save(); F.render();
  };
  A.photoAdd = (d, el) => {
    const f = el.files && el.files[0]; if (!f) return; el.value = '';
    const url = URL.createObjectURL(f); const im = new Image();
    im.onload = async () => {
      const max = 1440; const sc = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      const b64 = c.toDataURL('image/jpeg', 0.86).split(',')[1]; const id = 'p' + Date.now().toString(36);
      try {
        const r = await B.call('photos.save', { id, b64 });
        const st = S(); st.photos = st.photos || []; st.photos.push({ id, t: Date.now(), pose: F.UI.photoPose || 'front', url: r.url }); F.save(); F.toast('Photo saved'); F.render();
      } catch (e) { F.toast('Could not save photo: ' + e.message); }
    };
    im.onerror = () => F.toast('Could not read that image');
    im.src = url;
  };

  // =====================================================================
  // MONTHLY REPORT
  // =====================================================================
  function monthData(off) {
    const st = S(); const now = new Date(); const m0 = new Date(now.getFullYear(), now.getMonth() - off, 1).getTime(); const m1 = new Date(now.getFullYear(), now.getMonth() - off + 1, 1).getTime();
    const ss = realSessions(st).filter(s => s.date >= m0 && s.date < m1);
    const cardio = (st.cardio || []).filter(c => c.start >= m0 && c.start < m1);
    const days = Math.min(Date.now(), m1) - m0; const weeks = Math.max(1, days / (7 * DAY));
    const tot = ss.reduce((a, s) => { const x = E.sessionStats(s); a.vol += x.vol; a.sets += x.sets; a.min += x.dur; return a; }, { vol: 0, sets: 0, min: 0 });
    // strength: most frequent loaded lifts, best e1RM first vs last session this month
    const freq = {}; ss.forEach(s => s.items.forEach(it => { if (it.sets.some(x => x.done && x.w > 0)) freq[it.exId] = (freq[it.exId] || 0) + 1; }));
    const lifts = Object.keys(freq).filter(id => freq[id] >= 2).sort((a, b) => freq[b] - freq[a]).slice(0, 5).map(id => {
      const h = E.exHistory(ss, id); const a = h[0].best, b = h[h.length - 1].best; return { id, n: E.ex(id).n, a: Math.round(a), b: Math.round(b), pct: a ? (b - a) / a * 100 : 0 };
    });
    // weekly sets per muscle vs target
    const g = (E.GOALS[st.profile.goal] || E.GOALS.general).weekly; const mus = {};
    ss.forEach(s => s.items.forEach(it => { const e = E.ex(it.exId); if (!e) return; const n = it.sets.filter(x => x.done).length; const inv = E.involvement(e); for (const m in inv) mus[m] = (mus[m] || 0) + n * inv[m]; }));
    const muscles = E.MAJOR.map(m => ({ m, wk: (mus[m] || 0) / weeks })).sort((a, b) => b.wk - a.wk);
    const body = (st.body || []).filter(b => b.t >= m0 && b.t < m1 && b.weight).sort((a, b) => a.t - b.t);
    const dayset = new Set(ss.map(s => new Date(s.date).getDate())); cardio.forEach(c => dayset.add(new Date(c.start).getDate()));
    const prs = ss.reduce((a, s) => a + (s.prs || []).length, 0);
    return { m0, m1, label: new Date(m0).toLocaleDateString([], { month: 'long', year: 'numeric' }), ss, cardio, weeks, tot, lifts, muscles, target: g, body, dayset, prs,
      km: cardio.reduce((a, c) => a + (c.distKm || c.km || (c.distM ? c.distM / 1000 : 0) || 0), 0), cmin: cardio.reduce((a, c) => a + (c.min || 0), 0), nDays: new Date(m1 - 1).getDate(), first: new Date(m0).getDay() };
  }
  V.reportPanel = () => {
    const off = F.UI.repOff || 0; const d = monthData(off);
    let h = '<div class="row between"><button class="icon-btn" data-a="repMonth" data-d="1">' + I.back + '</button><h2 style="margin:0">' + esc(d.label) + '</h2><button class="icon-btn" data-a="repMonth" data-d="-1"' + (off ? '' : ' disabled style="opacity:.3"') + '>' + I.chev + '</button></div>';
    if (!d.ss.length && !d.cardio.length) return h + '<div class="card" style="text-align:center;padding:30px"><div class="muted">No training logged this month.</div></div>';
    h += '<div class="stats"><div class="stat"><div class="num">' + d.ss.length + '</div><div class="lbl">Workouts</div></div><div class="stat"><div class="num">' + (d.ss.length / d.weeks).toFixed(1) + '</div><div class="lbl">Per week</div></div><div class="stat"><div class="num">' + F.fmtVol(d.tot.vol) + '</div><div class="lbl">' + F.u() + ' lifted</div></div><div class="stat"><div class="num">' + d.prs + '</div><div class="lbl">PRs</div></div></div>';
    h += '<div class="card"><div class="card-h"><h3>Consistency</h3><span class="small muted">' + d.dayset.size + ' active days</span></div><div class="cal">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => '<i class="h">' + x + '</i>').join('') + '<i></i>'.repeat(d.first) + Array.from({ length: d.nDays }, (_, k) => '<i class="' + (d.dayset.has(k + 1) ? 'on' : '') + '">' + (k + 1) + '</i>').join('') + '</div></div>';
    if (d.lifts.length) h += '<div class="card"><div class="card-h"><h3>Strength</h3><span class="small muted">est. 1RM, first → last session</span></div>' + d.lifts.map(l => '<div class="li"><div class="grow">' + esc(l.n) + '</div><span class="small muted">' + l.a + ' → <b style="color:var(--text)">' + l.b + '</b></span><span class="tag ' + (l.pct > 0.5 ? 'fresh' : l.pct < -0.5 ? 'warm' : '') + '" style="min-width:58px;text-align:center">' + (l.pct > 0 ? '+' : '') + l.pct.toFixed(1) + '%</span></div>').join('') + '</div>';
    h += '<div class="card"><div class="card-h"><h3>Weekly sets per muscle</h3><span class="small muted">target ' + d.target[0] + '–' + d.target[1] + '</span></div><div class="col" style="gap:6px">' + d.muscles.map(x => { const ok = x.wk >= d.target[0] - 1; return '<div class="inv" style="grid-template-columns:92px 1fr 44px"><span>' + F.mLabel(x.m) + '</span><div class="bar" style="position:relative;height:8px"><i style="width:' + Math.min(100, 100 * x.wk / d.target[1]) + '%;' + (ok ? '' : 'background:var(--warm)') + '"></i><span style="position:absolute;top:-3px;bottom:-3px;left:' + (100 * d.target[0] / d.target[1]) + '%;width:2px;background:var(--text);opacity:.5"></span></div><span class="small" style="text-align:right">' + x.wk.toFixed(1) + '</span></div>'; }).join('') + '</div></div>';
    if (d.body.length >= 2 || d.cardio.length) h += '<div class="card"><div class="card-h"><h3>Body &amp; cardio</h3></div><div class="list">' + (d.body.length >= 2 ? '<div class="li"><div class="grow">Bodyweight</div><b>' + d.body[0].weight + ' → ' + d.body[d.body.length - 1].weight + ' ' + F.u() + '</b></div>' + (d.body[0].bf && d.body[d.body.length - 1].bf ? '<div class="li"><div class="grow">Body fat</div><b>' + d.body[0].bf + ' → ' + d.body[d.body.length - 1].bf + '%</b></div>' : '') : '') + (d.cardio.length ? '<div class="li"><div class="grow">Cardio</div><b>' + d.cardio.length + ' sessions · ' + Math.round(d.cmin) + ' min' + (d.km ? ' · ' + (F.u() === 'lb' ? (d.km / 1.609).toFixed(1) + ' mi' : d.km.toFixed(1) + ' km') : '') + '</b></div>' : '') + '</div></div>';
    h += '<button class="btn primary block" data-a="repImage">🖼️ Create shareable image</button>';
    return h;
  };
  A.repMonth = d => { F.UI.repOff = Math.max(0, (F.UI.repOff || 0) + (+d.d)); F.render(); };
  A.repImage = async () => {
    F.sheet({ t: 'repCard', url: null });
    try { const url = await reportCard(monthData(F.UI.repOff || 0)); if (F.UI.sheet && F.UI.sheet.t === 'repCard') { F.UI.sheet.url = url; F.render(); } } catch (e) { F.toast('Could not draw the image: ' + e.message); }
  };
  F.sheets.repCard = sh => '<h2>Monthly report</h2>' + (sh.url ? '<img src="' + sh.url + '" style="width:100%;border-radius:14px;display:block;margin-top:10px;border:1px solid var(--line)">' : '<div class="card flat" style="aspect-ratio:4/5;display:flex;align-items:center;justify-content:center;margin-top:10px"><span class="muted">Drawing…</span></div>') +
    '<div class="row" style="gap:8px;margin-top:12px"><button class="btn primary grow" data-a="repSave"' + (sh.url ? '' : ' disabled') + '>⬇️ Save to Photos</button><button class="btn grow" data-a="repShare"' + (sh.url ? '' : ' disabled') + '>Share…</button></div>';
  const repName = () => 'forge-report-' + new Date(monthData(F.UI.repOff || 0).m0).toISOString().slice(0, 7) + '.png';
  A.repSave = async () => { try { const r = await B.call('media.saveImage', { b64: F.UI.sheet.url.split(',')[1], name: repName() }); if (r && r.saved === false) await B.call('media.shareImage', { b64: F.UI.sheet.url.split(',')[1], name: repName(), text: '' }); else F.toast('Saved to Photos › Forge'); } catch (e) { F.toast(e.message); } };
  A.repShare = async () => { try { await B.call('media.shareImage', { b64: F.UI.sheet.url.split(',')[1], name: repName(), text: 'My training — ' + monthData(F.UI.repOff || 0).label }); } catch (e) { F.toast(e.message); } };

  async function reportCard(d) {
    const W = 1080, H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    try { await Promise.all(['700 76px "Barlow Condensed"', '500 32px Barlow', '600 30px Barlow'].map(f => document.fonts.load(f))); } catch (e) { }
    const D = "'Barlow Condensed', Barlow, sans-serif", T = "Barlow, sans-serif";
    const C = { bg: '#0a0b0e', text: '#f2f0ea', muted: '#8b909b', line: '#2a2e38', accent: '#ff6a33', fresh: '#2fd3a8', warm: '#f5b83d', gold: '#ffc94a' };
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W, 0, 40, W, 0, 900); rg.addColorStop(0, 'rgba(255,106,51,.28)'); rg.addColorStop(1, 'rgba(255,106,51,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.fillStyle = C.accent; g.font = '700 30px ' + D; g.fillText('FORGE  ·  MONTHLY REPORT', 72, 104);
    g.fillStyle = C.text; g.font = '700 84px ' + D; g.fillText(d.label.toUpperCase(), 72, 190);
    // stat tiles
    const tiles = [[d.ss.length, 'WORKOUTS'], [(d.ss.length / d.weeks).toFixed(1), 'PER WEEK'], [F.fmtVol(d.tot.vol), F.u().toUpperCase() + ' LIFTED'], [d.prs, 'PRS']];
    tiles.forEach(([v, l], i) => { const x = 72 + i * 240; g.fillStyle = C.text; g.font = '700 64px ' + D; g.fillText(String(v), x, 290); g.fillStyle = C.muted; g.font = '600 22px ' + T; g.fillText(l, x, 324); });
    // calendar
    let y = 390; g.fillStyle = C.text; g.font = '700 32px ' + D; g.fillText('CONSISTENCY · ' + d.dayset.size + ' ACTIVE DAYS', 72, y); y += 26;
    for (let k = 0; k < d.nDays; k++) { const pos = d.first + k; const cx = 72 + (pos % 7) * 58, cy = y + Math.floor(pos / 7) * 48; g.fillStyle = d.dayset.has(k + 1) ? C.accent : C.line; g.beginPath(); g.roundRect ? g.roundRect(cx, cy, 46, 38, 8) : g.rect(cx, cy, 46, 38); g.fill(); }
    // strength (right column)
    let ry = 390; const rx = 520; g.fillStyle = C.text; g.font = '700 32px ' + D; g.fillText('STRENGTH (EST. 1RM)', rx, ry); ry += 16;
    d.lifts.slice(0, 5).forEach(l => {
      ry += 52; g.font = '500 28px ' + T; g.fillStyle = C.text; let n = l.n; while (n.length > 3 && g.measureText(n + '…').width > 300) n = n.slice(0, -1); if (n !== l.n) n += '…'; g.fillText(n, rx, ry);
      g.textAlign = 'right'; g.fillStyle = l.pct > 0.5 ? C.fresh : l.pct < -0.5 ? C.warm : C.muted; g.font = '700 30px ' + D; g.fillText((l.pct > 0 ? '+' : '') + l.pct.toFixed(1) + '%', W - 72, ry); g.textAlign = 'left';
    });
    if (!d.lifts.length) { g.fillStyle = C.muted; g.font = '500 26px ' + T; g.fillText('Log a lift twice to see trends', rx, ry + 52); }
    // muscles
    y = 760; g.fillStyle = C.text; g.font = '700 32px ' + D; g.fillText('WEEKLY SETS PER MUSCLE  ·  TARGET ' + d.target[0] + '–' + d.target[1], 72, y); y += 20;
    const ms = d.muscles.slice(0, 10); const bw = (W - 144 - 30) / 2;
    ms.forEach((x, i) => {
      const col = i % 2, row = Math.floor(i / 2); const xx = 72 + col * (bw + 30), yy = y + 40 + row * 72;
      g.fillStyle = C.text; g.font = '500 26px ' + T; g.fillText(F.mLabel(x.m), xx, yy); g.textAlign = 'right'; g.fillStyle = C.muted; g.fillText(x.wk.toFixed(1), xx + bw, yy); g.textAlign = 'left';
      g.fillStyle = C.line; g.fillRect(xx, yy + 12, bw, 10);
      g.fillStyle = x.wk >= d.target[0] - 1 ? C.accent : C.warm; g.fillRect(xx, yy + 12, Math.max(6, Math.min(1, x.wk / d.target[1]) * bw), 10);
      g.fillStyle = C.text; g.globalAlpha = .5; g.fillRect(xx + bw * d.target[0] / d.target[1], yy + 8, 2, 18); g.globalAlpha = 1;
    });
    // footer body/cardio
    let fy = 1270; g.fillStyle = C.line; g.fillRect(72, fy - 50, W - 144, 2);
    const foot = [];
    if (d.body.length >= 2) foot.push('Bodyweight ' + d.body[0].weight + ' → ' + d.body[d.body.length - 1].weight + ' ' + F.u());
    if (d.cardio.length) foot.push('Cardio ' + d.cardio.length + '× · ' + Math.round(d.cmin) + ' min' + (d.km ? ' · ' + (F.u() === 'lb' ? (d.km / 1.609).toFixed(1) + ' mi' : d.km.toFixed(1) + ' km') : ''));
    foot.push(Math.round(d.tot.min / 60) + ' h training');
    g.fillStyle = C.muted; g.font = '500 28px ' + T; g.fillText(foot.join('   ·   '), 72, fy);
    return c.toDataURL('image/png');
  }
})();
