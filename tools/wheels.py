"""Detect wheel circles in a vehicle cut-out (dark round blobs in the lower body)."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def detect(img):
    """Hub detection: a wheel is a grey hub inside a dark tyre ring, resting on the sprite's bottom edge."""
    a = np.asarray(img.convert("RGBA")).astype(int)
    h, w = a.shape[:2]
    alpha = a[..., 3] > 200
    ys = np.where(alpha.any(axis=1))[0]
    bottom = ys.max() - 2
    rgb = a[..., :3]
    lum = rgb.sum(axis=2) / 3
    sat = (rgb.max(axis=2) - rgb.min(axis=2))
    dark = (lum < 80) & alpha
    hubm = (lum > 70) & (lum < 190) & (sat < 38) & alpha
    hubm[: int(bottom - 0.45 * h)] = False
    hubm = ndi.binary_opening(hubm, iterations=1)
    lab, n = ndi.label(hubm)
    cands = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        ar = (lab[sl] == i).sum()
        if ar < 6 or ar > 90: continue
        cy = (sl[0].start + sl[0].stop) / 2.0; cx = (sl[1].start + sl[1].stop) / 2.0
        # tyre ring check
        score = 0
        for r in (5, 6, 7, 8):
            for ang in np.linspace(0, 2 * np.pi, 16, endpoint=False):
                x = int(round(cx + r * np.cos(ang))); y = int(round(cy + r * np.sin(ang)))
                if 0 <= x < w and 0 <= y < h and dark[y, x]: score += 1
        score /= 64.0
        if score < 0.5: continue
        # estimate radius: walk down until leaving dark
        r = 6.5
        if bottom - cy > 12 or bottom - cy < 2: continue
        cands.append((cx, cy, r, score))
    # merge near duplicates
    cands.sort()
    res = []
    for c in cands:
        if res and abs(res[-1][0] - c[0]) < 9: 
            if c[3] > res[-1][3]: res[-1] = c
            continue
        res.append(c)
    return [(c[0], c[1], c[2]) for c in res], (w, h)
if __name__ == "__main__":
    import sys, glob
    from PIL import ImageDraw
    files = sorted(glob.glob("assets/source/vehicles/*/vehicle_*_body.png"))
    cell = (170, 120); cols = 6
    S = Image.new("RGB", (cols * cell[0], ((len(files) + cols - 1) // cols) * cell[1]), (90, 120, 100))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGBA"); ws, (w, h) = detect(im)
        k = 2
        big = im.resize((w * k, h * k), Image.LANCZOS)
        bg = Image.new("RGBA", big.size, (90, 120, 100, 255)); bg.alpha_composite(big)
        d = ImageDraw.Draw(bg)
        for cx, cy, r in ws:
            d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], outline=(255, 0, 255), width=1)
        S.paste(bg.convert("RGB"), ((i % cols) * cell[0] + 5, (i // cols) * cell[1] + 5))
    S.save(sys.argv[1])
