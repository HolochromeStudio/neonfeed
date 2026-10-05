"""Pixel icons (ASCII art + small primitives). Native sizes ~12-16px, nearest-upscaled x4 by the builder."""
from pxl import *
import math

PAL = {
    "k": INK, "w": hx("ffffff"), "y": hx("fee761"), "Y": hx("feae34"), "d": hx("d58a1f"), "o": hx("f77622"), "O": hx("be4a2f"),
    "r": hx("e43b44"), "R": hx("a22633"), "p": hx("ffb0a8"), "b": hx("1f86d8"), "B": hx("124e89"), "c": hx("a8e0ff"), "C": hx("4fb4f0"),
    "g": hx("63c74d"), "G": hx("3e8948"), "s": hx("8b9bb4"), "S": hx("5a6988"), "l": hx("c0cbdc"), "n": hx("733e39"), "N": hx("a56a4c"),
    "t": hx("5ad8c8"), "T": hx("2aa7a0"), "u": hx("a77be0"), "U": hx("7a4cb0"), "m": hx("e8b796"), "z": hx("3a4466"), "x": hx("262b44"),
    "e": hx("ead4aa"), "f": hx("f6757a"),
}

def art(rows, outline=True, pal=None):
    p = pal or PAL
    w = max(len(r) for r in rows); h = len(rows)
    c = C(w, h)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and ch != " ": c.px(x, y, p[ch])
    return c.outline(INK) if outline else c

I = {}
I["heart"] = art([
    "..rr...rr..",
    ".rppr.rrrR.",
    "rppprrrrrrR",
    "rpprrrrrrrR",
    "rrrrrrrrrrR",
    ".rrrrrrrrR.",
    "..rrrrrrR..",
    "...rrrrR...",
    "....rrR....",
    ".....R.....",
])
I["coin"] = art([
    "...dddddd...",
    "..dyyyyyyd..",
    ".dyyYYYYyyd.",
    "dyyYyyyyYyyd",
    "dyYyyYYyyYyd",
    "dyYyyYYyyYyd",
    "dyYyyYYyyYyd",
    "dyYyyYYyyYyd",
    "dyyYyyyyYyyd",
    ".dyyYYYYyyd.",
    "..dYyyyyYd..",
    "...dddddd...",
])
I["gem"] = art([
    "..bbbbbbbb..",
    ".bccCCCCbbB.",
    "bccCCbbCCbbB",
    "BbbbbbbbbbBB",
    ".BbbCCbbbBB.",
    "..BbbCbbBB..",
    "...BbbbBB...",
    "....BbbB....",
    ".....BB.....",
])
I["star"] = art([
    ".....yy.....",
    ".....yy.....",
    "....yyyy....",
    "yyyyyyyyyyyy",
    ".yyyyYyyyyd.",
    "..yyyYYyyd..",
    "...yyYYyd...",
    "..yyYdyYyd..",
    ".yyYd..dYyd.",
    ".yd......dd.",
])
I["bolt"] = art([
    "....yyyy.",
    "...yyyY..",
    "..yyyY...",
    ".yyyyyyy.",
    "....yyY..",
    "...yyY...",
    "..yyY....",
    "..yY.....",
    ".yY......",
    ".Y.......",
])
I["gear"] = art([
    "....ss....",
    ".s.ssss.s.",
    "ssssllsss.",
    ".sslSSlss.",
    "sslS..Slss",
    "sslS..Slss",
    ".sslSSlss.",
    "ssssllssss",
    ".s.ssss.s.",
    "....ss....",
])
I["crown"] = art([
    "y...y...y",
    "yy.yyy.yy",
    "yyyyyyyyy",
    "yYyyyyyYy",
    "yyyrbryyy",
    "yYYYYYYYd",
    "ddddddddd",
])
I["trophy"] = art([
    "yyyyyyyyyy",
    "yYyyyyyyYy",
    "yy.yyyy.yy",
    "yy.yyyy.yy",
    ".yyyyyyyy.",
    "..yyyyyY..",
    "...yyyY...",
    "....yY....",
    "....yY....",
    "..dddddd..",
    "..nnnnnn..",
])
I["lock"] = art([
    "..ssss..",
    ".sS..Ss.",
    ".s....s.",
    "yyyyyyyy",
    "yYyyyyYd",
    "yYyykyYd",
    "yYyykyYd",
    "ydddddd d".replace(" ", ""),
])
I["calendar"] = art([
    ".r....r.",
    "wwwwwwwwwww",
    "rrrrrrrrrrr",
    "rrrrrrrrrrr",
    "wwwwwwwwwww",
    "wkwkwkwkwkw",
    "wwwwwwwwwww",
    "wkwkwkwkwkw",
    "wwwwwwwwwww",
    "wkwkwwwwwkw",
    "sssssssssss",
])
I["mail"] = art([
    "wwwwwwwwwwww",
    "wsswwwwwwssw",
    "wwsswwwwssww",
    "wwwsswwsswww",
    "wwwwssssswww",
    "wwwwwwwwwwww",
    "slllllllllls",
])
I["alert"] = art([
    ".....rr.....",
    "....rrrr....",
    "....rwwr....",
    "...rrwwrr...",
    "...rrwwrr...",
    "..rrrwwrrr..",
    "..rrrrrrrr..",
    ".rrrrwwrrrr.",
    "rrrrrrrrrrrR",
    "RRRRRRRRRRRR",
])
I["cone"] = art([
    "....oo....",
    "...oooo...",
    "..owwwwo..",
    "..oooooo..",
    ".owwwwwwo.",
    ".oooooooo.",
    "oooooooooo",
    "kkkkkkkkkk",
])
I["jerrycan"] = art([
    ".rrrr.....",
    "rrrrrrrrrr",
    "rrRRRrrrrR",
    "rrRrrrrrrR",
    "rrRRRrrwwR",
    "rrrrrrrwwR",
    "rrrrrrrrrR",
    "RRRRRRRRRR",
])
I["pump"] = art([
    "..cccccc..",
    "..cwwwwc..",
    "..cwwwwc..",
    "..cccccc..",
    "..rrrrrr.r",
    "..rrrrrr.r",
    "..rrrrrr.r",
    "..rrrrrrrr",
    "..rrrrrrrr",
    ".rrrrrrrr.",
    "ssssssssss",
])
I["tire"] = art([
    "...kkkkk...",
    "..kzzzzzk..",
    ".kzzSSSzzk.",
    "kzzSllllSzk",
    "kzSlSSSSlSzk"[:11],
    "kzSlSkkSlSz"[:11],
    "kzSlSSSSlSz"[:11],
    "kzzSllllSzk"[:11],
    ".kzzSSSzzk.",
    "..kzzzzzk..",
    "...kkkkk...",
])
I["remote"] = art([
    "..rr..",
    ".rrrr.",
    "ssssss",
    "slllls",
    "slbbls",
    "slllls",
    "slgrls",
    "slllls",
    "ssssss",
])
I["ticket"] = art([
    "oooooooooooooo",
    "oYYYYYYYYYYYYo",
    "oYoyyyyyyyyoYo",
    "oYoyYYyYYyyoYo",
    "oYoyyyyyyyyoYo",
    "oYYYYYYYYYYYYo",
    "oooooooooooooo",
])
I["xp"] = art([
    "bbbbbbbbbbbbbbbbb",
    "bwbwbbwwwbbbbbbbb",
    "bwbwbbwbwbbbbbbbb",
    "bbwbbbwwwbbbbbbbb",
    "bwbwbbwbbbbbbbbbb",
    "bwbwbbwbbbbbbbbbb",
    "BBBBBBBBBBBBBBBBB",
])
I["rank_shield"] = art([
    "ssssssssss",
    "slllllllls",
    "slbbbbbbls",
    "slbwwwwbls",
    "slbbbbbbls",
    ".slbbbbls.",
    "..slbbls..",
    "...sllS...",
    "....SS....",
])
I["big"] = I["star"]; I["ay_plate"] = I["mail"]; I["se_plate"] = I["mail"]
I["dice"] = art([
    "wwwwwwwwwwww",
    "wkkwwwwwkkww",
    "wkkwwwwwkkww",
    "wwwwwkkwwwww",
    "wwwwwkkwwwww",
    "wkkwwwwwkkww",
    "wkkwwwwwkkww",
    "ssssssssssss",
])

# ------------------------------------------------------------------ statuses (14x14-ish, circular badge background)
def badge(rows, bg="x"):
    inner = art(rows, outline=False)
    d = max(inner.w, inner.h) + 4
    c = C(d, d)
    c.ell(0, 0, d - 1, d - 1, PAL[bg])
    c.blit(inner, (d - inner.w) // 2, (d - inner.h) // 2)
    return c.outline(INK)

S = {}
S["slow"] = badge(["...ggg..", "..gGGGg.", ".gGgggGg", ".gGgGGGg", "gGgGg.Gg", "gggg..gg", ".gg..ggG".replace("G","g")], "z")
S["stun"] = badge(["..y.y..y.", ".yyy.yyy.", "..y.y..y.", ".........", "yyyyyyyyy"], "z")
S["burn"] = badge(["....o...", "...oo...", "..ooyo..", ".ooyyoo.", ".oyyyyoo", ".oyyyyoo", "..ooyoo.", "...oo..."], "R")
S["wet"] = badge(["...c...", "..cCc..", "..cCc..", ".cCCCc.", "cCCbCCc", "cCbbbCc", ".cCCCc."], "B")
S["shock"] = badge(["...yyy", "..yyy.", ".yyyyy", "...yy.", "..yy..", ".yy..."], "z")
S["marked"] = badge(["..rrrr..", ".r.rr.r.", "r..rr..r", "rrrr.rrr".replace(".", "r"), "r..rr..r", ".r.rr.r.", "..rrrr.."], "z")
S["armor_break"] = badge(["ssssssss", "slls.lls", "sll..lls", ".sl..ls.", "..sl.s..", "..lss...", "...ss..."], "z")
S["pushback"] = badge(["....yy..", ".yyyyyyy", "yyyyyyyy", ".yyyyyyy", "....yy.."], "z")
S["silence"] = badge(["..ss....", ".slls.r.", "sllllsrr", "sllllsrr", ".slls.r.", "..ss...."], "z")
S["haste"] = badge(["yy..yy..", ".yy..yy.", "..yy..yy", ".yy..yy.", "yy..yy.."], "z")
S["shield"] = badge(["bbbbbbb", "bccccbb", "bcbbbbb", "bcbbbbb", ".bcbbb.", "..bbb..", "...b..."], "x")
S["jammed"] = badge(["..ss..", ".ssss.", "ssSSss", "ssSSss", ".ssss.", "..ss.."], "R")
S["oil"] = badge(["...k...", "..kkk..", "..kkk..", ".kkkkk.", "kkwkkkk", "kkkkkkk", ".kkkkk."], "z")
S["fear"] = badge(["..wwww..", ".wwwwww.", "wwkwwkww", "wwkwwkww", "wwwwwwww", ".wkkkkw.", "..wwww.."], "U")
S["regen"] = badge(["..g.g..", ".ggggg.", "ggggggg", ".ggggg.", "..ggg..", "...g..."], "x")

def register(add):
    for k, c in I.items():
        add("icon_" + k, c.scaled(4).im, "ui")
    for k, c in S.items():
        add("ui_status_" + k, c.scaled(4).im, "uigen")

if __name__ == "__main__":
    import sys
    S_ = "/tmp/claude-0/-home-user-neonfeed/e8a71be1-78bb-5ee0-ae8a-55f87ea78cf7/scratchpad/"
    sheet(list(I.values()) + list(S.values()), S_ + "icons.png", cols=12, cell=(20, 20), k=6)
