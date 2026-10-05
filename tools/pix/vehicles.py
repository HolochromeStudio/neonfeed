"""All 60 player vehicles + enemies + bosses, drawn top-down (facing up) in native low-res pixels."""
from vkit import *
S = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"

def _canvas(L, H, extra=8):
    w = H * 2 + extra
    return new(w, L + 2), w // 2 - 1

def _tail(c, cx, L, H, col=TAIL_R):
    for xx in (cx - H + 3, cx - H + 4, cx + H - 3, cx + H - 2): c.px(xx, L, col)

def car(col="blue", L=40, H=9, roof=None, taxi=False, bar=None, stripe=None, spoiler=False, glass=None, ev=False, wheels=True,
        hood_vent=False, convert=False, num=None, gold=False, nose=7, tail=5, tint=None):
    r = ramp(col); c, cx = _canvas(L, H)
    prof = taper(L, H, nose, tail)
    gl = glass or GLASS
    if wheels: wheels_at(c, H, [6, L - 13], 7, 3, 2)
    rows(c, 1, L, prof, r)
    c.rect(cx, 3, cx + 1, 13, r[2])
    if hood_vent:
        c.rect(cx - 2, 6, cx + 3, 10, r[0]); c.rect(cx - 1, 7, cx + 2, 9, INK2)
    if convert:
        rows(c, 15, L - 8, lambda y: H - 3, [hx("5a2a2a"), hx("a85a4a"), hx("d08a70"), hx("f0b090")], "roof")
        rows(c, 14, 15, lambda y: H - 3, gl, "glass")
    else:
        rows(c, 15, 19, lambda y: H - 3 + (y - 15) * 0.5, gl, "glass")
        rr = ramp(roof) if roof else r
        rows(c, 20, 29, lambda y: H - 2, [rr[0], rr[2], rr[3], rr[3]], "roof")
        rows(c, 30, 33, lambda y: H - 3 - (y - 30) * 0.4, gl, "glass")
    headlights(c, 2, H - 2)
    _tail(c, cx, L, H)
    mirrors(c, 15, H)
    if stripe:
        s = ramp(stripe)
        for x in (cx - 1, cx + 2):
            c.rect(x, 2, x, L - 2, s[2] if x < cx else s[0])
        c.rect(cx, 2, cx + 1, L - 2, s[1])
    if taxi:
        c.rect(cx - 2, 23, cx + 3, 24, hx("fee761")); c.rect(cx - 2, 23, cx - 2, 24, hx("d58a1f"))
        for k in range(4): c.px(cx - H + 2, 5 + k * 3, INK if k % 2 == 0 else WHITE) if False else None
        for k in range(6): c.px(cx - H + 3 + (k % 2) * 0, 35 + k % 1, INK) if False else None
        for k in range(0, 6): c.px(cx - H + 1 + k * 1, L - 4, INK if k % 2 == 0 else WHITE) if False else None
    if bar: lightbar(c, 23, H - 4, left=hx(bar[0]), right=hx(bar[1]))
    if spoiler: c.rect(cx - H + 2, L - 3, cx + H - 1, L - 2, ramp("black")[1])
    if ev:
        c.rect(cx - H + 3, 14, cx - H + 3, L - 4, hx("5ad8c8")); c.rect(cx + H - 2, 14, cx + H - 2, L - 4, hx("5ad8c8"))
    if num:
        c.rect(cx - 1, 21, cx + 2, 25, WHITE); c.px(cx, 22, INK); c.px(cx, 23, INK); c.px(cx, 24, INK); c.px(cx + 1, 22, INK)
    round_ends(c, 1, L, 3, 2)
    return finalize(c)

def van(col="white", L=42, H=10, bar=None, stripe=None, cross=False, dish=False, sign=None, boxes=False, ev=False, roof=None, slide=False, armored=False, rear_door=True):
    r = ramp(col); c, cx = _canvas(L, H)
    wheels_at(c, H, [6, L - 13], 7, 3, 2)
    rows(c, 1, L, taper(L, H, 5, 3), r)
    c.rect(cx, 3, cx + 1, 7, r[2])
    rows(c, 9, 12, lambda y: H - 3 + (y - 9) * 0.4, GLASS, "glass")
    rr = ramp(roof) if roof else r
    rows(c, 13, L - 3, lambda y: H - 1, [rr[0], rr[2], rr[3], rr[3]], "roof")
    headlights(c, 2, H - 2); _tail(c, cx, L, H)
    mirrors(c, 10, H)
    if rear_door: c.rect(cx, L - 7, cx + 1, L - 3, rr[0])
    for k in range(3): c.rect(cx - H + 3, 17 + k * 7, cx - H + 4, 18 + k * 7, rr[2]) if boxes else None
    if stripe:
        s = ramp(stripe); c.rect(cx - H + 2, 22, cx + H - 1, 24, s[1]); c.rect(cx - H + 2, 22, cx + H - 1, 22, s[2])
    if cross:
        c.rect(cx - 1, 20, cx + 2, 20, hx("e43b44")); c.rect(cx, 19, cx + 1, 21, hx("e43b44")); c.rect(cx - 2, 20, cx + 3, 21, hx("e43b44")) if False else None
        c.rect(cx - 3, 20, cx + 4, 21, hx("e43b44")); c.rect(cx - 1, 18, cx + 2, 23, hx("e43b44"))
    if bar: lightbar(c, 14, H - 3, left=hx(bar[0]), right=hx(bar[1]))
    if dish:
        c.ell(cx - 4, 22, cx + 5, 31, WHITE, outline=hx("8b9bb4")); c.rect(cx, 25, cx + 1, 28, hx("e43b44"))
        c.px(cx - 1, 24, hx("c0cbdc"))
    if sign:
        c.rect(cx - 3, 16, cx + 4, 18, ramp(sign)[1]); c.rect(cx - 3, 16, cx + 4, 16, ramp(sign)[2])
    if armored:
        for yy in (17, 25, 33): c.rect(cx - H + 3, yy, cx + H - 2, yy, ramp("grey")[0])
        c.rect(cx - 3, 20, cx + 4, 22, ramp("grey")[0])
    if ev:
        c.rect(cx - H + 3, 14, cx - H + 3, L - 6, hx("5ad8c8")); c.rect(cx + H - 2, 14, cx + H - 2, L - 6, hx("5ad8c8"))
    round_ends(c, 1, L, 2, 2)
    return finalize(c)

def bus(col="yellow", L=44, H=10, stripe="black", articulated=False, school=False, neon=None, portal=False):
    r = ramp(col); c, cx = _canvas(L, H)
    wheels_at(c, H, [6, L - 12], 8, 3, 2)
    rows(c, 1, L, taper(L, H, 3, 2), r)
    rows(c, 4, 8, lambda y: H - 2, GLASS, "glass")
    rows(c, 10, L - 3, lambda y: H - 1, [r[0], r[2], r[3], r[3]], "roof")
    for k in range(3): hatch(c, cx - 2, 14 + k * 9, 4, 5, ramp("white"))
    s = ramp(stripe)
    c.rect(cx - H + 2, 10, cx - H + 2, L - 4, s[1]); c.rect(cx + H - 1, 10, cx + H - 1, L - 4, s[1])
    if school:
        c.rect(cx - H + 2, 10, cx + H - 1, 10, s[1]); c.rect(cx - H + 2, L - 4, cx + H - 1, L - 4, s[1])
        c.rect(cx - 3, 12, cx + 4, 12, s[1])
    headlights(c, 2, H - 2); _tail(c, cx, L, H)
    mirrors(c, 5, H)
    if neon:
        n = hx(neon)
        c.rect(cx - H + 3, 11, cx - H + 3, L - 5, n); c.rect(cx + H - 2, 11, cx + H - 2, L - 5, n)
    if portal:
        for rr_ in (8, 6, 4):
            c.ell(cx - rr_ // 2 + 1, 25 - rr_ // 2, cx + rr_ // 2, 25 + rr_ // 2, [hx("a77be0"), hx("d6b8ff"), hx("4a2a6e")][(8 - rr_) // 2])
    if articulated:
        c.rect(cx - H + 3, 26, cx + H - 2, 27, ramp("black")[1])
    round_ends(c, 1, L, 2, 2)
    return finalize(c)

def cab(c, cx, H, r, y0=1, y1=14, glass_y=(8, 12)):
    rows(c, y0, y1, taper(y1, H, 4, 1), r)
    rows(c, glass_y[0], glass_y[1], lambda y: H - 3, GLASS, "glass")
    c.rect(cx, 3, cx + 1, 6, r[2])

def truck(kind="pickup", col="blue", L=44, H=10, cargo_col=None, **k):
    r = ramp(col); c, cx = _canvas(L, H)
    wheels_at(c, H, [5, L - 12], 7, 3, 2)
    cr = ramp(cargo_col) if cargo_col else ramp("grey")
    cab(c, cx, H, r)
    headlights(c, 2, H - 2)
    mirrors(c, 9, H)
    ys = 16
    if kind == "pickup":
        rows(c, 15, L - 1, lambda y: H, [r[0], r[1], r[2], r[2]], "flat")
        for y in range(15, L): 
            for x in range(cx - H + 1, cx + H + 1):
                edge = x in (cx - H + 1, cx + H) or y in (15, L - 1)
                c.px(x, y, r[0] if edge else ramp("grey")[0] if (x + y) % 7 else ramp("grey")[1])
        box_top(c, cx - 5, 20, cx, 26, ramp("brown")); box_top(c, cx + 1, 28, cx + 6, 34, ramp("tan"))
    elif kind == "tow":
        rows(c, 15, L - 1, lambda y: H - 1, ramp("grey"), "body")
        c.rect(cx - 1, 17, cx + 2, L - 3, ramp("yellow")[1]); c.rect(cx - 1, 17, cx + 2, 17, ramp("yellow")[2])
        for yy in range(19, L - 3, 4): c.rect(cx - 1, yy, cx + 2, yy, INK2)
        c.line(cx + 3, 16, cx + 7, 28, ramp("black")[2], 1); c.rect(cx + 6, 28, cx + 8, 30, ramp("red")[1])
        c.rect(cx - H + 2, 15, cx - H + 3, L - 4, ramp("red")[1])
    elif kind == "garbage":
        rows(c, 15, L - 1, lambda y: H, ramp("green"), "body")
        for k_ in range(2): box_top(c, cx - H + 3, 18 + k_ * 12, cx + H - 2, 26 + k_ * 12, ramp("green"))
        c.rect(cx - 2, L - 5, cx + 3, L - 3, ramp("black")[1])
    elif kind == "mail":
        rows(c, 15, L - 1, lambda y: H - 1, ramp("white"), "roof")
        c.rect(cx - H + 3, 22, cx + H - 2, 24, ramp("blue")[1]); c.rect(cx - 3, 18, cx + 4, 20, ramp("red")[1])
    elif kind == "food":
        rows(c, 15, L - 1, lambda y: H, [r[0], r[1], r[2], r[3]], "roof")
        for k_ in range(0, H * 2 - 4, 2):
            c.rect(cx - H + 3 + k_, 20, cx - H + 4 + k_, 25, WHITE if (k_ // 2) % 2 == 0 else ramp(k.get("awning", "red"))[1])
        c.rect(cx - 2, 29, cx + 3, 33, ramp("tan")[2]); c.px(cx, 30, ramp("red")[1])
    elif kind == "sweeper":
        rows(c, 15, L - 4, lambda y: H - 1, ramp("grey"), "body")
        box_top(c, cx - 5, 18, cx + 6, 30, ramp("orange"))
        c.ell(cx - H, L - 6, cx - H + 4, L - 2, ramp("yellow")[1]); c.ell(cx + H - 3, L - 6, cx + H + 1, L - 2, ramp("yellow")[1])
        for yy in range(32, 38): c.px(cx - 4 + (yy % 3), yy, ramp("yellow")[2])
    elif kind == "fire":
        rows(c, 15, L - 1, lambda y: H, ramp("red"), "body")
        c.rect(cx - 1, 16, cx + 2, L - 3, ramp("white")[1]); c.rect(cx - 1, 16, cx + 2, 16, ramp("white")[3])
        for yy in range(18, L - 3, 3): c.rect(cx - 1, yy, cx + 2, yy, ramp("grey")[0])
        c.ell(cx - H + 2, 24, cx - H + 6, 28, ramp("black")[1]); c.ell(cx + H - 5, 24, cx + H - 1, 28, ramp("black")[1])
        lightbar(c, 6, H - 3)
    elif kind == "mixer":
        rows(c, 15, L - 1, lambda y: H - 1, ramp("grey"), "body")
        c.ell(cx - 7, 17, cx + 8, L - 3, ramp("orange")[1], outline=ramp("orange")[0])
        for yy in range(19, L - 4, 3): c.line(cx - 6, yy, cx + 7, yy + 2, ramp("orange")[2], 1)
    elif kind == "dump":
        rows(c, 15, L - 1, lambda y: H, ramp("yellow"), "body")
        box_top(c, cx - H + 2, 17, cx + H - 1, L - 4, ramp("yellow"))
        for k_ in range(0, 6): c.rect(cx - H + 3 + k_ * 3, 20, cx - H + 4 + k_ * 3, L - 7, ramp("orange")[0]) if k_ % 2 == 0 else None
    elif kind == "crane":
        rows(c, 15, L - 1, lambda y: H, ramp("yellow"), "body")
        c.rect(cx - 2, 16, cx + 3, 20, ramp("grey")[1]); 
        c.rect(cx - 1, 20, cx + 2, L - 2, ramp("grey")[2]); c.rect(cx - 1, 20, cx + 2, 20, ramp("white")[3])
        for yy in range(22, L - 2, 3): c.rect(cx - 1, yy, cx + 2, yy, ramp("black")[2])
        c.rect(cx - 2, L - 4, cx + 3, L - 1, ramp("red")[1])
    elif kind == "plow":
        rows(c, 15, L - 1, lambda y: H - 1, ramp("orange"), "body")
        box_top(c, cx - 5, 20, cx + 6, 30, ramp("grey"))
        c.poly([(cx - H - 3, 3), (cx, -1 if False else 0), (cx + H + 4, 3), (cx + H + 4, 5), (cx, 2), (cx - H - 3, 5)], ramp("white")[1]) if False else None
    elif kind == "wrecker":
        rows(c, 15, L - 1, lambda y: H, ramp("grey"), "body")
        c.rect(cx - 5, 18, cx + 6, L - 4, ramp("black")[2]); c.rect(cx - 5, 18, cx + 6, 18, ramp("grey")[2])
        c.line(cx, 20, cx + 8, L - 2, ramp("yellow")[1], 2); c.rect(cx + 8, L - 3, cx + 10, L - 1, ramp("red")[1])
    elif kind == "riot":
        rows(c, 15, L - 1, lambda y: H, ramp("navy"), "body")
        box_top(c, cx - H + 3, 18, cx + H - 2, L - 6, ramp("navy"))
        c.rect(cx - 2, 20, cx + 3, 30, ramp("grey")[1]); c.rect(cx - 1, 14, cx + 2, 19, ramp("white")[1])
        lightbar(c, 16, H - 4)
    elif kind == "military":
        rows(c, 15, L - 1, lambda y: H, ramp("olive"), "body")
        box_top(c, cx - H + 2, 17, cx + H - 1, L - 5, ramp("olive"))
        for yy in range(19, L - 6, 6): c.rect(cx - H + 4, yy, cx + H - 3, yy + 2, ramp("olive")[0])
        c.rect(cx - 1, 20, cx + 2, 20, ramp("black")[1])
    elif kind == "rescue":
        rows(c, 15, L - 1, lambda y: H, ramp(col), "body")
        c.rect(cx - H + 3, 17, cx + H - 2, L - 4, ramp("white")[2]); 
        cx_ = cx; c.rect(cx_ - 1, 21, cx_ + 2, 27, hx("e43b44")); c.rect(cx_ - 3, 23, cx_ + 4, 25, hx("e43b44"))
        lightbar(c, 16, H - 4)
    elif kind == "heavyfire":
        rows(c, 15, L - 1, lambda y: H, ramp("red"), "body")
        c.rect(cx - 2, 16, cx + 3, L - 3, ramp("white")[1]); c.rect(cx - 2, 16, cx + 3, 16, ramp("white")[3])
        c.ell(cx - 6, 18, cx + 7, 28, ramp("grey")[1], outline=ramp("grey")[0]); c.ell(cx - 3, 21, cx + 4, 25, ramp("red")[1])
    round_ends(c, 1, L, 2, 2)
    return finalize(c)

def bike(col="red", rider="blue", box=False, L=26, scooter=False):
    c = new(14, L + 2); cx = 6
    tyre(c, cx, 1, 6, 2); tyre(c, cx, L - 7, 6, 2)
    c.rect(cx - 1, 7, cx + 2, L - 8, ramp(col)[1]); c.rect(cx - 1, 7, cx - 1, L - 8, ramp(col)[2]); c.rect(cx + 2, 7, cx + 2, L - 8, ramp(col)[0])
    c.rect(cx - 4, 7, cx + 5, 8, ramp("grey")[1])      # handlebar
    c.rect(cx - 4, 7, cx - 4, 8, ramp("black")[1]); c.rect(cx + 5, 7, cx + 5, 8, ramp("black")[1])
    rr = ramp(rider)
    c.rect(cx - 3, 10, cx + 4, 16, rr[1]); c.rect(cx - 3, 10, cx - 3, 16, rr[2]); c.rect(cx + 4, 10, cx + 4, 16, rr[0])
    c.ell(cx - 1, 15, cx + 2, 19, hx("e8b796")); c.ell(cx - 1, 16, cx + 2, 20, ramp("red")[1] if not scooter else ramp("yellow")[1])
    if box: box_top(c, cx - 3, 21, cx + 4, 25, ramp("tan"))
    c.px(cx, 0, LIGHT_Y); c.px(cx + 1, 0, LIGHT_Y)
    return finalize(c)

def show(items, name, cols=10, cell=(44, 58), k=3):
    sheet(items, S + name + ".png", cols=cols, cell=cell, k=k)

# ---------------------------------------------------------------- specials
def ghostify(c, tint="purple"):
    t = ramp(tint)
    px = c.im.load()
    for y in range(c.h):
        for x in range(c.w):
            p = px[x, y]
            if p[3] == 0: continue
            if (x + y) % 4 == 0: px[x, y] = CLEAR; continue
            px[x, y] = (min(255, (p[0] + t[2][0]) // 2 + 20), min(255, (p[1] + t[2][1]) // 2 + 20), min(255, (p[2] + t[2][2]) // 2 + 30), 215)
    return c

def glow_edge(c, col):
    """1px coloured halo outside the silhouette (arcane/energy units)"""
    a = c.im.getchannel("A"); big = C(c.w + 4, c.h + 4); big.blit(c.im, 2, 2)
    out = big.outline(col)
    n = C(c.w + 6, c.h + 6); n.blit(out, 0, 0)
    return n

def monster(col="red"):
    r = ramp(col); L = 42; H = 10; c, cx = _canvas(L, H, 14)
    for y in (2, L - 13):
        c.rect(cx - H - 5, y, cx - H - 1, y + 10, TIRE); c.rect(cx + H + 2, y, cx + H + 6, y + 10, TIRE)
        for k in range(0, 10, 2): c.rect(cx - H - 5, y + k, cx - H - 4, y + k, TIRE2); c.rect(cx + H + 5, y + k, cx + H + 6, y + k, TIRE2)
        c.rect(cx - H - 2, y + 3, cx - H - 1, y + 7, ramp("grey")[2]); c.rect(cx + H + 2, y + 3, cx + H + 3, y + 7, ramp("grey")[2])
    rows(c, 3, L - 3, taper(L - 3, H - 1, 4, 3), r)
    rows(c, 9, 13, lambda y: H - 4, GLASS, "glass")
    rows(c, 15, L - 8, lambda y: H - 3, [r[0], r[2], r[3], r[3]], "roof")
    c.rect(cx - 3, 18, cx + 4, 20, ramp("orange")[1]); c.rect(cx - 1, 24, cx + 2, 30, ramp("black")[1])
    headlights(c, 3, H - 2)
    for k in range(3): c.px(cx - 3 + k * 3, 6, hx("ffb0a8"))
    return finalize(c)

def tank(col="olive", L=34, H=11):
    r = ramp(col); c, cx = _canvas(L, H, 8)
    for xs in (cx - H, cx + H - 2):
        c.rect(xs - 1, 3, xs + 2, L - 2, TIRE); 
        for yy in range(4, L - 2, 2): c.rect(xs - 1, yy, xs + 2, yy, TIRE2)
    rows(c, 4, L - 3, taper(L - 3, H - 2, 3, 2), r)
    c.ell(cx - 6, 12, cx + 7, 25, r[2], outline=r[0]); c.ell(cx - 4, 14, cx + 5, 23, r[1])
    c.rect(cx, 0, cx + 1, 14, ramp("grey")[1]); c.rect(cx - 1, 0, cx + 2, 2, ramp("black")[1]); c.rect(cx, 3, cx, 14, ramp("grey")[2])
    c.rect(cx - 1, 17, cx + 2, 20, ramp("black")[1])
    for k in range(3): c.rect(cx - H + 2, 6 + k * 8, cx - H + 3, 8 + k * 8, r[0])
    return finalize(c)

def ufo(col="teal"):
    r = ramp(col); c = new(34, 34); cx = 16
    c.ell(2, 8, 31, 27, ramp("grey")[1], outline=ramp("grey")[0]); c.ell(4, 10, 29, 24, ramp("grey")[2])
    c.ell(9, 3, 24, 18, GLASS[1], outline=GLASS[0]); c.ell(11, 5, 17, 10, GLASS[3])
    for k in range(7):
        a = k * 6.283 / 7
        import math
        c.rect(int(16 + math.cos(a) * 12), int(17 + math.sin(a) * 7), int(16 + math.cos(a) * 12) + 1, int(17 + math.sin(a) * 7) + 1, [hx("feae34"), hx("5ad8c8"), hx("e43b44")][k % 3])
    return finalize(c)

def mecha(col="red"):
    r = ramp(col); c = new(40, 44); cx = 19
    for xs in (cx - 12, cx + 8):    # shoulder armour
        c.rect(xs, 8, xs + 5, 18, r[1]); c.rect(xs, 8, xs, 18, r[2]); c.rect(xs + 5, 8, xs + 5, 18, r[0])
    for xs in (cx - 12, cx + 8):    # arms with cannons
        c.rect(xs + 1, 19, xs + 4, 36, ramp("grey")[1]); c.rect(xs + 1, 19, xs + 1, 36, ramp("grey")[2]); c.rect(xs + 2, 36, xs + 3, 40, INK2)
    rows(c, 12, 30, lambda y: 7 - (1 if y > 26 else 0), r)
    c.rect(cx - 3, 16, cx + 4, 22, ramp("grey")[0]); c.rect(cx - 1, 18, cx + 2, 20, hx("feae34"))
    c.ell(cx - 4, 4, cx + 5, 13, ramp("grey")[1], outline=ramp("grey")[0]); c.rect(cx - 2, 7, cx + 3, 8, hx("e43b44")); c.px(cx - 2, 7, hx("ffb0a8"))
    for xs in (cx - 6, cx + 2):
        c.rect(xs, 31, xs + 3, 41, ramp("grey")[0]); c.rect(xs - 1, 40, xs + 4, 43, TIRE)
    return finalize(c)

def heli():
    r = ramp("olive"); c = new(48, 54); cx = 23
    rows(c, 12, 38, lambda y: 5 - (1 if y > 34 else 0) + (1 if 18 < y < 28 else 0), r)
    c.rect(cx, 38, cx + 1, 50, r[0]); c.rect(cx - 3, 48, cx + 4, 50, r[1])
    c.ell(cx - 3, 8, cx + 4, 18, GLASS[1], outline=GLASS[0]); c.rect(cx - 2, 10, cx - 1, 12, GLASS[3])
    c.rect(cx - 9, 22, cx - 6, 30, ramp("black")[1]); c.rect(cx + 7, 22, cx + 10, 30, ramp("black")[1])
    c.line(1, 4, 45, 46, hx("c0cbdc"), 1); c.line(45, 4, 1, 46, hx("8b9bb4"), 1)
    c.ell(cx - 1, 26, cx + 2, 29, ramp("grey")[2])
    return finalize(c)

def drill():
    L = 44; H = 10; c, cx = _canvas(L, H, 8)
    wheels_at(c, H, [14, L - 12], 7, 3, 2)
    r = ramp("orange")
    rows(c, 12, L, lambda y: H, r)
    rows(c, 14, 17, lambda y: H - 3, GLASS, "glass")
    rows(c, 19, L - 3, lambda y: H - 2, [r[0], r[2], r[3], r[3]], "roof")
    c.poly([(cx - 6, 12), (cx + 7, 12), (cx + 2, 0), (cx - 1, 0)], ramp("grey")[1])
    for k in range(0, 12, 3): c.line(cx - 6 + k // 2, 12 - k, cx + 7 - k // 2, 12 - k, ramp("grey")[2] if (k // 3) % 2 == 0 else ramp("grey")[0], 1)
    c.rect(cx, 0, cx + 1, 1, hx("fee761"))
    return finalize(c)

def two_cars():
    a = car("red", L=28, H=6); b = car("blue", L=28, H=6)
    c = new(a.w + b.w - 6, a.h + 4)
    c.blit(a, 0, 4); c.blit(b, a.w - 6, 0)
    return c

def _gold(c):
    c.recolor({})
    return c

def units():
    U = {}
    # ---- common
    U["taxi"] = car("yellow", taxi=True)
    U["compact"] = car("blue", L=34, H=8)
    U["hatchback"] = car("red", L=36, H=9, tail=3)
    U["pickup"] = truck("pickup", "blue", L=42)
    U["delivery_van"] = van("white", stripe="orange", boxes=True, L=40)
    U["city_bus"] = bus("teal", L=44)
    U["scooter"] = bike("orange", "blue", scooter=True)
    U["family_wagon"] = car("green", L=42, H=9, roof="white")
    U["minivan"] = van("purple", L=40, H=9)
    U["courier_bike"] = bike("yellow", "green", box=True)
    # ---- uncommon
    U["tow_truck"] = truck("tow", "red", L=44)
    U["garbage_truck"] = truck("garbage", "green", L=44)
    U["mail_van"] = van("white", stripe="blue", sign="red", L=40)
    U["food_truck"] = truck("food", "purple", L=44, awning="orange")
    U["school_bus"] = bus("yellow", school=True, L=44)
    U["street_sweeper"] = truck("sweeper", "orange", L=44)
    U["road_worker"] = truck("dump", "orange", L=44)
    U["utility_van"] = van("orange", stripe="yellow", ev=True, L=40)
    U["electric_taxi"] = car("yellow", taxi=True, ev=True)
    U["shuttle"] = bus("blue", L=40, stripe="white")
    # ---- rare
    U["police"] = car("white", bar=("e43b44", "1f86d8"), stripe="black")
    U["ambulance"] = van("white", cross=True, bar=("e43b44", "e43b44"), L=42)
    U["fire_engine"] = truck("fire", "red", L=44)
    U["highway_patrol"] = car("navy", bar=("e43b44", "1f86d8"), spoiler=True, hood_vent=True, L=40, stripe="white")
    U["armored_van"] = van("grey", armored=True, L=40)
    U["construction_truck"] = truck("mixer", "orange", L=44)
    U["news_van"] = van("white", dish=True, stripe="teal", L=42)
    U["rescue_van"] = van("orange", cross=True, bar=("feae34", "feae34"), L=42)
    U["recovery_truck"] = truck("tow", "orange", L=44)
    U["traffic_enforcement"] = car("blue", bar=("e43b44", "1f86d8"), stripe="white", L=38)
    # ---- epic
    U["swat_van"] = van("black", armored=True, bar=("e43b44", "1f86d8"), L=42)
    U["monster_truck"] = monster("red")
    U["limousine"] = car("black", L=46, H=9, stripe="gold", nose=6, tail=4)
    U["riot_truck"] = truck("riot", "navy", L=44)
    U["crane_truck"] = truck("crane", "yellow", L=46)
    U["snowplow"] = truck("plow", "orange", L=44)
    U["race_car"] = car("red", L=36, H=8, stripe="white", num=True, spoiler=True)
    U["mobile_command"] = van("olive", dish=True, armored=True, L=44)
    U["heavy_wrecker"] = truck("wrecker", "grey", L=46)
    U["airport_rescue"] = truck("heavyfire", "yellow", L=46)
    # ---- legendary
    U["presidential_limo"] = car("black", L=46, H=10, stripe="navy", roof="black", nose=6, tail=4)
    U["prototype_supercar"] = car("white", L=38, H=8, ev=True, spoiler=True, stripe="teal", hood_vent=True)
    U["heavy_rescue"] = truck("rescue", "orange", L=46)
    U["military_convoy"] = truck("military", "olive", L=46)
    U["experimental_ev"] = car("teal", L=40, H=9, ev=True, stripe="white", glass=[hx("0b3a3a"), hx("2aa7a0"), hx("5ad8c8"), hx("e8fff8")])
    U["vintage_hot_rod"] = car("red", L=40, H=9, convert=True, hood_vent=True, stripe="yellow")
    U["golden_taxi"] = car("gold", taxi=True, roof="gold")
    U["interceptor"] = car("black", L=40, H=8, bar=("e43b44", "1f86d8"), spoiler=True, stripe="blue", hood_vent=True)
    U["hyper_bus"] = bus("white", L=44, neon="2ce8f5", stripe="blue")
    U["elite_fire_engine"] = truck("heavyfire", "red", L=46)
    # ---- mythic
    U["ghost_car"] = ghostify(car("white", L=40), "purple")
    U["time_traveller"] = glow_edge(car("grey", L=38, H=9, stripe="orange", hood_vent=True, roof="white"), hx("ff9a3a"))
    U["ufo"] = ufo()
    U["mecha_vehicle"] = mecha()
    U["possessed_ice_cream_truck"] = glow_edge(truck("food", "pink", L=44, awning="purple"), hx("a77be0"))
    U["mini_tank"] = tank()
    U["quantum_taxi"] = glow_edge(car("yellow", taxi=True, ev=True), hx("d6b8ff"))
    U["portal_bus"] = bus("purple", portal=True, L=44, stripe="pink")
    U["phantom_ambulance"] = ghostify(van("white", cross=True, bar=("a77be0", "a77be0"), L=42), "purple")
    U["chrono_police"] = glow_edge(car("navy", bar=("5ad8c8", "d6b8ff"), stripe="white", L=40), hx("5ad8c8"))
    return U

def enemies():
    """facing UP; the atlas builder rotates them for the lane direction"""
    E = {}
    def hostile(c):   # red headlights + dark menace tint on the windshield area
        return c
    E["slow_car"] = car("olive", L=30, H=7, glass=[hx("2a1f10"), hx("6a5a30"), hx("a08a50"), hx("d8c890")])
    E["speedster"] = car("orange", L=32, H=6, stripe="black", spoiler=True)
    E["suv"] = car("grey", L=34, H=8, roof="black")
    E["truck"] = truck("dump", "brown", L=36, H=8)
    E["bus"] = bus("red", L=38, H=9, stripe="black")
    E["police_chase"] = car("black", L=32, H=7, bar=("e43b44", "e43b44"), stripe="white")
    E["gang_cars"] = two_cars()
    E["motorcycle"] = bike("black", "purple", L=24)
    E["armored_truck"] = van("grey", armored=True, L=36, H=9)
    E["road_cleaner"] = truck("sweeper", "green", L=36, H=8)
    return E

def bosses():
    B = {}
    B["monster_truck"] = monster("purple")
    B["helicopter"] = heli()
    B["tank"] = tank("grey", L=38, H=12)
    B["drill_truck"] = drill()
    B["ufo"] = ufo("purple")
    B["mecha"] = mecha("purple")
    return B

if __name__ == "__main__":
    U = units()
    show(list(U.values()), "veh_units", cols=12, cell=(46, 60), k=3)
    E = enemies(); B = bosses()
    show(list(E.values()) + list(B.values()), "veh_enemies", cols=8, cell=(52, 60), k=3)
