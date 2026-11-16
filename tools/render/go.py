import asyncio, json, base64, io, sys, os
from PIL import Image
from playwright.async_api import async_playwright
SUPINE = {'x_hollow_hold','x_hollow_rock','x_v_up','x_dragon_flag','p_hundred','p_rollup','p_single_leg_stretch','p_double_leg_stretch','p_leg_circle','y_happy_baby'}
POINT = {'x_hollow_hold','x_hollow_rock','x_v_up','x_dragon_flag','p_hundred','p_single_leg_stretch','p_double_leg_stretch','p_leg_circle','p_swimming','x_l_sit','y_boat','x_toes_to_bar','x_hanging_knee','x_dead_hang','x_wall_handstand'}
OVR = json.load(open('ovr.json')) if os.path.exists('ovr.json') else {}
only = sys.argv[1:] 
OUT = 'out'; os.makedirs(OUT, exist_ok=True)
def mirror(p): return {k: [300 - x, y] for k, (x, y) in p.items()}
def dec(u): return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')
async def main():
    ex = json.load(open('poses.json'))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 840, 'height': 560})
        pg.on('pageerror', lambda e: print('ERR', e)); pg.on('console', lambda m: m.type == 'error' and print('CONSOLE', m.text))
        await pg.goto('http://127.0.0.1:8770/index.html'); await pg.wait_for_function('window.ready', timeout=20000)
        for e in ex:
            if only and e['id'] not in only: continue
            poses = e['poses'] if not e['single'] else [e['poses'][0], mirror(e['poses'][0])]
            o = dict(front=e['front'], prop=e['prop'], face=-1 if e['id'] in SUPINE else 1, pointToes=e['id'] in POINT, mat=e['id'][:2] in ('y_', 'p_'))
            o.update(OVR.get(e['id'], {}))
            r = await pg.evaluate('([e,n]) => renderEx(e,n)', [dict(poses=poses, opts=o, noAnim=False), 14])
            for i, u in enumerate(r['keys']): dec(u).resize((630, 420), Image.LANCZOS).save(f"{OUT}/{e['id']}__{i}.webp", 'WEBP', quality=82, method=6)
            fr = [dec(u).resize((630, 420), Image.LANCZOS) for u in r['anim']]
            seq = fr + fr[-2:0:-1]
            dur = [500 if i in (0, len(fr) - 1) else 70 for i in range(len(fr))] + [70] * (len(fr) - 2)
            seq[0].save(f"{OUT}/{e['id']}__a.webp", 'WEBP', save_all=True, append_images=seq[1:], duration=dur, loop=0, quality=72, method=4)
            print(e['id'], os.path.getsize(f"{OUT}/{e['id']}__a.webp") // 1024, 'KB', flush=True)
        await b.close()
asyncio.run(main())
