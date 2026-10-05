#!/usr/bin/env python3
"""Stage 3b: modular paper-doll parts for the customizable player (tintable grey-white bases + untinted faces)."""
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from paperlib import *
from seglib import save

n = 0
def put(img, rel):
    global n; save(img, "doll/" + rel); n += 1
S = 4
SH = (205, 205, 205)   # tintable base: multiplied in-engine

def part(w, h, draw_fn, ow=2, shade=True):
    W, H = (w + 8) * S, (h + 8) * S
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    draw_fn(d, 4 * S, 4 * S, w * S, h * S)
    out = finish(im, 1, S) if False else None
    # outline only (no white sticker), then downsample
    a = im.getchannel("A")
    res = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if ow > 0:
        dil = a.filter(ImageFilter.MaxFilter(ow * S * 2 + 1))
        o = Image.new("RGBA", im.size, INK + (0,)); o.putalpha(dil); res.alpha_composite(o)
    if shade:   # inner shading: darker lower-right crescent
        sh = a.filter(ImageFilter.GaussianBlur(3 * S)); 
        shadow = ImageChops.subtract(a, ImageChops.offset(a, -3 * S, -4 * S))
        sd = Image.new("RGBA", im.size, (60, 40, 40, 0)); sd.putalpha(ImageChops.multiply(shadow, a).point(lambda v: int(v * 0.35)))
        im = im.copy(); im.alpha_composite(sd)
    res.alpha_composite(im)
    return res.resize((res.width // S, res.height // S), Image.LANCZOS)

# --- body parts (coordinates in 2x runtime pixels)
def rrect(d, x, y, w, h, r, fill):
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill)
put(part(30, 44, lambda d, x, y, w, h: rrect(d, x, y, w, h, 12 * S, SH + (255,))), "doll_leg.png")
put(part(36, 18, lambda d, x, y, w, h: d.ellipse([x, y, x + w, y + h], fill=SH + (255,))), "doll_shoe.png")
def torso(d, x, y, w, h):
    d.polygon([(x + 4 * S, y), (x + w - 4 * S, y), (x + w, y + h - 6 * S), (x + w - 4 * S, y + h), (x + 4 * S, y + h), (x, y + h - 6 * S)], fill=SH + (255,))
    d.rounded_rectangle([x, y, x + w, y + h], radius=9 * S, fill=SH + (255,))
put(part(62, 64, torso), "doll_torso.png")
put(part(20, 50, lambda d, x, y, w, h: rrect(d, x, y, w, h, 9 * S, SH + (255,))), "doll_arm.png")
put(part(22, 22, lambda d, x, y, w, h: d.ellipse([x, y, x + w, y + h], fill=SH + (255,))), "doll_hand.png")
put(part(24, 22, lambda d, x, y, w, h: d.ellipse([x, y, x + w, y + h], fill=SH + (255,)), shade=False), "doll_ear.png")
def head(d, x, y, w, h):
    d.rounded_rectangle([x, y, x + w, y + h], radius=int(w * 0.42), fill=SH + (255,))
put(part(84, 78, head), "doll_head.png")
put(part(14, 8, lambda d, x, y, w, h: d.ellipse([x, y, x + w, y + h], fill=(255, 150, 140, 255)), ow=0, shade=False), "doll_cheek.png")
def backpack(d, x, y, w, h):
    d.rounded_rectangle([x, y, x + w, y + h], radius=8 * S, fill=SH + (255,))
put(part(52, 56, backpack), "doll_backpack.png")

# --- faces (untinted)
def face(w, h, fn):
    W, H = w * S, h * S
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fn(d, W, H)
    return im.resize((w, h), Image.LANCZOS)
def eye(d, cx, cy, rw, rh, look=(0, 0), hl=True):
    d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=INK + (255,))
    if hl: d.ellipse([cx - rw * 0.15 + look[0] - rw * 0.15, cy - rh * 0.55 + look[1], cx + rw * 0.45 + look[0], cy - rh * 0.05 + look[1]], fill=(255, 255, 255, 255))
def eyes_fn(kind):
    def f(d, W, H):
        cy = H * 0.5; gap = W * 0.27
        for sgn in (-1, 1):
            cx = W / 2 + sgn * gap
            if kind in ("open", "angry", "worried", "think"):
                look = (0, -3 * S) if kind == "think" else (0, 0)
                eye(d, cx, cy, 6.2 * S, 8 * S, look)
            elif kind == "blink":
                d.arc([cx - 7 * S, cy - 4 * S, cx + 7 * S, cy + 6 * S], 200, 340, fill=INK + (255,), width=3 * S)
            elif kind == "happy":
                d.arc([cx - 7 * S, cy - 3 * S, cx + 7 * S, cy + 9 * S], 200, 340, fill=INK + (255,), width=3 * S)
            elif kind == "surprised":
                d.ellipse([cx - 8 * S, cy - 10 * S, cx + 8 * S, cy + 10 * S], fill=(255, 255, 255, 255), outline=INK + (255,), width=2 * S)
                d.ellipse([cx - 3 * S, cy - 3 * S, cx + 3 * S, cy + 3 * S], fill=INK + (255,))
            elif kind == "look":
                eye(d, cx + 3 * S, cy, 6.2 * S, 8 * S, (3 * S, 0))
            if kind == "angry":
                y0 = cy - 12 * S
                pts = [cx - 9 * S, y0 - 3 * S, cx + 9 * S, y0 + 5 * S] if sgn == 1 else [cx + 9 * S, y0 - 3 * S, cx - 9 * S, y0 + 5 * S]
                d.line(pts, fill=INK + (255,), width=3 * S)
            if kind == "worried":
                y0 = cy - 12 * S
                pts = [cx - 9 * S, y0 + 4 * S, cx + 9 * S, y0 - 3 * S] if sgn == 1 else [cx + 9 * S, y0 + 4 * S, cx - 9 * S, y0 - 3 * S]
                d.line(pts, fill=INK + (255,), width=3 * S)
    return f
for k in ["open", "blink", "happy", "angry", "worried", "surprised", "think", "look"]:
    put(face(84, 40, eyes_fn(k)), f"doll_eyes_{k}.png")
def mouth_fn(kind):
    def f(d, W, H):
        cx, cy = W / 2, H * 0.4
        if kind == "neutral": d.line([cx - 6 * S, cy, cx + 6 * S, cy], fill=INK + (255,), width=3 * S)
        elif kind == "smile": d.arc([cx - 11 * S, cy - 9 * S, cx + 11 * S, cy + 9 * S], 20, 160, fill=INK + (255,), width=3 * S)
        elif kind == "grin":
            d.pieslice([cx - 12 * S, cy - 8 * S, cx + 12 * S, cy + 12 * S], 0, 180, fill=INK + (255,)); d.pieslice([cx - 7 * S, cy + 1 * S, cx + 7 * S, cy + 9 * S], 0, 180, fill=(220, 90, 90, 255))
        elif kind == "talk_a": d.ellipse([cx - 7 * S, cy - 5 * S, cx + 7 * S, cy + 8 * S], fill=INK + (255,)); d.ellipse([cx - 4 * S, cy + 2 * S, cx + 4 * S, cy + 7 * S], fill=(220, 90, 90, 255))
        elif kind == "talk_b": d.ellipse([cx - 5 * S, cy - 2 * S, cx + 5 * S, cy + 3 * S], fill=INK + (255,))
        elif kind == "frown": d.arc([cx - 9 * S, cy, cx + 9 * S, cy + 16 * S], 200, 340, fill=INK + (255,), width=3 * S)
        elif kind == "o": d.ellipse([cx - 5 * S, cy - 5 * S, cx + 5 * S, cy + 6 * S], fill=INK + (255,))
        elif kind == "wobble":
            pts = [(cx - 10 * S + i * 2.5 * S, cy + math.sin(i * 1.7) * 3 * S) for i in range(9)]; d.line(pts, fill=INK + (255,), width=3 * S)
    return f
for k in ["neutral", "smile", "grin", "talk_a", "talk_b", "frown", "o", "wobble"]:
    put(face(40, 26, mouth_fn(k)), f"doll_mouth_{k}.png")
print("doll parts", n)
