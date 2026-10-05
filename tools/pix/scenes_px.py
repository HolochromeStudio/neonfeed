"""Logo, mode cards, map nodes, biome panoramas and story panels (all pixel art)."""
import math, random
from pxl import *
from icons_px import I as ICONS, art
import text_px, props_px, chars_px, vehicles, arena

def glyph_text(text, scale, fill, shade=None, outline=INK, shadow=True):
    return text_px.sticker(text, fill, shade, scale=scale, outline=outline, shadow=shadow)

# ------------------------------------------------------------------ logo
def cone(w=24, h=34):
    c = C(w, h); cx = w // 2
    for y in range(h - 5):
        half = 2 + int(y * (w / 2 - 4) / (h - 6))
        for x in range(cx - half, cx + half):
            c.px(x, y, hx("f77622") if y % 9 < 5 or y < 3 else WHITE)
        c.px(cx - half, y, hx("ffb060")); c.px(cx + half - 1, y, hx("be4a2f"))
    c.rect(1, h - 5, w - 2, h - 2, hx("3a4466")); c.rect(1, h - 5, w - 2, h - 5, hx("5a6988"))
    return c.outline(INK)

def traffic_light(w=14, h=44):
    c = C(w, h)
    c.rect(1, 0, w - 2, h - 8, hx("262b44")); c.rect(1, 0, 1, h - 8, hx("3a4466")); c.rect(w - 2, 0, w - 2, h - 8, hx("0e0b16"))
    for i, col in enumerate([hx("e43b44"), hx("feae34"), hx("63c74d")]):
        cy = 6 + i * 11
        c.ell(3, cy - 4, w - 4, cy + 4, col, outline=INK); c.px(4, cy - 2, WHITE)
    c.rect(w // 2 - 2, h - 8, w // 2 + 1, h - 1, hx("3a4466"))
    return c.outline(INK)

def logo_block():
    W, H = 184, 126
    c = C(W, H)
    board = props_ui_board(W - 16, H - 8)
    c.blit(board, 14, 4)
    c.blit(traffic_light(), 2, 10)
    t1 = glyph_text("TRAFFIC", 3, hx("ffffff"), hx("c0cbdc"))
    c.blit(t1, 38, 14)
    t2 = glyph_text("JAM", 6, hx("e43b44"), hx("a22633"))
    c.blit(t2, 44, 40)
    # tape corners
    for (x, y) in ((16, 2), (W - 34, 2)): 
        for dx in range(18):
            for dy in range(6): c.px(x + dx, y + dy, hx("e8d8b0") if dy < 5 else hx("c8b890"))
    return c

def props_ui_board(w, h):
    c = C(w, h)
    for y in range(h):
        for x in range(w):
            ex = min(x, w - 1 - x); ey = min(y, h - 1 - y)
            if ex + ey < 3: continue
            c.px(x, y, hx("e8d8b0") if (x * 5 + y * 3) % 17 else hx("dccaa0"))
    # dark title panel
    c.rect(4, 4, w - 5, h - 18, hx("262b44")); c.box(4, 4, w - 5, h - 18, hx("0e0b16"))
    for x in range(6, w - 6): c.px(x, 6, hx("3a4466"))
    # small caption area
    return c.outline(INK)

def strapline():
    t = glyph_text("MERGE . DEFEND . SURVIVE", 1, hx("ffffff"), hx("c0cbdc"), shadow=False)
    c = C(t.w + 12, 16)
    for y in range(16):
        for x in range(c.w):
            c.px(x, y, hx("e8d8b0") if y not in (0, 15) else hx("a88a5a"))
    c.blit(t, 6, 4)
    for x in range(c.w): c.px(x, 0, INK); c.px(x, 15, INK)
    return c

def tagline():
    a = glyph_text("SMALL CARS", 2, hx("fee761"), hx("d58a1f"))
    b = glyph_text("BIG CHAOS!", 2, hx("ffffff"), hx("c0cbdc"))
    c = C(max(a.w, b.w) + 8, a.h + b.h + 10)
    c.blit(a, 4, 3); c.blit(b, 4, a.h + 6)
    return c

# ------------------------------------------------------------------ map nodes
def node(kind):
    c = C(18, 22)
    if kind == "boss":
        c.ell(1, 0, 16, 15, hx("e43b44")); c.ell(3, 2, 14, 13, hx("a22633"))
        c.rect(6, 5, 11, 9, hx("f6f0e0")); c.px(7, 6, INK); c.px(10, 6, INK); c.rect(7, 9, 10, 10, hx("f6f0e0"))
        c.poly([(5, 14), (12, 14), (8, 21)], hx("e43b44"))
    elif kind == "lock":
        c.ell(1, 0, 16, 15, hx("8b9bb4")); c.ell(3, 2, 14, 13, hx("5a6988")); c.rect(6, 7, 11, 11, hx("c0cbdc")); c.rect(7, 4, 10, 7, hx("c0cbdc"))
        c.rect(8, 5, 9, 7, hx("5a6988")); c.px(8, 9, INK); c.poly([(5, 14), (12, 14), (8, 20)], hx("8b9bb4"))
    elif kind == "star":
        c.ell(1, 0, 16, 15, hx("feae34")); c.ell(3, 2, 14, 13, hx("fee761")); 
        c.blit(ICONS["star"].copy() if False else C(1, 1), 0, 0)
        for (x, y) in ((8, 4), (7, 6), (9, 6), (6, 7), (10, 7), (8, 8), (6, 9), (10, 9), (5, 8), (11, 8)): c.px(x, y, hx("d58a1f"))
        c.rect(7, 6, 9, 9, hx("d58a1f")); c.poly([(5, 14), (12, 14), (8, 20)], hx("feae34"))
    else:  # start
        c.ell(1, 0, 16, 15, hx("3e8948")); c.ell(3, 2, 14, 13, hx("63c74d"))
        c.poly([(6, 5), (6, 12), (12, 8)], WHITE); c.poly([(5, 14), (12, 14), (8, 20)], hx("3e8948"))
    return c.outline(INK)

# ------------------------------------------------------------------ biome panoramas (270 x 150)
def panorama(biome, seed=1):
    W, H = 270, 150
    rnd = random.Random(seed + hash(biome) % 99)
    PAL = {
        "city_center": ([hx("3a6ab0"), hx("5a8ad0"), hx("8ab4e8"), hx("bcd8f4"), hx("e8f0ff")], hx("5a6988")),
        "suburbs": ([hx("5aa0e0"), hx("7ab8f0"), hx("a8d4f8"), hx("d0ecff"), hx("f0f8ff")], hx("63c74d")),
        "highway": ([hx("4a86c8"), hx("6aa4e0"), hx("94c4f0"), hx("c0e0fa"), hx("e8f4ff")], hx("8b9bb4")),
        "industrial": ([hx("8a8aa0"), hx("a4a4b8"), hx("c0c0d0"), hx("d8d8e4"), hx("eeeef4")], hx("5a6988")),
        "desert": ([hx("e86a3a"), hx("f79a4a"), hx("fec35a"), hx("ffdf8a"), hx("fff0b8")], hx("e0b070")),
        "snow_town": ([hx("8ab0d8"), hx("a8c8e8"), hx("c8e0f4"), hx("e0f0fc"), hx("f4faff")], hx("f0f6ff")),
        "beach_road": ([hx("38a8e8"), hx("62c4f4"), hx("94dcfa"), hx("c4eefc"), hx("f0fbff")], hx("f0d898")),
        "countryside": ([hx("5aa8e8"), hx("80c4f4"), hx("a8dcfa"), hx("d0f0fc"), hx("f4fcff")], hx("84d86a")),
        "night_city": ([hx("0c0a24"), hx("1a1a48"), hx("2a2a68"), hx("3c3c88"), hx("5a58a8")], hx("262b44")),
    }
    sky, ground = PAL[biome]
    c = C(W, H)
    gy = H - 26
    for y in range(gy):
        k = min(len(sky) - 1, int(y / gy * len(sky)))
        for x in range(W): c.px(x, y, sky[k])
    if biome == "night_city":
        for _ in range(60): c.px(rnd.randrange(W), rnd.randrange(gy - 30), WHITE)
        c.ell(210, 14, 232, 36, hx("f6f0d0"), outline=hx("c8c0a0")); c.ell(216, 14, 236, 34, sky[2])
    else:
        sx = {"desert": 70, "beach_road": 200}.get(biome, rnd.randint(60, 210))
        c.ell(sx - 11, 18, sx + 11, 40, hx("fee761")); c.ell(sx - 8, 21, sx + 8, 37, hx("fff4b0"))
        for _ in range(4):
            x, y = rnd.randint(10, W - 50), rnd.randint(12, 60); w = rnd.randint(24, 40)
            c.rect(x, y, x + w, y + 5, WHITE); c.rect(x + 4, y - 3, x + w - 5, y, WHITE); c.rect(x, y + 5, x + w, y + 6, hx("c8d8ec"))
    def bld(x, w, h, col, win=True, base=None):
        c.rect(x, gy - h, x + w, gy, col); c.rect(x, gy - h, x, gy, tuple(min(255, int(v * 1.2)) for v in col[:3]) + (255,)); c.rect(x + w, gy - h, x + w, gy, tuple(int(v * .7) for v in col[:3]) + (255,))
        if win:
            for wy in range(gy - h + 3, gy - 3, 5):
                for wx in range(x + 3, x + w - 2, 4):
                    if rnd.random() < 0.55: c.rect(wx, wy, wx + 1, wy + 1, hx("fee761") if biome == "night_city" else hx("cfe6ff"))
    if biome in ("city_center", "night_city", "highway"):
        tone = [hx("4a5a8a"), hx("3a4a78"), hx("5a6a9a")] if biome != "night_city" else [hx("1a1c40"), hx("24265a"), hx("2e3070")]
        x = -2
        while x < W:
            bw = rnd.randint(14, 28); bh = rnd.randint(30, 100); bld(x, bw, bh, rnd.choice(tone)); x += bw + rnd.randint(1, 4)
        if biome == "highway":
            c.rect(0, gy - 22, W, gy - 18, hx("8b9bb4")); c.rect(0, gy - 18, W, gy - 17, hx("5a6988"))
            for x in range(8, W, 40): c.rect(x, gy - 18, x + 4, gy, hx("5a6988"))
    elif biome == "suburbs":
        for x in range(6, W - 20, 44):
            bw = rnd.randint(24, 32); bh = rnd.randint(18, 26); col = rnd.choice([hx("e8d8b0"), hx("f6b8a0"), hx("a8d0e8")])
            c.rect(x, gy - bh, x + bw, gy, col); c.poly([(x - 3, gy - bh), (x + bw + 3, gy - bh), (x + bw // 2, gy - bh - 12)], hx("a22633")); c.rect(x + 4, gy - 10, x + 8, gy, hx("733e39")); c.rect(x + bw - 10, gy - 14, x + bw - 5, gy - 8, hx("8ac4f0"))
        for x in range(26, W, 52): props_px.tree(7, x).__class__ and c.blit(props_px.tree(7, x), x, gy - 26)
    elif biome == "industrial":
        for x in range(10, W - 20, 56):
            bw = rnd.randint(30, 40); bh = rnd.randint(26, 40); bld(x, bw, bh, hx("6a6a82"), win=False)
            c.rect(x + 6, gy - bh - 22, x + 11, gy - bh, hx("5a5a72")); c.ell(x + 3, gy - bh - 34, x + 15, gy - bh - 20, hx("c8ccd8"))
        c.line(200, gy, 200, gy - 70, hx("e8b83a"), 2); c.line(200, gy - 70, 250, gy - 70, hx("e8b83a"), 2); c.line(250, gy - 70, 250, gy - 56, hx("181425"), 1)
    elif biome == "desert":
        for x, h in ((30, 24), (110, 40), (190, 30)):
            c.poly([(x - 60, gy), (x, gy - h), (x + 70, gy)], hx("e8a560")); c.poly([(x, gy - h), (x + 70, gy), (x + 20, gy)], hx("c8854a"))
        for x in (50, 150, 232):
            c.rect(x, gy - 22, x + 3, gy, hx("3e8948")); c.rect(x - 5, gy - 14, x, gy - 11, hx("3e8948")); c.rect(x - 5, gy - 18, x - 3, gy - 12, hx("3e8948")); c.rect(x + 3, gy - 16, x + 8, gy - 13, hx("3e8948")); c.rect(x + 6, gy - 20, x + 8, gy - 14, hx("3e8948"))
    elif biome == "snow_town":
        for x in range(12, W - 20, 40):
            bw = 26; bh = 20; c.rect(x, gy - bh, x + bw, gy, hx("c07a50")); c.poly([(x - 3, gy - bh), (x + bw + 3, gy - bh), (x + bw // 2, gy - bh - 12)], hx("f4faff")); c.rect(x + 10, gy - 10, x + 15, gy, hx("733e39")); c.rect(x + 3, gy - 14, x + 7, gy - 10, hx("fee761"))
        for x in range(30, W, 46): c.blit(props_px.pine(8, True), x, gy - 18)
    elif biome == "beach_road":
        for y in range(gy - 30, gy):
            for x in range(W): c.px(x, y, hx("1f86d8") if y < gy - 24 else hx("38a8e8"))
        for x in range(0, W, 9): c.px(x, gy - 22 + (x // 9) % 2, WHITE); c.px(x + 3, gy - 12 + (x // 9) % 2, hx("c4eefc"))
        for x in (30, 150, 230):
            c.rect(x, gy - 40, x + 1, gy, hx("733e39"))
            for ang in (-60, -30, 20, 55, 100, 150): 
                c.line(x, gy - 40, x + int(math.cos(math.radians(ang)) * 13), gy - 40 + int(math.sin(math.radians(ang)) * 9), hx("3e8948"), 2)
    elif biome == "countryside":
        for x, col in ((0, hx("70c050")), (80, hx("5ab048")), (180, hx("84d86a"))):
            c.ell(x - 40, gy - 30, x + 120, gy + 30, col)
        c.rect(206, gy - 40, 209, gy, hx("e8d8b0")); c.poly([(207, gy - 40), (190, gy - 54), (193, gy - 56), (210, gy - 42)], WHITE); c.poly([(207, gy - 40), (226, gy - 52), (223, gy - 56), (207, gy - 42)], hx("c0cbdc"))
        c.rect(40, gy - 24, 70, gy, hx("a22633")); c.poly([(36, gy - 24), (74, gy - 24), (55, gy - 38)], hx("733e39")); c.rect(52, gy - 12, 58, gy, hx("e8d8b0"))
    # ground strip with road
    for y in range(gy, H):
        for x in range(W): c.px(x, y, ground if (x + y) % 7 else tuple(int(v * 0.92) for v in ground[:3]) + (255,))
    c.rect(0, gy + 8, W, H, hx("3a4466") if biome not in ("desert",) else hx("5a4a52")); c.rect(0, gy + 8, W, gy + 8, hx("e8d8b0"))
    for x in range(4, W, 20): c.rect(x, gy + 17, x + 9, gy + 18, hx("fee761"))
    return c

# ------------------------------------------------------------------ story panels (125 x 76 native), top-down street scenes
def street(biome="city_center", cars=(), crowd=False, seed=1):
    base, _ = arena.paint(biome, "a", seed)
    c = C(125, 76)
    c.blit(base.im.crop((40, 54, 165, 130)), 0, 0)
    return c

def panel(n):
    c = C(125, 76)
    if n == 4:
        c.rect(0, 0, 124, 75, hx("0e0b16"))
        for _ in range(40): c.px(random.Random(n).randrange(125), random.Random(n * 3 + _).randrange(76), hx("1c1a2c"))
        q = glyph_text("?", 10, hx("ffffff"), hx("8b9bb4")); c.blit(q, 55, 18)
        c.rect(40, 62, 46, 64, hx("fee761")); c.rect(78, 62, 84, 64, hx("fee761"))
        return c
    base, _ = arena.paint("city_center", "a", n)
    c.blit(base.im.crop((0, 70, 125, 146)), 0, 0)
    car = vehicles.units()
    rot = lambda im: im.im.transpose(__import__("PIL.Image", fromlist=["Image"]).ROTATE_270)
    if n == 1:
        for x, k in ((20, "taxi"), (70, "delivery_van"), (100, "city_bus")): c.blit(rot(car[k]), x, 44 if k != "city_bus" else 25)
    elif n == 2:
        for i, k in enumerate(["taxi", "pickup", "city_bus", "police", "compact", "garbage_truck", "school_bus", "tow_truck"]):
            c.blit(rot(car[k]), 2 + i * 14, 44 if i % 2 == 0 else 24)
        for (x, y) in ((30, 20), (80, 40), (100, 18)): c.blit(glyph_text("!", 2, hx("e43b44")), x, y)
    elif n == 3:
        c.blit(rot(car["taxi"]), 54, 40); sp = fx_sparkle(); c.blit(sp, 56, 30); c.blit(sp, 86, 44)
        c.blit(glyph_text("GO!", 3, hx("fee761"), hx("d58a1f")), 70, 6)
    return c

def fx_sparkle():
    import fx_px
    return fx_px.sparkle(12)

def mode_card(kind):
    W, H = 80, 84
    c = C(W, H)
    pal = {"story": hx("2f8a4a"), "survival": hx("e86a2a"), "coop": hx("1f86d8"), "pvp": hx("a22633")}[kind]
    for y in range(H):
        for x in range(W): c.px(x, y, props_px.THEMES["green" if kind == "story" else "sun" if kind == "survival" else "blue" if kind == "coop" else "grape"][min(5, y * 6 // H)] if True else pal)
    if kind == "story":
        pts = [(12, 68), (28, 52), (22, 38), (46, 30), (58, 18), (68, 22)]
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]; x1, y1 = pts[i + 1]
            for t in range(0, 20, 2): c.px(int(x0 + (x1 - x0) * t / 20), int(y0 + (y1 - y0) * t / 20), hx("e43b44")); c.px(int(x0 + (x1 - x0) * t / 20) + 1, int(y0 + (y1 - y0) * t / 20), hx("e43b44"))
        for (x, y) in pts[:-1]: c.ell(x - 3, y - 3, x + 3, y + 3, hx("fee761"), outline=INK)
        x, y = pts[-1]; c.blit(node("boss"), x - 9, y - 18)
        for (x, y) in ((8, 40), (60, 60), (36, 70)): c.blit(props_px.tree(5, x), x, y)
    elif kind == "survival":
        c.rect(0, 58, W, H, hx("3a4466")); c.rect(0, 57, W, 57, hx("e8d8b0"))
        for x in range(2, W, 14): c.rect(x, 70, x + 7, 71, hx("fee761"))
        c.blit(cone(24, 34), 28, 28)
        c.blit(vehicles.units()["pickup"].im.transpose(__import__("PIL.Image", fromlist=["Image"]).ROTATE_270), 2, 62)
        c.blit(glyph_text("999", 1, WHITE), 54, 6) if False else None
        c.blit(ICONS["trophy"], 60, 8) if False else None
    elif kind == "coop":
        d = chars_px.npc("traffic_cop"); look = {"skin": (224, 169, 122), "hat": "cap_red_blue"}
        p = chars_px.person({"skin": (224, 169, 122), "top": (91, 121, 176), "bottom": (63, 95, 143), "shoes": (58, 46, 42), "hat": "cap_red_blue"})
        c.blit(d, 4, 20); c.blit(p, 34, 22)
        c.blit(glyph_text("+", 3, hx("fee761")), 34, 6)
    else:
        c.blit(ICONS["trophy"].scaled(3), 22, 14)
        c.blit(glyph_text("VS", 3, hx("ffffff"), hx("c0cbdc")), 28, 60)
    return c.outline(INK)

def register(add):
    def A(key, c, grp="big", k=4): add(key, c.scaled(k).im, grp)
    A("logo_title_block", logo_block()); A("logo_strapline", strapline()); A("logo_tagline", tagline()); A("logo_cone", cone())
    for nm in ("boss", "lock", "star", "start"): A("map_node_" + nm, node(nm), "ui")
    for b in ("city_center", "suburbs", "highway", "industrial", "desert", "snow_town", "beach_road", "countryside", "night_city"): A("biome_" + b, panorama(b))
    for i in range(1, 5): A(f"cut_panel_{i}", panel(i))
    for m in ("story", "survival", "coop", "pvp"): A("mode_" + m, mode_card(m))

if __name__ == "__main__":
    S_ = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"
    st = {}
    register(lambda k, im, g: st.__setitem__(k, im))
    sheet([st[k] for k in st if k.startswith(("biome_",))], S_ + "biomes.png", cols=3, cell=(1080, 600), k=1)
    sheet([st[k] for k in st if k.startswith(("logo_", "cut_", "mode_", "map_"))], S_ + "scenes.png", cols=4, cell=(500, 400), k=1)
