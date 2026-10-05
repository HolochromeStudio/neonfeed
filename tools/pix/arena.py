"""Bakes the top-down battle arenas (native 270x480 px; world = 4 px per art pixel, image origin at world (0,-80))."""
import math, random, json
import numpy as np
from pxl import *

W, H = 270, 500
OY = -80
FIELD_W = 1080.0
LANE = 19            # lane half-width in art px (76 world px)

def layout(kind):
    if kind == "a":
        cols, rows, cell, org = 4, 4, (192, 192), (112, 480)
    else:
        cols, rows, cell, org = 5, 6, (136, 120), (200, 500)
    return dict(cols=cols, rows=rows, cell=cell, org=org)

def path_pts(L):
    org, cell, rows = L["org"], L["cell"], L["rows"]
    yt = org[1] - 116.0; yb = org[1] + rows * cell[1] + 116.0
    xr = FIELD_W - 72.0; r = 88.0
    pts = [(-70.0, yt), (xr - r, yt)]
    for i in range(1, 9):
        a = -math.pi / 2 + (math.pi / 2) * i / 8.0
        pts.append((xr - r + math.cos(a) * r, yt + r + math.sin(a) * r))
    pts.append((xr, yb - r))
    for i in range(1, 9):
        a = (math.pi / 2) * i / 8.0
        pts.append((xr - r + math.cos(a) * r, yb - r + math.sin(a) * r))
    pts.append((-70.0, yb))
    return pts, yt, yb

def to_px(p): return (p[0] / 4.0, (p[1] - OY) / 4.0)

BIOME = {
    # lot, road, sidewalk, lot_dither, grout
    "city_center": dict(lot=(86, 92, 120), road=(62, 66, 92), side=(176, 170, 160), lot_kind="asphalt", prop="city"),
    "suburbs":     dict(lot=(96, 156, 72), road=(66, 70, 94), side=(206, 194, 172), lot_kind="grass", prop="suburb"),
    "highway":     dict(lot=(120, 108, 84), road=(52, 54, 72), side=(150, 138, 110), lot_kind="dirt", prop="highway"),
    "industrial":  dict(lot=(118, 120, 128), road=(56, 58, 72), side=(150, 146, 138), lot_kind="concrete", prop="industrial"),
    "desert":      dict(lot=(222, 184, 116), road=(90, 82, 94), side=(236, 206, 146), lot_kind="sand", prop="desert"),
    "snow_town":   dict(lot=(226, 234, 246), road=(92, 98, 122), side=(206, 216, 232), lot_kind="snow", prop="snow"),
    "beach_road":  dict(lot=(238, 214, 156), road=(84, 86, 108), side=(196, 154, 104), lot_kind="sand", prop="beach"),
    "countryside": dict(lot=(116, 172, 74), road=(74, 74, 90), side=(150, 190, 100), lot_kind="grass", prop="country"),
    "night_city":  dict(lot=(40, 44, 72), road=(30, 32, 52), side=(74, 76, 104), lot_kind="asphalt", prop="city", night=True),
}

def _rgb(t, k=1.0):
    return (max(0, min(255, int(t[0] * k))), max(0, min(255, int(t[1] * k))), max(0, min(255, int(t[2] * k))), 255)

def _noise(c, x0, y0, x1, y1, base, rnd, dens=0.10, dark=0.88, light=1.1, mask=None):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if mask is not None and not mask[y, x]: continue
            v = rnd.random()
            if v < dens * 0.5: c.px(x, y, _rgb(base, dark))
            elif v < dens: c.px(x, y, _rgb(base, light))

def _bricks(c, x0, y0, x1, y1, base, rnd, mask):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not mask[y, x]: continue
            row = (y // 3)
            joint = (y % 3 == 2) or ((x + (row % 2) * 3) % 6 == 5)
            k = 0.84 if joint else (1.0 + (0.05 if (x + y * 7) % 11 == 0 else 0) - (0.04 if (x * 3 + y) % 13 == 0 else 0))
            c.px(x, y, _rgb(base, k))

def tree(c, x, y, r, greens, rnd):
    dark, mid, lite = greens
    c.ell(x - r + 1, y - r + 2, x + r + 1, y + r + 2, (0, 0, 0, 70)) if False else None
    c.ell(x - r, y - r, x + r, y + r, dark)
    c.ell(x - r + 1, y - r + 1, x + r - 1, y + r - 1, mid)
    for _ in range(r * 3):
        a = rnd.random() * 6.283; d = rnd.random() * (r - 2)
        c.px(int(x + math.cos(a) * d - 1), int(y + math.sin(a) * d - 1), lite)
    c.px(x - r // 2, y - r // 2, lite); c.px(x - r // 2 + 1, y - r // 2, lite)

def bush(c, x, y, r, greens):
    tree(c, x, y, r, greens, random.Random(x * 31 + y))

def lamp(c, x, y, night=False):
    c.ell(x - 2, y - 2, x + 2, y + 2, hx("5a6988"), outline=INK)
    c.px(x, y, hx("fee761") if not night else hx("fff4b0"))

def hydrant(c, x, y):
    c.rect(x - 1, y - 1, x + 1, y + 1, hx("e43b44")); c.px(x, y, hx("ffb0a8")); c.rect(x - 2, y, x + 2, y, hx("a22633"))

def bin_(c, x, y):
    c.ell(x - 2, y - 2, x + 2, y + 2, hx("5a6988"), outline=INK); c.px(x - 1, y - 1, hx("8b9bb4"))

def bench(c, x, y, vertical=False):
    if vertical: c.rect(x - 1, y - 3, x + 1, y + 3, hx("a56a4c")); c.rect(x - 1, y - 3, x - 1, y + 3, hx("d09a72")); c.rect(x + 1, y - 3, x + 1, y + 3, hx("733e39"))
    else: c.rect(x - 3, y - 1, x + 3, y + 1, hx("a56a4c")); c.rect(x - 3, y - 1, x + 3, y - 1, hx("d09a72")); c.rect(x - 3, y + 1, x + 3, y + 1, hx("733e39"))

def cone(c, x, y):
    c.ell(x - 1, y - 1, x + 1, y + 1, hx("f77622"), outline=None); c.px(x, y, WHITE); c.px(x, y - 1, hx("ffd98a")) if False else None

def cactus(c, x, y):
    g = (hx("265c42"), hx("3e8948"), hx("63c74d"))
    c.rect(x - 1, y - 3, x, y + 3, g[1]); c.rect(x - 3, y - 1, x + 2, y, g[1]); c.px(x - 1, y - 3, g[2]); c.px(x - 3, y - 1, g[2]); c.px(x + 2, y, g[0])

def palm(c, x, y):
    g = (hx("265c42"), hx("3e8948"), hx("63c74d"))
    for a in range(0, 360, 45):
        dx, dy = math.cos(math.radians(a)) * 4, math.sin(math.radians(a)) * 4
        c.line(x, y, int(x + dx), int(y + dy), g[1] if a % 90 == 0 else g[0], 1)
        c.px(int(x + dx), int(y + dy), g[2])
    c.rect(x - 1, y - 1, x, y, hx("733e39"))

def pine(c, x, y, r, snow=False):
    g = (hx("193c3e"), hx("265c42"), hx("3e8948"))
    c.ell(x - r, y - r, x + r, y + r, g[0]); c.ell(x - r + 1, y - r + 1, x + r - 1, y + r - 1, g[1]); c.ell(x - r + 2, y - r + 2, x + r - 2, y + r - 2, g[2])
    if snow:
        for dx, dy in ((-2, -3), (1, -2), (-3, 1), (2, 2), (0, 0)): c.px(x + dx, y + dy, WHITE)

def crate(c, x, y, col="brown"):
    r = RAMP[col]; c.rect(x - 3, y - 3, x + 3, y + 3, r[1]); c.box(x - 3, y - 3, x + 3, y + 3, r[0]); c.line(x - 3, y - 3, x + 3, y + 3, r[0]); c.px(x - 2, y - 2, r[2])

def container(c, x, y, col, horizontal=True):
    r = RAMP[col]; w, h = (9, 4) if horizontal else (4, 9)
    c.rect(x - w, y - h, x + w, y + h, r[1]); c.box(x - w, y - h, x + w, y + h, r[0])
    if horizontal:
        for k in range(-w + 2, w, 2): c.px(x + k, y - h + 1, r[2]); c.px(x + k, y + h - 1, r[0])
    else:
        for k in range(-h + 2, h, 2): c.px(x - w + 1, y + k, r[2]); c.px(x + w - 1, y + k, r[0])

def flowers(c, x, y, cols, rnd):
    for _ in range(5):
        c.px(x + rnd.randint(-3, 3), y + rnd.randint(-2, 2), rnd.choice(cols))

def paint(biome, kind, seed=1):
    B = BIOME[biome]; L = layout(kind); rnd = random.Random(seed + hash(biome) % 1000)
    night = B.get("night", False)
    pts, yt, yb = path_pts(L)
    pp = [to_px(p) for p in pts]
    # --- distance field to the path polyline (art px)
    yy, xx = np.mgrid[0:H, 0:W]
    xx = xx.astype(np.float32) + 0.5; yy = yy.astype(np.float32) + 0.5
    dist = np.full((H, W), 1e9, np.float32); along = np.zeros((H, W), np.float32)
    acc = 0.0
    for i in range(1, len(pp)):
        ax, ay = pp[i - 1]; bx, by = pp[i]
        dx, dy = bx - ax, by - ay; ln = math.hypot(dx, dy)
        t = np.clip(((xx - ax) * dx + (yy - ay) * dy) / max(ln * ln, 1e-6), 0, 1)
        d = np.hypot(xx - (ax + t * dx), yy - (ay + t * dy))
        better = d < dist
        along = np.where(better, acc + t * ln, along); dist = np.where(better, d, dist)
        acc += ln
    c = C(W, H)
    # --- sidewalks (bands above/below the road) and lot
    top_edge = (yt - 76 - 8 - OY) / 4.0       # sidewalk ends (curb) here
    bot_edge = (yb + 76 + 8 - OY) / 4.0
    ys = np.arange(H)[:, None] + 0.5
    side_mask = np.broadcast_to((ys < top_edge) | (ys > bot_edge), (H, W))
    road = dist <= LANE
    curb = (dist > LANE) & (dist <= LANE + 2)
    lot_mask = ~side_mask & ~road & ~curb
    lot = B["lot"]; kind_ = B["lot_kind"]
    for y in range(H):
        for x in range(W):
            if lot_mask[y, x]:
                v = rnd.random(); base = lot
                if kind_ in ("grass",):
                    k = 0.88 if v < 0.16 else (1.1 if v > 0.88 else 1.0)
                    if (x * 7 + y * 13) % 23 == 0: k = 0.78
                    if (x * 5 + y * 3) % 31 == 0: k = 1.18
                    c.px(x, y, _rgb(base, k))
                elif kind_ in ("sand", "dirt", "snow"):
                    k = 0.9 if v < 0.12 else (1.08 if v > 0.9 else 1.0)
                    if kind_ == 'sand' and (x + (y // 3) * 5) % 17 == 0: k = 0.9
                    c.px(x, y, _rgb(base, k))
                else:
                    k = 0.9 if v < 0.1 else (1.08 if v > 0.92 else 1.0)
                    if (x % 16 == 0 or y % 16 == 0): k *= 0.9
                    c.px(x, y, _rgb(base, k))
    _bricks(c, 0, 0, W - 1, H - 1, B["side"], rnd, side_mask)
    # lot border shading near the road + painted bays on plain lots
    # --- road
    rd = B["road"]
    for y in range(H):
        for x in range(W):
            if road[y, x]:
                v = rnd.random()
                k = 0.9 if v < 0.06 else (1.1 if v > 0.95 else 1.0)
                if night: k *= 0.92
                c.px(x, y, _rgb(rd, k))
            elif curb[y, x]:
                c.px(x, y, hx("e8d8b0") if not night else hx("8b9bb4") if dist[y, x] <= LANE + 1 else hx("5a6988"))
    for y in range(H):
        for x in range(W):
            if road[y, x] and dist[y, x] > 3:
                dd = dist[y, x]
                if (6.5 < dd < 8.5 or 12.5 < dd < 14.5) and ((int(along[y, x]) * 3 + x) % 7 != 0) and rnd.random() < 0.55:
                    c.px(x, y, _rgb(rd, 0.84))
    # edge lines (white) and dashed yellow centre
    for y in range(H):
        for x in range(W):
            if road[y, x]:
                if LANE - 2 < dist[y, x] <= LANE - 1: c.px(x, y, _rgb((220, 222, 232), 0.8 if night else 1.0))
    for y in range(H):
        for x in range(W):
            if dist[y, x] < 0.9 and road[y, x] and (along[y, x] % 10.0) < 6.0:
                c.px(x, y, hx("fee761") if not night else hx("e0b040"))
    # zebra crossings (stripes along the road direction) at three places
    total = acc
    for f in (0.075, 0.5, 0.925):
        d0 = total * f
        for y in range(H):
            for x in range(W):
                if road[y, x] and abs(along[y, x] - d0) < 6.0:
                    off = (xx[y, x] if True else 0)
                    # stripes across the lane width: alternate by signed distance parity
                    k = int(dist[y, x] + 0.5) if False else 0
        # painted via signed offsets below
    def zebra(f):
        d0 = total * f
        for y in range(H):
            for x in range(W):
                if road[y, x] and abs(along[y, x] - d0) < 5.0 and dist[y, x] > 1.5:
                    # alternate stripes with a 2px period by the pixel coordinate across the road
                    # direction: vertical road uses x, horizontal uses y
                    across = x if (pts_vertical_at(d0)) else y
                    if (across // 2) % 2 == 0: c.px(x, y, hx("e8eef6") if not night else hx("a8b0c4"))
    segs = []; a_ = 0.0
    for i in range(1, len(pp)):
        ln = math.hypot(pp[i][0] - pp[i - 1][0], pp[i][1] - pp[i - 1][1]); segs.append((a_, a_ + ln, pp[i - 1], pp[i])); a_ += ln
    def pts_vertical_at(d):
        for s0, s1, p0, p1 in segs:
            if s0 <= d <= s1: return abs(p1[1] - p0[1]) > abs(p1[0] - p0[0])
        return False
    for f in (0.075, 0.5, 0.925): zebra(f)
    # arrows (white chevrons) every so often, pointing along travel
    def arrow(d):
        for s0, s1, p0, p1 in segs:
            if s0 <= d <= s1:
                t = (d - s0) / max(s1 - s0, 1e-6)
                cx_, cy_ = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
                dx, dy = p1[0] - p0[0], p1[1] - p0[1]; ln = math.hypot(dx, dy); dx, dy = dx / ln, dy / ln
                nx, ny = -dy, dx
                # offset to the lane's lower side so it does not hide the centre line
                bx, by = cx_ + nx * 9, cy_ + ny * 9
                for k in (-3, -2, -1, 0):
                    for sgn in (-1, 1):
                        px_ = bx - dx * k + nx * sgn * (3 + k)  # chevron arms
                        py_ = by - dy * k + ny * sgn * (3 + k)
                        c.px(int(px_), int(py_), hx("e8eef6"))
                return
    for f in (0.2, 0.32, 0.62, 0.78, 0.9): arrow(total * f)
    # manholes
    for f in (0.24, 0.7):
        for s0, s1, p0, p1 in segs:
            d = total * f
            if s0 <= d <= s1:
                t = (d - s0) / max(s1 - s0, 1e-6)
                mx, my = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + 8
                c.ell(int(mx) - 4, int(my) - 4, int(mx) + 4, int(my) + 4, hx("3a4466"), outline=hx("181425"))
                c.ell(int(mx) - 2, int(my) - 2, int(mx) + 2, int(my) + 2, hx("5a6988"))
                c.px(int(mx) - 1, int(my) - 1, hx("8b9bb4"))
                break
    # cracks and oil
    for _ in range(14):
        x = rnd.randint(0, W - 1); y = rnd.randint(0, H - 1)
        if road[y, x]:
            for _k in range(rnd.randint(3, 8)):
                c.px(x, y, _rgb(rd, 0.62)); x += rnd.choice((-1, 0, 1)); y += rnd.choice((0, 1))
                if not (0 <= x < W and 0 <= y < H) or not road[y, x]: break
    # --- parking bays on the lot inside the layout (painted lines around every grid cell)
    cols, rows, cell, org = L["cols"], L["rows"], L["cell"], L["org"]
    gx0 = int(org[0] / 4) - 8; gy0 = int((org[1] - OY) / 4) - 8
    gx1 = int((org[0] + cols * cell[0]) / 4) + 8; gy1 = int((org[1] - OY + rows * cell[1]) / 4) + 8
    pad_base = (92, 98, 126) if kind_ in ("asphalt",) else ((74, 78, 98) if night else (150, 150, 160))
    pm = np.zeros((H, W), bool)
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            cx_ = min(x - gx0, gx1 - x); cy_ = min(y - gy0, gy1 - y)
            if cx_ < 3 and cy_ < 3 and cx_ + cy_ < 2: continue
            pm[y, x] = True
    if kind_ in ("asphalt", "concrete", "dirt"):
        for y in range(H):
            for x in range(W):
                if pm[y, x]:
                    v = rnd.random(); k = 0.9 if v < 0.1 else (1.08 if v > 0.94 else 1.0)
                    c.px(x, y, _rgb(pad_base if kind_ == "asphalt" else lot, 0.78 * k))
    else:
        _bricks(c, 0, 0, W - 1, H - 1, pad_base, rnd, pm)
    pad_line = hx("e8eef6") if kind_ in ("asphalt", "concrete", "dirt") else hx("fff4b0")
    for x in range(gx0 + 2, gx1 - 1):
        if x % 4 < 2:
            c.px(x, gy0 + 1, pad_line); c.px(x, gy1 - 1, pad_line)
    for y in range(gy0 + 2, gy1 - 1):
        if y % 4 < 2:
            c.px(gx0 + 1, y, pad_line); c.px(gx1 - 1, y, pad_line)
    # painted dashes along the cell boundaries (bays)
    ox, oy = int(org[0] / 4), int((org[1] - OY) / 4)
    cw, ch = int(cell[0] / 4), int(cell[1] / 4)
    bay = _rgb(pad_base, 1.35) if kind_ == "asphalt" else _rgb(pad_base, 0.82)
    for ci in range(1, cols):
        for y in range(oy, oy + rows * ch):
            if y % 4 < 2: c.px(ox + ci * cw, y, bay)
    for ri in range(1, rows):
        for x in range(ox, ox + cols * cw):
            if x % 4 < 2: c.px(x, oy + ri * ch, bay)
    # --- decor
    drnd = random.Random(seed * 7 + 3)
    gl = (hx("193c3e"), hx("265c42"), hx("63c74d")) if not night else (hx("0f2430"), hx("1c4a42"), hx("3e8948"))
    gl2 = (hx("265c42"), hx("3e8948"), hx("b4e87a"))
    prop = B["prop"]
    top_y = int((yt - 76 - 8 - OY) / 4.0) - 10
    bot_y = int((yb + 76 + 8 - OY) / 4.0) + 10
    def sprinkle(y, step, items):
        x = 10 + drnd.randint(0, 8)
        while x < W - 8:
            items(x, y + drnd.randint(-3, 3), drnd)
            x += step + drnd.randint(-4, 10)
    def city_items(x, y, r):
        v = r.random()
        if v < 0.35: tree(c, x, y, 7, gl2 if not night else gl, r)
        elif v < 0.5: bush(c, x, y, 4, gl2)
        elif v < 0.62: lamp(c, x, y, night)
        elif v < 0.74: bench(c, x, y)
        elif v < 0.84: hydrant(c, x, y)
        elif v < 0.94: bin_(c, x, y)
        else: cone(c, x, y)
    def table(items): return items
    items_by = {
        "city": city_items, "suburb": city_items, "highway": lambda x, y, r: (bush(c, x, y, 4, gl2) if r.random() < 0.6 else cone(c, x, y)),
        "industrial": lambda x, y, r: (crate(c, x, y, r.choice(["brown", "tan"])) if r.random() < 0.5 else container(c, x, y, r.choice(["blue", "red", "orange", "teal"]), r.random() < 0.7)),
        "desert": lambda x, y, r: (cactus(c, x, y) if r.random() < 0.6 else bush(c, x, y, 2, (hx("8a6a46"), hx("a8884e"), hx("d0b070")))),
        "snow": lambda x, y, r: (pine(c, x, y, 4, True) if r.random() < 0.7 else bin_(c, x, y)),
        "beach": lambda x, y, r: (palm(c, x, y) if r.random() < 0.6 else bench(c, x, y)),
        "country": lambda x, y, r: (tree(c, x, y, 7, gl2, r) if r.random() < 0.5 else (flowers(c, x, y, [hx("fee761"), hx("ffffff"), hx("f6757a")], r))),
    }
    fn = items_by[prop]
    sprinkle(top_y, 15, fn); sprinkle(top_y - 20, 20, fn)
    sprinkle(bot_y, 15, fn); sprinkle(bot_y + 20, 20, fn)
    # inside the lot: left strip and top-left/right corners get greenery or props
    for (x, y) in ((6, gy0 + 14), (6, gy0 + 48), (6, gy1 - 40), (262, gy0 - 10)):
        if lot_mask[min(H - 1, max(0, y)), min(W - 1, max(0, x))] and kind_ not in ("asphalt", "concrete"):
            fn(x, y, drnd)
    if prop == "beach":     # sea strip along the very top
        for y in range(0, 14):
            for x in range(W):
                base = (60, 160, 220) if y < 10 else (130, 210, 240)
                k = 1.0 + (0.1 if (x // 3 + y) % 4 == 0 else 0)
                c.px(x, y, _rgb(base, k))
        for x in range(0, W, 7): c.px(x, 10 + (x // 7) % 2, WHITE)
    if prop == "industrial":
        for x in range(0, W, 6):
            if x % 12 < 6: c.rect(x, int(top_edge) - 2, x + 5, int(top_edge) - 1, hx("feae34"))
            else: c.rect(x, int(top_edge) - 2, x + 5, int(top_edge) - 1, hx("181425"))
    # spawn barricade (top lane, left edge) and the red city gate (bottom lane, left edge)
    sy = int(to_px(pts[0])[1])
    for y in range(sy - LANE, sy + LANE + 1):
        for x in range(0, 4):
            c.px(x, y, hx("f6f0e0") if ((x + y) // 2) % 2 == 0 else hx("e43b44"))
    ey = int(to_px(pts[-1])[1])
    for y in range(ey - LANE, ey + LANE + 1):
        for x in range(9, 12):
            c.px(x, y, hx("e43b44") if (y // 2) % 2 == 0 else hx("a22633"))
    for k in range(-LANE + 2, LANE - 1, 4): c.rect(6, ey + k, 7, ey + k + 1, hx("ffd98a"))
    return c, dict(top_edge=top_edge, bot_edge=bot_edge)

def bake(texdir):
    import os
    for kind in ("a", "b"):
        for b in BIOME:
            im, _ = paint(b, kind)
            im.im.save(os.path.join(texdir, f"arena_{b}_{kind}.png"))
    meta = {}
    for kind in ("a", "b"):
        L = layout(kind); pts, yt, yb = path_pts(L)
        meta[kind] = dict(yt=yt, yb=yb, org=L["org"], cols=L["cols"], rows=L["rows"], cell=L["cell"], first=pts[0], last=pts[-1])
    json.dump(meta, open(os.path.join(texdir, "arena_layout.json"), "w"))

if __name__ == "__main__":
    import sys
    outs = []
    for b in BIOME:
        im, _ = paint(b, "a")
        outs.append(im)
    S = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"
    sheet(outs[:5], S + "arena.png", cols=5, cell=(270, 480), k=1)
    sheet(outs[5:], S + "arena2.png", cols=4, cell=(270, 480), k=1)
