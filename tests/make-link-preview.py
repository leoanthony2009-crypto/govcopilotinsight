"""Rebuild link-preview.png (1200x630), the picture shown when a link to the site is shared.
Run from the repo root:  python3 tests/make-link-preview.py
"""
import os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = f'''<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:"PJS";font-weight:700;src:url(file://{ROOT}/fonts/plus-jakarta-sans-700.woff2)}}
@font-face{{font-family:"Inter";font-weight:400;src:url(file://{ROOT}/fonts/inter-400.woff2)}}
html,body{{margin:0}}body{{width:1200px;height:630px;background:#102d3b;color:#fff;box-sizing:border-box;padding:70px 90px 0;border-bottom:10px solid #c4ae7a;font-family:Inter,Arial,sans-serif}}
img{{height:96px;display:block;margin-left:-6px}}
h1{{font:700 58px/1.12 PJS,Arial,sans-serif;letter-spacing:-.02em;margin:52px 0 0}}
p{{font-size:29px;line-height:1.35;margin:30px 0 0;color:#e8edec}}
</style><img src="file://{ROOT}/logo-lockup-white.svg" alt="">
<h1>Better evidence. Better questions.<br>Stronger schools.</h1>
<p>A free IDSR tool, free briefings and a board workshop<br>for school governors and trustees · governorbrief.co.uk</p>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    tmp = os.path.join(ROOT, 'tests', '.link-preview.html'); open(tmp, 'w', encoding='utf-8').write(HTML)
    pg.goto('file://' + tmp); pg.wait_for_timeout(500); os.remove(tmp)
    pg.screenshot(path=os.path.join(ROOT, 'link-preview.png')); b.close()
print('wrote link-preview.png')
