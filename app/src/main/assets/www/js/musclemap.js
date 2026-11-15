/* Forge — detailed muscle activation model.
   ~35 individual muscles / heads. Each exercise gets a % share of total work, derived from its movement
   (name, pattern, equipment) using rules based on published EMG and biomechanics findings. Approximate,
   but far finer than "primary / secondary". */
(function () {
  'use strict';
  const SUB = {
    pec_upper: ['Upper chest', 'chest', 'Clavicular head of pectoralis major'],
    pec_mid: ['Mid chest', 'chest', 'Sternal head of pectoralis major'],
    pec_lower: ['Lower chest', 'chest', 'Costal (lower) fibres of pectoralis major'],
    serratus: ['Serratus anterior', 'chest', 'Rib-cage muscle that moves the shoulder blade forward'],
    delt_front: ['Front delt', 'shoulders', 'Anterior deltoid'],
    delt_side: ['Side delt', 'shoulders', 'Lateral deltoid — shoulder width'],
    delt_rear: ['Rear delt', 'shoulders', 'Posterior deltoid'],
    rotator: ['Rotator cuff', 'shoulders', 'Supraspinatus, infraspinatus, teres minor, subscapularis'],
    tri_long: ['Triceps long head', 'triceps', 'Largest head; also extends the shoulder'],
    tri_lat: ['Triceps lateral head', 'triceps', 'Outer "horseshoe" head'],
    tri_med: ['Triceps medial head', 'triceps', 'Deep head, works in every elbow extension'],
    bi_long: ['Biceps long head', 'biceps', 'Outer head — the "peak"'],
    bi_short: ['Biceps short head', 'biceps', 'Inner head — thickness'],
    brachialis: ['Brachialis', 'biceps', 'Under the biceps; pure elbow flexor'],
    brachiorad: ['Brachioradialis', 'forearms', 'Top of the forearm; neutral/overhand curls'],
    forearm_flex: ['Forearm flexors', 'forearms', 'Grip and wrist flexion'],
    forearm_ext: ['Forearm extensors', 'forearms', 'Wrist extension'],
    lats: ['Latissimus dorsi', 'lats', 'Back width'],
    teres: ['Teres major', 'lats', '"Little lat" under the armpit'],
    rhomboids: ['Rhomboids', 'middle back', 'Between the shoulder blades'],
    traps_mid: ['Mid & lower traps', 'middle back', 'Retract and depress the shoulder blades'],
    traps_upper: ['Upper traps', 'traps', 'Shrug / neck-to-shoulder'],
    erectors: ['Spinal erectors', 'lower back', 'Muscles alongside the spine'],
    rectus_abs: ['Rectus abdominis', 'abdominals', '"Six-pack" muscle'],
    obliques: ['Obliques', 'abdominals', 'Side abs — rotation and side bending'],
    tva: ['Deep core', 'abdominals', 'Transversus abdominis — bracing'],
    hip_flex: ['Hip flexors', 'quadriceps', 'Iliopsoas'],
    quads_vast: ['Vastus muscles', 'quadriceps', 'Outer, inner (teardrop) and middle quad'],
    rect_fem: ['Rectus femoris', 'quadriceps', 'Front quad crossing the hip'],
    ham_bf: ['Biceps femoris', 'hamstrings', 'Outer hamstring'],
    ham_semi: ['Semitendinosus & -membranosus', 'hamstrings', 'Inner hamstrings'],
    glute_max: ['Glute max', 'glutes', 'Gluteus maximus — hip extension'],
    glute_med: ['Glute medius', 'abductors', 'Side glute — hip stability & abduction'],
    adductors: ['Adductors', 'adductors', 'Inner thigh, incl. adductor magnus'],
    gastroc: ['Gastrocnemius', 'calves', 'Upper, two-headed calf'],
    soleus: ['Soleus', 'calves', 'Lower, deep calf'],
    neck: ['Neck', 'neck', 'Neck flexors/extensors'],
  };
  const GROUP_DEFAULT = {
    chest: { pec_mid: 0.5, pec_upper: 0.25, pec_lower: 0.25 }, shoulders: { delt_front: 0.4, delt_side: 0.4, delt_rear: 0.2 },
    triceps: { tri_long: 0.34, tri_lat: 0.33, tri_med: 0.33 }, biceps: { bi_long: 0.4, bi_short: 0.4, brachialis: 0.2 },
    forearms: { forearm_flex: 0.5, forearm_ext: 0.25, brachiorad: 0.25 }, lats: { lats: 0.8, teres: 0.2 },
    'middle back': { rhomboids: 0.5, traps_mid: 0.5 }, traps: { traps_upper: 1 }, 'lower back': { erectors: 1 },
    abdominals: { rectus_abs: 0.5, obliques: 0.3, tva: 0.2 }, quadriceps: { quads_vast: 0.8, rect_fem: 0.2 },
    hamstrings: { ham_bf: 0.5, ham_semi: 0.5 }, glutes: { glute_max: 0.85, glute_med: 0.15 }, adductors: { adductors: 1 },
    abductors: { glute_med: 1 }, calves: { gastroc: 0.6, soleus: 0.4 }, neck: { neck: 1 },
  };
  const has = (n, ...ks) => ks.some(k => n.includes(k));
  const mix = (...maps) => { const o = {}; maps.forEach(m => { for (const k in m) o[k] = (o[k] || 0) + m[k]; }); return o; };
  const TRI = (l, la, m) => ({ tri_long: l, tri_lat: la, tri_med: m });
  const HAM = v => ({ ham_bf: v / 2, ham_semi: v / 2 });
  const BI = (l, s, br, rad) => ({ bi_long: l, bi_short: s, brachialis: br, brachiorad: rad });

  function rules(e) {
    const n = e.n.toLowerCase(); const pm = e.pm[0]; const pat = e.pat; const iso = e.mech === 'i';
    if (e.cat === 'st') return null; // stretches handled generically
    // ---- Upper push ----
    if (has(n, 'pullover')) return { lats: 32, teres: 10, pec_lower: 18, pec_mid: 10, tri_long: 15, serratus: 10, rectus_abs: 5 };
    if (has(n, 'fly', 'flye', 'crossover', 'butterfly', 'pec deck', 'iron cross') && pm === 'chest') {
      if (has(n, 'incline', 'low cable', 'low-cable', 'low pulley')) return { pec_upper: 36, pec_mid: 26, pec_lower: 6, delt_front: 18, bi_short: 5, serratus: 5, rotator: 4 };
      if (has(n, 'decline', 'high', 'standing cable crossover', 'cable crossover')) return { pec_lower: 32, pec_mid: 32, pec_upper: 8, delt_front: 12, serratus: 8, bi_short: 4, rotator: 4 };
      return { pec_mid: 42, pec_upper: 16, pec_lower: 16, delt_front: 14, bi_short: 5, serratus: 4, rotator: 3 };
    }
    if (has(n, 'dip') && !has(n, 'bench dip') && (pm === 'chest' || has(n, 'chest version', 'parallel', 'ring'))) return mix({ pec_lower: 30, pec_mid: 16, delt_front: 14, serratus: 4, rectus_abs: 2 }, TRI(10, 14, 10));
    if (has(n, 'dip')) return mix({ pec_lower: 14, pec_mid: 6, delt_front: 14, serratus: 2 }, TRI(18, 24, 22));
    const pushup = has(n, 'push-up', 'pushup', 'push up');
    if (pat === 'hpush' || pushup || (pm === 'chest' && has(n, 'press')) || (pm === 'triceps' && has(n, 'bench press', 'floor press', 'close-grip', 'board press', 'pin press', 'jm press'))) {
      const close = has(n, 'close', 'narrow', 'diamond', 'triceps', 'jm press', 'board', 'pin press') || pm === 'triceps';
      let m;
      if (has(n, 'incline') && !pushup) m = mix({ pec_upper: 30, pec_mid: 14, pec_lower: 3, delt_front: 24, serratus: 4, rotator: 3 }, TRI(5, 9, 8));
      else if (has(n, 'decline') || (pushup && has(n, 'incline'))) m = mix({ pec_lower: 30, pec_mid: 26, pec_upper: 5, delt_front: 11, serratus: 4, rotator: 2 }, TRI(5, 9, 8));
      else if (pushup && has(n, 'feet elevated', 'decline')) m = mix({ pec_upper: 26, pec_mid: 20, delt_front: 22, serratus: 6 }, TRI(4, 10, 8));
      else m = mix({ pec_mid: 32, pec_lower: 12, pec_upper: 10, delt_front: 16, serratus: 4, rotator: 3 }, TRI(5, 10, 8));
      if (close) m = mix(m, { pec_mid: -12, pec_lower: -4 }, TRI(6, 8, 6));
      if (has(n, 'wide')) m = mix(m, { pec_mid: 6, pec_upper: 2 }, TRI(-2, -3, -2));
      if (has(n, 'floor press')) m = mix(m, { pec_lower: -6, delt_front: -6 }, TRI(2, 6, 6));
      if (e.eq === 'dumbbell' || e.eq === 'kettlebell') m = mix(m, { rotator: 3, pec_mid: 3 });
      if (pushup) m = mix(m, { rectus_abs: 5, tva: 5, serratus: 5, glute_max: 2 });
      return m;
    }
    // ---- Shoulders ----
    if (has(n, 'external rotation', 'internal rotation', 'cuban', 'car driver')) return { rotator: 70, delt_rear: 14, delt_side: 6, traps_mid: 10 };
    if (has(n, 'face pull')) return { delt_rear: 34, rotator: 22, traps_mid: 18, rhomboids: 12, traps_upper: 8, bi_long: 6 };
    if (has(n, 'rear delt', 'reverse fly', 'reverse flyes', 'reverse machine fly', 'back flyes', 'band pull apart', 'rear lateral', 'bent over low-pulley side lateral', 'rear-delt')) return { delt_rear: 46, rhomboids: 17, traps_mid: 17, rotator: 12, delt_side: 5, traps_upper: 3 };
    if (has(n, 'upright')) return { delt_side: 36, traps_upper: 30, delt_front: 14, bi_long: 6, brachialis: 6, brachiorad: 4, forearm_flex: 4 };
    if (has(n, 'shrug')) return { traps_upper: 74, traps_mid: 8, rhomboids: 6, forearm_flex: 12 };
    if (has(n, 'lateral', 'side lateral', 'deltoid raise', 'scaption', 'power partials', 'lying one-arm lateral', 'incline shoulder raise')) return { delt_side: 56, delt_front: 12, traps_upper: 14, rotator: 10, delt_rear: 5, serratus: 3 };
    if (has(n, 'front raise', 'front dumbbell raise', 'front cable raise', 'front plate', 'front two-dumbbell', 'front incline', 'front barbell raise', 'straight raises', 'single dumbbell raise', 'dumbbell raise', 'front delt raise')) return { delt_front: 54, pec_upper: 14, delt_side: 12, serratus: 8, traps_upper: 8, rotator: 4 };
    if (pat === 'vpush' || (pm === 'shoulders' && has(n, 'press', 'jerk', 'thruster', 'get-up'))) {
      let m = mix({ delt_front: 32, delt_side: 20, traps_upper: 8, pec_upper: 7, serratus: 5, rotator: 3 }, TRI(5, 9, 8));
      if (has(n, 'arnold')) m = mix(m, { delt_side: 4, delt_front: 2, pec_upper: -2 });
      if (has(n, 'behind', 'bradford')) m = mix(m, { delt_side: 6, delt_rear: 4, delt_front: -6 });
      if (has(n, 'standing', 'military', 'push press', 'jerk', 'kettlebell')) m = mix(m, { rectus_abs: 3, tva: 4, obliques: 3, erectors: 3 });
      if (has(n, 'push press', 'jerk', 'thruster')) m = mix(m, { quads_vast: 12, glute_max: 7, gastroc: 3 });
      return m;
    }
    // ---- Pulls ----
    if (has(n, 'straight-arm', 'straight arm', 'rope straight')) return { lats: 52, teres: 14, tri_long: 12, pec_lower: 6, delt_rear: 6, rectus_abs: 6, serratus: 4 };
    const vpull = pat === 'vpull' || has(n, 'pulldown', 'pull-up', 'pullup', 'pull up', 'chin', 'muscle up', 'rope climb');
    if (vpull) {
      let m = mix({ lats: 36, teres: 10, rhomboids: 9, traps_mid: 8, delt_rear: 6, forearm_flex: 5, rectus_abs: 2 }, BI(6, 6, 8, 4));
      if (has(n, 'chin', 'underhand', 'reverse grip', 'v-bar', 'close-grip')) m = mix(m, { lats: -3, teres: -1 }, BI(3, 4, 1, -1));
      if (has(n, 'wide', 'behind')) m = mix(m, { lats: 4, teres: 2, traps_mid: 2 }, BI(-2, -2, -2, 0));
      if (e.eq === 'bodyweight' || has(n, 'pull-up', 'pullup', 'chin')) m = mix(m, { rectus_abs: 3, tva: 3, forearm_flex: 3 });
      return m;
    }
    if (pat === 'hpull' || /\brows?\b/.test(n)) {
      let m = mix({ lats: 24, rhomboids: 17, traps_mid: 15, delt_rear: 12, teres: 6, forearm_flex: 4 }, BI(5, 4, 6, 4));
      if (has(n, 'bent over', 'bent-over', 't-bar', 'long bar', 'pendlay', 'reverse grip bent')) m = mix(m, { erectors: 10, ...HAM(4), glute_max: 4 });
      if (has(n, 'one-arm', 'one arm', 'single', 'alternating')) m = mix(m, { obliques: 4, lats: 3 });
      if (has(n, 'reverse grip', 'underhand', 'palms in')) m = mix(m, { lats: 3, traps_mid: -2 }, BI(2, 2, 0, 0));
      if (has(n, 'to neck', 'high row', 'rear delt row')) m = mix(m, { delt_rear: 8, traps_mid: 4, lats: -8 });
      if (has(n, 'inverted', 'bodyweight')) m = mix(m, { rectus_abs: 4, tva: 4, glute_max: 3 });
      return m;
    }
    // ---- Hinges ----
    if (has(n, 'romanian', 'stiff-legged', 'stiff leg', 'good morning', 'single-leg deadlift', 'one-legged deadlift')) {
      let m = mix(HAM(34), { glute_max: 24, erectors: 18, adductors: 10, forearm_flex: 6, traps_upper: 4, lats: 4 });
      if (has(n, 'good morning')) m = mix(m, { erectors: 8, forearm_flex: -6 });
      if (has(n, 'one-legged', 'single-leg')) m = mix(m, { glute_med: 8, obliques: 3 });
      return m;
    }
    if (has(n, 'sumo deadlift', 'sumo')) return mix({ glute_max: 22, quads_vast: 15, adductors: 15, erectors: 14, traps_upper: 6, lats: 4, forearm_flex: 8, tva: 4 }, HAM(12));
    if (has(n, 'rack pull')) return mix({ erectors: 22, glute_max: 22, traps_upper: 14, lats: 6, forearm_flex: 12, rhomboids: 4 }, HAM(14), { adductors: 6 });
    if (has(n, 'deadlift', 'clean', 'snatch', 'axle', 'log lift', 'atlas', 'tire flip')) {
      let m = mix({ glute_max: 20, erectors: 18, quads_vast: 12, adductors: 8, traps_upper: 6, lats: 5, forearm_flex: 8, rect_fem: 2, tva: 3 }, HAM(18));
      if (has(n, 'clean', 'snatch', 'high pull')) m = mix(m, { traps_upper: 6, delt_side: 4, gastroc: 4, delt_front: 3 });
      return m;
    }
    if (has(n, 'hip thrust', 'glute bridge', 'butt lift', 'hip raise', 'hip lift', 'pelvic tilt', 'physioball hip bridge', 'smith machine hip raise') && pm !== 'abdominals') return mix({ glute_max: 50, glute_med: 10, quads_vast: 8, adductors: 8, erectors: 4, rectus_abs: 4 }, HAM(16));
    if (has(n, 'kickback', 'glute kickback', 'hip extension', 'reverse hyper', 'donkey kick')) return mix({ glute_max: 58, glute_med: 12, erectors: 8 }, HAM(22));
    if (has(n, 'swing', 'pull through', 'pull-through')) return mix({ glute_max: 30, erectors: 14, quads_vast: 8, delt_front: 6, forearm_flex: 8, tva: 6, rectus_abs: 4, lats: 4 }, HAM(20));
    if (has(n, 'hyperextension', 'back extension', 'superman')) return mix({ erectors: 52, glute_max: 26 }, HAM(22));
    // ---- Legs ----
    if (has(n, 'leg extension')) return { quads_vast: 70, rect_fem: 30 };
    if (has(n, 'leg curl', 'glute ham', 'glute-ham', 'hamstring curl', 'ball leg curl', 'hamstring slide', 'prone manual')) return mix(HAM(78), { gastroc: 14 }, has(n, 'glute') ? { glute_max: 8 } : { ham_bf: 4, ham_semi: 4 });
    if (pm === 'calves' || has(n, 'calf')) return has(n, 'seated') ? { soleus: 68, gastroc: 28, tib: 0, forearm_flex: 0 } : { gastroc: 64, soleus: 32, tva: 4 };
    if (has(n, 'adductor', 'adduction')) return { adductors: 86, glute_max: 6, rect_fem: 8 };
    if (has(n, 'abductor', 'abduction', 'monster walk', 'side leg raise', 'hip circles')) return { glute_med: 72, glute_max: 18, rect_fem: 10 };
    if (pat === 'lunge' || has(n, 'lunge', 'split squat', 'step up', 'step-up', 'step ups', 'bulgarian', 'pistol')) {
      let m = mix({ quads_vast: 30, rect_fem: 6, glute_max: 26, glute_med: 10, adductors: 10, gastroc: 3, soleus: 3, tva: 4 }, HAM(8));
      if (has(n, 'step')) m = mix(m, { glute_max: 6, quads_vast: -2 });
      if (has(n, 'rear', 'reverse', 'back lunge')) m = mix(m, { glute_max: 4, quads_vast: -4 });
      return m;
    }
    if (pat === 'squat' || has(n, 'squat', 'leg press', 'hack', 'wall sit', 'sissy')) {
      let m;
      if (has(n, 'leg press', 'hack', 'lying machine squat')) m = mix({ quads_vast: 42, rect_fem: 6, glute_max: 24, adductors: 14, gastroc: 4, soleus: 4 }, HAM(6));
      else if (has(n, 'front', 'goblet', 'zercher', 'kettlebells')) m = mix({ quads_vast: 36, rect_fem: 7, glute_max: 18, adductors: 10, erectors: 8, rectus_abs: 4, tva: 5, traps_mid: 4, soleus: 3 }, HAM(5));
      else m = mix({ quads_vast: 30, rect_fem: 6, glute_max: 22, adductors: 14, erectors: 9, glute_med: 4, tva: 5, soleus: 3, gastroc: 2 }, HAM(5));
      if (has(n, 'wide', 'sumo', 'plie')) m = mix(m, { adductors: 10, glute_max: 4, quads_vast: -8 });
      if (has(n, 'narrow', 'close')) m = mix(m, { quads_vast: 6, adductors: -4, glute_max: -2 });
      if (has(n, 'box')) m = mix(m, { glute_max: 4, ham_bf: 2, ham_semi: 2, quads_vast: -6 });
      if (has(n, 'jump')) m = mix(m, { gastroc: 8, soleus: 4 });
      if (e.eq === 'bodyweight' && !has(n, 'jump')) m = mix(m, { erectors: -4 });
      return m;
    }
    // ---- Arms ----
    if (pm === 'biceps' || (has(n, 'curl') && !has(n, 'wrist', 'leg', 'finger') && pm !== 'forearms')) {
      if (has(n, 'hammer', 'cross body', 'cross-body', 'neutral', 'rope attachment')) return mix(BI(18, 12, 32, 30), { forearm_flex: 8 });
      if (has(n, 'reverse', 'zottman')) return mix(BI(10, 8, 30, 34), { forearm_ext: 18 });
      if (has(n, 'preacher', 'spider', 'concentration', 'machine', 'prone incline', 'lying high bench')) return mix(BI(20, 40, 28, 7), { forearm_flex: 5 });
      if (has(n, 'incline', 'drag', 'overhead cable', 'high cable', 'behind', 'lying supine', 'lying cable')) return mix(BI(42, 20, 22, 10), { forearm_flex: 4, delt_front: 2 });
      if (has(n, 'wide')) return mix(BI(22, 40, 22, 8), { forearm_flex: 8 });
      if (has(n, 'close')) return mix(BI(40, 22, 22, 8), { forearm_flex: 8 });
      return mix(BI(30, 30, 22, 10), { forearm_flex: 5, delt_front: 3 });
    }
    if (pm === 'triceps' || has(n, 'tricep', 'skull', 'kickback', 'pushdown', 'french press', 'tate press')) {
      if (has(n, 'overhead', 'behind the head', 'french', 'standing dumbbell triceps', 'standing one-arm dumbbell triceps', 'seated triceps press', 'towel', 'speed band overhead', 'kneeling cable triceps', 'incline barbell triceps', 'cable incline triceps')) return mix(TRI(50, 22, 22), { rotator: 3, rectus_abs: 3 });
      if (has(n, 'reverse grip')) return TRI(20, 30, 50);
      if (has(n, 'pushdown', 'push down', 'press down')) return has(n, 'rope') ? TRI(22, 44, 30) : mix(TRI(22, 40, 32), { forearm_flex: 6 });
      if (has(n, 'kickback', 'bent-over')) return mix(TRI(32, 38, 26), { delt_rear: 4 });
      if (has(n, 'skull', 'lying', 'decline', 'tate', 'body tricep', 'band skull')) return mix(TRI(38, 30, 28), { forearm_flex: 4 });
      return TRI(34, 33, 33);
    }
    if (pm === 'forearms' || has(n, 'wrist', 'finger curl', 'grip', 'farmer', 'plate pinch', 'wrist roller')) {
      if (has(n, 'palms-down', 'palms down', 'pronation', 'extens', 'reverse')) return { forearm_ext: 82, brachiorad: 18 };
      if (has(n, 'farmer', 'carry', 'walk')) return { forearm_flex: 40, traps_upper: 25, tva: 15, obliques: 10, gastroc: 10 };
      return { forearm_flex: 86, forearm_ext: 6, brachiorad: 8 };
    }
    // ---- Core ----
    if (pm === 'abdominals' || pm === 'lower back' && has(n, 'side')) {
      if (has(n, 'twist', 'oblique', 'side bend', 'side bridge', 'side jackknife', 'wood chop', 'windmill', 'judo', 'russian', 'pallof', 'heel touch', 'figure 8', 'pass between', 'landmine 180', 'cable lift', 'side plank', 'elbow to knee', 'cross-body crunch', 'cross body crunch', 'spell caster', 'bicycle', 'air bike')) return { obliques: 52, rectus_abs: 24, tva: 18, glute_med: 3, delt_side: 3 };
      if (has(n, 'leg raise', 'knee raise', 'reverse crunch', 'pull-in', 'pull in', 'tuck', 'flutter', 'scissor', 'leg lift', 'hip raise', 'bottoms up', 'butt-ups', 'jackknife', 'v-up', 'hanging', 'leg tucks', 'toe touch', 'hanging pike')) return { rectus_abs: 44, hip_flex: 28, obliques: 14, tva: 10, rect_fem: 4 };
      if (has(n, 'plank', 'dead bug', 'rollout', 'ab roller', 'body saw', 'spider crawl', 'bird', 'stomach vacuum', 'fallout', 'cocoon', 'otis')) return { tva: 34, rectus_abs: 32, obliques: 14, serratus: 6, glute_max: 6, delt_front: 4, lats: has(n, 'roll') ? 4 : 0, hip_flex: 0 };
      if (has(n, 'mountain climber')) return { rectus_abs: 24, hip_flex: 20, quads_vast: 14, delt_front: 14, tva: 14, obliques: 8, gastroc: 6 };
      if (has(n, 'sit-up', 'sit up', 'situp')) return { rectus_abs: 50, hip_flex: 22, obliques: 18, tva: 10 };
      return { rectus_abs: 60, obliques: 22, tva: 12, hip_flex: 6 };
    }
    // ---- Plyometric / conditioning ----
    if (e.cat === 'p' || e.cat === 'c') {
      if (has(n, 'rope jump', 'skip', 'skipping', 'butt kick', 'hop')) return { gastroc: 38, soleus: 26, quads_vast: 16, glute_max: 8, hip_flex: 6, tva: 6 };
      if (has(n, 'throw', 'slam', 'chest pass', 'chest push', 'medicine ball')) return { delt_front: 22, pec_mid: 18, tri_lat: 12, lats: 12, rectus_abs: 12, obliques: 12, quads_vast: 6, glute_max: 6 };
      if (has(n, 'push-up', 'push up', 'drop push')) return mix({ pec_mid: 34, delt_front: 20, serratus: 8, rectus_abs: 8 }, TRI(8, 12, 10));
      return { quads_vast: 30, glute_max: 20, gastroc: 16, soleus: 8, rect_fem: 6, ham_bf: 5, ham_semi: 5, hip_flex: 5, tva: 5 };
    }
    if (has(n, 'battling rope', 'battle rope')) return { delt_front: 26, delt_side: 10, forearm_flex: 14, rectus_abs: 14, tva: 12, obliques: 10, quads_vast: 8, glute_max: 6 };
    if (has(n, 'sled', 'prowler', 'yoke', 'rickshaw')) return mix({ quads_vast: 28, glute_max: 24, gastroc: 12, soleus: 6, erectors: 8, tva: 6 }, HAM(10), { forearm_flex: 6 });
    return null;
  }

  function generic(e) {
    const m = {};
    e.pm.forEach(g => { const d = GROUP_DEFAULT[g] || {}; for (const k in d) m[k] = (m[k] || 0) + d[k] * (e.cat === 'st' ? 100 : 70) / e.pm.length; });
    e.sm.forEach(g => { const d = GROUP_DEFAULT[g] || {}; for (const k in d) m[k] = (m[k] || 0) + d[k] * 30 / Math.max(1, e.sm.length); });
    return m;
  }

  const CACHE = {};
  /** Sorted [{k, label, group, pct}] summing to 100. */
  function detail(e) {
    if (!e) return [];
    if (CACHE[e.id]) return CACHE[e.id];
    let m = e.dm ? Object.assign({}, e.dm) : (rules(e) || generic(e));
    // Make sure every muscle the database lists as involved shows up (as at least a stabiliser).
    const groupsIn = new Set(Object.keys(m).filter(k => m[k] > 0 && SUB[k]).map(k => SUB[k][1]));
    e.pm.concat(e.sm).forEach(g => { if (!groupsIn.has(g) && GROUP_DEFAULT[g]) { const d = GROUP_DEFAULT[g]; for (const k in d) m[k] = (m[k] || 0) + d[k] * (e.pm.includes(g) ? 12 : 4); } });
    const list = Object.keys(m).filter(k => SUB[k] && m[k] > 0.5).map(k => ({ k, v: m[k] }));
    const tot = list.reduce((a, x) => a + x.v, 0) || 1;
    const out = list.map(x => ({ k: x.k, label: SUB[x.k][0], group: SUB[x.k][1], info: SUB[x.k][2], pct: x.v / tot * 100 }))
      .sort((a, b) => b.pct - a.pct);
    // round so it sums to 100
    let acc = 0; out.forEach((x, i) => { x.pct = i === out.length - 1 ? Math.max(1, 100 - acc) : Math.max(1, Math.round(x.pct)); acc += x.pct; });
    return (CACHE[e.id] = out);
  }
  const role = pct => pct >= 15 ? 'Primary' : pct >= 6 ? 'Secondary' : 'Stabiliser';

  /** Group-level involvement 0..1 (top group = 1) — used by fatigue & volume models. */
  function groupInvolvement(e) {
    const g = {}; detail(e).forEach(x => { g[x.group] = (g[x.group] || 0) + x.pct; });
    const mx = Math.max(1, ...Object.values(g)); const out = {};
    for (const k in g) { const v = g[k] / mx; if (v >= 0.06) out[k] = Math.round(v * 100) / 100; }
    return out;
  }

  /** Body-map values with view-specific detail (front view shows front/side delts, back view rear delts, etc.). */
  function mapValues(sub) {
    // sub: { subKey: weight }
    const v = k => sub[k] || 0;
    const front = {}, back = {};
    const set = (o, g, x) => { if (x > 0) o[g] = Math.max(o[g] || 0, x); };
    set(front, 'chest', Math.max(v('pec_upper'), v('pec_mid'), v('pec_lower')) + v('serratus') * 0.3);
    set(front, 'shoulders', Math.max(v('delt_front'), v('delt_side') * 0.8));
    set(back, 'shoulders', Math.max(v('delt_rear'), v('delt_side') * 0.8, v('rotator') * 0.7));
    set(front, 'traps', v('traps_upper')); set(back, 'traps', Math.max(v('traps_upper'), v('traps_mid') * 0.6));
    set(back, 'middle back', Math.max(v('rhomboids'), v('traps_mid'))); set(back, 'lats', Math.max(v('lats'), v('teres')));
    set(back, 'lower back', v('erectors'));
    set(front, 'biceps', Math.max(v('bi_long'), v('bi_short'), v('brachialis')));
    set(back, 'triceps', Math.max(v('tri_long'), v('tri_lat'), v('tri_med')));
    set(front, 'forearms', Math.max(v('forearm_flex'), v('brachiorad'))); set(back, 'forearms', Math.max(v('forearm_ext'), v('brachiorad') * 0.6));
    set(front, 'abdominals', Math.max(v('rectus_abs'), v('obliques'), v('tva') * 0.8));
    set(front, 'quadriceps', Math.max(v('quads_vast'), v('rect_fem'), v('hip_flex') * 0.6));
    set(front, 'adductors', v('adductors'));
    set(back, 'hamstrings', Math.max(v('ham_bf'), v('ham_semi'))); set(back, 'glutes', v('glute_max'));
    set(back, 'abductors', v('glute_med'));
    set(front, 'calves', Math.max(v('soleus'), v('gastroc') * 0.6)); set(back, 'calves', Math.max(v('gastroc'), v('soleus') * 0.6));
    const mx = Math.max(0.0001, ...Object.values(front), ...Object.values(back));
    for (const o of [front, back]) for (const k in o) o[k] = Math.min(1, o[k] / mx);
    return { front, back };
  }
  const subMap = list => { const o = {}; list.forEach(x => { o[x.k] = (o[x.k] || 0) + x.pct; }); return o; };

  window.Muscles = { SUB, detail, role, groupInvolvement, mapValues, subMap };
})();
