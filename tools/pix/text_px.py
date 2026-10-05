"""Pixel text stickers (digits, labels, logo) rendered from Silkscreen with PIL (no anti-aliasing)."""
import os
from PIL import Image, ImageDraw, ImageFont
from pxl import *
FONT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts", "Silkscreen-Bold.ttf")

def glyphs(text, scale=3, size=8):
    f = ImageFont.truetype(FONT, size)
    im = Image.new("L", (len(text) * size + 8, size + 6), 0)
    d = ImageDraw.Draw(im); d.fontmode = "1"
    d.text((2, 0), text, font=f, fill=255)
    bb = im.getbbox() or (0, 0, 1, 1)
    im = im.crop(bb)
    out = C(im.width, im.height)
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] > 100: out.px(x, y, WHITE)
    return out.scaled(scale) if scale > 1 else out

def sticker(text, fill, shade=None, scale=2, outline=INK, shadow=True, pad=0):
    g = glyphs(text, scale)
    # colour: top rows lighter, bottom shade
    px = g.im.load(); sh = shade or tuple(int(v * 0.6) for v in fill[:3]) + (255,)
    for y in range(g.h):
        for x in range(g.w):
            if px[x, y][3]:
                px[x, y] = fill if y < g.h * 0.62 else sh
    o = g.outline(outline)
    if shadow:
        n = C(o.w + 2, o.h + 2)
        s = o.copy(); s.recolor({})
        spx = s.im.load()
        for y in range(s.h):
            for x in range(s.w):
                if spx[x, y][3]: spx[x, y] = outline
        n.blit(s, 2, 2); n.blit(o, 0, 0)
        return n
    return o

def register(add):
    for d in range(10):
        c = sticker(str(d), WHITE, hx("c0cbdc"), scale=3, shadow=True)
        add(f"digit_{d}", c.scaled(4).im, "ui")
    L = {"block": ("BLOCK", hx("4fb4f0")), "boss": ("BOSS", hx("e43b44")), "combo": ("COMBO", hx("fee761")), "critical": ("CRIT!", hx("feae34")),
         "merge": ("MERGE!", hx("63c74d")), "miss": ("MISS", hx("c0cbdc")), "wave": ("WAVE", hx("ffffff"))}
    for k, (t, col) in L.items():
        add("lbl_" + k, sticker(t, col, scale=2).scaled(4).im, "ui")

if __name__ == "__main__":
    S = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"
    st = {}
    register(lambda k, im, g: st.__setitem__(k, im))
    sheet(list(st.values()), S + "text.png", cols=8, cell=(110, 110), k=1)
