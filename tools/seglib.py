"""Segmentation helpers: turn rectangles of the master sheet into clean transparent cut-outs."""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage as ndi
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, "assets/source/reference/traffic_jam_master_sheet.webp")
SRC = Image.open(SHEET).convert("RGB")
A = np.asarray(SRC).astype(int)


def cutout(box, bg=None, thr=60, white=226, pad=2, minarea=100, erode=1, keep_ratio=0.06, thr_white=True):
    """Cut the sprite that lives inside `box` out of the paper it sits on.

    The background colour is sampled from the window border. Components touching the
    window border (neighbour slivers / label text) are dropped unless they are the main body.
    """
    x0, y0, x1, y1 = box
    r = A[y0:y1, x0:x1]
    if bg is None:
        ring = np.concatenate([r[0], r[-1], r[:, 0], r[:, -1]])
        bg = np.median(ring, axis=0)
    d = np.abs(r - bg).sum(axis=2)
    m = d > thr
    if thr_white:
        m |= r.min(axis=2) > white
    m = ndi.binary_opening(m, iterations=1)
    m = ndi.binary_closing(m, iterations=2)
    lab, n = ndi.label(m)
    if n == 0:
        return None
    sizes = ndi.sum(m, lab, range(1, n + 1))
    big = sizes.max()
    keep = np.zeros_like(m)
    h, w = m.shape
    for i, s in enumerate(sizes, 1):
        if s < max(minarea, big * keep_ratio):
            continue
        ys, xs = np.where(lab == i)
        touches = ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1
        if s == big or not touches:
            keep |= lab == i
    keep = ndi.binary_closing(keep, iterations=3)
    keep = ndi.binary_fill_holes(keep)
    if erode:
        keep = ndi.binary_erosion(keep, iterations=erode)
    alpha = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = Image.fromarray(r.astype(np.uint8)).convert("RGBA")
    rgba.putalpha(alpha)
    bb = rgba.getbbox()
    if not bb:
        return None
    bb = (max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, rgba.width), min(bb[3] + pad, rgba.height))
    return rgba.crop(bb)


def paper_cut(box, edge=1.2, radius=2):
    """Rectangular torn-paper items (buttons, labels): keep the rectangle, soften edges."""
    x0, y0, x1, y1 = box
    r = Image.fromarray(A[y0:y1, x0:x1].astype(np.uint8)).convert("RGBA")
    m = Image.new("L", r.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle([0, 0, r.width - 1, r.height - 1], radius=radius, fill=255)
    r.putalpha(m.filter(ImageFilter.GaussianBlur(edge * 0.5)))
    return r


def upscale(img, k=2, sharpen=True):
    """Lanczos upscale with a light unsharp pass to keep the outlines crisp (no invented detail)."""
    if k == 1:
        return img
    rgb = img.convert("RGB").resize((img.width * k, img.height * k), Image.LANCZOS)
    al = img.getchannel("A").resize((img.width * k, img.height * k), Image.LANCZOS)
    if sharpen:
        rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    out = rgb.convert("RGBA")
    out.putalpha(al)
    return out


def hue_shift(img, deg=0.0, sat=1.0, val=1.0, keep_dark=True):
    """Re-colour a cut-out. Dark outlines / grey tyres are naturally untouched (low saturation)."""
    rgba = np.asarray(img.convert("RGBA")).astype(np.float32) / 255.0
    rgb = rgba[..., :3]
    mx = rgb.max(axis=2); mn = rgb.min(axis=2); df = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / df) % 6, np.where(mx == g, (b - r) / df + 2, (r - g) / df + 4)) / 6.0
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    v = mx
    h = (h + deg / 360.0) % 1.0
    s = np.clip(s * sat, 0, 1)
    v = np.clip(v * val, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    cols = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros_like(rgb)
    for k, (cr, cg, cb) in enumerate(cols):
        sel = i == k
        out[..., 0] = np.where(sel, cr, out[..., 0])
        out[..., 1] = np.where(sel, cg, out[..., 1])
        out[..., 2] = np.where(sel, cb, out[..., 2])
    res = np.concatenate([out, rgba[..., 3:4]], axis=2)
    return Image.fromarray((res * 255).astype(np.uint8), "RGBA")


def save(img, relpath):
    p = os.path.join(ROOT, "assets/source", relpath)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, optimize=True)
    return p
