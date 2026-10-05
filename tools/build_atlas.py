#!/usr/bin/env python3
"""Packs every generated pixel sprite into runtime atlases (assets/runtime/atlas_*.png + atlas.json) and writes the tiled textures.

All art is drawn in code by tools/pix/*.py at native low resolution and nearest-upscaled x4 (one art pixel = 4 screen pixels on the
1080 px canvas). Run from the repo root:  python3 tools/build_atlas.py
"""
import os, sys, glob, json
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "pix"))
from PIL import Image
from pix.build_px import register, register_tex, make_icon

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "assets/runtime")
TEXDIR = os.path.join(OUT, "tex")
os.makedirs(TEXDIR, exist_ok=True)
for f in glob.glob(OUT + "/atlas_*.png"): os.remove(f)
for f in glob.glob(TEXDIR + "/*.png"): os.remove(f)

items = {}
def add(key, im, group): items[key] = (key, im, group)
register(add, None)
register_tex(TEXDIR)
make_icon(os.path.join(OUT, "icon.png"))
items = list(items.values())

PAGE = 2048
def pack(group_items, name):
    group_items.sort(key=lambda t: -t[1].height)
    pages = []; cur = None
    def newpage():
        return dict(img=Image.new("RGBA", (PAGE, PAGE), (0, 0, 0, 0)), x=0, y=0, rowh=0, entries={})
    cur = newpage(); pages.append(cur)
    PADP = 2
    for key, im, _ in group_items:
        w, h = im.size
        assert w + PADP * 2 <= PAGE and h + PADP * 2 <= PAGE, (key, im.size)
        if cur["x"] + w + PADP * 2 > PAGE:
            cur["x"] = 0; cur["y"] += cur["rowh"]; cur["rowh"] = 0
        if cur["y"] + h + PADP * 2 > PAGE:
            cur = newpage(); pages.append(cur)
        x = cur["x"] + PADP; y = cur["y"] + PADP
        cur["img"].paste(im, (x, y))
        cur["entries"][key] = [x, y, w, h]
        cur["x"] += w + PADP * 2; cur["rowh"] = max(cur["rowh"], h + PADP * 2)
    return pages

manifest = {"pages": [], "entries": {}}
groups = {}
for it in items: groups.setdefault(it[2], []).append(it)
for g, its in sorted(groups.items()):
    for i, pg in enumerate(pack(its, g)):
        # crop page height to used area (power-of-two not required)
        used_h = max(e[1] + e[3] for e in pg["entries"].values()) + 4
        img = pg["img"].crop((0, 0, PAGE, min(PAGE, used_h)))
        fn = f"atlas_{g}_{i}.png"
        img.save(os.path.join(OUT, fn), optimize=True)
        manifest["pages"].append(fn)
        for k, e in pg["entries"].items():
            manifest["entries"][k] = {"page": len(manifest["pages"]) - 1, "rect": e}
with open(os.path.join(OUT, "atlas.json"), "w") as f:
    json.dump(manifest, f, indent=0, sort_keys=True)
print("packed", len(items), "sprites into", len(manifest["pages"]), "pages:", manifest["pages"])
