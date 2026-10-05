"""Pixel effects: glow, ring, sparkle, smoke puffs, explosions, debris, dust, bullet, flame, drop."""
import math, random
from pxl import *

def _disc(c, cx, cy, r, col):
    for y in range(c.h):
        for x in range(c.w):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r: c.px(x, y, col)

def glow(n=24):
    c = C(n, n)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2)
            if d < 0.35: a = 255
            elif d < 0.6: a = 200 if (x + y) % 2 == 0 else 255
            elif d < 0.8: a = 120 if (x + y) % 2 == 0 else 0
            elif d < 0.95: a = 70 if (x % 2 == 0 and y % 2 == 0) else 0
            else: a = 0
            if a: c.px(x, y, (255, 255, 255, a))
    return c

def ring(n=48):
    c = C(n, n)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2)
            if n / 2 - 2 <= d <= n / 2 - 0.5: c.px(x, y, WHITE)
            elif n / 2 - 3 <= d < n / 2 - 2 and (x + y) % 2 == 0: c.px(x, y, (255, 255, 255, 140))
    return c

def sparkle(n=22):
    c = C(n, n); m = n // 2
    for k in range(m):
        w = max(0, 2 - k // 3)
        c.rect(m - w, m - 1 - k, m + w - 1, m - 1 - k, WHITE) if False else None
    for k in range(0, m):
        t = 1 if k < m * 0.6 else 0
        for dx in range(-t, t + 1):
            c.px(m + dx, k, WHITE if abs(dx) == 0 else (255, 255, 255, 170))
            c.px(m + dx, n - 1 - k, WHITE if abs(dx) == 0 else (255, 255, 255, 170))
            c.px(k, m + dx, WHITE if abs(dx) == 0 else (255, 255, 255, 170))
            c.px(n - 1 - k, m + dx, WHITE if abs(dx) == 0 else (255, 255, 255, 170))
    for dx in range(-2, 2):
        for dy in range(-2, 2): c.px(m + dx, m + dy, WHITE)
    return c

def shadow(w=24, h=12):
    c = C(w, h)
    for y in range(h):
        for x in range(w):
            d = math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2))
            if d < 0.7: c.px(x, y, (0, 0, 0, 255))
            elif d < 0.95 and (x + y) % 2 == 0: c.px(x, y, (0, 0, 0, 255))
    return c

def puff(r, light, mid, dark, seed=1):
    rnd = random.Random(seed)
    n = r * 2 + 4; c = C(n, n); cx = n / 2
    blobs = [(cx, cx, r)] + [(cx + rnd.uniform(-r * 0.5, r * 0.5), cx + rnd.uniform(-r * 0.5, r * 0.5), r * rnd.uniform(0.45, 0.7)) for _ in range(5)]
    for (bx, by, br) in blobs: _disc(c, bx, by, br, mid)
    for (bx, by, br) in blobs: _disc(c, bx - 1, by - 1, br * 0.6, light)
    # shade lower right
    px = c.im.load()
    for y in range(n):
        for x in range(n):
            if px[x, y] == mid and x + y > n * 1.1: px[x, y] = dark
    return c

def explosion(n=30, seed=3):
    rnd = random.Random(seed); c = C(n, n); cx = n / 2
    pts = []
    for i in range(14):
        a = i * 6.283 / 14; rr = n / 2 - 1 if i % 2 == 0 else n / 3.2
        pts.append((cx + math.cos(a) * rr, cx + math.sin(a) * rr))
    c.poly(pts, hx("e43b44"))
    pts2 = [(cx + (p[0] - cx) * 0.72, cx + (p[1] - cx) * 0.72) for p in pts]
    c.poly(pts2, hx("f77622"))
    pts3 = [(cx + (p[0] - cx) * 0.45, cx + (p[1] - cx) * 0.45) for p in pts]
    c.poly(pts3, hx("fee761"))
    _disc(c, cx, cx, n / 9, WHITE)
    return c.outline(INK)

def burst(w=30, h=24):
    c = C(w, h); cx, cy = w / 2, h / 2
    pts = []
    for i in range(16):
        a = i * 6.283 / 16; rr = (w / 2 - 1) if i % 2 == 0 else w / 4.4
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * h / w))
    c.poly(pts, hx("feae34")); c.poly([(cx + (p[0] - cx) * .6, cy + (p[1] - cy) * .6) for p in pts], hx("fff4b0"))
    return c.outline(INK)

def flame(w=10, h=12):
    rows = ["....oo....", "...ooo....", "..oooyo...", "..oyyyoo..", ".ooyyyyoo.", ".oyyyyyyo.", ".oyywwyyo.", ".oyywwyyo.", "..oyyyyo..", "...oyyo...", "....oo...."]
    from icons_px import PAL, art
    return art(rows)

def drop(n=8):
    from icons_px import art
    return art(["...c...", "..cCc..", ".cCCCc.", "cCCbCCc", "cCbbbCc", ".cCCCc."], outline=True)

def dust(n=14):
    return puff(5, hx("d8dce8"), hx("a9b0c4"), hx("7a829c"), seed=9)

def bullet(w=8, h=4):
    c = C(w, h); c.rect(0, 1, w - 1, 2, hx("fee761")); c.rect(w - 3, 0, w - 1, 3, WHITE); c.rect(0, 1, 1, 2, hx("f77622"))
    return c

def rock(n=8, seed=1):
    rnd = random.Random(seed); c = C(n, n)
    pts = [(n / 2 + math.cos(a) * n / 2.4 * rnd.uniform(.7, 1.1), n / 2 + math.sin(a) * n / 2.4 * rnd.uniform(.7, 1.1)) for a in [i * 6.283 / 7 for i in range(7)]]
    c.poly(pts, hx("8b9bb4")); c.px(int(n / 2) - 1, int(n / 2) - 1, hx("c0cbdc"))
    return c.outline(INK)

def scrap(i):
    rnd = random.Random(i)
    cols = [hx("8b9bb4"), hx("5a6988"), hx("a56a4c"), hx("c0cbdc"), hx("e43b44"), hx("feae34")]
    n = rnd.randint(4, 7); c = C(n, n)
    kind = i % 3
    col = rnd.choice(cols)
    if kind == 0: c.rect(0, 1, n - 1, n - 2, col)
    elif kind == 1: c.poly([(0, n - 1), (n - 1, n - 1), (n // 2, 0)], col)
    else: c.rect(1, 0, n - 2, n - 1, col)
    c.px(0, 1, WHITE) if False else None
    return c.outline(INK)

def register(add):
    def A(k, c, scale=4): add("fx_" + k, c.scaled(scale).im, "fx")
    A("glow", glow()); A("ring", ring()); A("sparkle", sparkle()); A("shadow_blob", shadow())
    A("flame", flame()); A("drop", drop()); A("dust", dust()); A("bullet", bullet())
    A("smoke_tiny", puff(3, hx("e8eef6"), hx("b4bccc"), hx("8890a8"), 1))
    A("smoke_small", puff(5, hx("e8eef6"), hx("b4bccc"), hx("8890a8"), 2))
    A("smoke_med", puff(7, hx("e8eef6"), hx("b4bccc"), hx("8890a8"), 3))
    A("smoke_big", puff(10, hx("d8dce8"), hx("a0a8bc"), hx("6a728c"), 4))
    A("smoke_cloud_b", puff(8, hx("c8ccd8"), hx("8a92a8"), hx("5a627c"), 5))
    A("smoke_far", puff(6, hx("a0a8bc"), hx("6a728c"), hx("4a526c"), 6))
    A("rock_a", rock(10, 1)); A("rock_b", rock(9, 2)); A("rock_c", rock(7, 3))
    A("explosion_orange", explosion()); A("boom_burst", burst())
    A("spark_burst", burst(26, 20)); A("sparkle_big", sparkle(30))
    for i in range(14): A("scrap_%02d" % i, scrap(i))
    A("debris_a", scrap(30)); A("streaks", C(1, 1)); A("cone_big", C(1, 1))
    for nm in ("arrow_blue", "arrow_red_a", "arrow_red_b", "arrow_small"):
        c = C(9, 9); col = hx("1f86d8") if "blue" in nm else hx("e43b44")
        c.poly([(4, 0), (8, 5), (5, 5), (5, 8), (3, 8), (3, 5), (0, 5)], col); A(nm, c.outline(INK))
    A("shard_blue", C(1, 1)); A("drop", drop())
    A("wheel", C(1, 1))
