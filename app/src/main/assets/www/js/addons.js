/* Forge — add-on mini programs (6–7 sessions, done one at a time alongside the main plan).
   Item: [exerciseId, sets, target, unit ('r' reps | 's' seconds), restSec, displayAlias?] */
(function () {
  'use strict';
  const P = window.ADDONS = [
    {
      id: 'core', name: 'Core Crusher', icon: '🧱', color: '#ff6a33', min: 12, level: 'All levels',
      desc: 'Seven short ab & core sessions that build from stability to strength. Great as a 12-minute finisher.',
      sessions: [
        { t: 'Foundation', items: [['Crunches', 2, 15, 'r', 30], ['Plank', 2, 30, 's', 30], ['Dead_Bug', 2, 10, 'r', 30], ['Reverse_Crunch', 2, 12, 'r', 30]] },
        { t: 'Obliques', items: [['Russian_Twist', 3, 20, 'r', 30], ['Side_Bridge', 2, 25, 's', 20], ['Cross-Body_Crunch', 2, 12, 'r', 30], ['Plank', 2, 35, 's', 30]] },
        { t: 'Lower abs', items: [['Flutter_Kicks', 3, 30, 's', 30], ['Leg_Pull-In', 3, 12, 'r', 30], ['Reverse_Crunch', 3, 12, 'r', 30], ['Dead_Bug', 2, 12, 'r', 30]] },
        { t: 'Anti-rotation', items: [['Plank', 3, 40, 's', 30], ['Side_Bridge', 3, 30, 's', 20], ['Bottoms_Up', 3, 10, 'r', 30], ['Superman', 2, 30, 's', 30]] },
        { t: 'Burner', items: [['Mountain_Climbers', 3, 30, 's', 30], ['Air_Bike', 3, 20, 'r', 30], ['Jackknife_Sit-Up', 3, 12, 'r', 30], ['Plank', 2, 45, 's', 30]] },
        { t: 'Strength', items: [['Hanging_Leg_Raise', 3, 10, 'r', 45], ['Ab_Roller', 3, 8, 'r', 45], ['Side_Bridge', 3, 35, 's', 20], ['Toe_Touchers', 3, 15, 'r', 30]] },
        { t: 'Final test', items: [['Plank', 1, 90, 's', 60], ['Crunches', 2, 25, 'r', 30], ['Russian_Twist', 2, 30, 'r', 30], ['Flutter_Kicks', 2, 45, 's', 30], ['Hanging_Leg_Raise', 2, 12, 'r', 45]] },
      ],
    },
    {
      id: 'cali', name: 'Calisthenics Foundations', icon: '🤸', color: '#2fd3a8', min: 25, level: 'Beginner → intermediate',
      desc: 'Bodyweight strength: push-ups, pull-ups, dips, squats and core control. No gym needed beyond a bar.',
      sessions: [
        { t: 'Baseline', items: [['Pushups', 3, 10, 'r', 60], ['Inverted_Row', 3, 8, 'r', 60], ['Bodyweight_Squat', 3, 15, 'r', 45], ['Plank', 2, 30, 's', 30]] },
        { t: 'Pull focus', items: [['Scapular_Pull-Up', 3, 8, 'r', 45], ['Chin-Up', 3, 5, 'r', 90], ['Inverted_Row', 3, 10, 'r', 60], ['Hanging_Leg_Raise', 2, 8, 'r', 45]] },
        { t: 'Push focus', items: [['Pushups', 3, 12, 'r', 60], ['Bench_Dips', 3, 12, 'r', 60], ['Push-Ups_With_Feet_Elevated', 3, 8, 'r', 60], ['Push_Up_to_Side_Plank', 2, 8, 'r', 45]] },
        { t: 'Legs & core', items: [['Bodyweight_Walking_Lunge', 3, 12, 'r', 45], ['Single_Leg_Glute_Bridge', 3, 12, 'r', 45], ['Freehand_Jump_Squat', 3, 10, 'r', 60], ['Side_Bridge', 2, 30, 's', 20]] },
        { t: 'Full body', items: [['Pullups', 3, 6, 'r', 90], ['Dips_-_Triceps_Version', 3, 8, 'r', 90], ['Bodyweight_Squat', 3, 20, 'r', 45], ['Pushups', 2, 15, 'r', 60]] },
        { t: 'Advanced push', items: [['Decline_Push-Up', 3, 10, 'r', 60], ['Pushups_Close_and_Wide_Hand_Positions', 3, 10, 'r', 60], ['Parallel_Bar_Dip', 3, 10, 'r', 90], ['Plank', 2, 60, 's', 30]] },
        { t: 'Max test', items: [['Pullups', 2, 10, 'r', 120], ['Pushups', 2, 25, 'r', 90], ['Dips_-_Triceps_Version', 2, 15, 'r', 90], ['Bodyweight_Squat', 1, 40, 'r', 60], ['Hanging_Leg_Raise', 2, 12, 'r', 60]] },
      ],
    },
    {
      id: 'mobility', name: 'Mobility & Stretch', icon: '🧘', color: '#6aa8ff', min: 15, level: 'All levels',
      desc: 'Six stretch & mobility sessions for hips, hamstrings, shoulders and spine. Ideal on rest days.',
      sessions: [
        { t: 'Hips', items: [['Kneeling_Hip_Flexor', 2, 40, 's', 10], ['Worlds_Greatest_Stretch', 2, 6, 'r', 10], ['Lying_Glute', 2, 40, 's', 10], ['Groin_and_Back_Stretch', 2, 40, 's', 10], ['Standing_Hip_Circles', 1, 10, 'r', 10]] },
        { t: 'Hamstrings & calves', items: [['Hamstring_Stretch', 2, 40, 's', 10], ['Runners_Stretch', 2, 40, 's', 10], ['Standing_Gastrocnemius_Calf_Stretch', 2, 40, 's', 10], ['Inchworm', 2, 6, 'r', 15], ['Seated_Floor_Hamstring_Stretch', 1, 60, 's', 10]] },
        { t: 'Shoulders & chest', items: [['Arm_Circles', 1, 30, 's', 10], ['Chest_And_Front_Of_Shoulder_Stretch', 2, 40, 's', 10], ['Overhead_Lat', 2, 40, 's', 10], ['Triceps_Stretch', 2, 30, 's', 10], ['Round_The_World_Shoulder_Stretch', 2, 8, 'r', 10]] },
        { t: 'Spine', items: [['Cat_Stretch', 2, 10, 'r', 10], ['Spinal_Stretch', 2, 40, 's', 10], ['Childs_Pose', 2, 45, 's', 10], ['Middle_Back_Stretch', 2, 30, 's', 10], ['Hug_Knees_To_Chest', 1, 60, 's', 10]] },
        { t: 'Full-body flow', items: [['Worlds_Greatest_Stretch', 2, 8, 'r', 10], ['Inchworm', 2, 6, 'r', 15], ['Quad_Stretch', 2, 40, 's', 10], ['The_Straddle', 2, 45, 's', 10], ['Upper_Back_Stretch', 2, 30, 's', 10]] },
        { t: 'Deep release', items: [['Lying_Glute', 2, 60, 's', 10], ['Seated_Floor_Hamstring_Stretch', 2, 60, 's', 10], ['Kneeling_Hip_Flexor', 2, 60, 's', 10], ['Childs_Pose', 1, 90, 's', 10], ['Side-Lying_Floor_Stretch', 2, 45, 's', 10]] },
      ],
    },
    {
      id: 'bootcamp', name: 'Boot Camp', icon: '🎖️', color: '#f5b83d', min: 20, level: 'Intermediate',
      desc: 'Military-style conditioning: push-ups, sit-ups, jumps, crawls and sprints. Short rests, high output.',
      sessions: [
        { t: 'Day 1 · Basic', items: [['Star_Jump', 3, 30, 's', 20], ['Pushups', 3, 12, 'r', 30], ['Sit-Up', 3, 15, 'r', 30], ['Bodyweight_Squat', 3, 20, 'r', 30], ['Mountain_Climbers', 3, 30, 's', 30]] },
        { t: 'Day 2 · Legs', items: [['Fast_Skipping', 3, 30, 's', 20], ['Bodyweight_Walking_Lunge', 3, 16, 'r', 30], ['Freehand_Jump_Squat', 3, 12, 'r', 30], ['Split_Jump', 3, 10, 'r', 30], ['Flutter_Kicks', 3, 30, 's', 30]] },
        { t: 'Day 3 · Upper', items: [['Pushups', 4, 15, 'r', 30], ['Pullups', 4, 5, 'r', 45], ['Bench_Dips', 3, 15, 'r', 30], ['Spider_Crawl', 3, 30, 's', 30], ['Plank', 3, 45, 's', 20]] },
        { t: 'Day 4 · Engine', items: [['Rope_Jumping', 4, 45, 's', 20], ['Knee_Tuck_Jump', 3, 10, 'r', 30], ['Mountain_Climbers', 3, 40, 's', 20], ['Star_Jump', 3, 40, 's', 20]] },
        { t: 'Day 5 · PT test prep', items: [['Pushups', 3, 20, 'r', 45], ['Sit-Up', 3, 25, 'r', 45], ['Wind_Sprints', 4, 20, 's', 40], ['Bodyweight_Squat', 2, 30, 'r', 30]] },
        { t: 'Day 6 · Grinder', items: [['Spider_Crawl', 4, 30, 's', 20], ['Pushups', 4, 15, 'r', 20], ['Freehand_Jump_Squat', 4, 15, 'r', 20], ['Russian_Twist', 3, 30, 'r', 20], ['Plank', 2, 60, 's', 20]] },
        { t: 'Day 7 · Final PT test', items: [['Pushups', 1, 50, 'r', 120], ['Sit-Up', 1, 50, 'r', 120], ['Pullups', 1, 12, 'r', 120], ['Wind_Sprints', 6, 20, 's', 40]] },
      ],
    },
    {
      id: 'yoga', name: 'Yoga-Style Flow', icon: '🪷', color: '#c08bff', min: 18, level: 'All levels',
      desc: 'Six calm, pose-based flows for flexibility, balance and breathing. Hold each pose and breathe slowly.',
      sessions: [
        { t: 'Grounding', items: [['Childs_Pose', 1, 60, 's', 5, "Child's pose"], ['Cat_Stretch', 2, 8, 'r', 5, 'Cat–cow'], ['Upward_Stretch', 2, 30, 's', 5, 'Mountain reach'], ['Kneeling_Hip_Flexor', 2, 45, 's', 5, 'Low lunge'], ['Hug_Knees_To_Chest', 1, 60, 's', 5, 'Knees to chest']] },
        { t: 'Open hips', items: [['Kneeling_Hip_Flexor', 2, 45, 's', 5, 'Low lunge'], ['Lying_Glute', 2, 60, 's', 5, 'Supine pigeon'], ['Groin_and_Back_Stretch', 2, 45, 's', 5, 'Butterfly fold'], ['The_Straddle', 1, 60, 's', 5, 'Wide-leg fold'], ['Childs_Pose', 1, 60, 's', 5, "Child's pose"]] },
        { t: 'Strong & steady', items: [['Plank', 2, 30, 's', 10, 'Plank pose'], ['Side_Bridge', 2, 25, 's', 10, 'Side plank'], ['Superman', 2, 25, 's', 10, 'Locust'], ['Pelvic_Tilt_Into_Bridge', 2, 8, 'r', 10, 'Bridge flow'], ['Childs_Pose', 1, 60, 's', 5, "Child's pose"]] },
        { t: 'Spine & twist', items: [['Cat_Stretch', 2, 10, 'r', 5, 'Cat–cow'], ['Spinal_Stretch', 2, 45, 's', 5, 'Seated twist'], ['Knee_Across_The_Body', 2, 45, 's', 5, 'Supine twist'], ['Standing_Lateral_Stretch', 2, 30, 's', 5, 'Standing side bend'], ['One_Half_Locust', 2, 30, 's', 5, 'Half locust']] },
        { t: 'Hamstrings & fold', items: [['Standing_Toe_Touches', 2, 10, 'r', 5, 'Forward fold'], ['Runners_Stretch', 2, 45, 's', 5, 'Half splits'], ['Seated_Floor_Hamstring_Stretch', 2, 60, 's', 5, 'Seated forward fold'], ['Worlds_Greatest_Stretch', 2, 6, 'r', 5, 'Lunge twist flow'], ['Hug_Knees_To_Chest', 1, 60, 's', 5, 'Knees to chest']] },
        { t: 'Full flow', items: [['Upward_Stretch', 1, 30, 's', 5, 'Mountain reach'], ['Inchworm', 2, 5, 'r', 10, 'Walk-out flow'], ['Kneeling_Hip_Flexor', 2, 45, 's', 5, 'Low lunge'], ['Side_Bridge', 2, 30, 's', 10, 'Side plank'], ['Pelvic_Tilt_Into_Bridge', 2, 10, 'r', 5, 'Bridge flow'], ['Childs_Pose', 1, 90, 's', 5, 'Resting pose']] },
      ],
    },
    {
      id: 'home', name: 'No-Equipment Home', icon: '🏠', color: '#2fd3a8', min: 25, level: 'All levels',
      desc: 'Seven full-body sessions with zero equipment — just floor space and a chair. Perfect for travel or busy days.',
      sessions: [
        { t: 'Foundations', items: [['x_jumping_jack', 2, 40, 's', 20], ['Bodyweight_Squat', 3, 15, 'r', 45], ['Pushups', 3, 10, 'r', 60], ['Butt_Lift_Bridge', 3, 15, 'r', 45], ['Plank', 2, 40, 's', 30]] },
        { t: 'Lower body', items: [['x_high_knees', 2, 30, 's', 20], ['Bodyweight_Walking_Lunge', 3, 12, 'r', 45], ['Single_Leg_Glute_Bridge', 3, 12, 'r', 45], ['x_wall_sit', 3, 40, 's', 45], ['x_calf_raise_bw', 3, 20, 'r', 30]] },
        { t: 'Upper body', items: [['Pushups', 3, 12, 'r', 60], ['x_pike_pushup', 3, 8, 'r', 60], ['Bench_Dips', 3, 12, 'r', 60], ['x_plank_tap', 3, 20, 'r', 30], ['Superman', 2, 30, 's', 30]] },
        { t: 'Conditioning', items: [['x_burpee', 4, 8, 'r', 45], ['Mountain_Climbers', 4, 30, 's', 30], ['x_skater_jump', 3, 20, 'r', 30], ['Freehand_Jump_Squat', 3, 12, 'r', 45]] },
        { t: 'Core & posture', items: [['x_bird_dog', 3, 10, 'r', 30], ['x_hollow_hold', 3, 25, 's', 30], ['Side_Bridge', 2, 30, 's', 20], ['x_v_up', 3, 10, 'r', 45], ['Superman', 3, 12, 'r', 30]] },
        { t: 'Full body', items: [['x_bear_crawl', 3, 30, 's', 45], ['Push-Ups_With_Feet_Elevated', 3, 10, 'r', 60], ['Bodyweight_Squat', 3, 20, 'r', 45], ['x_crab_walk', 3, 30, 's', 45], ['Plank', 2, 60, 's', 30]] },
        { t: 'Final challenge', items: [['x_burpee', 1, 20, 'r', 60], ['Pushups', 2, 20, 'r', 60], ['Bodyweight_Squat', 2, 30, 'r', 45], ['x_wall_sit', 1, 90, 's', 60], ['Plank', 1, 90, 's', 60]] },
      ],
    },
    {
      id: 'core2', name: 'Core 2.0', icon: '🔥', color: '#ff4a4a', min: 15, level: 'Intermediate → advanced',
      desc: 'Gymnast-style core: hollow body, V-ups, hanging work, dragon flags and L-sits. For after Core Crusher.',
      sessions: [
        { t: 'Hollow basics', items: [['x_hollow_hold', 3, 30, 's', 30], ['x_hollow_rock', 3, 15, 'r', 30], ['x_plank_tap', 3, 20, 'r', 30], ['Side_Bridge', 2, 40, 's', 20]] },
        { t: 'Hanging', items: [['x_hanging_knee', 3, 12, 'r', 45], ['Hanging_Leg_Raise', 3, 8, 'r', 60], ['x_dead_hang', 2, 40, 's', 45], ['x_hollow_hold', 2, 40, 's', 30]] },
        { t: 'Dynamic', items: [['x_v_up', 3, 12, 'r', 45], ['Russian_Twist', 3, 30, 'r', 30], ['Mountain_Climbers', 3, 40, 's', 30], ['x_hollow_rock', 3, 20, 'r', 30]] },
        { t: 'Anti-extension', items: [['Ab_Roller', 3, 8, 'r', 60], ['x_bird_dog', 3, 12, 'r', 30], ['Plank', 2, 75, 's', 30], ['x_dragon_flag', 3, 3, 'r', 90]] },
        { t: 'Compression', items: [['x_l_sit', 4, 10, 's', 45], ['x_v_up', 3, 15, 'r', 45], ['x_toes_to_bar', 3, 5, 'r', 90], ['x_hollow_hold', 2, 45, 's', 30]] },
        { t: 'Test day', items: [['x_hollow_hold', 1, 60, 's', 60], ['x_toes_to_bar', 2, 8, 'r', 90], ['x_dragon_flag', 2, 5, 'r', 90], ['x_l_sit', 2, 20, 's', 60]] },
      ],
    },
    {
      id: 'plyo', name: 'Plyo Power', icon: '⚡', color: '#f5b83d', min: 20, level: 'Intermediate',
      desc: 'Jumps, bounds and explosive push-ups to build power and athleticism. Land softly; quality over quantity.',
      sessions: [
        { t: 'Landing mechanics', items: [['x_jumping_jack', 2, 40, 's', 20], ['Freehand_Jump_Squat', 3, 8, 'r', 60], ['Standing_Long_Jump', 3, 5, 'r', 60], ['x_skater_jump', 3, 12, 'r', 45]] },
        { t: 'Vertical', items: [['Knee_Tuck_Jump', 4, 6, 'r', 60], ['Rocket_Jump', 3, 8, 'r', 60], ['Split_Jump', 3, 10, 'r', 60], ['x_calf_raise_bw', 2, 20, 'r', 30]] },
        { t: 'Lateral', items: [['Lateral_Bound', 4, 8, 'r', 60], ['x_skater_jump', 3, 16, 'r', 45], ['Single-Leg_Lateral_Hop', 3, 8, 'r', 60], ['x_high_knees', 3, 30, 's', 30]] },
        { t: 'Upper power', items: [['Plyo_Push-up', 4, 6, 'r', 75], ['x_burpee', 3, 8, 'r', 60], ['Pushups', 2, 15, 'r', 60], ['Mountain_Climbers', 3, 30, 's', 30]] },
        { t: 'Combo', items: [['x_burpee', 4, 10, 'r', 60], ['Knee_Tuck_Jump', 3, 8, 'r', 60], ['Standing_Long_Jump', 3, 6, 'r', 60], ['Plyo_Push-up', 3, 6, 'r', 75]] },
        { t: 'Power test', items: [['Standing_Long_Jump', 3, 3, 'r', 90], ['Knee_Tuck_Jump', 2, 12, 'r', 90], ['x_burpee', 1, 25, 'r', 60], ['Lateral_Bound', 2, 10, 'r', 60]] },
      ],
    },
    {
      id: 'skills', name: 'Calisthenics Skills', icon: '🤸', color: '#6aa8ff', min: 30, level: 'Intermediate → advanced',
      desc: 'Seven sessions working toward pull-ups, pistol squats, L-sits and handstand push-ups. Pairs with the Skills ladders.',
      sessions: [
        { t: 'Pull foundations', items: [['x_dead_hang', 3, 30, 's', 45], ['Scapular_Pull-Up', 3, 8, 'r', 45], ['Inverted_Row', 3, 10, 'r', 60], ['Band_Assisted_Pull-Up', 3, 6, 'r', 90]] },
        { t: 'Push foundations', items: [['Pushups', 3, 12, 'r', 60], ['x_pike_pushup', 3, 8, 'r', 75], ['Dips_-_Triceps_Version', 3, 6, 'r', 90], ['x_plank_tap', 2, 20, 'r', 30]] },
        { t: 'Single leg', items: [['Bodyweight_Walking_Lunge', 3, 12, 'r', 45], ['x_wall_sit', 2, 60, 's', 45], ['x_pistol_squat', 4, 3, 'r', 90], ['Single_Leg_Glute_Bridge', 3, 12, 'r', 45]] },
        { t: 'Compression', items: [['x_hollow_hold', 3, 30, 's', 30], ['x_l_sit', 5, 8, 's', 45], ['x_hanging_knee', 3, 10, 'r', 60], ['x_v_up', 3, 10, 'r', 45]] },
        { t: 'Strict pulling', items: [['Chin-Up', 4, 5, 'r', 120], ['Pullups', 3, 5, 'r', 120], ['Inverted_Row', 2, 12, 'r', 60], ['x_dead_hang', 2, 45, 's', 45]] },
        { t: 'Inversions', items: [['x_pike_pushup', 3, 10, 'r', 75], ['x_wall_handstand', 4, 20, 's', 60], ['x_crab_walk', 2, 30, 's', 45], ['x_hollow_hold', 2, 40, 's', 30]] },
        { t: 'Skill test', items: [['Pullups', 1, 10, 'r', 120], ['x_pistol_squat', 2, 5, 'r', 120], ['x_l_sit', 2, 15, 's', 60], ['x_wall_handstand', 1, 45, 's', 60], ['Muscle_Up', 3, 1, 'r', 120]] },
      ],
    },
  ];
  window.ADDON_IDS = Array.from(new Set(P.flatMap(p => p.sessions.flatMap(s => s.items.map(i => i[0])))));
})();
