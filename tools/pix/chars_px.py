"""Pixel characters: modular doll parts (tinted by the game), cosmetics, NPCs, animals and avatar presets."""
import math, random
from PIL import Image, ImageDraw
from pxl import *

def ramp_from(rgb, sat=1.0):
    r, g, b = rgb[:3]
    def k(f): return (max(0, min(255, int(r * f))), max(0, min(255, int(g * f))), max(0, min(255, int(b * f))), 255)
    return [k(0.62), (int(r), int(g), int(b), 255), k(1.2), k(1.45)]

NR = [(165, 165, 180, 255), (228, 228, 238, 255), (255, 255, 255, 255), (255, 255, 255, 255)]   # neutral ramp, tinted in-engine

def mask_shape(w, h, fn):
    m = Image.new("L", (w, h), 0); fn(ImageDraw.Draw(m)); return m

def shaded(w, h, fn, r, lite=1, dark=1, bottom=True):
    m = mask_shape(w, h, fn); px = m.load(); c = C(w, h)
    for y in range(h):
        xs = [x for x in range(w) if px[x, y]]
        if not xs: continue
        x0, x1 = xs[0], xs[-1]
        for x in xs:
            col = r[1]
            if x - x0 < lite: col = r[2]
            elif x1 - x < dark: col = r[0]
            c.px(x, y, col)
    if bottom:
        for x in range(w):
            ys = [y for y in range(h) if px[x, y]]
            if ys and c.get(x, ys[-1]) == r[1]: c.px(x, ys[-1], r[0])
    return c

def head(r): return shaded(22, 20, lambda d: d.rounded_rectangle([0, 0, 21, 19], radius=7, fill=255), r, 2, 2)
def ear(r): return shaded(3, 4, lambda d: d.rectangle([0, 0, 2, 3], fill=255), r, 1, 1)
def torso(r): return shaded(14, 12, lambda d: d.rounded_rectangle([0, 0, 13, 11], radius=3, fill=255), r, 2, 2)
def arm(r): return shaded(4, 11, lambda d: d.rounded_rectangle([0, 0, 3, 10], radius=1, fill=255), r, 1, 1)
def hand(r): return shaded(4, 4, lambda d: d.rounded_rectangle([0, 0, 3, 3], radius=1, fill=255), r, 1, 1)
def leg(r): return shaded(5, 11, lambda d: d.rectangle([0, 0, 4, 10], fill=255), r, 1, 1, bottom=False)
def shoe(r):
    c = shaded(7, 4, lambda d: d.rounded_rectangle([0, 0, 6, 3], radius=1, fill=255), r, 1, 1)
    for x in range(7): c.px(x, 3, INK2)
    return c

def eyes(kind):
    c = C(16, 6)
    def eye(x, y, w=3, h=4, pup=None):
        c.rect(x, y, x + w - 1, y + h - 1, INK)
        c.px(x, y, WHITE) if h > 2 else None
    L, R = 3, 10
    if kind == "open": eye(L, 1); eye(R, 1)
    elif kind == "blink":
        c.rect(L, 3, L + 3, 3, INK); c.rect(R - 1, 3, R + 2, 3, INK)
    elif kind == "happy":
        for x0 in (L - 1, R - 1):
            c.px(x0, 4, INK); c.px(x0 + 1, 3, INK); c.px(x0 + 2, 3, INK); c.px(x0 + 3, 4, INK)
    elif kind == "surprised":
        for x0 in (L - 1, R - 1):
            c.rect(x0, 0, x0 + 3, 5, WHITE); c.box(x0, 0, x0 + 3, 5, INK); c.rect(x0 + 1, 2, x0 + 2, 3, INK)
    elif kind == "angry":
        eye(L, 2, 3, 3); eye(R, 2, 3, 3)
        c.px(L - 1, 0, INK); c.px(L, 0, INK); c.px(L + 1, 1, INK); c.px(L + 2, 1, INK)
        c.px(R + 4, 0, INK); c.px(R + 3, 0, INK); c.px(R + 2, 1, INK); c.px(R + 1, 1, INK)
    elif kind == "worried":
        eye(L, 2, 3, 4); eye(R, 2, 3, 4)
        c.px(L - 1, 1, INK); c.px(L, 0, INK); c.px(L + 1, 0, INK)
        c.px(R + 4, 1, INK); c.px(R + 3, 0, INK); c.px(R + 2, 0, INK)
    elif kind == "think":
        for x0 in (L - 1, R - 1):
            c.rect(x0, 1, x0 + 3, 4, WHITE); c.box(x0, 1, x0 + 3, 4, INK); c.rect(x0 + 2, 1, x0 + 3, 2, INK)
    elif kind == "look":
        for x0 in (L - 1, R - 1):
            c.rect(x0, 1, x0 + 3, 4, WHITE); c.box(x0, 1, x0 + 3, 4, INK); c.rect(x0 + 2, 2, x0 + 3, 3, INK)
    return c

def mouth(kind):
    c = C(8, 4)
    if kind == "smile":
        c.px(1, 1, INK); c.px(6, 1, INK); c.rect(2, 2, 5, 2, INK)
    elif kind == "neutral": c.rect(2, 1, 5, 1, INK)
    elif kind == "frown":
        c.px(1, 2, INK); c.px(6, 2, INK); c.rect(2, 1, 5, 1, INK)
    elif kind == "o": c.rect(3, 0, 4, 3, INK); c.px(3, 1, hx("e43b44")); 
    elif kind == "grin":
        c.rect(1, 0, 6, 2, WHITE); c.box(1, 0, 6, 2, INK); c.px(3, 1, INK) if False else None; c.px(3, 0, INK); c.px(4, 2, INK)
    elif kind == "talk_a": c.rect(2, 0, 5, 3, INK); c.rect(3, 2, 4, 2, hx("e43b44"))
    elif kind == "talk_b": c.rect(2, 1, 5, 2, INK)
    elif kind == "wobble":
        for x, y in ((1, 2), (2, 1), (3, 2), (4, 1), (5, 2), (6, 1)): c.px(x, y, INK)
    return c

def cheek():
    c = C(4, 3); c.rect(0, 0, 3, 2, (255, 120, 120, 150)); return c

# ------------------------------------------------------------------ hair / hats / glasses overlays (32x32, head centre at (16,16))
def _dome(c, x0, x1, y0, y1, r):
    cx = (x0 + x1) / 2; rx = (x1 - x0) / 2; ry = y1 - y0
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, ry)
        hw = rx * math.sqrt(max(0.0, 1 - (1 - t) ** 2)) if t < 1 else rx
        for x in range(x0, x1 + 1):
            if abs(x + 0.5 - cx - 0.5) <= hw:
                col = r[1]
                if x < cx - rx * 0.55: col = r[2]
                elif x > cx + rx * 0.55: col = r[0]
                c.px(x, y, col)

def hair(style, col):
    r = ramp_from(col); c = C(32, 32)
    if style == "messy":
        _dome(c, 4, 27, 3, 12, r)
        for x in range(5, 27):
            for y in range(12, 14 + (x * 7) % 3): c.px(x, y, r[1] if (x // 3) % 2 else r[0])
        for x, h in ((7, 2), (11, 3), (15, 2), (19, 3), (23, 2)): c.rect(x, 3 - h, x + 1, 3, r[2])
        c.rect(4, 12, 6, 19, r[0]); c.rect(25, 12, 27, 19, r[0])
    elif style == "spiky":
        _dome(c, 5, 26, 6, 12, r)
        for x, h in ((6, 5), (10, 7), (14, 8), (18, 7), (22, 5)):
            for k in range(h): c.rect(x + k // 4, 6 - k, x + 3 - k // 3, 6 - k, r[1] if k % 2 else r[2])
        c.rect(5, 12, 6, 16, r[0]); c.rect(25, 12, 26, 16, r[0])
    elif style == "slick":
        _dome(c, 4, 27, 4, 12, r)
        for x in range(5, 27): c.px(x, 8, r[2]); c.px(x, 9, r[3] if x % 4 == 0 else r[2])
        c.rect(4, 12, 6, 18, r[0]); c.rect(25, 12, 27, 18, r[0])
    elif style == "curly":
        for (x, y, rr) in ((6, 9, 4), (11, 5, 4), (16, 4, 4), (21, 5, 4), (26, 9, 4), (5, 15, 3), (27, 15, 3), (9, 8, 3), (22, 8, 3)):
            c.ell(x - rr, y - rr, x + rr, y + rr, r[1]); c.px(x - 1, y - 2, r[3]); c.px(x - 2, y - 1, r[2])
        c.rect(8, 9, 24, 12, r[1])
    return c.outline(INK)

def hat(style):
    c = C(32, 32)
    def cap(dome, brim, lite=True):
        d = ramp_from(dome); b = ramp_from(brim)
        _dome(c, 4, 27, 3, 12, d)
        c.rect(15, 2, 16, 3, d[2])
        c.rect(4, 11, 27, 12, d[0])
        c.rect(7, 12, 24, 14, b[1]); c.rect(7, 12, 24, 12, b[2]); c.rect(7, 14, 24, 14, b[0])
    if style == "cap_blue_red": cap((40, 110, 200), (230, 60, 70))
    elif style == "cap_red_blue": cap((220, 60, 68), (40, 110, 200))
    elif style == "cap_green": cap((70, 170, 80), (40, 100, 50))
    elif style == "cap_white": cap((240, 240, 248), (150, 160, 180))
    elif style == "black":
        d = ramp_from((60, 56, 76)); _dome(c, 8, 23, 2, 10, d)
        c.rect(2, 10, 29, 12, d[1]); c.rect(2, 10, 29, 10, d[2]); c.rect(2, 12, 29, 12, d[0])
        c.rect(8, 8, 23, 9, (228, 60, 68, 255))
    elif style == "golden":
        d = ramp_from((250, 200, 60)); _dome(c, 5, 26, 2, 11, d)
        c.rect(14, 1, 17, 11, d[2]); c.rect(3, 11, 28, 13, d[0]); c.rect(3, 11, 28, 11, d[2])
    elif style == "crown":
        d = ramp_from((255, 210, 70))
        c.rect(7, 8, 24, 12, d[1])
        for x in (7, 12, 17, 22): c.rect(x, 4, x + 2, 8, d[1]); c.px(x + 1, 3, d[2])
        c.px(16, 10, hx("e43b44")); c.px(10, 10, hx("1f86d8")); c.px(21, 10, hx("63c74d"))
    return c.outline(INK)

def glasses(style):
    c = C(32, 32)
    if style == "round":
        for x0 in (7, 17):
            c.ell(x0, 13, x0 + 7, 19, hx("1c1a2c")); c.px(x0 + 2, 14, hx("5a6988")); c.px(x0 + 3, 14, hx("5a6988"))
        c.rect(14, 15, 17, 16, hx("1c1a2c"))
    else:
        c.rect(6, 13, 25, 18, hx("0e0b16")); c.rect(7, 14, 10, 14, hx("5a6988")); c.rect(17, 14, 20, 14, hx("5a6988"))
    return c.outline(INK)

def headphones():
    c = C(32, 32)
    for x in range(5, 27):
        t = (x - 15.5) / 11.0
        y = int(3 + (t * t) * 6)
        c.rect(x, y, x, y + 1, hx("5a6988"))
    for x0 in (2, 25): c.rect(x0, 11, x0 + 4, 19, hx("e43b44")); c.rect(x0, 11, x0 + 4, 12, hx("ff7a82")); c.rect(x0 + 3, 12, x0 + 4, 19, hx("a22633"))
    return c.outline(INK)

def backpack():
    r = ramp_from((166, 100, 60)); c = shaded(11, 13, lambda d: d.rounded_rectangle([0, 0, 10, 12], radius=3, fill=255), r, 2, 2)
    c.rect(2, 4, 8, 4, r[0]); c.rect(3, 7, 7, 10, r[0]); c.rect(3, 7, 7, 7, r[2])
    return c.outline(INK)

# ------------------------------------------------------------------ full people (coloured), used for NPCs and avatar presets
HAIR_COL = {"messy": (122, 78, 44), "spiky": (28, 26, 40), "slick": (28, 26, 40), "curly": (236, 200, 80)}

def person(look, W=44, H=60, extra=None, expr="open", mouth_k="smile", hood=False, tall=1):
    c = C(W, H); cx = W // 2
    gy = H - 3
    skin = ramp_from(look.get("skin", (224, 169, 122)))
    topr = ramp_from(look.get("top", (91, 121, 176))); botr = ramp_from(look.get("bottom", (63, 95, 143))); shr = ramp_from(look.get("shoes", (58, 46, 42)))
    legh = 11
    if look.get("accessory") == "backpack": c.blit(backpack(), cx - 6, gy - 28)
    for dx in (-5, 0):
        c.blit(leg(botr), cx + dx - 0, gy - 13 - 0 + 1)
        c.blit(shoe(shr), cx + dx - 1, gy - 4 + 1)
    c.blit(torso(topr), cx - 7, gy - 25)
    c.blit(arm(topr), cx - 11, gy - 24); c.blit(arm(topr), cx + 7, gy - 24)
    c.blit(hand(skin), cx - 11, gy - 14); c.blit(hand(skin), cx + 7, gy - 14)
    hy = gy - 46
    c.blit(ear(skin), cx - 12, hy + 8); c.blit(ear(skin), cx + 9, hy + 8)
    c.blit(head(skin), cx - 11, hy)
    c.blit(cheek(), cx - 8, hy + 14); c.blit(cheek(), cx + 4, hy + 14)
    c.blit(eyes(expr), cx - 8, hy + 8); c.blit(mouth(mouth_k), cx - 4, hy + 15)
    if look.get("hair"): c.blit(hair(look["hair"], HAIR_COL.get(look["hair"], look.get("hair_col", (80, 60, 40)))), cx - 17, hy - 7)
    if look.get("glasses"): c.blit(glasses(look["glasses"]), cx - 17, hy - 7)
    if look.get("hat"): c.blit(hat(look["hat"]), cx - 17, hy - 7)
    if look.get("headphones"): c.blit(headphones(), cx - 17, hy - 7)
    if extra: extra(c, cx, gy, hy)
    return c.outline(INK)

def _tie(c, cx, gy, hy, col=(228, 60, 68)):
    c.rect(cx - 1, gy - 24, cx, gy - 18, col + (255,)); c.rect(cx - 1, gy - 18, cx, gy - 17, tuple(int(v * .6) for v in col) + (255,))

def npc(name):
    S = {"skin": (224, 169, 122)}
    if name == "traffic_cop":
        def ex(c, cx, gy, hy):
            c.rect(cx - 2, gy - 21, cx + 1, gy - 20, hx("fee761")); c.rect(cx + 10, gy - 23, cx + 12, gy - 6, WHITE); c.rect(cx + 10, gy - 23, cx + 12, gy - 22, hx("e43b44"))
            c.rect(cx - 4, hy - 4, cx + 3, hy - 2, hx("fee761")) if False else None
        return person({"skin": (198, 138, 90), "top": (36, 66, 140), "bottom": (28, 44, 100), "shoes": (24, 22, 36), "hat": "cap_blue_red" if False else "cap_white"} | {"hat": None}, extra=lambda c, cx, gy, hy: (ex(c, cx, gy, hy), _cop_hat(c, cx, hy)))
    if name == "mayor":
        def ex(c, cx, gy, hy):
            _tie(c, cx, gy, hy, (30, 120, 230)); c.rect(cx - 5, hy + 15, cx + 4, hy + 16, hx("c0cbdc")); c.rect(cx - 3, hy + 16, cx + 2, hy + 16, hx("c0cbdc"))
            for x in range(cx - 4, cx + 4): c.px(x, gy - 25, hx("e8eef6"))
            c.rect(cx - 8, gy - 23, cx + 7, gy - 22, hx("ffd24a")) if False else None
        return person({"skin": (241, 201, 165), "top": (52, 56, 90), "bottom": (40, 42, 70), "shoes": (24, 22, 36), "hair": "slick", "hair_col": (200, 204, 216), "glasses": "round"}, extra=ex)
    if name == "mechanic":
        def ex(c, cx, gy, hy):
            c.rect(cx - 5, gy - 24, cx + 4, gy - 22, hx("1f5aa8")); c.rect(cx + 10, gy - 16, cx + 11, gy - 7, hx("c0cbdc")); c.rect(cx + 9, gy - 17, cx + 12, gy - 16, hx("8b9bb4"))
            c.px(cx + 5, hy + 15, hx("3a3040"))
        return person({"skin": (198, 138, 90), "top": (40, 90, 170), "bottom": (40, 90, 170), "shoes": (60, 40, 30), "hat": "cap_red_blue"}, extra=ex)
    if name == "news_reporter":
        def ex(c, cx, gy, hy):
            c.rect(cx + 10, gy - 20, cx + 11, gy - 12, hx("5a6988")); c.rect(cx + 9, gy - 24, cx + 12, gy - 20, hx("fee761")); c.rect(cx + 9, gy - 24, cx + 12, gy - 24, hx("d58a1f"))
        return person({"skin": (241, 201, 165), "top": (210, 60, 70), "bottom": (50, 50, 80), "shoes": (60, 40, 30), "hair": "messy", "hair_col": (110, 70, 40)}, extra=ex)
    if name == "construction":
        def ex(c, cx, gy, hy):
            c.rect(cx - 7, gy - 22, cx + 6, gy - 21, hx("e8eef6")); c.rect(cx - 7, gy - 17, cx + 6, gy - 16, hx("e8eef6"))
            c.rect(cx - 5, hy + 15, cx + 4, hy + 17, hx("733e39"))
        return person({"skin": (198, 138, 90), "top": (247, 118, 34), "bottom": (70, 80, 110), "shoes": (60, 40, 30), "hat": "golden"}, extra=ex)
    if name == "delivery_guy":
        def ex(c, cx, gy, hy):
            c.rect(cx - 8, gy - 20, cx + 7, gy - 8, hx("c49a62")); c.rect(cx - 8, gy - 20, cx + 7, gy - 19, hx("e0b888")); c.rect(cx - 1, gy - 20, cx, gy - 8, hx("a87a50")); c.rect(cx + 3, gy - 16, cx + 6, gy - 13, WHITE)
        return person({"skin": (165, 106, 62), "top": (70, 170, 80), "bottom": (60, 60, 80), "shoes": (30, 30, 40), "hat": "cap_green"}, extra=ex)
    if name == "rival_driver":
        def ex(c, cx, gy, hy):
            c.rect(cx - 7, gy - 25, cx + 6, gy - 24, hx("ffffff")); c.rect(cx + 4, gy - 24, cx + 6, gy - 18, hx("ffffff"))
        return person({"skin": (241, 201, 165), "top": (200, 40, 50), "bottom": (30, 30, 50), "shoes": (30, 30, 40), "hair": "slick", "glasses": "dark"}, expr="angry", mouth_k="grin", extra=ex)
    if name == "mysterious_stranger":
        c = C(44, 60); cx = 22
        r = ramp_from((60, 40, 110))
        c.blit(shaded(24, 34, lambda d: d.polygon([(8, 0), (15, 0), (23, 33), (0, 33)], fill=255), r, 2, 3), cx - 12, 24)
        c.blit(shaded(18, 20, lambda d: d.rounded_rectangle([0, 0, 17, 19], radius=8, fill=255), r, 2, 3), cx - 9, 6)
        c.rect(cx - 6, 14, cx + 5, 22, hx("0e0b16")); c.rect(cx - 5, 16, cx - 3, 17, hx("fee761")); c.rect(cx + 2, 16, cx + 4, 17, hx("fee761"))
        return c.outline(INK)
    raise KeyError(name)

def _cop_hat(c, cx, hy):
    d = ramp_from((36, 66, 140)); _dome(c, cx - 9, cx + 8, hy - 3, hy + 3, d)
    c.rect(cx - 11, hy + 3, cx + 10, hy + 4, d[0]); c.rect(cx - 5, hy - 1, cx + 3, hy + 1, hx("fee761")) if False else None
    c.rect(cx - 2, hy - 1, cx + 1, hy + 1, hx("fee761"))

# ------------------------------------------------------------------ animals (side view, facing right)
def animal(kind):
    if kind == "dog":
        c = C(26, 18); b = ramp_from((226, 170, 110))
        c.blit(shaded(15, 8, lambda d: d.rounded_rectangle([0, 0, 14, 7], radius=3, fill=255), b, 2, 2), 3, 5)
        c.blit(shaded(8, 8, lambda d: d.rounded_rectangle([0, 0, 7, 7], radius=3, fill=255), b, 1, 1), 15, 1)
        c.rect(14, 0, 16, 3, hx("733e39")); c.rect(21, 4, 23, 5, hx("181425")); c.px(19, 3, INK)
        for x in (4, 6, 14, 16): c.rect(x, 12, x + 1, 15, b[0])
        c.rect(2, 4, 3, 7, b[2]); c.px(1, 3, b[2])
        return c.outline(INK)
    if kind == "cat":
        c = C(24, 18); b = ramp_from((150, 160, 180))
        c.blit(shaded(14, 8, lambda d: d.rounded_rectangle([0, 0, 13, 7], radius=3, fill=255), b, 2, 2), 3, 6)
        c.blit(shaded(8, 7, lambda d: d.rounded_rectangle([0, 0, 7, 6], radius=2, fill=255), b, 1, 1), 14, 2)
        c.poly([(14, 2), (15, -1 + 1), (17, 2)], b[2]); c.poly([(19, 2), (20, 0), (21, 3)], b[2])
        c.px(18, 4, INK); c.px(21, 4, INK); c.rect(1, 3, 3, 9, b[1]); c.px(0, 2, b[1])
        for x in (4, 6, 13, 15): c.rect(x, 13, x + 1, 15, b[0])
        return c.outline(INK)
    if kind in ("pigeon", "seagull"):
        c = C(22, 14); b = ramp_from((150, 156, 176) if kind == "pigeon" else (240, 240, 248))
        c.blit(shaded(14, 8, lambda d: d.ellipse([0, 0, 13, 7], fill=255), b, 2, 2), 2, 4)
        c.blit(shaded(6, 6, lambda d: d.ellipse([0, 0, 5, 5], fill=255), b, 1, 1), 13, 1)
        c.px(17, 3, INK); c.rect(18, 4, 20, 4, hx("feae34"))
        c.rect(5, 3, 11, 5, b[2]); c.rect(1, 6, 3, 8, b[0])
        c.rect(6, 11, 6, 12, hx("e86a2a")); c.rect(9, 11, 9, 12, hx("e86a2a"))
        return c.outline(INK)
    if kind == "raccoon":
        c = C(26, 18); b = ramp_from((130, 136, 156))
        c.blit(shaded(15, 8, lambda d: d.rounded_rectangle([0, 0, 14, 7], radius=3, fill=255), b, 2, 2), 3, 5)
        c.blit(shaded(8, 7, lambda d: d.rounded_rectangle([0, 0, 7, 6], radius=2, fill=255), b, 1, 1), 15, 2)
        c.rect(16, 4, 21, 5, hx("181425")); c.px(18, 4, WHITE); c.px(20, 4, WHITE); c.px(22, 6, INK)
        for k in range(4): c.rect(0 + k * 2, 5 + k % 2, 1 + k * 2, 7 + k % 2, hx("181425") if k % 2 else hx("c0cbdc"))
        for x in (5, 7, 14, 16): c.rect(x, 12, x + 1, 15, b[0])
        return c.outline(INK)

# ------------------------------------------------------------------ garment icons
def garment(kind, col, pattern=None):
    r = ramp_from(col); c = C(16, 16)
    if kind in ("tee", "jacket", "hoodie", "scarf"):
        c.poly([(4, 2), (11, 2), (15, 5), (13, 8), (12, 7), (12, 14), (3, 14), (3, 7), (2, 8), (0, 5)], r[1])
        c.rect(3, 3, 3, 13, r[2]); c.rect(12, 7, 12, 13, r[0]); c.rect(5, 2, 10, 3, r[0])
        if kind == "hoodie": c.ell(4, 1, 11, 6, r[0]); c.rect(6, 8, 9, 11, r[0])
        if kind == "jacket": c.rect(7, 4, 8, 13, r[0]); c.px(6, 6, WHITE); c.px(6, 9, WHITE)
        if kind == "scarf": c.rect(3, 3, 12, 5, hx("e8eef6")); c.rect(9, 5, 11, 10, hx("e8eef6"))
        if pattern == "patch":
            for (x, y, cc) in ((5, 8, (230, 200, 90)), (9, 10, (220, 90, 90)), (6, 11, (90, 190, 120))): c.rect(x, y, x + 2, y + 2, cc + (255,))
    elif kind == "pants":
        c.poly([(3, 1), (12, 1), (13, 14), (9, 14), (8, 6), (7, 6), (6, 14), (2, 14)], r[1]); c.rect(3, 1, 12, 2, r[0]); c.rect(3, 3, 3, 13, r[2]); c.rect(12, 3, 12, 13, r[0])
    elif kind == "shorts":
        c.poly([(3, 3), (12, 3), (13, 10), (9, 10), (8, 7), (7, 7), (6, 10), (2, 10)], r[1]); c.rect(3, 3, 12, 4, r[0])
    elif kind == "overalls":
        c.rect(4, 1, 5, 4, r[0]); c.rect(10, 1, 11, 4, r[0]); c.poly([(3, 4), (12, 4), (13, 14), (9, 14), (8, 9), (7, 9), (6, 14), (2, 14)], r[1]); c.rect(6, 5, 9, 7, r[2])
    elif kind == "shoe":
        c.poly([(1, 6), (7, 6), (9, 9), (14, 10), (15, 13), (1, 13)], r[1]); c.rect(1, 12, 15, 13, WHITE); c.rect(2, 7, 4, 8, r[2])
    return c.outline(INK)

def register(add):
    k = 4
    def A(key, c, grp="chars"): add(key, c.scaled(k).im, grp)
    # neutral doll parts (tinted by the game)
    A("doll_head", head(NR).outline(INK)); A("doll_ear", ear(NR).outline(INK)); A("doll_torso", torso(NR).outline(INK))
    A("doll_arm", arm(NR).outline(INK)); A("doll_hand", hand(NR).outline(INK)); A("doll_leg", leg(NR).outline(INK)); A("doll_shoe", shoe(NR).outline(INK))
    A("doll_cheek", cheek()); A("doll_backpack", backpack())
    for kind in ("open", "blink", "happy", "surprised", "angry", "worried", "think", "look"): A("doll_eyes_" + kind, eyes(kind))
    for kind in ("smile", "neutral", "frown", "o", "grin", "talk_a", "talk_b", "wobble"): A("doll_mouth_" + kind, mouth(kind))
    # cosmetics (head overlays share one 32x32 canvas centred on the head)
    A("cos_hair_messy_brown", hair("messy", HAIR_COL["messy"])); A("cos_hair_spiky_black", hair("spiky", HAIR_COL["spiky"]))
    A("cos_hair_slick_black", hair("slick", HAIR_COL["slick"])); A("cos_hair_curly_blond", hair("curly", HAIR_COL["curly"]))
    A("cos_hats_cap_blue_red", hat("cap_blue_red")); A("cos_hats_cap_red_blue", hat("cap_red_blue")); A("cos_hats_cap_green", hat("cap_green"))
    A("cos_hats_cap_white", hat("cap_white")); A("cos_hats_hat_black", hat("black")); A("cos_hats_golden", hat("golden")); A("cos_hats_crown", hat("crown"))
    A("cos_glasses_round_shades", glasses("round")); A("cos_glasses_dark_shades", glasses("dark")); A("cos_accessories_headphones", headphones())
    for key, kind, col, pat in [("tops_patchwork_tee", "tee", (91, 121, 176), "patch"), ("tops_navy_scarf", "scarf", (58, 79, 130), None), ("tops_tan_jacket", "jacket", (224, 135, 58), None),
                                ("tops_teal_hoodie", "hoodie", (63, 154, 148), None), ("tops_red_jacket", "jacket", (194, 74, 67), None), ("tops_green_jacket", "jacket", (79, 138, 80), None),
                                ("tops_grey_jacket", "jacket", (138, 138, 136), None), ("bottoms_yellow_jacket", "jacket", (232, 184, 58), None), ("tops_blue_hoodie", "hoodie", (125, 99, 176), None),
                                ("bottoms_jeans", "pants", (63, 95, 143), None), ("bottoms_cargo", "pants", (122, 90, 58), None), ("bottoms_overalls", "overalls", (69, 70, 74), None),
                                ("bottoms_denim_shorts", "shorts", (179, 160, 112), None), ("bottoms_dark_jacket", "pants", (63, 106, 69), None), ("bottoms_red_pack", "pants", (154, 58, 58), None),
                                ("bottoms_red_sneakers", "shoe", (194, 74, 67), None), ("bottoms_blue_hoodie2", "hoodie", (60, 90, 170), None), ("tops_jeans_overalls", "overalls", (63, 95, 143), None),
                                ("bottoms_dark_jacket2", "jacket", (60, 60, 70), None), ("bottoms_red_bag", "pants", (170, 60, 60), None), ("bottoms_red_pack2", "pants", (150, 50, 50), None)]:
        A("cos_" + key, garment(kind, col, pat))
    # NPCs and animals
    for nm in ("traffic_cop", "mayor", "mechanic", "news_reporter", "construction", "delivery_guy", "rival_driver", "mysterious_stranger"): A("npc_" + nm, npc(nm))
    for a_ in ("dog", "cat", "pigeon", "seagull", "raccoon"): A("npc_animal_" + a_, animal(a_))
    # avatar presets (mirror customize_screen.PRESETS)
    sk = [(241, 201, 165), (224, 169, 122), (198, 138, 90), (165, 106, 62), (122, 74, 44), (90, 51, 32)]
    tops = [(91, 121, 176), (58, 79, 130)]; bots = [(63, 95, 143), (122, 90, 58)]
    P = [("cap_red_blue", 2, "cap_red_blue", None, 0, 0, False), ("cap_headphones", 1, "cap_blue_red", None, 1, 1, True), ("brown_hair", 1, None, "messy", 0, 1, False),
         ("cap_blue", 3, "cap_blue_red", None, 1, 0, False), ("long_hair", 4, None, "spiky", 0, 0, True), ("red_curls", 0, "cap_red_blue", "spiky", 1, 1, False)]
    for nm, s_, h_, hr, t_, b_, bp in P:
        look = {"skin": sk[s_], "top": tops[t_], "bottom": bots[b_], "shoes": (58, 46, 42), "hat": h_, "hair": hr, "accessory": "backpack" if bp else None}
        A("pc_" + nm, person(look))

if __name__ == "__main__":
    S_ = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"
    st = {}
    register(lambda k, im, g: st.__setitem__(k, im))
    keys = [k for k in st if k.startswith(("npc_", "pc_"))]
    sheet([st[k] for k in keys], S_ + "chars.png", cols=10, cell=(60 * 4, 66 * 4), k=1)
    keys2 = [k for k in st if k.startswith(("cos_", "doll_"))]
    sheet([st[k] for k in keys2], S_ + "cos.png", cols=12, cell=(130, 130), k=1)
