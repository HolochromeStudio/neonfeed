"""Registers every pixel-art sprite with the atlas builder. Native art is low-res; each sprite is nearest-upscaled by K."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
K = 4

def up(c, k=K):
    im = c if isinstance(c, Image.Image) else c.im
    return im.resize((im.width * k, im.height * k), Image.NEAREST)

def register(add, texdir):
    import vehicles, ui_px, icons_px, fx_px, text_px, props_px, chars_px, scenes_px
    ui_px.register(add); icons_px.register(add); fx_px.register(add); text_px.register(add); props_px.register(add); chars_px.register(lambda k, im, g: add(k, im, g)); scenes_px.register(add)
    for uid, c in vehicles.units().items():
        add("veh_" + uid, up(c), "units")
    for sets, prefix in ((vehicles.enemies(), "en_"), (vehicles.bosses(), "boss_")):
        for eid, c in sets.items():
            im = c.im
            add(prefix + eid, up(im.transpose(Image.ROTATE_270)), "units")             # facing right
            add(prefix + eid + "_down", up(im.transpose(Image.ROTATE_180)), "units")
            add(prefix + eid + "_left", up(im.transpose(Image.ROTATE_90)), "units")
            add(prefix + eid + "_up", up(im), "units")

def register_tex(texdir):
    import arena, props_px
    arena.bake(texdir)
    props_px.make_ground(texdir)
    props_px.register_bg(texdir)

def make_icon(path):
    import scenes_px, props_px
    from pxl import C, hx
    c = C(64, 64)
    sky = props_px.THEMES["teal"]
    for y in range(64):
        for x in range(64): c.px(x, y, sky[min(5, y * 6 // 64)])
    c.rect(0, 50, 63, 63, hx("3a4466")); c.rect(0, 49, 63, 49, hx("e8d8b0"))
    for x in range(2, 64, 16): c.rect(x, 57, x + 7, 58, hx("fee761"))
    cone = scenes_px.cone(24, 34); c.blit(cone, 6, 22)
    tl = scenes_px.traffic_light(); c.blit(tl, 38, 8)
    c.scaled(8).im.save(path)
