#!/usr/bin/env python3
"""Stage 2: build the 60 player-vehicle art files + enemy/boss variants from the extracted sheet sprites."""
import os, sys, glob
sys.path.insert(0, os.path.dirname(__file__))
from seglib import *
from roster_art import R

SRC_DIR = os.path.join(ROOT, "assets/source")

def find_base(base):
    if base.startswith("enemy:"):
        return os.path.join(SRC_DIR, f"enemies/enemy_{base[6:]}.png")
    if base.startswith("boss:"):
        return os.path.join(SRC_DIR, f"vehicles/bosses/boss_{base[5:]}.png")
    hits = glob.glob(os.path.join(SRC_DIR, f"vehicles/*/vehicle_{base}_*_body.png"))
    assert hits, base
    return hits[0]

def tint_mult(img, tint):
    a = np.asarray(img).astype(np.float32)
    for c in range(3):
        a[..., c] = np.clip(a[..., c] * tint[c], 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")

def build(uid, rec):
    im = Image.open(find_base(rec["base"])).convert("RGBA")
    if rec.get("hue") or rec.get("sat", 1) != 1 or rec.get("val", 1) != 1:
        im = hue_shift(im, rec.get("hue", 0), rec.get("sat", 1), rec.get("val", 1))
    if rec.get("tint"):
        im = tint_mult(im, rec["tint"])
    if rec.get("sx", 1) != 1 or rec.get("scale", 1) != 1:
        k = rec.get("scale", 1)
        im = im.resize((int(im.width * rec.get("sx", 1) * k), int(im.height * k)), Image.LANCZOS)
    if rec.get("alpha", 1) < 1:
        a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] * rec["alpha"]).astype(np.uint8); im = Image.fromarray(a, "RGBA")
    if rec.get("flip"):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im

if __name__ == "__main__":
    n = 0
    for uid, rec in R.items():
        save(build(uid, rec), f"units/{rec['rarity']}/vehicle_{uid}_{rec['rarity']}_body.png"); n += 1
    print("built", n, "unit art files")
