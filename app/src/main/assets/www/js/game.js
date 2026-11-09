/* Forge — gamification: XP, levels, titles, muscle mastery, streaks, achievements, weekly quests. */
(function () {
  'use strict';
  const E = () => window.Engine;

  const xpToReach = L => Math.round(150 * Math.pow(Math.max(0, L - 1), 1.7));
  function levelOf(xp) {
    let L = 1; while (xpToReach(L + 1) <= xp) L++;
    const a = xpToReach(L), b = xpToReach(L + 1);
    return { level: L, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
  }
  const TITLES = ['Rookie', 'Apprentice', 'Iron Novice', 'Bar Bender', 'Plate Crusher', 'Steel Forged', 'Iron Veteran', 'Titan', 'Colossus', 'Mythic'];
  const title = L => TITLES[Math.min(TITLES.length - 1, Math.floor((L - 1) / 5))];
  const muscleLevel = xp => Math.floor(Math.sqrt((xp || 0) / 40)) + 1;

  function setXp(s, e) {
    if (!s.done) return 0;
    if (e && (e.eq === 'bodyweight' || e.eq === 'band') && !s.w) return 6 + Math.round((s.r || 0) / 2);
    return 6 + Math.round(Math.min((s.w || 0) * (s.r || 0), 1500) / 100);
  }

  function sessionXp(session, prs, planned) {
    let sets = 0;
    session.items.forEach(it => { const e = E().ex(it.exId); it.sets.forEach(s => { sets += setXp(s, e); }); });
    const st = E().sessionStats(session);
    const lines = [{ k: 'Sets', v: sets }];
    if (st.sets >= 1) lines.push({ k: 'Workout complete', v: 50 + Math.min(70, st.dur) });
    if (prs.length) lines.push({ k: prs.length + ' personal record' + (prs.length > 1 ? 's' : ''), v: prs.length * 40 });
    if (planned) lines.push({ k: 'On-plan bonus', v: 30 });
    if ((session.hr || []).length > 20) lines.push({ k: 'Heart-rate tracked', v: 15 });
    return { total: lines.reduce((a, l) => a + l.v, 0), lines };
  }

  // ---------- Streaks ----------
  function weekStreak(state) {
    const target = Math.max(1, (state.profile.days || []).length);
    const byWeek = {};
    state.sessions.forEach(s => { const k = E().startOfWeek(s.date); byWeek[k] = (byWeek[k] || 0) + 1; });
    let w = E().startOfWeek(Date.now()); let streak = 0;
    const thisWeek = byWeek[w] || 0;
    if (thisWeek >= target) streak++;
    w -= 7 * E().DAY;
    while ((byWeek[w] || 0) >= target) { streak++; w -= 7 * E().DAY; }
    return { streak, thisWeek, target };
  }
  function dayStreak(state) {
    const days = new Set(state.sessions.map(s => E().startOfDay(s.date)));
    let d = E().startOfDay(Date.now()); let n = 0;
    if (!days.has(d)) d -= E().DAY;
    while (days.has(d)) { n++; d -= E().DAY; }
    return n;
  }

  // ---------- Achievements ----------
  const totals = st => {
    let vol = 0, sets = 0, prs = 0;
    st.sessions.forEach(s => { const x = E().sessionStats(s); vol += x.vol; sets += x.sets; prs += (s.prs || []).length; });
    return { vol, sets, prs, n: st.sessions.length };
  };
  const ACH = [
    { id: 'first', icon: '🔥', name: 'First Spark', desc: 'Complete your first workout', test: (st) => st.sessions.length >= 1 },
    { id: 'w10', icon: '🔟', name: 'Habit Forming', desc: 'Complete 10 workouts', test: (st, t) => t.n >= 10 },
    { id: 'w50', icon: '🏛️', name: 'Pillar', desc: 'Complete 50 workouts', test: (st, t) => t.n >= 50 },
    { id: 'w100', icon: '💯', name: 'Centurion', desc: 'Complete 100 workouts', test: (st, t) => t.n >= 100 },
    { id: 'ton', icon: '⚖️', name: 'Ton Club', desc: 'Move 1,000 kg in one session', test: (st, t, s) => s && E().toKg(E().sessionStats(s).vol, st.profile.units) >= 1000 },
    { id: 'ton5', icon: '🏗️', name: 'Heavy Machinery', desc: 'Move 5,000 kg in one session', test: (st, t, s) => s && E().toKg(E().sessionStats(s).vol, st.profile.units) >= 5000 },
    { id: 'vol100', icon: '🌋', name: '100 Tonnes', desc: 'Lift 100,000 kg total', test: (st, t) => E().toKg(t.vol, st.profile.units) >= 100000 },
    { id: 'pr1', icon: '📈', name: 'New Heights', desc: 'Set your first personal record', test: (st, t) => t.prs >= 1 },
    { id: 'pr25', icon: '🚀', name: 'PR Machine', desc: 'Set 25 personal records', test: (st, t) => t.prs >= 25 },
    { id: 'week', icon: '🗓️', name: 'Week Warrior', desc: 'Hit every planned session in a week', test: (st) => weekStreak(st).streak >= 1 },
    { id: 'streak4', icon: '⛓️', name: 'Unbroken', desc: '4-week training streak', test: (st) => weekStreak(st).streak >= 4 },
    { id: 'streak12', icon: '🛡️', name: 'Iron Will', desc: '12-week training streak', test: (st) => weekStreak(st).streak >= 12 },
    { id: 'early', icon: '🌅', name: 'Early Bird', desc: 'Start a workout before 7 am', test: (st, t, s) => s && new Date(s.date).getHours() < 7 },
    { id: 'night', icon: '🌙', name: 'Night Shift', desc: 'Start a workout after 9 pm', test: (st, t, s) => s && new Date(s.date).getHours() >= 21 },
    { id: 'balanced', icon: '☯️', name: 'Balanced Build', desc: 'Train all major muscles in one week', test: (st) => { const w = E().weeklyMuscleSets(st.sessions); return E().MAJOR.every(m => w[m] >= 1); } },
    { id: 'heart', icon: '❤️', name: 'Heart Tracker', desc: 'Record heart rate with your watch', test: (st, t, s) => s && (s.hr || []).length > 20 },
    { id: 'tempo', icon: '⏱️', name: 'Tempo Master', desc: 'Finish a session with watch rep tracking on 10+ sets', test: (st, t, s) => s && s.items.reduce((a, it) => a + it.sets.filter(x => x.done && x.tempo && x.tempo.length).length, 0) >= 10 },
    { id: 'rpe', icon: '🎯', name: 'Self-Aware', desc: 'Log RPE on every set of a workout', test: (st, t, s) => s && s.items.every(it => it.sets.filter(x => x.done).every(x => x.rpe)) && E().sessionStats(s).sets >= 8 },
    { id: 'strava', icon: '🧡', name: 'Social Lifter', desc: 'Upload a workout to Strava', test: (st) => st.sessions.some(s => s.synced && s.synced.strava) },
    { id: 'samsung', icon: '💙', name: 'In Sync', desc: 'Save a workout to Samsung Health', test: (st) => st.sessions.some(s => s.synced && s.synced.hc) },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Perform 30 different exercises', test: (st) => new Set(st.sessions.flatMap(s => s.items.filter(i => i.sets.some(x => x.done)).map(i => i.exId))).size >= 30 },
    { id: 'lvl10', icon: '⭐', name: 'Double Digits', desc: 'Reach level 10', test: (st) => levelOf(st.game.xp).level >= 10 },
    { id: 'lvl25', icon: '🌟', name: 'Steel Forged', desc: 'Reach level 25', test: (st) => levelOf(st.game.xp).level >= 25 },
    { id: 'bwbench', icon: '🏋️', name: 'Bodyweight Bench', desc: 'Bench press your bodyweight', test: (st) => { const bw = st.profile.bodyweight || 9999; return st.sessions.some(s => s.items.some(it => /bench press/i.test((E().ex(it.exId) || {}).n || '') && it.sets.some(x => x.done && x.w >= bw && x.r >= 1))); } },
  ];

  function checkAchievements(state, session) {
    const t = totals(state); const got = [];
    ACH.forEach(a => { if (!state.game.ach[a.id] && a.test(state, t, session)) { state.game.ach[a.id] = Date.now(); got.push(a); } });
    return got;
  }

  // ---------- Weekly quests ----------
  const QUESTS = [
    { id: 'sets40', name: 'Volume Hunter', desc: 'Log 40 working sets', target: 40, xp: 200, prog: (ss) => ss.reduce((a, s) => a + E().sessionStats(s).sets, 0) },
    { id: 'plan', name: 'By the Book', desc: 'Complete every planned session', target: 0, xp: 300, prog: (ss, st) => ss.length, tgt: st => Math.max(1, st.profile.days.length) },
    { id: 'pr2', name: 'Record Breaker', desc: 'Set 2 personal records', target: 2, xp: 220, prog: (ss) => ss.reduce((a, s) => a + (s.prs || []).length, 0) },
    { id: 'legs2', name: 'Never Skip', desc: 'Train legs in 2 sessions', target: 2, xp: 180, prog: (ss) => ss.filter(s => { const m = E().sessionStats(s).mus; return (m.quadriceps || 0) + (m.hamstrings || 0) >= 3; }).length },
    { id: 'rpe20', name: 'Honest Effort', desc: 'Log RPE on 20 sets', target: 20, xp: 150, prog: (ss) => ss.reduce((a, s) => a + s.items.reduce((b, it) => b + it.sets.filter(x => x.done && x.rpe).length, 0), 0) },
    { id: 'hr2', name: 'Wired In', desc: 'Track heart rate in 2 sessions', target: 2, xp: 160, prog: (ss) => ss.filter(s => (s.hr || []).length > 20).length },
    { id: 'tons', name: 'Tonnage', desc: 'Move 8,000 kg this week', target: 8000, xp: 220, prog: (ss, st) => Math.round(ss.reduce((a, s) => a + E().toKg(E().sessionStats(s).vol, st.profile.units), 0)) },
    { id: 'new', name: 'Fresh Moves', desc: 'Try an exercise you have never done', target: 1, xp: 120, prog: (ss, st) => { const before = new Set(st.sessions.filter(s => s.date < E().startOfWeek(Date.now())).flatMap(s => s.items.map(i => i.exId))); return ss.some(s => s.items.some(i => !before.has(i.exId) && i.sets.some(x => x.done))) ? 1 : 0; } },
    { id: 'early', name: 'Dawn Patrol', desc: 'Finish a workout before 9 am', target: 1, xp: 140, prog: (ss) => ss.filter(s => new Date(s.date).getHours() < 9).length },
  ];

  function weekQuests(state) {
    const wk = E().isoWeek(Date.now());
    if (!state.game.quests || state.game.quests.week !== wk) {
      let h = 0; for (const c of wk) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const pool = QUESTS.slice(); const pick = [];
      while (pick.length < 3) { h = (h * 1103515245 + 12345) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0].id); }
      state.game.quests = { week: wk, ids: pick, done: {} };
    }
    const ss = state.sessions.filter(s => s.date >= E().startOfWeek(Date.now()));
    return state.game.quests.ids.map(id => {
      const q = QUESTS.find(x => x.id === id); const target = q.tgt ? q.tgt(state) : q.target;
      const p = q.prog(ss, state);
      return { id, name: q.name, desc: q.desc, xp: q.xp, target, progress: Math.min(p, target), done: !!state.game.quests.done[id], complete: p >= target };
    });
  }
  function claimQuests(state) {
    const done = [];
    weekQuests(state).forEach(q => { if (q.complete && !q.done) { state.game.quests.done[q.id] = Date.now(); state.game.xp += q.xp; done.push(q); } });
    return done;
  }

  function addMuscleXp(state, session) {
    session.items.forEach(it => {
      const e = E().ex(it.exId); if (!e) return; const inv = E().involvement(e);
      const n = it.sets.filter(x => x.done).length;
      for (const m in inv) state.game.mxp[m] = (state.game.mxp[m] || 0) + Math.round(n * inv[m] * 10);
    });
  }

  window.Game = { levelOf, xpToReach, title, muscleLevel, sessionXp, weekStreak, dayStreak, ACH, checkAchievements, weekQuests, claimQuests, addMuscleXp };
})();
