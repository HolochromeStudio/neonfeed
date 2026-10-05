"""Pixel UI kit: panels, buttons, bars, pills, slots, cards, chips, bubbles, ribbons, stamps, stars. Same keys as the old kit."""
from pxl import *
import math

RAMP["lavender"] = RAMP["purple"]
RAMP["mint"] = [hx("2f8a6a"), hx("5cc8a0"), hx("9ae8c4"), hx("d4faea")]
RAMP["cream"] = [hx("b89a68"), hx("e8d8b0"), hx("f6ecd0"), hx("ffffff")]
RAMP["paper"] = [hx("a88a5a"), hx("e8d4a4"), hx("f6e8c4"), hx("fff8e0")]
RAMP["cardboard"] = [hx("5a3a28"), hx("a87a50"), hx("c89a68"), hx("e0b888")]
RAMP["kraft"] = [hx("7a5230"), hx("c49a62"), hx("dcb882"), hx("f0d4a4")]
RAMP["dark"] = [hx("0e0b16"), hx("262b44"), hx("3a4466"), hx("5a6988")]

def box(w, h, r, outline=INK, ch=2, bevel=True, hi_rows=1, lo_rows=1, fill=None):
    """w x h native pixels, ramp r = [dark, mid, light, hi]; chamfered corners."""
    c = C(w, h)
    body = fill or r[1]
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x); ey = min(y, h - 1 - y)
            if ex + ey < ch: continue
            c.px(x, y, body)
    if bevel:
        for x in range(ch, w - ch):
            for k in range(hi_rows): c.px(x, 1 + k, r[2])
            for k in range(lo_rows): c.px(x, h - 2 - k, r[0])
        for y in range(ch, h - ch):
            c.px(1, y, r[2]); c.px(w - 2, y, r[0])
        # corner bevel pixels
        c.px(ch, 1, r[2]) if ch > 1 else None
    out = c.outline(outline)
    # outline() grows the canvas by 1px each side; chamfer the outline corners too
    n = C(w, h); n.im = out.im.crop((1, 1, w + 1, h + 1))
    # re-add the outline ring inside bounds: draw explicitly
    ring = C(w, h)
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x); ey = min(y, h - 1 - y)
            if ex + ey < ch: continue
            edge = (ex == 0 or ey == 0 or ex + ey == ch)
            if edge: ring.px(x, y, outline)
    ring.blit(C_from(n, ring, outline), 0, 0) if False else None
    for y in range(h):
        for x in range(w):
            if ring.get(x, y)[3]: c.px(x, y, outline)
    return c

def C_from(n, ring, outline): return n

def panel(name, ramp_name, w=64, h=64):
    r = RAMP[ramp_name]
    c = box(w, h, r, ch=3, hi_rows=1, lo_rows=2)
    # inner border line one pixel in for a framed look
    for x in range(4, w - 4): c.px(x, 3, r[2] if ramp_name not in ("dark",) else r[2])
    return c

def button(ramp_name, pressed=False, w=61, h=30):
    r = RAMP[ramp_name]
    c = C(w, h)
    under = box(w, h, [r[0]] * 4, ch=2, bevel=False)
    c.blit(under, 0, 0)
    if not pressed:
        body = box(w, h - 4, r, ch=2, hi_rows=2, lo_rows=1)
        c.blit(body, 0, 0)
    else:
        body = box(w, h - 4, [r[0], r[1], r[1], r[2]], ch=2, hi_rows=1, lo_rows=1)
        c.blit(body, 0, 3)
    return c

def bar_bg(w=62, h=13):
    c = box(w, h, RAMP["dark"], ch=2, bevel=False, fill=hx("181425"))
    for x in range(2, w - 2): c.px(x, 2, hx("262b44"))
    return c

def bar_fill(ramp_name, w=62, h=13):
    r = RAMP[ramp_name]
    c = C(w, h)
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            c.px(x, y, r[1])
    for x in range(2, w - 2):
        c.px(x, 2, r[3] if x % 8 > 1 else r[2]); c.px(x, 3, r[2])
        c.px(x, h - 3, r[0])
    return c

def pill(w=63, h=20):
    c = box(w, h, RAMP["dark"], ch=3, bevel=False, fill=hx("262b44"))
    for x in range(3, w - 3): c.px(x, 1, hx("3a4466"))
    return c

def slot(col=None, w=40, h=33):
    base = hx("2a2f4a"); ln = hx("5a6988")
    c = C(w, h)
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x); ey = min(y, h - 1 - y)
            if ex + ey < 2: continue
            c.px(x, y, base)
            if (x + y) % 9 == 0: c.px(x, y, hx("303656"))
    # corner brackets
    for (x0, y0, dx, dy) in ((1, 1, 1, 1), (w - 2, 1, -1, 1), (1, h - 2, 1, -1), (w - 2, h - 2, -1, -1)):
        for k in range(6):
            c.px(x0 + dx * k, y0, ln if col is None else col); c.px(x0, y0 + dy * k, ln if col is None else col)
    if col is not None:
        for y in range(2, h - 2):
            for x in range(2, w - 2):
                if (x + y) % 2 == 0 and (x < 4 or x > w - 5 or y < 4 or y > h - 5): c.px(x, y, col)
    return c

def card(rarity_ramp, w=48, h=62):
    r = RAMP["paper"]; rr = RAMP[rarity_ramp]
    c = box(w, h, r, ch=3, hi_rows=1, lo_rows=2)
    # rarity frame + header strip
    for x in range(2, w - 2):
        c.px(x, 2, rr[1]); c.px(x, 3, rr[2])
    for y in range(2, h - 2):
        c.px(2, y, rr[1]); c.px(w - 3, y, rr[1])
    for x in range(2, w - 2): c.px(x, h - 3, rr[1])
    return c

def chip(rarity_ramp, w=40, h=11):
    rr = RAMP[rarity_ramp]
    return box(w, h, rr, ch=2, hi_rows=1, lo_rows=1)

def bubble(w=64, h=42, tail=True):
    c = C(w, h)
    b = box(w, h - 7, RAMP["white"], ch=3, hi_rows=1, lo_rows=1, fill=hx("ffffff"))
    c.blit(b, 0, 0)
    if tail:
        for k in range(5):
            c.rect(10 + k, h - 7 + k, 24 - k, h - 7 + k, hx("ffffff"))
        c.px(9, h - 8, INK); 
        for k in range(5): c.px(10 + k - 1, h - 7 + k, INK); c.px(24 - k + 1, h - 7 + k, INK)
        c.px(15, h - 2, INK); c.px(16, h - 2, INK)
    return c

def dialog(w=64, h=50):
    c = box(w, h, RAMP["dark"], ch=3, hi_rows=1, lo_rows=1, fill=hx("1c2038"))
    for x in range(3, w - 3): c.px(x, 2, hx("e8d8b0"))
    for x in range(3, w - 3): c.px(x, h - 3, hx("e8d8b0"))
    for y in range(3, h - 3): c.px(2, y, hx("e8d8b0")); c.px(w - 3, y, hx("e8d8b0"))
    return c

def namebox(w=44, h=17):
    return box(w, h, RAMP["red"], ch=2, hi_rows=1, lo_rows=1)

def ribbon(ramp_name, w=79, h=20):
    r = RAMP[ramp_name]; c = C(w, h)
    body = box(w - 12, h - 4, r, ch=1, hi_rows=1, lo_rows=1)
    c.blit(body, 6, 0)
    for side in (0, 1):
        tail = C(10, h - 6)
        for y in range(h - 6):
            for x in range(10):
                if (side == 0 and x + (y // 2 if y < (h - 6) // 2 else (h - 7 - y) // 2) >= 2) or (side == 1 and x <= 9 - 2 - (y // 2 if y < (h - 6) // 2 else (h - 7 - y) // 2)):
                    tail.px(x, y, r[0])
        t = tail.outline(INK)
        c.blit(t, 0 if side == 0 else w - 12, 4)
    return c

def stamp(ramp_name, w=40, h=40, text=None):
    r = RAMP[ramp_name]; c = C(w, h)
    c.ell(1, 1, w - 2, h - 2, r[1], outline=r[0]); c.ell(4, 4, w - 5, h - 5, r[1], outline=r[2])
    for k in range(0, 360, 30):
        x = w / 2 + math.cos(math.radians(k)) * (w / 2 - 2); y = h / 2 + math.sin(math.radians(k)) * (h / 2 - 2)
        c.px(int(x), int(y), r[3])
    return c

def star(ramp_name, size=10):
    r = RAMP[ramp_name]; c = C(size, size)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rad = size / 2 - 0.5 if i % 2 == 0 else size / 5.2
        pts.append((size / 2 + math.cos(a) * rad, size / 2 + math.sin(a) * rad))
    c.poly(pts, r[2]); c.px(size // 2 - 1, size // 2 - 2, r[3]); c.px(size // 2 + 1, size // 2 + 1, r[1])
    return c.outline(INK)

def tape(w=32, h=11, ramp_name="tan"):
    r = RAMP[ramp_name]; c = C(w, h)
    for y in range(h):
        for x in range(w):
            if (x < 2 and y % 2 == 0) or (x > w - 3 and y % 2 == 1): continue
            c.px(x, y, r[2] if y < 2 else r[1])
    return c

def rank_badge(n):
    import text_px
    cols = ["grey", "green", "blue", "purple", "orange", "red", "gold"]
    r = RAMP[cols[n - 1]]
    c = C(15, 15)
    c.ell(0, 0, 14, 14, r[0]); c.ell(1, 1, 13, 13, r[1]); c.ell(2, 2, 8, 6, r[2])
    g = text_px.glyphs(str(n), scale=1)
    px = g.im.load(); sh = C(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            if px[x, y][3]: sh.px(x, y, INK)
    ox, oy = (15 - g.w) // 2, (15 - g.h) // 2
    c.blit(sh, ox + 1, oy + 1); c.blit(g, ox, oy)
    return c.outline(INK)

def register(add):
    k = 4
    def A(key, c, group="uigen", scale=k): add(key, c.scaled(scale).im, group)
    for nm, rp in [("paper", "paper"), ("cream", "cream"), ("cardboard", "cardboard"), ("dark", "dark"), ("kraft", "kraft"), ("teal", "teal"), ("blue", "blue"), ("red", "red"),
                   ("orange", "orange"), ("yellow", "yellow"), ("lavender", "lavender"), ("mint", "mint"), ("gray", "grey"), ("green", "green"), ("pink", "pink")]:
        A("ui_panel_" + nm, panel(nm, rp))
    for nm, rp in [("teal", "teal"), ("blue", "blue"), ("red", "red"), ("orange", "orange"), ("yellow", "yellow"), ("lavender", "lavender"), ("mint", "mint"), ("gray", "grey"), ("green", "green"), ("dark", "dark")]:
        A(f"ui_btn_{nm}_up", button(rp, False)); A(f"ui_btn_{nm}_down", button(rp, True))
    A("ui_btn_disabled_up", button("grey", False))
    A("ui_bar_bg", bar_bg())
    for nm, rp in [("blue", "blue"), ("green", "green"), ("lavender", "lavender"), ("orange", "orange"), ("red", "red"), ("teal", "teal"), ("yellow", "yellow")]:
        A(f"ui_bar_fill_{nm}", bar_fill(rp))
    A("ui_pill", pill())
    A("ui_slot", slot()); A("ui_slot_ok", slot(hx("63c74d"))); A("ui_slot_merge", slot(hx("fee761"))); A("ui_slot_bad", slot(hx("e43b44")))
    for rar, rp in [("common", "grey"), ("uncommon", "green"), ("rare", "blue"), ("epic", "purple"), ("legendary", "orange"), ("mythic", "pink")]:
        A(f"ui_card_{rar}", card(rp)); A(f"ui_chip_{rar}", chip(rp))
    A("ui_bubble", bubble()); A("ui_dialog_box", dialog()); A("ui_namebox", namebox())
    for nm, rp in [("red", "red"), ("teal", "teal"), ("yellow", "yellow")]:
        A(f"ui_ribbon_{nm}", ribbon(rp))
    for nm, rp in [("blue", "blue"), ("green", "green"), ("red", "red")]:
        A(f"ui_stamp_{nm}", stamp(rp))
    for n in range(1, 8): A(f"ui_rank_{n}", rank_badge(n))
    A("ui_star_gold", star("gold")); A("ui_star_gray", star("grey")); A("ui_star_red", star("red"))
    A("ui_tape", tape()); A("ui_tape_b", tape(ramp_name="cream")); A("ui_tape_small", tape(19, 9))
