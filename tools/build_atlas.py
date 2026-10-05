#!/usr/bin/env python3
"""Stage 4: pack the source PNGs into runtime atlases (assets/runtime/atlas_*.png + atlas.json).

Key naming (used by the game through scripts/core/atlas.gd):
  veh_<unit> en_<enemy> boss_<boss> pc_<preset> npc_<name> cos_<cat>_<name> prop_<n> tile_<n> icon_<n> digit_<n> lbl_<n>
  mode_<n> map_<n> logo_<n> biome_<n> cut_<n> fx_<n> + every ui_gen/doll file by its stem.
"""
import os, sys, glob, json, re
sys.path.insert(0, os.path.dirname(__file__))
from seglib import ROOT, upscale
from PIL import Image

SRC = os.path.join(ROOT, "assets/source")
OUT = os.path.join(ROOT, "assets/runtime")
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + "/atlas_*.png"): os.remove(f)

items = []   # (key, PIL image, group)
def add(key, im, group): items.append((key, im, group))
def stem(f): return os.path.splitext(os.path.basename(f))[0]

for f in glob.glob(SRC + "/units/*/*.png"):
    m = re.match(r"vehicle_(.+)_(common|uncommon|rare|epic|legendary|mythic)_body", stem(f))
    add("veh_" + m.group(1), upscale(Image.open(f).convert("RGBA"), 2), "units")
for f in glob.glob(SRC + "/enemies/enemy_*.png"):
    add("en_" + stem(f)[6:], upscale(Image.open(f).convert("RGBA"), 2), "units")
for f in glob.glob(SRC + "/vehicles/bosses/boss_*.png"):
    add("boss_" + stem(f)[5:], upscale(Image.open(f).convert("RGBA"), 2), "units")
for f in glob.glob(SRC + "/characters/player/*.png"):
    add("pc_" + stem(f)[len("player_preset_"):], upscale(Image.open(f).convert("RGBA"), 2), "chars")
for f in glob.glob(SRC + "/characters/npcs/*.png"):
    add("npc_" + stem(f)[4:].replace("animal_", "animal_"), upscale(Image.open(f).convert("RGBA"), 2), "chars")
for f in glob.glob(SRC + "/cosmetics/*/*.png"):
    cat = f.split("/")[-2]; nm = stem(f).split("_", 2)[-1]
    add(f"cos_{cat}_{nm}", upscale(Image.open(f).convert("RGBA"), 2), "chars")
for f in glob.glob(SRC + "/environment/props/*.png"):
    add("prop_" + stem(f)[5:], upscale(Image.open(f).convert("RGBA"), 2), "env")
for f in glob.glob(SRC + "/environment/roads/tile_*.png"):
    im = Image.open(f).convert("RGBA").resize((128, 128), Image.LANCZOS)
    add("tile_" + stem(f)[5:], im, "env")
for f in glob.glob(SRC + "/ui/icons/*.png"):
    add("icon_" + stem(f)[8:], upscale(Image.open(f).convert("RGBA"), 2), "ui")
for f in glob.glob(SRC + "/ui/numbers/ui_digit_*.png"):
    add("digit_" + stem(f)[-1], upscale(Image.open(f).convert("RGBA"), 2), "ui")
for f in glob.glob(SRC + "/ui/numbers/ui_label_*.png"):
    add("lbl_" + stem(f)[9:], upscale(Image.open(f).convert("RGBA"), 2), "ui")
for f in glob.glob(SRC + "/ui/cards/ui_mode_*.png"):
    add("mode_" + stem(f)[8:], upscale(Image.open(f).convert("RGBA"), 3), "big")
for f in glob.glob(SRC + "/ui/map/*.png"):
    nm = stem(f)[len("ui_map_"):]
    add("map_" + nm, upscale(Image.open(f).convert("RGBA"), 3 if nm == "art" else 2), "big")
for f in glob.glob(SRC + "/ui/logo/*.png"):
    add("logo_" + stem(f)[5:], upscale(Image.open(f).convert("RGBA"), 3), "big")
for f in glob.glob(SRC + "/biomes/*.png"):
    add("biome_" + stem(f)[6:], upscale(Image.open(f).convert("RGBA"), 4), "big")
for f in glob.glob(SRC + "/cutscenes/*.png"):
    add("cut_" + stem(f)[len("cutscene_"):], upscale(Image.open(f).convert("RGBA"), 5), "big")
for f in glob.glob(SRC + "/fx/*.png"):
    add("fx_" + stem(f)[3:], upscale(Image.open(f).convert("RGBA"), 2), "fx")
for f in glob.glob(SRC + "/ui_gen/*.png"):
    add(stem(f), Image.open(f).convert("RGBA"), "uigen")
for f in glob.glob(SRC + "/doll/*.png"):
    add(stem(f), Image.open(f).convert("RGBA"), "chars")
for f in glob.glob(SRC + "/ui/buttons/*.png"):
    add("btnbaked_" + stem(f)[10:-6], upscale(Image.open(f).convert("RGBA"), 3), "ui")

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
