#!/usr/bin/env python3
"""Stage 3: procedural cut-paper UI kit, character doll parts, status icons, paper scraps.
Colours are sampled from the supplied sheet palette (teal 84,140,132 / blue 113,156,188 / red 209,110,103 / ...)."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from paperlib import *
from seglib import save, ROOT

PAL = {  # sampled from the sheet's buttons + cards
  "teal": (84, 140, 132), "blue": (113, 156, 188), "red": (209, 110, 103), "orange": (219, 136, 99),
  "yellow": (233, 171, 75), "lavender": (140, 143, 184), "mint": (141, 176, 162), "gray": (150, 148, 140),
  "green": (110, 160, 98), "pink": (214, 140, 160), "dark": (62, 58, 56), "cream": (232, 216, 184),
}
import colorsys
def _vivid(c, sat=1.32, val=1.06):
    h, l, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    r, g, b = colorsys.hsv_to_rgb(h, min(1, l * sat), min(1, v * val))
    return (int(r * 255), int(g * 255), int(b * 255))
PAL = {k: (_vivid(v) if k not in ("gray", "dark", "cream") else v) for k, v in PAL.items()}
RAR = {"common": (150, 150, 146), "uncommon": (120, 168, 120), "rare": (116, 150, 205), "epic": (170, 120, 190), "legendary": (232, 150, 92), "mythic": (220, 108, 130)}
n = 0
def put(img, rel):
    global n; save(img, "ui_gen/" + rel); n += 1

# ------------------------------------------------------------------ panels (9-slice friendly: 256x256, margin ~46)
for name, col, seed in [("paper", PARCH, 3), ("cream", (238, 224, 194), 8), ("cardboard", (176, 146, 108), 5), ("dark", (70, 66, 64), 11), ("kraft", (196, 164, 120), 13)]:
    put(paper_card(236, 236, col, r=14, jit=1.8, seed=seed, pad=10, grain=18 if name != "dark" else 12, outline=(54, 40, 34) if name != "dark" else (24, 20, 20)), f"ui_panel_{name}.png")
for name, col in PAL.items():
    put(paper_card(236, 236, col, r=14, jit=1.8, seed=hash(name) % 97, pad=10), f"ui_panel_{name}.png")
# rarity-bordered unit cards
for rname, col in RAR.items():
    card = paper_card(176, 232, mix(PARCH, (255, 255, 255), 0.25), outline=rgb(col, 0.7), r=12, jit=1.4, seed=hash(rname) % 50, pad=8, edge=3.5)
    put(card, f"ui_card_{rname}.png")
    # inner tinted header strip
    put(paper_card(150, 34, col, r=6, jit=1.0, seed=7, pad=5, grain=12), f"ui_chip_{rname}.png")

# ------------------------------------------------------------------ buttons (up / down), 9-slice margin ~34
def button(col, pressed=False, w=220, h=96, seed=2):
    base = paper_card(w, h, col, r=12, jit=1.3, seed=seed, pad=12, edge=3.0, shadow=not pressed)
    if pressed:
        # darker + sunk: shadow compressed (drawn tight)
        a = base.getchannel("A")
        dk = Image.new("RGBA", base.size, (30, 20, 16, 70)); dk.putalpha(a.point(lambda v: int(v * 0.22)))
        base.alpha_composite(dk)
        sh = shadow_of(a, (1, 2), 2, 0.5)
        sim = Image.new("RGBA", base.size, (30, 20, 16, 0)); sim.putalpha(sh)
        bg = Image.new("RGBA", base.size, (0, 0, 0, 0)); bg.alpha_composite(sim); bg.alpha_composite(base)
        base = bg
    # inner stitched rim
    d = ImageDraw.Draw(base)
    return base
for name in ["teal", "blue", "red", "orange", "yellow", "lavender", "mint", "gray", "green", "dark"]:
    put(button(PAL[name]), f"ui_btn_{name}_up.png")
    put(button(rgb(PAL[name], 0.9), pressed=True), f"ui_btn_{name}_down.png")
put(button(PAL["gray"]), "ui_btn_disabled_up.png")

# ------------------------------------------------------------------ bars / pills / slots
put(paper_card(236, 40, (58, 50, 46), r=14, jit=0.8, seed=21, pad=6, grain=8, outline=(24, 18, 16), edge=2.5), "ui_bar_bg.png")
for name in ["green", "red", "yellow", "blue", "orange", "lavender", "teal"]:
    put(paper_card(236, 40, PAL[name], r=14, jit=0.8, seed=23, pad=6, grain=10, shadow=False, outline=rgb(PAL[name], 0.55), edge=2.0), f"ui_bar_fill_{name}.png")
put(paper_card(236, 64, (58, 50, 46), r=24, jit=0.6, seed=31, pad=8, grain=8, outline=(24, 18, 16)), "ui_pill.png")

# grid slot: asphalt-grey paper tile with cut corner marks
def slot(hl=None, w=150, h=122):
    base = paper_card(w, h, (84, 86, 90), r=10, jit=1.2, seed=41, pad=6, grain=18, outline=(34, 32, 32), shadow=True)
    d = ImageDraw.Draw(base)
    pad = 6
    # dashed parking line
    for x in range(pad + 14, w + pad - 14, 18):
        d.line([x, pad + 10, x + 9, pad + 10], fill=(238, 224, 168), width=3)
        d.line([x, h + pad - 10, x + 9, h + pad - 10], fill=(238, 224, 168), width=3)
    if hl:
        o = Image.new("RGBA", base.size, hl + (0,))
        o.putalpha(base.getchannel("A").point(lambda v: int(v * 0.38)))
        base.alpha_composite(o)
    return base
put(slot(), "ui_slot.png"); put(slot((120, 255, 140)), "ui_slot_ok.png"); put(slot((255, 214, 90)), "ui_slot_merge.png"); put(slot((255, 110, 100)), "ui_slot_bad.png")

# ------------------------------------------------------------------ tape, stamp, ribbon
def tape(w=120, h=38, col=(214, 190, 140), seed=2):
    t = paper_card(w, h, col, r=2, jit=2.4, seed=seed, pad=3, shadow=True, grain=20, outline=rgb(col, 0.7), edge=1.0)
    a = np.asarray(t).copy(); a[..., 3] = (a[..., 3] * 0.82).astype(np.uint8)
    return Image.fromarray(a, "RGBA")
put(tape(), "ui_tape.png"); put(tape(col=(236, 220, 170), seed=5), "ui_tape_b.png"); put(tape(70, 30, (190, 150, 120), 7), "ui_tape_small.png")
def stamp(col, sz=160, seed=3):
    S = 3
    im = Image.new("RGBA", (sz * S, sz * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = sz * S / 2
    d.ellipse([6 * S, 6 * S, sz * S - 6 * S, sz * S - 6 * S], outline=col + (230,), width=7 * S)
    d.ellipse([22 * S, 22 * S, sz * S - 22 * S, sz * S - 22 * S], outline=col + (200,), width=3 * S)
    rs = np.random.RandomState(seed)
    a = np.asarray(im).astype(np.float32)
    ink = rs.rand(*a.shape[:2]) > 0.18
    a[..., 3] *= ink
    return Image.fromarray(a.astype(np.uint8), "RGBA").resize((sz, sz), Image.LANCZOS)
put(stamp((190, 60, 54)), "ui_stamp_red.png"); put(stamp((60, 110, 150), seed=4), "ui_stamp_blue.png"); put(stamp((70, 130, 80), seed=5), "ui_stamp_green.png")
put(paper_card(300, 64, PAL["red"], r=4, jit=2.2, seed=9, pad=8, outline=(120, 40, 36)), "ui_ribbon_red.png")
put(paper_card(300, 64, PAL["teal"], r=4, jit=2.2, seed=10, pad=8, outline=(40, 80, 76)), "ui_ribbon_teal.png")
put(paper_card(300, 64, PAL["yellow"], r=4, jit=2.2, seed=12, pad=8, outline=(130, 90, 30)), "ui_ribbon_yellow.png")

# ------------------------------------------------------------------ speech bubble + dialogue box (9-slice)
put(paper_card(236, 150, (252, 248, 236), r=34, jit=0.9, seed=60, pad=10, outline=INK, edge=3.0, grain=6), "ui_bubble.png")
put(paper_card(236, 180, (240, 224, 190), r=16, jit=1.6, seed=62, pad=10, outline=INK, edge=3.0, grain=16), "ui_dialog_box.png")
put(paper_card(160, 54, (240, 224, 190), r=6, jit=1.6, seed=63, pad=8, outline=INK, edge=2.5, grain=14), "ui_namebox.png")

# ------------------------------------------------------------------ soft shadow + vignette + paper grain overlay
sh = Image.new("RGBA", (96, 48), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([8, 8, 88, 40], fill=(24, 16, 12, 150)); put(sh.filter(ImageFilter.GaussianBlur(5)), "fx_shadow_blob.png")
g = paper_noise(512, 512, seed=77, strength=1.0)
gm = np.clip(128 + g * 90, 0, 255).astype(np.uint8)
grain = Image.fromarray(np.stack([gm, gm, gm, np.full_like(gm, 255)], axis=2), "RGBA")
# make tileable by cross-fading with offset copy
off = ImageChops.offset(grain, 256, 256)
mask = Image.fromarray((np.abs(np.linspace(-1, 1, 512))[None, :] * np.abs(np.linspace(-1, 1, 512))[:, None] * 255).astype(np.uint8)).point(lambda v: v)
tile = Image.composite(grain, off, Image.fromarray(((1 - np.abs(np.linspace(-1, 1, 512))[None, :] ** 3) * (1 - np.abs(np.linspace(-1, 1, 512))[:, None] ** 3) * 255).astype(np.uint8)))
put(tile, "ui_grain_tile.png")
v = np.zeros((256, 256), np.float32)
yy, xx = np.mgrid[0:256, 0:256]; r = np.sqrt(((xx - 128) / 128.0) ** 2 + ((yy - 128) / 128.0) ** 2)
va = np.clip((r - 0.55) / 0.55, 0, 1) ** 1.6 * 200
put(Image.fromarray(np.stack([np.full((256, 256), 22), np.full((256, 256), 14), np.full((256, 256), 10), va.astype(np.uint8)], axis=2).astype(np.uint8), "RGBA"), "ui_vignette.png")
# halftone dots (screenprint feel)
ht = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(ht)
for y in range(0, 64, 8):
    for x in range(0, 64, 8):
        ox = 4 if (y // 8) % 2 else 0
        d.ellipse([x + ox, y, x + ox + 3, y + 3], fill=(40, 28, 26, 70))
put(ht, "ui_halftone_tile.png")

# ------------------------------------------------------------------ paper scraps / confetti
rs = random.Random(7)
SCRAP_COLS = [(226, 208, 176), (209, 110, 103), (233, 171, 75), (113, 156, 188), (141, 176, 162), (238, 230, 208), (219, 136, 99)]
for i in range(14):
    k = rs.randint(18, 34); S = 4
    im = Image.new("RGBA", (k * S, k * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    npt = rs.randint(4, 6); cx = cy = k * S / 2
    pts = []
    for j in range(npt):
        a = 2 * math.pi * j / npt + rs.uniform(-0.3, 0.3); rr = k * S * rs.uniform(0.28, 0.48)
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    col = SCRAP_COLS[i % len(SCRAP_COLS)]
    d.polygon(pts, fill=col + (255,), outline=rgb(col, 0.55) + (255,))
    put(im.resize((k, k), Image.LANCZOS), f"fx_scrap_{i:02d}.png")
# glow / sparkle
gl = np.zeros((96, 96), np.float32); yy, xx = np.mgrid[0:96, 0:96]; r = np.sqrt((xx - 48) ** 2 + (yy - 48) ** 2) / 48
gl = np.clip(1 - r, 0, 1) ** 2
put(Image.fromarray(np.stack([np.full((96, 96), 255), np.full((96, 96), 236), np.full((96, 96), 170), (gl * 255).astype(np.uint8)], axis=2).astype(np.uint8), "RGBA"), "fx_glow.png")
sp = Image.new("RGBA", (96, 96), (0, 0, 0, 0)); d = ImageDraw.Draw(sp)
d.polygon([(48, 4), (56, 40), (92, 48), (56, 56), (48, 92), (40, 56), (4, 48), (40, 40)], fill=(255, 244, 190, 255), outline=(150, 100, 30, 255))
put(sp.filter(ImageFilter.GaussianBlur(0.6)), "fx_sparkle.png")
ring = Image.new("RGBA", (192, 192), (0, 0, 0, 0)); ImageDraw.Draw(ring).ellipse([6, 6, 186, 186], outline=(255, 250, 235, 255), width=10)
put(ring.filter(ImageFilter.GaussianBlur(1.2)), "fx_ring.png")
# dust puff
dp = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(dp)
for cx, cy, rr in [(32, 34, 20), (20, 38, 13), (44, 38, 14), (30, 26, 13)]:
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(214, 200, 178, 255), outline=(150, 134, 112, 255), width=2)
put(dp.filter(ImageFilter.GaussianBlur(0.8)), "fx_dust.png")
# bullet shapes
bl = Image.new("RGBA", (32, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(bl)
d.ellipse([2, 3, 30, 13], fill=(255, 220, 110, 255), outline=INK, width=2); put(bl, "fx_bullet.png")
wd = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(wd); d.ellipse([4, 4, 28, 28], fill=(120, 190, 240, 255), outline=(40, 80, 130, 255), width=3); put(wd, "fx_drop.png")
fl = Image.new("RGBA", (40, 48), (0, 0, 0, 0)); d = ImageDraw.Draw(fl)
d.polygon([(20, 2), (34, 24), (36, 36), (20, 46), (6, 36), (8, 22), (14, 28), (14, 14)], fill=(244, 140, 50, 255), outline=(150, 50, 20, 255))
d.polygon([(20, 22), (28, 34), (20, 44), (12, 34)], fill=(255, 226, 120, 255)); put(fl, "fx_flame.png")
# ------------------------------------------------------------------ status icons
def icon(draw_fn, bg, name):
    S = 4; sz = 56
    im, d = glyph_canvas(sz, S)
    c = sz * S / 2
    d.ellipse([6 * S, 6 * S, (sz - 6) * S, (sz - 6) * S], fill=bg + (255,))
    draw_fn(d, S, c)
    out = finish(im, sz, S, ow=2, sticker=True)
    put(out, f"ui_status_{name}.png")
def poly(d, pts, S, fill, outline=INK, w=2):
    d.polygon([(x * S, y * S) for x, y in pts], fill=fill, outline=outline)
    d.line([(x * S, y * S) for x, y in pts + [pts[0]]], fill=outline, width=w * S)
icon(lambda d, S, c: [d.line([(34 * S, 22 * S), (22 * S, 34 * S)], fill=(250, 250, 250, 255), width=3 * S), d.polygon([(14 * S, 26 * S), (30 * S, 42 * S), (14 * S, 42 * S)], fill=(250, 250, 250, 255))], (86, 140, 170), "slow")
def _stun(d, S, c):
    for k in range(3):
        a = k * 2.1 - 0.2; x = c + math.cos(a) * 12 * S; y = c - 6 * S + math.sin(a) * 6 * S
        d.polygon([(x, y - 5 * S), (x + 2 * S, y - S), (x + 6 * S, y), (x + 2 * S, y + S), (x, y + 5 * S), (x - 2 * S, y + S), (x - 6 * S, y), (x - 2 * S, y - S)], fill=(255, 236, 120, 255))
    d.arc([14 * S, 30 * S, 42 * S, 46 * S], 180, 360, fill=(250, 250, 250, 255), width=3 * S)
icon(_stun, (160, 120, 190), "stun")
icon(lambda d, S, c: [d.polygon([(28 * S, 11 * S), (40 * S, 28 * S), (38 * S, 40 * S), (28 * S, 46 * S), (18 * S, 40 * S), (16 * S, 28 * S), (22 * S, 32 * S), (22 * S, 20 * S)], fill=(255, 190, 70, 255)), d.polygon([(28 * S, 28 * S), (34 * S, 38 * S), (28 * S, 44 * S), (22 * S, 38 * S)], fill=(255, 240, 150, 255))], (214, 90, 60), "burn")
icon(lambda d, S, c: d.polygon([(28 * S, 10 * S), (40 * S, 32 * S), (28 * S, 46 * S), (16 * S, 32 * S)], fill=(240, 250, 255, 255)), (80, 150, 210), "wet")
icon(lambda d, S, c: d.polygon([(32 * S, 8 * S), (18 * S, 30 * S), (27 * S, 30 * S), (22 * S, 48 * S), (40 * S, 24 * S), (30 * S, 24 * S)], fill=(255, 236, 90, 255)), (90, 100, 190), "shock")
def _marked(d, S, c):
    d.ellipse([14 * S, 14 * S, 42 * S, 42 * S], outline=(255, 255, 255, 255), width=3 * S)
    d.ellipse([22 * S, 22 * S, 34 * S, 34 * S], fill=(255, 255, 255, 255)); d.line([(28 * S, 8 * S), (28 * S, 48 * S)], fill=(255, 255, 255, 255), width=2 * S); d.line([(8 * S, 28 * S), (48 * S, 28 * S)], fill=(255, 255, 255, 255), width=2 * S)
icon(_marked, (200, 60, 60), "marked")
def _abreak(d, S, c):
    d.polygon([(28 * S, 10 * S), (42 * S, 15 * S), (40 * S, 34 * S), (28 * S, 46 * S), (16 * S, 34 * S), (14 * S, 15 * S)], fill=(230, 230, 230, 255))
    d.line([(28 * S, 12 * S), (24 * S, 26 * S), (32 * S, 32 * S), (26 * S, 44 * S)], fill=INK + (255,), width=2 * S)
icon(_abreak, (140, 110, 80), "armor_break")
icon(lambda d, S, c: [d.polygon([(10 * S, 22 * S), (30 * S, 22 * S), (30 * S, 14 * S), (46 * S, 28 * S), (30 * S, 42 * S), (30 * S, 34 * S), (10 * S, 34 * S)], fill=(250, 250, 250, 255))], (100, 150, 110), "pushback")
def _silence(d, S, c):
    d.rectangle([22 * S, 14 * S, 34 * S, 32 * S], fill=(250, 250, 250, 255)); d.arc([16 * S, 22 * S, 40 * S, 40 * S], 0, 180, fill=(250, 250, 250, 255), width=3 * S)
    d.line([(12 * S, 44 * S), (44 * S, 12 * S)], fill=(210, 50, 50, 255), width=4 * S)
icon(_silence, (110, 110, 120), "silence")
def _haste(d, S, c):
    for k in range(2):
        d.polygon([(10 * S + k * 16 * S, 14 * S), (26 * S + k * 16 * S, 28 * S), (10 * S + k * 16 * S, 42 * S), (16 * S + k * 16 * S, 28 * S)], fill=(255, 240, 150, 255))
icon(_haste, (230, 160, 60), "haste")
def _shield(d, S, c):
    d.polygon([(28 * S, 9 * S), (44 * S, 15 * S), (42 * S, 34 * S), (28 * S, 47 * S), (14 * S, 34 * S), (12 * S, 15 * S)], fill=(250, 250, 250, 255))
    d.polygon([(28 * S, 15 * S), (38 * S, 19 * S), (36 * S, 32 * S), (28 * S, 40 * S)], fill=(120, 190, 230, 255))
icon(_shield, (70, 130, 190), "shield")
def _jam(d, S, c):
    d.ellipse([14 * S, 14 * S, 42 * S, 42 * S], outline=(250, 250, 250, 255), width=3 * S)
    d.line([(20 * S, 20 * S), (36 * S, 36 * S)], fill=(250, 250, 250, 255), width=3 * S); d.line([(36 * S, 20 * S), (20 * S, 36 * S)], fill=(250, 250, 250, 255), width=3 * S)
icon(_jam, (160, 100, 60), "jammed")
icon(lambda d, S, c: [d.ellipse([12 * S, 22 * S, 44 * S, 42 * S], fill=(30, 28, 30, 255)), d.ellipse([20 * S, 18 * S, 38 * S, 32 * S], fill=(80, 78, 90, 255)), d.ellipse([22 * S, 20 * S, 28 * S, 25 * S], fill=(200, 200, 220, 255))], (90, 80, 100), "oil")
def _fear(d, S, c):
    d.ellipse([14 * S, 14 * S, 42 * S, 42 * S], fill=(250, 250, 250, 255)); d.ellipse([20 * S, 22 * S, 25 * S, 28 * S], fill=INK + (255,)); d.ellipse([31 * S, 22 * S, 36 * S, 28 * S], fill=INK + (255,)); d.ellipse([24 * S, 32 * S, 32 * S, 40 * S], fill=INK + (255,))
icon(_fear, (130, 90, 160), "fear")
icon(lambda d, S, c: [d.polygon([(28 * S, 12 * S), (44 * S, 20 * S), (40 * S, 40 * S), (28 * S, 46 * S), (16 * S, 40 * S), (12 * S, 20 * S)], fill=(255, 255, 255, 255)), d.polygon([(28 * S, 20 * S), (36 * S, 24 * S), (34 * S, 36 * S), (28 * S, 40 * S), (22 * S, 36 * S), (20 * S, 24 * S)], fill=(100, 170, 100, 255))], (80, 130, 80), "regen")

# rank star + rank pip
def star(col, sz=40):
    S = 4; im, d = glyph_canvas(sz, S); c = sz * S / 2
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5; r = (sz * S * 0.46) if k % 2 == 0 else (sz * S * 0.2)
        pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
    d.polygon(pts, fill=col + (255,))
    return finish(im, sz, S, ow=1, sticker=False)
put(star((250, 200, 60)), "ui_star_gold.png"); put(star((180, 176, 170)), "ui_star_gray.png"); put(star((230, 90, 70)), "ui_star_red.png")
print("generated", n, "ui files")

# ------------------------------------------------------------------ paper houses / pines for the world map (reconstructed in the sheet's style)
def house(body, roof, w=120, h=110, floors=1, seed=1):
    S = 4
    W, H = (w + 12) * S, (h + 12) * S
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x0, y1 = 6 * S, (h + 6) * S
    bh = int(h * (0.38 + 0.2 * floors)) * S
    d.rectangle([x0 + 8 * S, y1 - bh, (w + 6) * S - 8 * S, y1], fill=body + (255,))
    # roof
    d.polygon([(x0, y1 - bh + 4 * S), ((w // 2 + 6) * S, y1 - bh - int(h * 0.38) * S), ((w + 6) * S, y1 - bh + 4 * S)], fill=roof + (255,))
    # door + windows
    d.rectangle([(w // 2 - 7 + 6) * S, y1 - 24 * S, (w // 2 + 7 + 6) * S, y1], fill=(120, 76, 50, 255))
    for fl in range(floors):
        for wx in (22, w - 38):
            yy = y1 - bh + (10 + fl * 30) * S
            d.rectangle([(wx + 6) * S, yy, (wx + 22) * S, yy + 18 * S], fill=(172, 206, 226, 255), outline=(60, 44, 40, 255), width=2 * S)
    return finish(im, 1, S, ow=2, sticker=False) if False else _outline(im, S)
def _outline(im, S):
    a = im.getchannel("A"); dil = a.filter(ImageFilter.MaxFilter(2 * S * 2 + 1))
    res = Image.new("RGBA", im.size, (0, 0, 0, 0))
    o = Image.new("RGBA", im.size, INK + (0,)); o.putalpha(dil); res.alpha_composite(o); res.alpha_composite(im)
    return res.resize((res.width // S, res.height // S), Image.LANCZOS)
put(house((230, 214, 182), (196, 82, 70), seed=1), "prop_house_a.png")
put(house((214, 186, 150), (70, 96, 150), floors=1, seed=2), "prop_house_b.png")
put(house((192, 120, 84), (110, 70, 56), w=140, floors=1, seed=3), "prop_house_c.png")
put(house((226, 210, 190), (86, 128, 120), w=100, h=150, floors=2, seed=4), "prop_house_d.png")
def pine(sz=110):
    S = 4; W, H = (sz) * S, (int(sz * 1.5)) * S
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([W // 2 - 7 * S, H - 26 * S, W // 2 + 7 * S, H - 4 * S], fill=(110, 76, 52, 255))
    for k in range(3):
        top = (8 + k * 30) * S; bw = (36 + k * 12) * S
        d.polygon([(W // 2, top), (W // 2 - bw // 2 - 4 * S, top + 56 * S), (W // 2 + bw // 2 + 4 * S, top + 56 * S)], fill=(58 + k * 6, 112 + k * 8, 86, 255))
    return _outline(im, S)
put(pine(), "prop_pine.png")
print("houses/pines added")

# ------------------------------------------------------------------ spinning wheel overlay (tyre + hub with lugs so rotation reads)
def wheel_img(sz=64):
    S = 4
    im = Image.new("RGBA", (sz * S, sz * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = sz * S / 2
    d.ellipse([2 * S, 2 * S, (sz - 2) * S, (sz - 2) * S], fill=(34, 30, 30, 255), outline=(14, 10, 10, 255), width=2 * S)
    # tread nicks
    for k in range(10):
        a = k * math.pi / 5
        x0 = c + math.cos(a) * 28 * S; y0 = c + math.sin(a) * 28 * S
        x1 = c + math.cos(a) * 24 * S; y1 = c + math.sin(a) * 24 * S
        d.line([x0, y0, x1, y1], fill=(70, 64, 62, 255), width=2 * S)
    d.ellipse([c - 15 * S, c - 15 * S, c + 15 * S, c + 15 * S], fill=(168, 168, 170, 255), outline=(60, 56, 56, 255), width=2 * S)
    for k in range(5):
        a = k * 2 * math.pi / 5
        x = c + math.cos(a) * 9 * S; y = c + math.sin(a) * 9 * S
        d.ellipse([x - 3.2 * S, y - 3.2 * S, x + 3.2 * S, y + 3.2 * S], fill=(84, 82, 86, 255))
    d.ellipse([c - 4 * S, c - 4 * S, c + 4 * S, c + 4 * S], fill=(228, 228, 232, 255), outline=(60, 56, 56, 255), width=S)
    # a single bright mark so spin is visible
    d.ellipse([c + 8 * S, c - 2 * S, c + 12 * S, c + 2 * S], fill=(255, 255, 255, 255))
    return im.resize((sz, sz), Image.LANCZOS)
put(wheel_img(), "fx_wheel.png")
