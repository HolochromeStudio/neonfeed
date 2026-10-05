"""Bright cut-paper menu backgrounds (sunburst + halftone + paper scraps + painted road line)."""
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "runtime", "tex")
W, H = 540, 960
THEMES = {
    "teal":   ((78, 190, 190), (250, 226, 160), (255, 255, 255)),
    "sun":    ((255, 170, 90), (255, 232, 160), (255, 255, 255)),
    "blue":   ((96, 160, 232), (206, 232, 250), (255, 255, 255)),
    "grape":  ((156, 120, 214), (246, 214, 236), (255, 255, 255)),
    "green":  ((110, 190, 110), (246, 236, 170), (255, 255, 255)),
}
def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def make(name, top, bot, hi, seed):
    rnd = random.Random(seed)
    yy = np.linspace(0, 1, H)[:, None, None]
    top_a, bot_a = np.array(top, np.float32), np.array(bot, np.float32)
    img = (top_a * (1 - yy) + bot_a * yy) * np.ones((H, W, 3), np.float32)
    im = Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")
    # sunburst from upper middle
    ray = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ray)
    cx, cy = W * 0.5, H * 0.22
    n = 16
    for i in range(n):
        a0 = (i / n) * math.tau; a1 = a0 + math.tau / n / 2
        d.polygon([(cx, cy), (cx + 1600 * math.cos(a0), cy + 1600 * math.sin(a0)), (cx + 1600 * math.cos(a1), cy + 1600 * math.sin(a1))], fill=hi + (34,))
    im = Image.alpha_composite(im, ray)
    # halftone dots, fading downward
    dots = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(dots)
    for y in range(0, H, 14):
        for x in range(0, W, 14):
            xx = x + (7 if (y // 14) % 2 else 0)
            r = max(0.0, 4.2 * (1 - y / H) ** 1.4)
            if r > 0.6: d.ellipse([xx - r, y - r, xx + r, y + r], fill=hi + (46,))
    im = Image.alpha_composite(im, dots)
    # paper scraps
    sc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for _ in range(9):
        w, h = rnd.randint(70, 170), rnd.randint(40, 90)
        col = lerp(top, hi, rnd.uniform(0.2, 0.6)) if rnd.random() < 0.5 else lerp(bot, (255, 120, 90), rnd.uniform(0.1, 0.4))
        tile = Image.new("RGBA", (w + 20, h + 20), (0, 0, 0, 0)); td = ImageDraw.Draw(tile)
        td.rounded_rectangle([10, 10, w + 10, h + 10], 8, fill=tuple(int(c) for c in col) + (70,))
        tile = tile.rotate(rnd.uniform(-35, 35), expand=True, resample=Image.BICUBIC)
        sc.alpha_composite(tile, (rnd.randint(-30, W - 60), rnd.randint(40, H - 200)))
    im = Image.alpha_composite(im, sc)
    # painted road strip at the very bottom with dashed line
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 56, W, H], fill=(70, 72, 86, 255))
    d.rectangle([0, H - 60, W, H - 56], fill=(240, 230, 200, 255))
    for x in range(10, W, 64): d.rectangle([x, H - 30, x + 32, H - 25], fill=(244, 206, 100, 255))
    # soft lighter vignette towards the bottom (no dark muddy corners)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.ellipse([-W * 0.3, -H * 0.1, W * 1.3, H * 0.55], fill=hi + (60,))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    im = Image.alpha_composite(im, glow)
    im.convert("RGB").save(os.path.join(OUT, f"bg_{name}.png"))
for i, (k, (a, b, c)) in enumerate(THEMES.items()):
    make(k, a, b, c, 100 + i)
print("bg ok")
