"""Top-down pixel props, ground tiles and menu backgrounds."""
import math, random
import numpy as np
from pxl import *
from icons_px import art

G = (hx("193c3e"), hx("265c42"), hx("3e8948"), hx("63c74d"), hx("b4e87a"))

def tree(r=9, seed=1, cols=G):
    rnd = random.Random(seed); n = r * 2 + 6; c = C(n, n); cx = n // 2
    # shadow
    for y in range(n):
        for x in range(n):
            if math.hypot(x - cx - 2, y - cx - 3) <= r: c.px(x, y, (0, 0, 0, 90))
    c.ell(cx - r, cx - r - 1, cx + r, cx + r - 1, cols[0]); c.ell(cx - r + 1, cx - r, cx + r - 1, cx + r - 2, cols[1])
    for _ in range(r * 5):
        a = rnd.random() * 6.283; d = rnd.random() * (r - 3)
        c.px(int(cx + math.cos(a) * d - 1), int(cx + math.sin(a) * d - 2), cols[2] if rnd.random() < .6 else cols[3])
    for _ in range(r): c.px(int(cx - r / 2 + rnd.random() * 3), int(cx - r / 2 + rnd.random() * 3), cols[4])
    return c

def bush(r=5, seed=2): return tree(r, seed)

def pine(r=9, snow=False):
    c = tree(r, 5, (hx("0f2430"), hx("193c3e"), hx("265c42"), hx("3e8948"), hx("63c74d")))
    if snow:
        for dx, dy in ((-3, -3), (2, -4), (-5, 1), (3, 2), (0, 0), (-1, 5)): c.px(c.w // 2 + dx, c.h // 2 + dy, WHITE)
    return c

def lamp(): 
    c = C(12, 12)
    for y in range(12):
        for x in range(12):
            if math.hypot(x - 7, y - 8) <= 3: c.px(x, y, (0, 0, 0, 90))
    c.ell(2, 2, 8, 8, hx("5a6988"), outline=INK); c.ell(4, 4, 6, 6, hx("fee761")); c.px(4, 4, WHITE)
    return c

def hydrant():
    c = C(9, 9); c.ell(1, 1, 7, 7, hx("e43b44"), outline=INK); c.rect(3, 3, 5, 5, hx("a22633")); c.px(3, 3, hx("ffb0a8")); c.rect(0, 4, 8, 4, hx("e43b44"))
    return c.outline(INK)

def bench():
    c = C(18, 9); c.rect(1, 2, 16, 6, hx("a56a4c")); c.rect(1, 2, 16, 2, hx("d09a72")); c.rect(1, 6, 16, 6, hx("733e39"))
    for x in (4, 8, 12): c.rect(x, 3, x, 5, hx("8b5a3c"))
    return c.outline(INK)

def bin_():
    c = C(10, 10); c.ell(1, 1, 8, 8, hx("5a6988"), outline=INK); c.ell(3, 3, 6, 6, hx("3a4466")); c.px(2, 2, hx("8b9bb4"))
    return c.outline(INK)

def rock(n=11, seed=1):
    rnd = random.Random(seed); c = C(n, n)
    pts = [(n / 2 + math.cos(a) * n / 2.2 * rnd.uniform(.75, 1.1), n / 2 + math.sin(a) * n / 2.2 * rnd.uniform(.75, 1.1)) for a in [i * 6.283 / 8 for i in range(8)]]
    c.poly(pts, hx("8b9bb4")); c.poly([(x * .6 + n * .2, y * .6 + n * .2) for x, y in pts], hx("a9b4c8")); c.px(3, 3, WHITE)
    return c.outline(INK)

def bush_rocks():
    c = C(18, 14); b = bush(4, 7); c.blit(b, 0, 0); r = rock(7, 3); c.blit(r, 10, 5)
    return c

def barricade(w=22):
    c = C(w, 8)
    for x in range(w):
        for y in range(2, 6): c.px(x, y, hx("f6f0e0") if ((x + y) // 3) % 2 == 0 else hx("e43b44"))
    c.rect(1, 6, 2, 7, hx("5a6988")); c.rect(w - 3, 6, w - 2, 7, hx("5a6988"))
    return c.outline(INK)

def house(w, h, roof_col, seed):
    rnd = random.Random(seed); r = RAMP[roof_col]; c = C(w, h)
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x); ey = min(y, h - 1 - y)
            c.px(x, y, r[1] if (y // 2) % 2 == 0 else r[0] if False else r[1])
            if y % 3 == 2: c.px(x, y, r[0])
    c.rect(0, 0, w - 1, 1, r[2]); c.rect(w // 2 - 1, 0, w // 2, h - 1, r[2])
    for _ in range(2): c.rect(rnd.randint(2, w - 6), rnd.randint(2, h - 6), 0 + 2 + 2, 2 + 2, hx("8b9bb4")) if False else None
    c.rect(w - 6, 3, w - 4, 5, hx("a56a4c"))     # chimney
    return c.outline(INK)

def junction_box():
    c = C(10, 8); c.rect(0, 0, 9, 7, hx("8b9bb4")); c.rect(0, 0, 9, 1, hx("c0cbdc")); c.rect(0, 7, 9, 7, hx("5a6988")); c.rect(2, 3, 7, 4, hx("3a4466"))
    return c.outline(INK)

def sign(col="red"):
    c = C(9, 9); c.ell(0, 0, 8, 8, hx("e43b44") if col == "red" else hx("1f86d8")); c.rect(2, 3, 6, 5, WHITE)
    return c.outline(INK)

def tile_noise(size, base, seed, spec=(0.9, 1.08), dens=(0.1, 0.07), extra=None):
    rnd = random.Random(seed); c = C(size, size)
    for y in range(size):
        for x in range(size):
            v = rnd.random(); k = 1.0
            if v < dens[0]: k = spec[0]
            elif v > 1 - dens[1]: k = spec[1]
            c.px(x, y, (min(255, int(base[0] * k)), min(255, int(base[1] * k)), min(255, int(base[2] * k)), 255))
    if extra: extra(c, rnd)
    return c

def make_ground(texdir):
    import os
    def grass_extra(c, rnd):
        for _ in range(c.w * 2):
            x, y = rnd.randrange(c.w), rnd.randrange(c.h)
            c.px(x, y, hx("3e8948")); c.px(x, (y + 1) % c.h, hx("3e8948"))
    def flowers(c, rnd):
        grass_extra(c, rnd)
        for _ in range(6): c.px(rnd.randrange(c.w), rnd.randrange(c.h), rnd.choice([hx("fee761"), WHITE, hx("f6757a")]))
    def seams(c, rnd):
        for i in range(0, c.w, 16):
            for k in range(c.w): c.px(k, i, tuple(int(v * 0.9) for v in c.get(k, i)[:3]) + (255,)); c.px(i, k, tuple(int(v * 0.9) for v in c.get(i, k)[:3]) + (255,))
    def ripples(c, rnd):
        for _ in range(5):
            x, y = rnd.randrange(c.w), rnd.randrange(c.h)
            for k in range(5): c.px((x + k) % c.w, (y + (k % 2)) % c.h, (200, 168, 108, 255))
    def snow(c, rnd):
        for _ in range(8): c.px(rnd.randrange(c.w), rnd.randrange(c.h), (255, 255, 255, 255))
    defs = {
        "ground_grass": ((104, 170, 74), 11, grass_extra), "ground_grass_flowers": ((106, 172, 76), 12, flowers),
        "ground_concrete": ((182, 176, 166), 13, seams), "ground_sand": ((226, 192, 128), 14, ripples), "ground_snow": ((236, 242, 250), 15, snow),
        "ground_dark": ((70, 74, 102), 16, None), "ground_dry": ((176, 160, 100), 17, ripples), "ground_asphalt": ((84, 90, 118), 18, None),
    }
    for nm, (base, seed, ex) in defs.items():
        tile_noise(16, base, seed, extra=ex).save(os.path.join(texdir, nm + ".png"), 8)
    # dashed centre-line tiles (16 x 16 native => 128 px)
    for nm, col in (("tile_road_dashed_yellow_h", hx("fee761")), ("tile_road_dashed_white_h", hx("e8eef6"))):
        c = C(16, 16)
        c.rect(1, 7, 8, 8, col)
        c.save(os.path.join(texdir, nm + ".png"), 8)

def register(add):
    def A(k, c, g="env", s=4): add("prop_" + k, c.scaled(s).im, g)
    A("tree", tree(10, 1)); A("bush", bush(6, 2)); A("street_lamp", lamp()); A("hydrant", hydrant()); A("bench", bench()); A("trash_can", bin_()); A("bin_blue", bin_())
    A("rock", rock(12, 1)); A("bush_rocks", bush_rocks()); A("pine", pine(10)); A("barricade_a", barricade(22)); A("barricade_b", barricade(16))
    A("junction_box", junction_box()); A("stop_sign", sign("red")); A("stop_sign_small", sign("red")); A("one_way_sign", sign("blue")); A("speed_camera", junction_box())
    A("traffic_light", lamp())
    for i, (w, h, col) in enumerate([(24, 20, "red"), (24, 20, "blue"), (28, 20, "orange"), (20, 28, "teal")]):
        A("house_" + "abcd"[i], house(w, h, col, i))

# ------------------------------------------------------------------ menu backgrounds
THEMES = {
    "teal":  [hx("1d6f87"), hx("2a9aa8"), hx("4cc4c0"), hx("86e0cc"), hx("c4f0c8"), hx("f0f4b0")],
    "sun":   [hx("c4482a"), hx("e86a2a"), hx("f79a3a"), hx("fec35a"), hx("ffe08a"), hx("fff4c0")],
    "blue":  [hx("1c3f8a"), hx("2a63bc"), hx("3f8ae0"), hx("6cb4f0"), hx("a8d8f8"), hx("dcf0ff")],
    "grape": [hx("3a2470"), hx("5a3a9a"), hx("7c5cc4"), hx("a47ce0"), hx("d0a8f0"), hx("f0d8ff")],
    "green": [hx("1f5f3a"), hx("2f8a4a"), hx("4fb458"), hx("84d86a"), hx("c0ee8c"), hx("eef8b8")],
}

def menu_bg(theme, seed=1):
    W, H = 270, 480
    pal = THEMES[theme]; rnd = random.Random(seed)
    c = C(W, H)
    bands = len(pal)
    for y in range(H):
        k = min(bands - 1, int(y / (H - 16) * bands))
        for x in range(W): c.px(x, y, pal[k])
    # flat sunburst wedges (next band colour), clipped to the sky
    cx, cy = W / 2, 120
    for y in range(H - 16):
        for x in range(W):
            a = math.atan2(y - cy, x - cx)
            if int((a + math.pi) / (2 * math.pi) * 18) % 2 == 0:
                p = c.get(x, y)
                if p in pal and pal.index(p) < bands - 1: c.px(x, y, pal[pal.index(p) + 1])
    # clouds
    for _ in range(6):
        x, y = rnd.randint(10, W - 50), rnd.randint(30, 260)
        w = rnd.randint(24, 46)
        for dx, dw, dy in ((0, w, 0), (4, w - 8, -3), (w // 3, w // 3, -5)):
            c.rect(x + dx, y + dy, x + dx + dw, y + dy + 4, WHITE); c.rect(x + dx, y + dy + 4, x + dx + dw, y + dy + 5, pal[-2])
    # skyline silhouettes
    dark = tuple(int(v * 0.42) for v in pal[1][:3]) + (255,)
    mid = tuple(int(v * 0.6) for v in pal[2][:3]) + (255,)
    for layer, col, hmin, hmax in ((0, mid, 40, 90), (1, dark, 24, 60)):
        x = -4
        while x < W:
            bw = rnd.randint(16, 30); bh = rnd.randint(hmin, hmax)
            c.rect(x, H - 15 - bh, x + bw, H - 15, col)
            for wy in range(H - 15 - bh + 4, H - 20, 6):
                for wx in range(x + 3, x + bw - 2, 5):
                    if rnd.random() < 0.45: c.px(wx, wy, hx("fee761")); c.px(wx + 1, wy, hx("fee761"))
            x += bw + rnd.randint(0, 3)
    for _ in range(18):
        x, y = rnd.randint(2, W - 3), rnd.randint(2, 200)
        c.px(x, y, WHITE)
    c.rect(0, H - 14, W, H, hx("3a4466")); c.rect(0, H - 15, W, H - 15, hx("e8d8b0"))
    for x in range(4, W, 16): c.rect(x, H - 8, x + 7, H - 7, hx("fee761"))
    return c

def register_bg(texdir):
    import os
    for i, th in enumerate(THEMES):
        menu_bg(th, 10 + i).save(os.path.join(texdir, f"bg_{th}.png"), 4)
