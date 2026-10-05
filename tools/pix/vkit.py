"""Top-down vehicle kit. Vehicles face UP (front at y=0). Canvas width is even; centre line sits between columns cx and cx+1."""
from pxl import *

def ramp(name): return RAMP[name]

def rows(c, y0, y1, half_fn, r, style="body", cx=None):
    """paint rows y0..y1; half_fn(y)->half width (px each side of the centre line). Shaded left-light / right-dark."""
    cx = c.w // 2 - 1 if cx is None else cx
    for y in range(y0, y1 + 1):
        h = max(1, int(round(half_fn(y))))
        xa, xb = cx - h + 1, cx + h
        for x in range(xa, xb + 1):
            t = x - xa; n = xb - xa
            if style == "glass":
                if t == 0 or t == n: col = r[0]
                elif y == y0: col = r[0]
                elif y == y1: col = r[1]
                else:
                    col = r[1]
                    d = (x - cx) + (y - y0) * 1
                    if d in (-3, -2) and y > y0: col = r[2]
                    if d in (0, 1) and y > y0 + 1: col = r[2]
            elif style == "flat":
                col = r[1]
            elif style == "roof":
                if t == 0 or t == n or y == y0 or y == y1: col = r[0] if (t == n or y == y1) else r[2]
                elif t == 1 or y == y0 + 1: col = r[2]
                else: col = r[1]
            else:
                if t == 0: col = r[2]
                elif t == 1 and n > 7: col = r[2]
                elif t == n: col = r[0]
                elif t == n - 1 and n > 7: col = r[0]
                else: col = r[1]
            c.px(x, y, col)

def row_span(c, y):
    xs = [x for x in range(c.w) if c.get(x, y)[3] > 0]
    return (xs[0], xs[-1]) if xs else None

def round_ends(c, y_front, y_back, rf=2, rb=2):
    for (yy, rr, d) in ((y_front, rf, 1), (y_back, rb, -1)):
        for dy in range(rr):
            y = yy + dy * d
            sp = row_span(c, y)
            if not sp: continue
            for k in range(rr - dy):
                c.px(sp[0] + k, y, CLEAR); c.px(sp[1] - k, y, CLEAR)

def tyre(c, x, y, h=7, w=3):
    c.rect(x, y, x + w - 1, y + h - 1, TIRE)
    c.rect(x, y, x, y + h - 1, TIRE2)
    for k in range(1, h - 1, 2): c.px(x + w - 1, y + k, TIRE2)

def wheels_at(c, half, ys, h=7, w=3, out=2, cx=None):
    """tyres peeking `out` px beyond the body edge"""
    cx = c.w // 2 - 1 if cx is None else cx
    for y in ys:
        tyre(c, cx - half + 1 - out, y, h, w)
        tyre(c, cx + half - w + 1 + out, y, h, w)

def headlights(c, y, half, col=LIGHT_Y, cx=None, w=2, glow=True):
    cx = c.w // 2 - 1 if cx is None else cx
    c.rect(cx - half + 1, y, cx - half + w, y, col)
    c.rect(cx + half - w + 1, y, cx + half, y, col)

def taillights(c, y, half, col=TAIL_R, cx=None, w=2):
    headlights(c, y, half, col, cx, w)

def lightbar(c, y, half, cx=None, left=hx("e43b44"), right=hx("1f86d8"), h=2):
    cx = c.w // 2 - 1 if cx is None else cx
    c.rect(cx - half + 1, y, cx, y + h - 1, left)
    c.rect(cx + 1, y, cx + half, y + h - 1, right)
    c.px(cx - half + 1, y, hx("ffb0a8")); c.px(cx + half, y, hx("a8e0ff"))
    c.rect(cx - half, y - 1, cx + half + 1, y - 1, INK2) if False else None

def center_line(c, y0, y1, col, cx=None):
    cx = c.w // 2 - 1 if cx is None else cx
    c.rect(cx, y0, cx + 1, y1, col)

def mirrors(c, y, half, cx=None, col=None):
    cx = c.w // 2 - 1 if cx is None else cx
    col = col or INK2
    c.px(cx - half, y, col); c.px(cx + half + 1, y, col)
    c.px(cx - half, y + 1, col); c.px(cx + half + 1, y + 1, col)

def finalize(c, outline=True):
    return c.outline(INK) if outline else c

def new(w, h): return C(w, h)

def box_top(c, x0, y0, x1, y1, r, rim=True):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if rim and (x in (x0, x1) or y in (y0, y1)): col = r[0] if (x == x1 or y == y1) else r[2]
            else: col = r[1]
            c.px(x, y, col)

def hatch(c, x, y, w, h, r):
    box_top(c, x, y, x + w - 1, y + h - 1, r)
    c.px(x + 1, y + 1, r[3])

def taper(L, H, nose=7, tail=5):
    """half-width profile of a body of length L and max half-width H: pointed-ish nose, slightly narrower tail"""
    def f(y):
        if y < nose: return H - (nose - y) * 0.75
        if y > L - tail: return H - (y - (L - tail)) * 0.55
        return H
    return f
