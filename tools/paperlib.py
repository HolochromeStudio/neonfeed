"""Procedural cut-paper drawing helpers (Pillow + numpy). Everything is drawn 2x supersampled."""
import numpy as np, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

INK = (40, 28, 26)
PARCH = (226, 208, 176)

def rgb(c, k=1.0):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))

_noise_cache = {}
def paper_noise(w, h, seed=1, strength=1.0):
    """Grain: low-frequency blotches + fibres + speckle, values around 0 (+-)."""
    rs = np.random.RandomState(seed)
    low = rs.randn(max(2, h // 18), max(2, w // 18))
    low = np.asarray(Image.fromarray(((low - low.min()) / (np.ptp(low) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 255 - 0.5
    mid = rs.randn(h // 3 + 1, w // 3 + 1)
    mid = np.asarray(Image.fromarray(((mid - mid.min()) / (np.ptp(mid) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)).astype(np.float32) / 255 - 0.5
    fine = rs.randn(h, w) * 0.5
    # fibres: random short strokes
    fib = Image.new("L", (w, h), 128)
    d = ImageDraw.Draw(fib)
    for _ in range(max(10, w * h // 900)):
        x = rs.randint(0, w); y = rs.randint(0, h); a = rs.rand() * math.pi; l = rs.randint(4, 14)
        d.line([x, y, x + math.cos(a) * l, y + math.sin(a) * l], fill=int(128 + rs.randn() * 26), width=1)
    fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.5))).astype(np.float32) / 255 - 0.5
    return (low * 0.5 + mid * 0.22 + fine * 0.14 + fib * 0.6) * strength

def textured(w, h, color, seed=1, strength=26):
    n = paper_noise(w, h, seed)
    base = np.zeros((h, w, 3), np.float32)
    for c in range(3):
        base[..., c] = color[c] + n * strength
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")

def deckled_poly(w, h, r=10, jit=1.6, seed=1, step=7, inset=0):
    """Rounded rectangle outline with scissor-cut jitter."""
    rs = random.Random(seed)
    pts = []
    def edge(x0, y0, x1, y1):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / step))
        for i in range(n):
            t = i / n
            nx = -(y1 - y0); ny = (x1 - x0); L = math.hypot(nx, ny) or 1
            j = rs.uniform(-jit, jit)
            pts.append((x0 + (x1 - x0) * t + nx / L * j, y0 + (y1 - y0) * t + ny / L * j))
    def arc(cx, cy, a0, a1):
        for i in range(5):
            a = math.radians(a0 + (a1 - a0) * i / 5)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    i = inset
    edge(i + r, i, w - i - r, i); arc(w - i - r, i + r, -90, 0)
    edge(w - i, i + r, w - i, h - i - r); arc(w - i - r, h - i - r, 0, 90)
    edge(w - i - r, h - i, i + r, h - i); arc(i + r, h - i - r, 90, 180)
    edge(i, h - i - r, i, i + r); arc(i + r, i + r, 180, 270)
    return pts

def shadow_of(mask, off=(4, 6), blur=5, alpha=0.38):
    s = Image.new("L", mask.size, 0)
    s.paste(mask, off)
    s = s.filter(ImageFilter.GaussianBlur(blur))
    return s.point(lambda v: int(v * alpha))

def paper_card(w, h, color, outline=None, r=10, jit=1.6, seed=1, shadow=True, pad=10, edge=2.2, grain=22, hilite=True, tape=None):
    """A cut paper card with deckled edge, grain, rim light, dark ink outline and drop shadow. Returns RGBA (w+2pad, h+2pad)."""
    S = 2
    W, H = (w + pad * 2) * S, (h + pad * 2) * S
    mask = Image.new("L", (W, H), 0)
    pts = deckled_poly(w * S, h * S, r * S, jit * S, seed, step=7 * S)
    ImageDraw.Draw(mask).polygon([(x + pad * S, y + pad * S) for x, y in pts], fill=255)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if shadow:
        sh = shadow_of(mask, (3 * S, 5 * S), 4 * S, 0.42)
        shim = Image.new("RGBA", (W, H), (30, 20, 16, 0)); shim.putalpha(sh)
        out.alpha_composite(shim)
    tex = textured(W, H, color, seed, grain).convert("RGBA")
    if hilite:   # light rim top-left, darker bottom-right: reads as cut paper thickness
        er = mask.filter(ImageFilter.MinFilter(2 * S + 1))
        rim = ImageChops.subtract(mask, er)
        hl = Image.new("RGBA", (W, H), (255, 250, 235, 0)); hl.putalpha(rim.point(lambda v: int(v * 0.35)))
        tex.alpha_composite(hl)
    ol = outline if outline else rgb(color, 0.45)
    border = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(int(edge * S) * 2 + 1)))
    olim = Image.new("RGBA", (W, H), ol + (0,)); olim.putalpha(border.point(lambda v: int(v * 0.9)))
    tex.alpha_composite(olim)
    tex.putalpha(mask)
    out.alpha_composite(tex)
    return out.resize((w + pad * 2, h + pad * 2), Image.LANCZOS)

def glyph_canvas(sz, S=4):
    im = Image.new("RGBA", (sz * S, sz * S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def finish(im, sz, S=4, outline=INK, ow=2, sticker=True):
    """downsample glyph, add dark outline + white sticker edge."""
    a = im.getchannel("A")
    k = ow * S
    dil = a.filter(ImageFilter.MaxFilter(k * 2 + 1))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if sticker:
        st = dil.filter(ImageFilter.MaxFilter(3 * S + 1))
        w = Image.new("RGBA", im.size, (250, 246, 236, 0)); w.putalpha(st); out.alpha_composite(w)
    o = Image.new("RGBA", im.size, outline + (0,)); o.putalpha(dil); out.alpha_composite(o)
    out.alpha_composite(im)
    return out.resize((sz, sz), Image.LANCZOS)
