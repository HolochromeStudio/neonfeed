#!/usr/bin/env python3
"""Wheel placement for the animated vehicles.

Automatic: dark column runs along the sprite bottom (tyres) cross-checked with Hough circles; picks the 2-3 most credible wheels.
Overrides in tools/wheel_overrides.json fix the sprites where the 3/4 view hides a tyre. Output: assets/runtime/wheels.json
  { "<base sprite>": {"size":[w,h], "wheels":[[x,y,r],...]} }  (native sprite pixels)
"""
import cv2, numpy as np, glob, os, json, sys
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
files = sorted(glob.glob("assets/source/vehicles/*/vehicle_*_body.png") + glob.glob("assets/source/enemies/enemy_*.png") + glob.glob("assets/source/vehicles/bosses/boss_*.png"))
K = 5

def base_name(f):
    n = os.path.basename(f)[:-4]
    if n.startswith("vehicle_"):
        parts = n.split("_")
        return "_".join(parts[1:-2])
    if n.startswith("enemy_"):
        return "enemy:" + n[6:]
    return "boss:" + n[5:]

def template():
    t = Image.open("assets/source/vehicles/common/vehicle_taxi_common_body.png").convert("RGBA")
    a = np.asarray(t)[..., :3]
    return cv2.cvtColor(a[26:43, 41:59].copy(), cv2.COLOR_RGB2GRAY)
TPL = None
def detect(im):
    """Template-match a clean tyre cut from the taxi at several scales; keep non-overlapping peaks near the bottom edge."""
    global TPL
    if TPL is None: TPL = template()
    a = np.asarray(im.convert("RGBA")); h, w = a.shape[:2]
    alpha = a[..., 3] > 200
    ys = np.where(alpha.any(axis=1))[0]; bottom = ys.max() - 2
    g = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY)
    pad = 12
    gp = cv2.copyMakeBorder(g, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
    hits = []
    for sc in (0.75, 0.85, 1.0, 1.15, 1.3):
        t = cv2.resize(TPL, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
        if t.shape[0] >= gp.shape[0] or t.shape[1] >= gp.shape[1]: continue
        r = cv2.matchTemplate(gp, t, cv2.TM_CCOEFF_NORMED)
        ys2, xs2 = np.where(r > 0.5)
        for y, x in zip(ys2, xs2):
            cx = x + t.shape[1] / 2.0 - pad; cy = y + t.shape[0] / 2.0 - pad
            rad = min(max(7.4 * sc, 6.8), 8.6)
            if abs((cy + rad) - bottom) > 6.5 or cx < 0.27 * w or cx > w - 7: continue
            hits.append((float(r[y, x]), cx, cy, rad))
    hits.sort(reverse=True)
    res = []
    for sc_, cx, cy, rad in hits:
        if any(abs(cx - x) < 12.5 for x, _, _ in res): continue
        res.append((cx, cy, rad))
        if len(res) >= (3 if w >= 70 else 2): break
    res.sort()
    return res, (w, h)

def main():
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    from roster_art import R
    base = {}
    sheets = []; cur = []
    for f in files:
        bn = base_name(f)
        im = Image.open(f).convert("RGBA")
        res, (w, h) = detect(im)
        if bn.startswith("boss:"):
            res = []
        base[bn] = {"size": [w, h], "wheels": res}
        big = im.resize((w * 4, h * 4), Image.LANCZOS)
        bg = Image.new("RGBA", big.size, (86, 112, 98, 255)); bg.alpha_composite(big)
        d = ImageDraw.Draw(bg)
        for x, y, r in res:
            d.ellipse([(x - r) * 4, (y - r) * 4, (x + r) * 4, (y + r) * 4], outline=(0, 255, 0), width=2)
        d.text((4, 4), bn[:30], fill=(255, 255, 255))
        cur.append(bg)
        if len(cur) == 9:
            sheets.append(cur); cur = []
    if cur: sheets.append(cur)
    out = {}
    def emit(key, bn, sx=1.0, sc=1.0):
        w, h = base[bn]["size"]
        nw, nh = w * sx * sc, h * sc
        ws = []
        for x, y, r in base[bn]["wheels"]:
            # runtime art is 2x of the native cut-out; origin = bottom centre of the texture
            ws.append([round((x * sx * sc - nw / 2.0) * 2, 1), round((y * sc - nh) * 2, 1), round(r * sc * (1 + sx) / 2 * 2, 1)])
        out[key] = ws
    for uid, rec in R.items():
        b = rec["base"]
        bn = b if ":" in b else b
        if bn not in base: continue
        emit("veh_" + uid, bn, rec.get("sx", 1.0), rec.get("scale", 1.0))
    for bn in base:
        if bn.startswith("enemy:"):
            emit("en_" + bn[6:], bn)
    os.makedirs("assets/runtime", exist_ok=True)
    json.dump(out, open("assets/runtime/wheels.json", "w"), indent=0, sort_keys=True)
    if len(sys.argv) > 1:
        for si, sh in enumerate(sheets):
            W = max(i.width for i in sh) + 6; H = max(i.height for i in sh) + 6
            S = Image.new("RGB", (W * 3, H * 3), (30, 30, 30))
            for i, im in enumerate(sh):
                S.paste(im.convert("RGB"), ((i % 3) * W, (i // 3) * H))
            S.save(f"{sys.argv[1]}/wh_{si}.png")
    print("wheels for", len(out), "sprites")
main()
