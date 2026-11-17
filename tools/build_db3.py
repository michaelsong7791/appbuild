import re
import json,re
d={x['id']:x for x in json.load(open('exercises.json'))}
exec(open('build_db.py').read().split("miss=")[0])  # reuse T3/T2 lists
base_ids=json.load(open('sel_ids.json'))+json.load(open('extra_ids.json'))
free=json.load(open('free_ids.json'))
EQ={'barbell':'barbell','dumbbell':'dumbbell','cable':'cable','machine':'machine','kettlebells':'kettlebell','bands':'band','e-z curl bar':'ezbar','body only':'bodyweight',None:'bodyweight','other':'bodyweight','exercise ball':'ball','medicine ball':'medball','foam roll':'foamroll'}
def needs(x):
    n=x['name'].lower(); r=[]
    if any(k in n for k in ['bench press','incline','decline','flye','fly','preacher','bench','skull','lying','pullover']) and 'floor' not in n: r.append('bench')
    if any(k in n for k in ['box','depth jump','platform']) : r.append('bench')
    if any(k in n for k in ['pullup','pull-up','pull up','chin','hanging','muscle up','muscle_up','dip','parallel bars','rocky']) and 'bench dip' not in n: r.append('pullupbar')
    if 'smith' in n: r.append('smith')
    if 'suspended' in n or 'with straps' in n: r=[q for q in r if q!='bench']+['suspension']
    if 'battling' in n: r.append('ropes')
    if 'hyperextensions back' in n: r.append('bench')
    return sorted(set(r))
def pat(x):
    n=x['name'].lower(); p=x['primaryMuscles'][0]
    if x['mechanic']!='compound': return 'iso'
    if p=='chest' or ('bench' in n and 'press' in n) or 'push-up' in n or 'pushup' in n: return 'hpush'
    if (p=='shoulders' and 'press' in n) or 'jerk' in n or 'handstand' in n: return 'vpush'
    w=re.split(r'[^a-z]+',n)
    if 'upright' in w: return 'other'
    if 'row' in w or 'rows' in w: return 'hpull'
    if any(k in n for k in ['pulldown','pullup','pull-up','muscle up','muscle-up']) or 'chin' in w or 'chins' in w or 'chin-up' in n: return 'vpull'
    if any(k in n for k in ['deadlift','good morning','swing','clean','hip thrust','bridge','pull through','rack pull']): return 'hinge'
    if any(k in n for k in ['lunge','split squat','step up','step-up']): return 'lunge'
    if 'squat' in n or 'leg press' in n: return 'squat'
    if p=='lats': return 'vpull'
    if p=='middle back': return 'hpull'
    if any(k in n for k in ['deadlift','good morning','swing','clean','hip thrust','bridge','pull through','rack pull']): return 'hinge'
    if any(k in n for k in ['lunge','split squat','step up','step-up']): return 'lunge'
    if p=='quadriceps' or 'squat' in n or 'leg press' in n: return 'squat'
    return 'other'
CAT={'stretching':'st','plyometrics':'p','cardio':'c'}
out=[]
for i in base_ids+free:
    x=d[i]; e={'id':i,'n':x['name'],'eq':EQ[x.get('equipment')],'lv':x['level'][0],'mech':(x['mechanic'] or 'isolation')[0],'f':(x['force'] or 'static')[:4] if x['category']!='stretching' else 'stat',
      'pm':x['primaryMuscles'],'sm':[m for m in x['secondaryMuscles'] if m not in x['primaryMuscles']],'ins':x['instructions'],
      'cat':CAT.get(x['category'],'s'),'t':3 if i in T3 else 2 if i in T2 else 1,'req':needs(x),'pat':pat(x)}
    if x.get('equipment')=='bands': e['eq']='band'
    if i in ('Band_Assisted_Pull-Up','Seated_Band_Hamstring_Curl'): e['eq']='band'
    if i in ('Inverted_Row_with_Straps',) or i.startswith('Suspended_'): e['eq']='suspension'; e['req']=[]
    if i=='Battling_Ropes': e['eq']='ropes'; e['req']=[]
    out.append(e)
for c in json.load(open('custom_ex.json')):
    c=dict(c); c.setdefault('req',[]); c['eq']='bodyweight'; c['t']=2; c['f']=c['f'][:4]; c['own']=1; out.append(c)
# popular bodyweight/calisthenics boosted
for e in out:
    if e['id'] in ('Pushups','Pullups','Chin-Up','Dips_-_Triceps_Version','Bodyweight_Squat','Plank','Inverted_Row','Hanging_Leg_Raise','Bodyweight_Walking_Lunge','Mountain_Climbers','Butt_Lift_Bridge','Side_Bridge','Superman','Crunches','Freehand_Jump_Squat','Decline_Push-Up','Single_Leg_Glute_Bridge','Handstand_Push-Ups','Muscle_Up','Dips_-_Chest_Version'): e['t']=max(e['t'],3)
for e in out:
    if e['id'] in ('Muscle_Up','Kipping_Muscle_Up','One_Arm_Chin-Up','Handstand_Push-Ups','Single-Arm_Push-Up','Ring_Dips','Gironda_Sternum_Chins'): e['lv']='e'
open('/home/claude/forge/app/src/main/assets/www/data/exercises.js','w').write('window.EXDB='+json.dumps(out,separators=(',',':'))+';')
import collections
print(len(out), collections.Counter(e['eq'] for e in out), collections.Counter(e['cat'] for e in out))
