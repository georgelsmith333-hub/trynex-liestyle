from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'artifacts/trynex-storefront/public'
runtime_root = root / 'mockups/psd-master-v10/runtime-roles'
paths = [
    runtime_root / family / 'white' / f'{face}-{role}.png'
    for family in ('tshirt', 'longsleeve', 'hoodie', 'mug', 'cap', 'waterbottle')
    for face in ('front', 'back')
    for role in ('studioBackground', 'base', 'shadow', 'protected', 'highlight', 'print-mask')
]
for rel in paths:
    p = Path(rel)
    try:
        im = Image.open(p).convert('RGBA')
        alpha = im.getchannel('A')
        amin, amax = alpha.getextrema()
        colors = im.getcolors(maxcolors=2_000_000)
        checker = sum(1 for count, rgba in (colors or []) if rgba[:3] in {(204,204,204),(255,255,255)})
        print(f'{p.relative_to(root)}\tsize={im.size}\talpha={amin}-{amax}\twhite-checker-pixels={checker}')
    except Exception as exc:
        print(f'{p.relative_to(root)}\tERROR={exc}')
