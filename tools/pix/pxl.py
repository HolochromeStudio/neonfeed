"""Tiny pixel-art canvas on top of PIL (no anti-aliasing). Native art is low-res; save(scale=4) nearest-upscales."""
import os
from PIL import Image, ImageDraw
from pal import *

class C:
    def __init__(self, w, h, fill=CLEAR):
        self.im = Image.new("RGBA", (w, h), fill)
        self.d = ImageDraw.Draw(self.im)
        self.w, self.h = w, h
    # ---- primitives
    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.im.putpixel((int(x), int(y)), c)
    def get(self, x, y):
        return self.im.getpixel((int(x), int(y))) if 0 <= x < self.w and 0 <= y < self.h else CLEAR
    def rect(self, x0, y0, x1, y1, c):   # inclusive
        self.d.rectangle([x0, y0, x1, y1], fill=c)
    def box(self, x0, y0, x1, y1, c):    # outline only
        self.d.rectangle([x0, y0, x1, y1], outline=c)
    def rrect(self, x0, y0, x1, y1, c, r=2):
        self.d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=c)
    def line(self, x0, y0, x1, y1, c, w=1):
        self.d.line([x0, y0, x1, y1], fill=c, width=w)
    def ell(self, x0, y0, x1, y1, c, outline=None):
        self.d.ellipse([x0, y0, x1, y1], fill=c, outline=outline)
    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)
    def blit(self, other, x, y):
        self.im.alpha_composite(other.im if isinstance(other, C) else other, (int(x), int(y)))
    def copy(self):
        n = C(self.w, self.h); n.im = self.im.copy(); n.d = ImageDraw.Draw(n.im); return n
    # ---- symmetric helpers (x relative to centre column(s)); width must be even for even canvases
    def sym(self, cx, y0, y1, half, c):
        """rect centred on cx spanning `half` px each side (cx is the left centre pixel when canvas width is even)."""
        self.rect(cx - half + 1, y0, cx + half, y1, c)
    def mirror_x(self):
        left = self.im.crop((0, 0, self.w // 2, self.h)).transpose(Image.FLIP_LEFT_RIGHT)
        self.im.paste(left, (self.w - self.w // 2, 0)); self.d = ImageDraw.Draw(self.im)
    # ---- whole-image effects
    def outline(self, col=INK, diag=False):
        a = self.im.getchannel("A")
        px = a.load(); out = Image.new("RGBA", (self.w + 2, self.h + 2), CLEAR)
        big = Image.new("RGBA", (self.w + 2, self.h + 2), CLEAR); big.alpha_composite(self.im, (1, 1))
        bp = big.load(); op = out.load()
        for y in range(self.h + 2):
            for x in range(self.w + 2):
                if bp[x, y][3] == 0:
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) + (((1,1),(-1,1),(1,-1),(-1,-1)) if diag else ()):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < self.w + 2 and 0 <= yy < self.h + 2 and bp[xx, yy][3] > 0:
                            op[x, y] = col; break
        out.alpha_composite(big)
        n = C(self.w + 2, self.h + 2); n.im = out; n.d = ImageDraw.Draw(n.im); return n
    def recolor(self, mapping):
        px = self.im.load()
        for y in range(self.h):
            for x in range(self.w):
                if px[x, y] in mapping: px[x, y] = mapping[px[x, y]]
    def flip_h(self):
        n = C(self.w, self.h); n.im = self.im.transpose(Image.FLIP_LEFT_RIGHT); n.d = ImageDraw.Draw(n.im); return n
    def rot(self, deg):
        n = C(self.w, self.h); n.im = self.im.rotate(deg, resample=Image.NEAREST, expand=False); n.d = ImageDraw.Draw(n.im); return n
    def scaled(self, k):
        n = C(self.w * k, self.h * k); n.im = self.im.resize((self.w * k, self.h * k), Image.NEAREST); n.d = ImageDraw.Draw(n.im); return n
    def fit(self, W, H, k=4, anchor="center"):
        """upscale by k and centre onto a W x H transparent canvas (anchor: center|bottom)."""
        up = self.im.resize((self.w * k, self.h * k), Image.NEAREST)
        out = Image.new("RGBA", (W, H), CLEAR)
        x = (W - up.width) // 2
        y = (H - up.height) // 2 if anchor == "center" else H - up.height
        out.alpha_composite(up, (x, y))
        return out
    def save(self, path, k=4):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.scaled(k).im.save(path) if k != 1 else self.im.save(path)

def shade_body(c, mask_color, ramp, light_from="left"):
    """Shade pixels equal to `mask_color` using ramp [dark, mid, light, hi]: light left/top, dark right/bottom. Operates per connected body."""
    px = c.im.load()
    xs = [x for y in range(c.h) for x in range(c.w) if px[x, y] == mask_color]
    if not xs: return
    x0, x1 = min(xs), max(xs)
    span = max(1, x1 - x0)
    for y in range(c.h):
        for x in range(c.w):
            if px[x, y] == mask_color:
                t = (x - x0) / span
                if t < 0.2: col = ramp[2]
                elif t > 0.82: col = ramp[0]
                else: col = ramp[1]
                px[x, y] = col

def dither(c, x0, y0, x1, y1, a, b):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c.px(x, y, a if (x + y) % 2 == 0 else b)

def sheet(items, path, cols=10, cell=(64, 64), bg=hx("3a4466"), k=2):
    """contact sheet of C or PIL images for quick review"""
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell[0] * k, rows * cell[1] * k
    out = Image.new("RGBA", (W, H), bg)
    for i, it in enumerate(items):
        im = it.im if isinstance(it, C) else it
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        out.alpha_composite(im, ((i % cols) * cell[0] * k + (cell[0] * k - im.width) // 2, (i // cols) * cell[1] * k + (cell[1] * k - im.height) // 2))
    out.save(path)
