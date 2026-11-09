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
  ];
  window.ADDON_IDS = Array.from(new Set(P.flatMap(p => p.sessions.flatMap(s => s.items.map(i => i[0])))));
})();
