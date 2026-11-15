"""Forge — original stick-figure demo frames (2 poses each) for calisthenics/core moves missing from the
public-domain exercise database. Output: img/<id>__0.webp and __1.webp (420x280), same flip-animation as photos."""
import json, math
from PIL import Image, ImageDraw

W, H, SC = 300, 200, 1.4
BG = (244, 241, 234); GROUND = (214, 208, 196); BODY = (42, 46, 56); NEAR = (255, 106, 51); FAR = (160, 166, 176); PROP = (120, 124, 134)

S = dict(hd=(150, 30), nk=(150, 50), hp=(150, 105), eN=(150, 78), hN=(152, 104), eF=(148, 78), hF=(148, 104), kN=(152, 145), fN=(154, 185), kF=(148, 145), fF=(146, 185))
def P(base=S, **kw):
    d = dict(base); d.update(kw); return d
def mirror(p): return {k: (300 - x, y) for k, (x, y) in p.items()}
def shift(p, dx=0, dy=0, keys=None): return {k: ((x + dx, y + dy) if (keys is None or k in keys) else (x, y)) for k, (x, y) in p.items()}

PLANK = dict(hd=(232, 118), nk=(214, 126), hp=(150, 140), eN=(214, 155), hN=(214, 185), eF=(210, 155), hF=(210, 185), kN=(110, 161), fN=(70, 183), kF=(108, 161), fF=(66, 183))
QUAD = dict(hd=(222, 104), nk=(205, 112), hp=(132, 118), eN=(206, 148), hN=(207, 183), eF=(200, 148), hF=(200, 183), kN=(134, 183), fN=(96, 183), kF=(128, 183), fF=(90, 183))
LIE = dict(hp=(150, 180), nk=(198, 178), hd=(214, 175), eN=(230, 177), hN=(258, 176), eF=(228, 178), hF=(256, 178), kN=(110, 180), fN=(70, 180), kF=(112, 181), fF=(72, 181))
HANG = dict(hN=(152, 16), hF=(150, 16), eN=(152, 36), eF=(150, 36), nk=(152, 58), hd=(162, 44), hp=(150, 112), kN=(152, 146), fN=(152, 178), kF=(148, 146), fF=(148, 178))

EX = [
  dict(id='x_burpee', n='Burpee', pm=['quadriceps'], sm=['chest', 'shoulders', 'triceps', 'abdominals', 'glutes', 'calves'], lv='b', cat='p', f='push', mech='c', pat='other',
       dm={'quads_vast': 18, 'glute_max': 14, 'pec_mid': 12, 'delt_front': 10, 'tri_lat': 6, 'tri_med': 4, 'rectus_abs': 8, 'tva': 8, 'gastroc': 8, 'soleus': 4, 'hip_flex': 6, 'rect_fem': 2},
       ins=['Stand tall, then squat down and place your hands on the floor in front of your feet.', 'Jump or step your feet back into a straight-arm plank.', 'Optional: do one push-up, chest to the floor.', 'Jump your feet back toward your hands.', 'Explode up into a jump, reaching your arms overhead. Land softly and repeat.'],
       poses=[PLANK, P(hd=(150, 30), nk=(150, 50), hp=(150, 105), eN=(160, 28), hN=(166, 6), eF=(140, 28), hF=(134, 6), kN=(154, 145), fN=(156, 178), kF=(146, 145), fF=(144, 178))]),
  dict(id='x_jumping_jack', n='Jumping Jacks', pm=['calves'], sm=['quadriceps', 'shoulders', 'glutes', 'abductors'], lv='b', cat='p', f='push', mech='c', pat='other', front=True,
       dm={'gastroc': 22, 'soleus': 14, 'delt_side': 16, 'glute_med': 14, 'quads_vast': 12, 'adductors': 8, 'traps_upper': 6, 'tva': 8},
       ins=['Stand with feet together and arms by your sides.', 'Jump your feet out wider than your hips while sweeping your arms overhead.', 'Jump back to the start, arms back to your sides.', 'Stay light on the balls of your feet and keep a steady rhythm.'],
       poses=[P(eN=(138, 78), hN=(134, 104), eF=(162, 78), hF=(166, 104), kN=(142, 145), fN=(140, 185), kF=(158, 145), fF=(160, 185)),
              P(hd=(150, 26), nk=(150, 46), hp=(150, 101), eN=(124, 30), hN=(110, 10), eF=(176, 30), hF=(190, 10), kN=(128, 140), fN=(110, 180), kF=(172, 140), fF=(190, 180))]),
  dict(id='x_high_knees', n='High Knees', pm=['quadriceps'], sm=['calves', 'abdominals', 'glutes'], lv='b', cat='p', f='push', mech='c', pat='other',
       dm={'hip_flex': 26, 'rect_fem': 14, 'quads_vast': 14, 'gastroc': 16, 'soleus': 8, 'rectus_abs': 10, 'glute_max': 8, 'tva': 4},
       ins=['Stand tall with your core braced.', 'Run in place, driving one knee up to hip height.', 'Switch legs quickly, pumping your arms in opposition.', 'Land on the balls of your feet and keep your chest up.'],
       poses=[P(kN=(184, 102), fN=(178, 140), eN=(138, 75), hN=(132, 96), eF=(165, 74), hF=(176, 58)),
              P(kF=(184, 102), fF=(178, 140), eN=(165, 74), hN=(178, 58), eF=(138, 75), hF=(132, 96))]),
  dict(id='x_bear_crawl', n='Bear Crawl', pm=['shoulders'], sm=['quadriceps', 'abdominals', 'triceps', 'chest'], lv='b', cat='s', f='push', mech='c', pat='other',
       dm={'delt_front': 22, 'tva': 16, 'rectus_abs': 10, 'quads_vast': 16, 'tri_lat': 8, 'tri_med': 6, 'pec_mid': 8, 'serratus': 8, 'obliques': 6},
       ins=['Start on hands and knees, then lift your knees an inch off the floor.', 'Keep your back flat and hips level.', 'Crawl forward by moving the opposite hand and foot together in small steps.', 'Keep knees hovering low the whole time; crawl backward to return.'],
       poses=[dict(hd=(222, 98), nk=(205, 108), hp=(130, 110), eN=(207, 145), hN=(210, 183), eF=(198, 145), hF=(196, 183), kN=(150, 150), fN=(118, 183), kF=(138, 150), fF=(104, 183)),
              dict(hd=(226, 98), nk=(209, 108), hp=(134, 110), eN=(220, 145), hN=(228, 183), eF=(197, 145), hF=(192, 183), kN=(142, 150), fN=(106, 183), kF=(156, 150), fF=(122, 183))]),
  dict(id='x_skater_jump', n='Skater Jumps', pm=['glutes'], sm=['quadriceps', 'abductors', 'calves', 'adductors'], lv='i', cat='p', f='push', mech='c', pat='other', front=True,
       dm={'glute_max': 26, 'glute_med': 20, 'quads_vast': 22, 'adductors': 10, 'gastroc': 10, 'soleus': 6, 'obliques': 6},
       ins=['Stand on one leg with a slight bend in the knee.', 'Leap sideways, landing softly on the other leg.', 'Let the trailing leg sweep behind you without touching down.', 'Immediately push off and bound back to the other side.'],
       poses=[dict(hd=(186, 56), nk=(178, 72), hp=(160, 118), eN=(196, 92), hN=(210, 108), eF=(150, 88), hF=(132, 104), kN=(176, 150), fN=(178, 185), kF=(140, 150), fF=(120, 178))]),
  dict(id='x_hollow_hold', n='Hollow Body Hold', pm=['abdominals'], sm=['quadriceps'], lv='i', cat='s', f='stat', mech='c', pat='iso',
       dm={'rectus_abs': 40, 'tva': 30, 'obliques': 12, 'hip_flex': 14, 'rect_fem': 4},
       ins=['Lie on your back with arms overhead and legs straight.', 'Press your lower back into the floor and lift shoulders and legs a few inches.', 'Make a shallow "banana" shape; keep the lower back glued down.', 'Hold, breathing steadily. Bend the knees to make it easier.'],
       poses=[dict(hp=(150, 175), nk=(198, 163), hd=(214, 155), eN=(232, 152), hN=(258, 140), eF=(230, 154), hF=(255, 143), kN=(110, 166), fN=(72, 155), kF=(112, 168), fF=(74, 158)),
              dict(hp=(150, 175), nk=(197, 166), hd=(213, 159), eN=(232, 156), hN=(258, 146), eF=(230, 158), hF=(255, 149), kN=(110, 168), fN=(72, 161), kF=(112, 170), fF=(74, 164))]),
  dict(id='x_hollow_rock', n='Hollow Rock', pm=['abdominals'], sm=['quadriceps'], lv='i', cat='s', f='static', mech='c', pat='iso',
       dm={'rectus_abs': 42, 'tva': 28, 'obliques': 12, 'hip_flex': 14, 'rect_fem': 4},
       ins=['Get into the hollow body position.', 'Keeping that rigid shape, rock back toward your shoulders.', 'Rock forward toward your hips without breaking the shape.', 'Move as one piece — nothing bends.'],
       poses=[dict(hp=(150, 178), nk=(196, 158), hd=(211, 148), eN=(230, 142), hN=(254, 126), eF=(228, 145), hF=(252, 130), kN=(110, 174), fN=(70, 170), kF=(112, 176), fF=(72, 172)),
              dict(hp=(150, 175), nk=(198, 172), hd=(214, 168), eN=(232, 170), hN=(258, 165), eF=(230, 172), hF=(256, 168), kN=(112, 158), fN=(80, 138), kF=(114, 160), fF=(82, 141))]),
  dict(id='x_v_up', n='V-Up', pm=['abdominals'], sm=['quadriceps'], lv='i', cat='s', f='pull', mech='c', pat='iso',
       dm={'rectus_abs': 48, 'hip_flex': 24, 'obliques': 12, 'tva': 10, 'rect_fem': 6},
       ins=['Lie flat with arms overhead and legs straight.', 'In one motion, lift your legs and torso, reaching your hands toward your toes.', 'Balance briefly on your tailbone at the top.', 'Lower slowly back to the floor under control.'],
       poses=[LIE, dict(hp=(150, 180), nk=(176, 138), hd=(184, 122), eN=(140, 118), hN=(116, 104), eF=(144, 120), hF=(120, 106), kN=(130, 145), fN=(110, 110), kF=(132, 147), fF=(112, 112))]),
  dict(id='x_bird_dog', n='Bird Dog', pm=['lower back'], sm=['glutes', 'abdominals', 'shoulders'], lv='b', cat='s', f='static', mech='c', pat='iso',
       dm={'erectors': 26, 'glute_max': 22, 'tva': 18, 'obliques': 10, 'delt_front': 8, 'traps_mid': 8, 'ham_bf': 4, 'ham_semi': 4},
       ins=['Start on hands and knees, hands under shoulders, knees under hips.', 'Brace your core and keep your back flat.', 'Reach one arm forward and the opposite leg back until both are level with your body.', 'Pause, return, and switch sides. Keep hips square.'],
       poses=[QUAD, P(QUAD, eN=(232, 108), hN=(262, 104), kF=(95, 116), fF=(58, 114))]),
  dict(id='x_l_sit', n='L-Sit', pm=['abdominals'], sm=['triceps', 'quadriceps', 'shoulders'], lv='e', cat='s', f='static', mech='c', pat='iso',
       dm={'rectus_abs': 26, 'hip_flex': 22, 'rect_fem': 10, 'tri_lat': 10, 'tri_med': 8, 'delt_front': 8, 'serratus': 6, 'tva': 6, 'lats': 4},
       ins=['Sit with legs straight and hands flat beside your hips (or on parallettes/dip bars).', 'Press down hard, locking your elbows, to lift your hips off the floor.', 'Lift your straight legs so they are parallel to the floor.', 'Hold. Tuck the knees to make it easier.'],
       poses=[dict(hp=(150, 150), nk=(150, 95), hd=(150, 76), eN=(149, 138), hN=(148, 180), eF=(153, 138), hF=(153, 180), kN=(190, 150), fN=(232, 150), kF=(190, 152), fF=(232, 152)),
              dict(hp=(150, 145), nk=(150, 90), hd=(150, 71), eN=(149, 135), hN=(148, 180), eF=(153, 135), hF=(153, 180), kN=(190, 145), fN=(232, 143), kF=(190, 147), fF=(232, 145))]),
  dict(id='x_pike_pushup', n='Pike Push-Up', pm=['shoulders'], sm=['triceps', 'chest'], lv='i', cat='s', f='push', mech='c', pat='vpush',
       dm={'delt_front': 34, 'delt_side': 14, 'tri_lat': 12, 'tri_med': 10, 'tri_long': 5, 'pec_upper': 10, 'serratus': 7, 'traps_upper': 4, 'tva': 4},
       ins=['Start in a downward-dog shape: hands and feet on the floor, hips high.', 'Bend your elbows to lower the top of your head toward the floor between your hands.', 'Keep hips high so you press vertically, like an overhead press.', 'Push back up to straight arms.'],
       poses=[dict(nk=(190, 120), hd=(200, 138), hp=(150, 72), eN=(200, 152), hN=(210, 183), eF=(196, 152), hF=(205, 183), kN=(125, 128), fN=(100, 183), kF=(122, 128), fF=(96, 183)),
              dict(nk=(200, 150), hd=(212, 166), hp=(155, 82), eN=(186, 168), hN=(210, 183), eF=(182, 168), hF=(205, 183), kN=(128, 133), fN=(100, 183), kF=(125, 133), fF=(96, 183))]),
  dict(id='x_pistol_squat', n='Pistol Squat', pm=['quadriceps'], sm=['glutes', 'abductors', 'calves', 'abdominals'], lv='e', cat='s', f='push', mech='c', pat='squat',
       dm={'quads_vast': 34, 'rect_fem': 6, 'glute_max': 22, 'glute_med': 12, 'adductors': 8, 'hip_flex': 6, 'soleus': 4, 'tva': 6, 'gastroc': 2},
       ins=['Stand on one leg with the other leg slightly in front.', 'Reach your arms forward and squat down on the standing leg.', 'Keep the free leg straight and off the floor as you lower to full depth.', 'Drive through the whole foot to stand back up. Hold a support to learn it.'],
       poses=[P(kF=(168, 140), fF=(186, 168), eN=(168, 70), hN=(190, 72), eF=(166, 72), hF=(188, 74)),
              dict(hp=(140, 150), nk=(158, 98), hd=(166, 80), kN=(172, 152), fN=(150, 185), kF=(180, 152), fF=(222, 150), eN=(185, 96), hN=(210, 96), eF=(183, 98), hF=(208, 98))]),
  dict(id='x_wall_sit', n='Wall Sit', pm=['quadriceps'], sm=['glutes', 'calves'], lv='b', cat='s', f='static', mech='i', pat='iso', prop='wall',
       dm={'quads_vast': 58, 'rect_fem': 10, 'glute_max': 14, 'adductors': 8, 'soleus': 6, 'tva': 4},
       ins=['Lean your back flat against a wall.', 'Walk your feet out and slide down until your thighs are parallel to the floor.', 'Knees over ankles, shins vertical.', 'Hold, keeping your back against the wall.'],
       poses=[dict(hp=(122, 128), nk=(122, 74), hd=(122, 55), kN=(165, 128), fN=(165, 185), kF=(163, 130), fF=(163, 185), eN=(135, 100), hN=(152, 124), eF=(133, 102), hF=(150, 126)),
              dict(hp=(122, 128), nk=(122, 74), hd=(122, 55), kN=(165, 128), fN=(165, 185), kF=(163, 130), fF=(163, 185), eN=(140, 78), hN=(165, 78), eF=(138, 80), hF=(162, 80))]),
  dict(id='x_plank_tap', n='Plank Shoulder Taps', pm=['abdominals'], sm=['shoulders', 'chest', 'triceps'], lv='b', cat='s', f='static', mech='c', pat='iso',
       dm={'tva': 26, 'obliques': 20, 'rectus_abs': 14, 'delt_front': 14, 'serratus': 8, 'pec_mid': 6, 'tri_med': 6, 'glute_med': 6},
       ins=['Start in a high plank, hands under shoulders, feet hip-width.', 'Lift one hand and tap the opposite shoulder.', 'Keep your hips still — don’t rock side to side.', 'Alternate hands with control.'],
       poses=[PLANK, P(PLANK, eN=(226, 142), hN=(213, 124))]),
  dict(id='x_dead_hang', n='Dead Hang', pm=['forearms'], sm=['lats', 'shoulders'], lv='b', cat='s', f='static', mech='c', pat='iso', front=True, prop='barfront', req=['pullupbar'],
       dm={'forearm_flex': 46, 'lats': 18, 'teres': 6, 'rotator': 10, 'traps_mid': 8, 'brachiorad': 6, 'tva': 6},
       ins=['Grab a pull-up bar with an overhand grip, slightly wider than shoulders.', 'Hang with straight arms, feet off the floor.', 'For an active hang, pull your shoulder blades down without bending the elbows.', 'Hold as long as you can with good grip.'],
       poses=[dict(hN=(140, 16), hF=(160, 16), eN=(142, 35), eF=(158, 35), nk=(150, 56), hd=(150, 40), hp=(150, 110), kN=(148, 145), fN=(148, 178), kF=(152, 145), fF=(152, 178)),
              dict(hN=(140, 16), hF=(160, 16), eN=(144, 31), eF=(156, 31), nk=(150, 50), hd=(150, 34), hp=(150, 104), kN=(148, 140), fN=(148, 172), kF=(152, 140), fF=(152, 172))]),
  dict(id='x_hanging_knee', n='Hanging Knee Raise', pm=['abdominals'], sm=['forearms', 'quadriceps'], lv='b', cat='s', f='pull', mech='c', pat='iso', prop='bar', req=['pullupbar'],
       dm={'rectus_abs': 40, 'hip_flex': 26, 'obliques': 12, 'forearm_flex': 10, 'lats': 6, 'tva': 6},
       ins=['Hang from a pull-up bar with straight arms.', 'Brace your core and curl your knees up toward your chest.', 'Tilt your pelvis up at the top.', 'Lower slowly without swinging.'],
       poses=[HANG, P(HANG, hp=(150, 108), kN=(180, 84), fN=(168, 120), kF=(176, 86), fF=(164, 122))]),
  dict(id='x_toes_to_bar', n='Toes-to-Bar', pm=['abdominals'], sm=['lats', 'forearms', 'quadriceps'], lv='e', cat='s', f='pull', mech='c', pat='iso', prop='bar', req=['pullupbar'],
       dm={'rectus_abs': 34, 'hip_flex': 22, 'lats': 14, 'obliques': 10, 'forearm_flex': 10, 'rect_fem': 4, 'tva': 6},
       ins=['Hang from a pull-up bar with straight arms.', 'Press the bar down with straight arms (engage your lats).', 'Raise your straight legs until your toes touch the bar.', 'Lower under control; avoid excessive swinging.'],
       poses=[HANG, dict(hN=(152, 16), hF=(150, 16), eN=(154, 36), eF=(152, 36), nk=(156, 58), hd=(168, 48), hp=(140, 108), kN=(151, 64), fN=(161, 22), kF=(149, 65), fF=(158, 23))]),
  dict(id='x_dragon_flag', n='Dragon Flag', pm=['abdominals'], sm=['lats', 'lower back'], lv='e', cat='s', f='static', mech='c', pat='iso', prop='bench', req=['bench'],
       dm={'rectus_abs': 40, 'obliques': 14, 'tva': 16, 'lats': 10, 'hip_flex': 10, 'glute_max': 6, 'erectors': 4},
       ins=['Lie on a bench and grip it behind your head.', 'Roll your body up onto your upper back, legs pointing up.', 'Keep your body perfectly straight from shoulders to toes.', 'Lower slowly, hinging only at the shoulders, then raise again.'],
       poses=[dict(nk=(100, 140), hd=(84, 136), hN=(70, 150), eN=(80, 126), hF=(72, 150), eF=(82, 128), hp=(150, 95), kN=(185, 62), fN=(220, 30), kF=(183, 64), fF=(218, 32)),
              dict(nk=(100, 140), hd=(84, 136), hN=(70, 150), eN=(80, 126), hF=(72, 150), eF=(82, 128), hp=(155, 128), kN=(195, 118), fN=(235, 108), kF=(193, 120), fF=(233, 110))]),
  dict(id='x_wall_handstand', n='Wall Handstand Hold', pm=['shoulders'], sm=['triceps', 'abdominals', 'traps'], lv='e', cat='s', f='static', mech='c', pat='iso', prop='wallR',
       dm={'delt_front': 30, 'delt_side': 14, 'tri_lat': 10, 'tri_med': 10, 'traps_upper': 10, 'serratus': 10, 'tva': 10, 'forearm_flex': 6},
       ins=['Face away from a wall, hands on the floor about a hand-length from it.', 'Kick or walk up until your heels rest on the wall.', 'Push the floor away with straight arms; ribs in, body straight.', 'Hold, then come down one leg at a time.'],
       poses=[dict(hN=(170, 183), hF=(164, 183), eN=(171, 158), eF=(166, 158), nk=(172, 132), hd=(178, 150), hp=(178, 78), kN=(182, 45), fN=(186, 12), kF=(180, 45), fF=(184, 12)),
              dict(hN=(170, 183), hF=(164, 183), eN=(171, 158), eF=(166, 158), nk=(172, 130), hd=(178, 148), hp=(176, 76), kN=(181, 43), fN=(186, 10), kF=(179, 43), fF=(184, 10))]),
  dict(id='x_crab_walk', n='Crab Walk', pm=['triceps'], sm=['glutes', 'shoulders', 'hamstrings', 'abdominals'], lv='b', cat='s', f='push', mech='c', pat='other',
       dm={'tri_lat': 14, 'tri_med': 12, 'tri_long': 8, 'delt_rear': 10, 'delt_front': 6, 'glute_max': 18, 'ham_bf': 8, 'ham_semi': 6, 'tva': 10, 'quads_vast': 8},
       ins=['Sit with knees bent, feet flat, hands on the floor behind you, fingers forward.', 'Lift your hips into a reverse tabletop.', 'Walk forward or backward using opposite hand and foot.', 'Keep your hips up the whole time.'],
       poses=[dict(hN=(110, 183), eN=(112, 155), hF=(118, 183), eF=(118, 155), nk=(118, 128), hd=(102, 120), hp=(170, 128), kN=(210, 128), fN=(212, 183), kF=(206, 128), fF=(208, 183)),
              dict(hN=(124, 183), eN=(122, 155), hF=(114, 183), eF=(116, 155), nk=(120, 128), hd=(104, 120), hp=(172, 128), kN=(208, 128), fN=(210, 183), kF=(220, 128), fF=(224, 183))]),
  dict(id='x_calf_raise_bw', n='Bodyweight Calf Raise', pm=['calves'], sm=[], lv='b', cat='s', f='push', mech='i', pat='iso',
       dm={'gastroc': 64, 'soleus': 32, 'tva': 4},
       ins=['Stand tall with feet hip-width, hands on a wall for balance if needed.', 'Rise onto the balls of your feet as high as possible.', 'Pause and squeeze at the top.', 'Lower slowly. Use a step for extra range, or one leg to make it harder.'],
       poses=[S, shift(S, 0, -12, keys=['hd', 'nk', 'hp', 'eN', 'hN', 'eF', 'hF', 'kN', 'kF'])]),
]

def draw(p, prop, front):
    im = Image.new('RGB', (int(W * SC), int(H * SC)), BG); d = ImageDraw.Draw(im)
    s = lambda pt: (pt[0] * SC, pt[1] * SC)
    d.line([s((0, 190)), s((300, 190))], fill=GROUND, width=int(4 * SC))
    if prop in ('bar', 'barfront'): d.line([s((105 if prop == 'barfront' else 125, 14)), s((195 if prop == 'barfront' else 180, 14))], fill=PROP, width=int(5 * SC))
    if prop == 'wall': d.rectangle([s((96, 0)), s((110, 190))], fill=(220, 214, 202))
    if prop == 'wallR': d.rectangle([s((190, 0)), s((204, 190))], fill=(220, 214, 202))
    if prop == 'bench': d.rectangle([s((60, 150)), s((150, 160))], fill=PROP); d.line([s((70, 160)), s((70, 190))], fill=PROP, width=int(4 * SC)); d.line([s((140, 160)), s((140, 190))], fill=PROP, width=int(4 * SC))
    def seg(a, b, col, w):
        d.line([s(p[a]), s(p[b])], fill=col, width=int(w * SC))
        for q in (a, b): x, y = s(p[q]); r = w * SC / 2; d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    farc = FAR if not front else NEAR
    for a, b in (('hp', 'kF'), ('kF', 'fF'), ('nk', 'eF'), ('eF', 'hF')): seg(a, b, farc, 7)
    seg('nk', 'hp', BODY, 9)
    for a, b in (('hp', 'kN'), ('kN', 'fN'), ('nk', 'eN'), ('eN', 'hN')): seg(a, b, NEAR, 8)
    hx, hy = s(p['hd']); r = 12 * SC; d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=BODY)
    return im

out = []
for e in EX:
    poses = e['poses'] if len(e['poses']) == 2 else [e['poses'][0], mirror(e['poses'][0])]
    for i, p in enumerate(poses):
        draw(p, e.get('prop'), e.get('front')).save('img/%s__%d.webp' % (e['id'], i), 'WEBP', quality=80, method=6)
    r = {k: v for k, v in e.items() if k not in ('poses', 'prop', 'front')}
    out.append(r)
json.dump(out, open('custom_ex.json', 'w'))
print(len(out), 'custom exercises rendered')
