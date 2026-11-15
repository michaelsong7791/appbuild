/* Forge — calisthenics skill ladders. Each step unlocks when you log a set that meets its target
   (reps, or seconds for holds) in any workout or quick log. Unlocks give XP and celebrate. */
(function () {
  'use strict';
  const E = window.Engine, F = window.F, I = window.I, A = F.actions, esc = F.esc;
  const S = () => F.S();
  const LADDERS = [
    { id: 'push', name: 'Push-up mastery', icon: '🫸', steps: [['Incline_Push-Up', 12], ['Pushups', 10], ['Push-Ups_-_Close_Triceps_Position', 10], ['Decline_Push-Up', 12], ['Plyo_Push-up', 8], ['Single-Arm_Push-Up', 3]] },
    { id: 'pull', name: 'Road to the pull-up', icon: '🧗', steps: [['x_dead_hang', 30, 's'], ['Inverted_Row', 10], ['Band_Assisted_Pull-Up', 8], ['Chin-Up', 5], ['Pullups', 8], ['Pullups', 15], ['Muscle_Up', 1]] },
    { id: 'legs', name: 'Pistol squat path', icon: '🦵', steps: [['Bodyweight_Squat', 20], ['Bodyweight_Walking_Lunge', 12], ['Freehand_Jump_Squat', 12], ['x_wall_sit', 60, 's'], ['x_pistol_squat', 1], ['x_pistol_squat', 5]] },
    { id: 'core', name: 'Iron core', icon: '🧱', steps: [['x_bird_dog', 10], ['Plank', 60, 's'], ['x_hollow_hold', 30, 's'], ['x_hanging_knee', 10], ['Hanging_Leg_Raise', 8], ['x_toes_to_bar', 5], ['x_dragon_flag', 3]] },
    { id: 'press', name: 'Handstand push-up', icon: '🤸', steps: [['Bench_Dips', 12], ['Dips_-_Triceps_Version', 8], ['x_pike_pushup', 8], ['x_wall_handstand', 30, 's'], ['Handstand_Push-Ups', 3]] },
    { id: 'lsit', name: 'L-sit', icon: '🪑', steps: [['x_hollow_hold', 45, 's'], ['x_l_sit', 10, 's'], ['x_l_sit', 20, 's']] },
  ];
  const valid = () => LADDERS.map(l => Object.assign({}, l, { steps: l.steps.filter(s => E.ex(s[0])) }));

  /** Best reps/seconds ever logged per exercise. */
  function bests(st) {
    const b = {};
    st.sessions.forEach(s => s.items.forEach(it => it.sets.forEach(x => { if (x.done !== false && x.r) b[it.exId] = Math.max(b[it.exId] || 0, x.r); })));
    return b;
  }
  /** Index of highest completed step (-1 = none). Steps must be done in order only for display; any later completion unlocks earlier ones. */
  function level(l, b) { let lv = -1; l.steps.forEach((s, i) => { if ((b[s[0]] || 0) >= s[1]) lv = i; }); return lv; }

  /** Called after any session is saved. Returns newly unlocked [{ladder, step}] and awards XP. */
  F.checkSkills = st => {
    const b = bests(st); st.game.skills = st.game.skills || {}; const got = [];
    valid().forEach(l => {
      const lv = level(l, b); const prev = st.game.skills[l.id] != null ? st.game.skills[l.id] : -1;
      if (lv > prev) { for (let i = prev + 1; i <= lv; i++) got.push({ l, i }); st.game.skills[l.id] = lv; }
    });
    if (got.length) {
      st.game.xp += got.length * 75;
      const top = got[got.length - 1]; const s = top.l.steps[top.i];
      setTimeout(() => { F.toast(top.l.icon + ' Skill unlocked: ' + E.ex(s[0]).n + ' ' + s[1] + (s[2] === 's' ? 's' : ' reps') + ' · +' + got.length * 75 + ' XP'); F.confetti(); }, 900);
    }
    return got;
  };

  F.skillsDone = st => { const sk = (st.game && st.game.skills) || {}; return valid().some(l => sk[l.id] === l.steps.length - 1); };
  F.skillsView = () => {
    const st = S(); const b = bests(st);
    let h = '<p class="small muted" style="margin:0">Calisthenics progressions. Hit the target in any workout or quick log to unlock the next step. Tap a step for how-to.</p>';
    valid().forEach(l => {
      const lv = level(l, b); const next = l.steps[lv + 1]; const done = lv === l.steps.length - 1;
      h += '<div class="card"><div class="card-h"><h3>' + l.icon + ' ' + esc(l.name) + '</h3><span class="tag ' + (done ? 'gold' : 'accent') + '">' + (lv + 1) + ' / ' + l.steps.length + '</span></div>';
      h += '<div class="ladder">' + l.steps.map((s, i) => { const e = E.ex(s[0]); const state = i <= lv ? 'done' : i === lv + 1 ? 'cur' : 'lock';
        return '<button class="rung ' + state + '" data-a="ex" data-id="' + s[0] + '"><div class="dot">' + (state === 'done' ? '✓' : state === 'lock' ? '🔒' : i + 1) + '</div><div class="thumb" style="width:52px;height:52px;background-image:url(' + E.img(s[0], 0) + ')"></div><div class="tiny" style="font-weight:700;line-height:1.15;margin-top:4px">' + esc(e.n) + '</div><div class="tiny muted">' + s[1] + (s[2] === 's' ? ' s' : ' reps') + '</div></button>'; }).join('') + '</div>';
      if (next) { const e = E.ex(next[0]); const best = b[next[0]] || 0;
        h += '<div class="row between" style="margin-top:10px"><div class="small grow"><b>Next:</b> ' + esc(e.n) + ' — ' + next[1] + (next[2] === 's' ? ' seconds' : ' reps') + ' in one set' + (best ? ' <span class="muted">(best ' + best + ')</span>' : '') + '<div class="bar" style="margin-top:6px"><i style="width:' + Math.min(100, best / next[1] * 100) + '%"></i></div></div><button class="btn sm primary" style="margin-left:10px" data-a="quickLog" data-id="' + next[0] + '">⚡ Log</button></div>';
      } else h += '<div class="small" style="margin-top:8px;color:var(--gold);font-weight:700">🏆 Ladder complete!</div>';
      h += '</div>';
    });
    return h;
  };
})();
