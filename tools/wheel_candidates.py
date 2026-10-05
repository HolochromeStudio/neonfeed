"""Hough-circle wheel candidates for every vehicle/enemy/boss base sprite -> numbered review sheets + candidates.json"""
import cv2, numpy as np, glob, os, json, sys
from PIL import Image, ImageDraw
files = sorted(glob.glob("assets/source/vehicles/*/vehicle_*_body.png") + glob.glob("assets/source/enemies/enemy_*.png") + glob.glob("assets/source/vehicles/bosses/boss_*.png"))
cands = {}
K = 5
sheets = []
cur = []
for f in files:
    im = Image.open(f).convert("RGBA"); a = np.asarray(im); h, w = a.shape[:2]
    name = os.path.basename(f)[:-4]
    g = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY)
    g = cv2.resize(g, (w * K, h * K), interpolation=cv2.INTER_CUBIC)
    alpha = cv2.resize(a[..., 3], (w * K, h * K))
    ys = np.where(alpha > 200)[0]; bottom = ys.max() - 2 * K
    g = cv2.GaussianBlur(g, (5, 5), 0)
    cs = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1, minDist=7 * K, param1=110, param2=16, minRadius=int(4.5 * K), maxRadius=int(11 * K))
    res = []
    if cs is not None:
        for x, y, r in cs[0]:
            if y < bottom - 0.5 * h * K: continue
            yy, xx = np.ogrid[:g.shape[0], :g.shape[1]]
            ring = ((xx - x) ** 2 + (yy - y) ** 2 < r ** 2) & ((xx - x) ** 2 + (yy - y) ** 2 > (r * 0.62) ** 2)
            if g[ring].mean() > 100: continue
            res.append((x / K, y / K, r / K))
    res.sort()
    cands[name] = {"size": [int(w), int(h)], "cands": [[round(float(x), 1), round(float(y), 1), round(float(r), 1)] for x, y, r in res]}
    big = im.resize((w * 4, h * 4), Image.LANCZOS)
    bg = Image.new("RGBA", big.size, (86, 112, 98, 255)); bg.alpha_composite(big)
    d = ImageDraw.Draw(bg)
    for i, (x, y, r) in enumerate(res):
        d.ellipse([(x - r) * 4, (y - r) * 4, (x + r) * 4, (y + r) * 4], outline=(255, 0, 255), width=2)
        d.text((x * 4 - 4, y * 4 - 6), str(i), fill=(255, 255, 0))
    d.text((4, 4), name[:34], fill=(255, 255, 255))
    for gx in range(0, w, 10):
        d.line([(gx * 4, bg.height - 8), (gx * 4, bg.height)], fill=(255, 255, 255)); d.text((gx * 4 + 1, bg.height - 22), str(gx), fill=(255, 255, 255))
    cur.append(bg)
    if len(cur) == 6:
        sheets.append(cur); cur = []
if cur: sheets.append(cur)
json.dump(cands, open("/tmp/wheel_cands.json", "w"), indent=0)
out = sys.argv[1]
for si, sh in enumerate(sheets):
    W = max(i.width for i in sh) + 8
    Hh = max(i.height for i in sh) + 8
    S = Image.new("RGB", (W * 3, Hh * 2), (30, 30, 30))
    for i, im in enumerate(sh):
        S.paste(im.convert("RGB"), ((i % 3) * W, (i // 3) * Hh))
    S.save(f"{out}/wc_{si}.png")
print(len(sheets), "sheets", len(files), "sprites")
