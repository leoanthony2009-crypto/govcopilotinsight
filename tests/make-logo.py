#!/usr/bin/env python3
"""Rebuild every GovernorBrief logo and icon file from one definition.

    python3 tests/make-logo.py

The B is digital teal on light backgrounds and warm brass on dark ones. One-colour
versions for single-colour printing are written to brand/mono/.

Needs: fonttools, brotli, uharfbuzz, Pillow (pip) and rsvg-convert (librsvg).
The wordmark is drawn from the site's own Plus Jakarta Sans files and saved as
outlines, so the logos never depend on a font being installed.
"""
import io, math, os, subprocess

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIDNIGHT, TEAL, BRASS, WHITE = "#102d3b", "#247e84", "#c4ae7a", "#ffffff"
NAME = "GovernorBrief"
STRAP = "From Information to Assurance."

# ---------------------------------------------------------------- symbol
# Drawn in a 100 x 100 box; the ring fills 10..90.
STANDARD = dict(theta=62, bar_to=72, stem=38, top=28, bot=72, r=11, hx=46.5, hx2=48, sw=8)


def favicon_symbol(ring, b):
    """The symbol redrawn on a 32 x 32 pixel grid for browser tabs. Every straight edge
    (the B's stem and bars, the G's crossbar) sits exactly on a pixel boundary at 32 px,
    and on a half pixel at 16 px, which is the sharpest a 1.5 px line can be."""
    R, c, sw = 12, 16.5, 3
    sx = c + R * math.cos(math.radians(62))
    sy = c - R * math.sin(math.radians(62))
    st = f'fill="none" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'
    g = f'<path d="M{sx:.2f},{sy:.2f} A{R},{R} 0 1 0 {c + R},{c} L25,{c}" stroke="{ring}" {st}/>'
    bb = (f'<path d="M12.5,10.5 V22.5 M12.5,10.5 H16.5 a3,3 0 0 1 0,6 H12.5 M16.5,16.5 H17.5 '
          f'a3,3 0 0 1 0,6 H12.5" stroke="{b}" {st}/>')
    return g + bb


def symbol(p, ring, b=None):
    """The G ring (open at the upper right, short crossbar) and the B inside it."""
    b = b or ring
    R = p.get("R", 36)
    by = p.get("bar_y", 50)
    sx = 50 + R * math.cos(math.radians(p["theta"]))
    sy = 50 - R * math.sin(math.radians(p["theta"]))
    mid = (p["top"] + p["bot"]) / 2
    st = f'fill="none" stroke-width="{p["sw"]}" stroke-linecap="round" stroke-linejoin="round"'
    g = f'<path d="M{sx:.2f},{sy:.2f} A{R},{R} 0 1 0 {50 + R},50 L{50 + R},{by} L{p["bar_to"]},{by}" stroke="{ring}" {st}/>'
    bb = (f'<path d="M{p["stem"]},{p["top"]} V{p["bot"]} M{p["stem"]},{p["top"]} H{p["hx"]} '
          f'a{p["r"]},{p["r"]} 0 0 1 0,{2 * p["r"]} H{p["stem"]} M{p["hx"]},{mid} H{p["hx2"]} '
          f'a{p["r"]},{p["r"]} 0 0 1 0,{2 * p["r"]} H{p["stem"]}" stroke="{b}" {st}/>')
    return g + bb


# ---------------------------------------------------------------- lettering
class Face:
    def __init__(self, weight):
        path = os.path.join(ROOT, "fonts", f"plus-jakarta-sans-{weight}.woff2")
        self.tt = TTFont(path)
        buf = io.BytesIO()
        self.tt.flavor = None
        self.tt.save(buf)
        self.hb = hb.Font(hb.Face(buf.getvalue()))
        self.glyphs = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.cap = self.tt["OS/2"].sCapHeight


FACES = {}


def face(w):
    if w not in FACES:
        FACES[w] = Face(w)
    return FACES[w]


def run(text, weight, size, x, baseline, tracking=0.0):
    """Outline one run of text. Returns (path data, x after the run, ink left, ink right)."""
    f = face(weight)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(f.hb, buf, {"kern": True, "liga": False})
    k = size / 1000
    out, pen_x, lo, hi = [], x, None, None
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = f.order[info.codepoint]
        ox = pen_x + pos.x_offset * k
        t = (k, 0, 0, -k, ox, baseline)
        sp = SVGPathPen(f.glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        f.glyphs[name].draw(TransformPen(sp, t))
        d = sp.getCommands()
        if d:
            out.append(d)
            bp = BoundsPen(f.glyphs)
            f.glyphs[name].draw(TransformPen(bp, t))
            lo = bp.bounds[0] if lo is None else min(lo, bp.bounds[0])
            hi = bp.bounds[2] if hi is None else max(hi, bp.bounds[2])
        pen_x += pos.x_advance * k + tracking * size
    return "".join(out), pen_x, lo, hi


def wordmark(size, x, baseline):
    """'Governor' in medium, 'Brief' in bold, so the two words separate without a space."""
    d1, x1, lo, _ = run("Governor", 500, size, x, baseline, -0.012)
    d2, x2, _, hi = run("Brief", 700, size, x1 + 0.004 * size, baseline, -0.012)
    return d1 + d2, lo, hi


# ---------------------------------------------------------------- lockups
H = 80          # height of the symbol in lockup units
GAP = 30        # symbol to wordmark
PAD = 4         # breathing room so nothing is clipped; clear space is set where the logo is used


def svg(w, h, body, label, bg=None):
    r = f'<rect width="{w:.0f}" height="{h:.0f}" rx="16" fill="{bg}"/>' if bg else ""
    return (f'<svg role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" '
            f'height="{h:.0f}" viewBox="0 0 {w:.0f} {h:.0f}"><title>{label}</title>{r}{body}</svg>\n')


# The symbol in a lockup has a lighter, 6-unit line. Its measurements are chosen so that at 44 px high
# (half size) the ring, the stem and the bars of the B and the rule all fall on whole pixels.
LOCK = dict(STANDARD, sw=6, R=37, stem=39, top=29, bot=73, hx=47.5, hx2=49, bar_y=51)
RULE_X, NAME_X = 105, 128       # the divider rule, and where the name starts
# The lockup with the strapline is shown at 66 px high (three quarters size) on the website. Its
# measurements are multiples of 4/3 so that at that size every straight edge falls on a whole pixel:
# the ring and the B have a 4 px line, the rule is 2 px, and the lettering sits on whole-pixel baselines.
U = 4 / 3
LOCK_FULL = dict(STANDARD, sw=4 * U, R=36, stem=38, top=6 + 17 * U, bot=6 + 49 * U, r=8 * U,
                 hx=6 + 30 * U, hx2=6 + 31 * U, bar_y=50, bar_to=6 + 50 * U)
RULE_FULL = 104
STRAP_CAPS = "FROM INFORMATION TO ASSURANCE"


def fitted(text, weight, size, left, width, baseline):
    """A run of text letter-spaced so that its ink is exactly `width` wide, starting at `left`."""
    _, _, lo0, hi0 = run(text, weight, size, 0, baseline, 0.0)
    _, _, lo1, hi1 = run(text, weight, size, 0, baseline, 0.1)
    t = (width - (hi0 - lo0)) / (((hi1 - lo1) - (hi0 - lo0)) / 0.1)
    _, _, lo, _ = run(text, weight, size, 0, baseline, t)
    d, _, _, _ = run(text, weight, size, left - lo, baseline, t)
    return d


def lockup(kind, ink, b=None, bg=None, pad=PAD, mono=False):
    """kind: 'primary' (symbol, rule, name), 'full' (with strapline), 'wordmark' (name only)."""
    parts, x = [], 0.0
    if b is None:
        b = ink if mono else (BRASS if ink == WHITE else TEAL)
    if kind != "wordmark":
        full = kind == "full"
        parts.append(f'<g transform="translate(-10 -10)">{symbol(LOCK_FULL if full else LOCK, ink, b)}</g>')
        parts.append(f'<path d="M{RULE_FULL if full else RULE_X},4 V76" stroke="{b}" stroke-width="{2 * U if full else 2:.4f}" fill="none"/>')
        x = NAME_X
    if kind == "full":
        size = 50
        base = 36 * U - PAD                             # baseline on a whole pixel at 66 px high
        d, lo, hi = wordmark(size, 0, base)
        d, lo, hi = wordmark(size, x - lo, base)
        # strapline: capitals at full strength, letter-spaced to the width of the name; 16 units is
        # 12 px at 66 px high (capitals about 8.5 px tall), the smallest size that stays crisp
        sd = fitted(STRAP_CAPS, 500, 16, lo + 1, hi - lo - 2, 57 * U - PAD)
        parts.append(f'<path d="{d}" fill="{ink}"/><path d="{sd}" fill="{ink}"/>')
        height = H
    else:
        size = 52 if kind == "primary" else 58
        base = H / 2 + face(500).cap * size / 2000      # name centred on the symbol
        d, lo, hi = wordmark(size, 0, base)
        d, lo, hi = wordmark(size, x - lo, base)
        parts.append(f'<path d="{d}" fill="{ink}"/>')
        height = H
        if kind == "wordmark":
            top = base - face(500).cap * size / 1000
            parts = [f'<g transform="translate(0 {-top + 1:.2f})">{parts[0]}</g>']
            height = face(500).cap * size / 1000 + 2
    w, h = hi + 2 * pad, height + 2 * pad
    if kind != "wordmark" and not bg:
        # Width is a whole multiple of 22 against a height of 88, so the logo scales to whole
        # pixels (253 x 44, 322 x 56). At 44 px high the symbol's lines are exactly 3 px.
        w = math.ceil(w / 44) * 44 if kind == "full" else math.ceil(w / 22) * 22
    label = NAME + (". " + STRAP if kind == "full" else "")
    return svg(w, h, f'<g transform="translate({pad} {pad})">{"".join(parts)}</g>', label, bg)


def tile(p, scale, ink=WHITE, b=None, bg=MIDNIGHT, rx=22, mono=False):
    t = (100 - 100 * scale) / 2
    if b is None:
        b = ink if mono else (BRASS if ink == WHITE else TEAL)
    r = f'<rect width="100" height="100" rx="{rx}" fill="{bg}"/>' if bg else ""
    return (f'<svg role="img" aria-label="{NAME}" xmlns="http://www.w3.org/2000/svg" width="100" height="100" '
            f'viewBox="0 0 100 100"><title>{NAME}</title>{r}<g transform="translate({t:g} {t:g}) scale({scale:g})">'
            f'{symbol(p, ink, b)}</g></svg>\n')


# ---------------------------------------------------------------- output
def write(rel, text):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return path


def png(src_rel, dst_rel, width=None, height=None):
    cmd = ["rsvg-convert"]
    if width:
        cmd += ["-w", str(width)]
    if height:
        cmd += ["-h", str(height)]
    dst = os.path.join(ROOT, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(cmd + ["-o", dst, os.path.join(ROOT, src_rel)], check=True)
    return dst


def main():
    # logos used by the site
    write("logo-header-light.svg", lockup("primary", MIDNIGHT))
    write("logo-header-white.svg", lockup("primary", WHITE))
    write("logo-lockup-light.svg", lockup("full", MIDNIGHT))
    write("logo-lockup-white.svg", lockup("full", WHITE))
    write("logo-lockup-dark.svg", lockup("full", WHITE, bg=MIDNIGHT, pad=30))
    write("logo-mark.svg", tile(STANDARD, 0.76))
    write("logo-mark-white.svg", tile(STANDARD, 0.92, bg=None))
    write("logo-mark-midnight.svg", tile(STANDARD, 0.92, ink=MIDNIGHT, bg=None))

    # browser and phone icons
    write("favicon.svg", f'<svg role="img" aria-label="{NAME}" xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
          f'viewBox="0 0 32 32"><title>{NAME}</title><rect width="32" height="32" rx="7" fill="{MIDNIGHT}"/>'
          f'{favicon_symbol(WHITE, BRASS)}</svg>\n')
    png("favicon.svg", "favicon-16.png", 16, 16)
    png("favicon.svg", "favicon-32.png", 32, 32)
    tmp = png("favicon.svg", "favicon-48.tmp.png", 48, 48)
    ims = [Image.open(os.path.join(ROOT, f)).convert("RGBA") for f in ("favicon-16.png", "favicon-32.png")] + [Image.open(tmp).convert("RGBA")]
    ims[2].save(os.path.join(ROOT, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])
    os.remove(tmp)
    png("logo-mark.svg", "apple-touch-icon.png", 180, 180)
    png("logo-mark.svg", "icon-192.png", 192, 192)
    png("logo-mark.svg", "icon-512.png", 512, 512)

    # brand kit: name-only logo and ready-to-place PNGs for documents and slides
    write("brand/logo-wordmark-light.svg", lockup("wordmark", MIDNIGHT))
    write("brand/logo-wordmark-white.svg", lockup("wordmark", WHITE))
    for src, dst in (("logo-header-light.svg", "logo-primary-midnight"), ("logo-header-white.svg", "logo-primary-white"),
                     ("logo-lockup-light.svg", "logo-full-midnight"), ("logo-lockup-white.svg", "logo-full-white"),
                     ("brand/logo-wordmark-light.svg", "logo-wordmark-midnight"), ("brand/logo-wordmark-white.svg", "logo-wordmark-white")):
        png(src, f"brand/png/{dst}.png", width=1600)
    png("logo-mark.svg", "brand/png/symbol-tile.png", 1024, 1024)
    png("logo-mark-midnight.svg", "brand/png/symbol-midnight.png", 1024, 1024)
    png("logo-mark-white.svg", "brand/png/symbol-white.png", 1024, 1024)

    # one-colour versions, for single-colour printing, engraving, embroidery and fax-quality copies
    for kind, name in (("primary", "logo-primary"), ("full", "logo-full")):
        write(f"brand/mono/{name}-midnight.svg", lockup(kind, MIDNIGHT, mono=True))
        write(f"brand/mono/{name}-white.svg", lockup(kind, WHITE, mono=True))
        write(f"brand/mono/{name}-black.svg", lockup(kind, "#000000", mono=True))
    write("brand/mono/symbol-midnight.svg", tile(STANDARD, 0.92, ink=MIDNIGHT, bg=None, mono=True))
    write("brand/mono/symbol-white.svg", tile(STANDARD, 0.92, bg=None, mono=True))
    print("logo files rebuilt")


if __name__ == "__main__":
    main()
