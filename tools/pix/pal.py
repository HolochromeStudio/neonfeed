"""Shared pixel palette. Base: ENDESGA-32 plus a few shade ramps for vehicles."""
def hx(s, a=255):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)

INK = hx("181425")        # outlines
INK2 = hx("262b44")
WHITE = hx("ffffff")
CREAM = hx("ead4aa")
PAPER = hx("e8d8b0")
CLEAR = (0, 0, 0, 0)

# (dark, mid, light, highlight)
RAMP = {
    "red":    [hx("a22633"), hx("e43b44"), hx("f6757a"), hx("ffb0a8")],
    "orange": [hx("be4a2f"), hx("f77622"), hx("feae34"), hx("ffd98a")],
    "yellow": [hx("d58a1f"), hx("feae34"), hx("fee761"), hx("fff4b0")],
    "green":  [hx("265c42"), hx("3e8948"), hx("63c74d"), hx("b4e87a")],
    "teal":   [hx("1f6f78"), hx("2aa7a0"), hx("5ad8c8"), hx("b2f2e4")],
    "blue":   [hx("124e89"), hx("1f86d8"), hx("4fb4f0"), hx("a8e0ff")],
    "navy":   [hx("181f4c"), hx("2c3f87"), hx("4a66c4"), hx("8aa4f0")],
    "purple": [hx("4a2a6e"), hx("7a4cb0"), hx("a77be0"), hx("d6b8ff")],
    "pink":   [hx("b55088"), hx("e86aa8"), hx("ff9ec8"), hx("ffd0e4")],
    "white":  [hx("8b9bb4"), hx("c0cbdc"), hx("e8eef6"), hx("ffffff")],
    "grey":   [hx("3a4466"), hx("5a6988"), hx("8b9bb4"), hx("c0cbdc")],
    "black":  [hx("0e0b16"), hx("1c1a2c"), hx("38395a"), hx("5a6988")],
    "brown":  [hx("4a2a22"), hx("733e39"), hx("a56a4c"), hx("d09a72")],
    "gold":   [hx("a86a14"), hx("e0a020"), hx("ffd24a"), hx("fff2a0")],
    "olive":  [hx("3a4a24"), hx("5e7a38"), hx("8aa650"), hx("b8d080")],
    "tan":    [hx("8a6a46"), hx("c0a070"), hx("e2c898"), hx("f4e2bc")],
}
GLASS = [hx("0f2a52"), hx("1f5a9e"), hx("5ab4e8"), hx("d4f2ff")]   # windows: dark, mid, light, glint
LIGHT_Y = hx("fff2a0")
TAIL_R = hx("ff3a3a")
TIRE = hx("1c1a2c")
TIRE2 = hx("38395a")
ASPH = [hx("3a3f58"), hx("464b66"), hx("535874"), hx("626883")]
