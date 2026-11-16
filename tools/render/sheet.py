import json,sys
from PIL import Image, ImageDraw
ex=[e['id'] for e in json.load(open('poses.json'))]
ids=sys.argv[1:] or ex
for part in range(0,len(ids),12):
    sub=ids[part:part+12]; rows=(len(sub)+1)//2
    im=Image.new('RGB',(4*260,rows*173),'white'); d=ImageDraw.Draw(im)
    for k,i in enumerate(sub):
        for c in range(2):
            t=Image.open(f'out/{i}__{c}.webp').resize((260,173)); im.paste(t,((k%2)*520+c*260,(k//2)*173))
        d.text(((k%2)*520+6,(k//2)*173+4),i,fill='black')
    im.save(f'sheet{part//12}.png')
