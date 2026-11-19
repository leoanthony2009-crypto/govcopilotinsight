"""Rebuild GovernorBrief-Offer-2026-27.pdf (the two-page marketing offer sheet).

Source: tests/offer/offer.html (+ qr.svg, which points at /contact?type=workshop&from=offer-pdf).
Run from the repo root:  python3 tests/make-offer.py
Update the wording in offer.html when the site changes (briefing count, price, roles).
"""
import os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tests', 'offer', 'offer.html')
OUT = os.path.join(ROOT, 'GovernorBrief-Offer-2026-27.pdf')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto('file://' + SRC)
    pg.wait_for_timeout(600)
    over = pg.evaluate("[...document.querySelectorAll('.page')].filter(s=>s.scrollHeight>s.clientHeight).length")
    if over:
        sys.exit('A page overflows A4: shorten the copy in tests/offer/offer.html')
    pg.pdf(path=OUT, prefer_css_page_size=True, print_background=True, tagged=True, outline=True)
    b.close()
print('wrote', OUT)
