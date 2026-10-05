#!/usr/bin/env python3
"""Stage 1 of the asset pipeline: master sheet -> clean transparent source PNGs.

Run:  python3 tools/extract_assets.py
Every cut-out is segmented from the supplied TRAFFIC JAM master sheet (assets/source/reference).
Nothing here uses placeholder art. Output is native resolution (no upscaling) in assets/source/.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from seglib import *

count = 0
def out(img, rel):
    global count
    if img is None:
        print("!! missing", rel); return
    save(img, rel); count += 1

# ---------------------------------------------------------------- VEHICLES (5 cols x 6 rows)
COLS = [(66, 127), (128, 193), (195, 262), (263, 332), (333, 408)]
ROWS = [(299, 349), (349, 399), (399, 454), (454, 509), (507, 561), (559, 605)]
VEH = [
  # row 1 (common)
  ["compact", "taxi", "hatchback", "family_wagon", "delivery_van"],
  # row 2
  ["pickup", "taxi_alt", "food_truck", "mail_van", "road_worker"],
  # row 3
  ["ambulance", "fire_engine", "police", "construction_truck", "tow_truck"],
  # row 4
  ["swat_van", "school_bus", "box_truck_sign", "crane_truck", "mobile_command"],
  # row 5
  ["interceptor", "hot_rod", "supercar", "ice_cream_truck", "armored_dozer"],
  # row 6
  ["rocket_car", "fire_racer", "winged_van", "gadget_buggy", "mini_tank"],
]
RARITY_ROW = ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
for ri, names in enumerate(VEH):
    for ci, n in enumerate(names):
        r0, r1 = ROWS[ri]; c0, c1 = COLS[ci]
        out(cutout((c0, r0, c1, r1)), f"vehicles/{RARITY_ROW[ri]}/vehicle_{n}_{RARITY_ROW[ri]}_body.png")

# ---------------------------------------------------------------- PLAYER AVATARS (presets)
AV = [(286,41,342,123),(346,39,400,123),(398,41,450,123),(451,40,501,123),(496,41,546,122),(545,35,596,122)]
AVN = ["cap_red_blue", "cap_headphones", "brown_hair", "cap_blue", "long_hair", "red_curls"]
for n, b in zip(AVN, AV):
    out(cutout((b[0]-2, b[1]-2, b[2]+2, b[3]+2)), f"characters/player/player_preset_{n}.png")

# ---------------------------------------------------------------- COSMETICS
HAT = {
  "hats": [("cap_blue_red",(285,129,335,163)),("cap_green",(332,127,383,163)),("cap_white",(285,162,335,194)),
           ("hat_black",(338,164,385,192)),("cap_red_blue",(390,164,441,193))],
  "hair": [("curly_blond",(385,127,433,163)),("spiky_black",(437,126,490,167)),("messy_brown",(495,127,543,167)),("slick_black",(548,127,597,164))],
  "glasses": [("round_shades",(444,169,494,193)),("dark_shades",(498,168,546,192))],
  "accessories": [("headphones",(550,162,600,197))],
}
for cat, items in HAT.items():
    for n, b in items:
        out(cutout((b[0]-2, b[1]-2, b[2]+2, b[3]+2)), f"cosmetics/{cat}/cosmetic_{cat}_{n}.png")
OUTFIT_X = [285 + 31.5 * i for i in range(11)]
TOPS = ["patchwork_tee", "jeans_overalls", "grey_jacket", "red_jacket", "teal_hoodie", "tan_jacket", "blue_hoodie", "navy_scarf", "green_hoodie", "green_jacket"]
BOTS = ["denim_shorts", "blue_hoodie2", "yellow_jacket", "dark_jacket", "jeans", "cargo", "overalls", "red_sneakers", "red_bag", "red_pack"]
for i, n in enumerate(TOPS):
    out(cutout((int(OUTFIT_X[i]), 195, int(OUTFIT_X[i+1])+1, 235), pad=1), f"cosmetics/tops/cosmetic_outfit_{n}.png")
for i, n in enumerate(BOTS):
    out(cutout((int(OUTFIT_X[i]), 233, int(OUTFIT_X[i+1])+1, 268), pad=1), f"cosmetics/bottoms/cosmetic_outfit2_{n}.png")

# ---------------------------------------------------------------- NPCs & ANIMALS
NPC = [("traffic_cop",(632,35,703,115)),("mayor",(709,37,779,115)),("mechanic",(787,38,851,115)),("news_reporter",(855,37,921,115)),
       ("construction",(632,133,701,212)),("delivery_guy",(710,133,775,212)),("rival_driver",(783,133,850,212)),("mysterious_stranger",(855,133,920,212))]
for n, b in NPC:
    out(cutout((b[0]-2, b[1]-2, b[2]+2, b[3]+2)), f"characters/npcs/npc_{n}.png")
ANI = [("dog",(630,231,686,287)),("cat",(686,231,736,287)),("pigeon",(737,236,795,287)),("seagull",(799,236,857,287)),("raccoon",(861,238,925,287))]
for n, b in ANI:
    out(cutout(b), f"characters/npcs/npc_animal_{n}.png")

# ---------------------------------------------------------------- ENEMIES / BOSSES
EN1 = [("slow_car",(942,50,1008,108)),("speedster",(1007,44,1076,108)),("suv",(1073,44,1137,108)),("truck",(1135,36,1198,108)),("bus",(1196,34,1267,108))]
EN2 = [("police_chase",(941,128,1007,208)),("gang_cars",(1005,134,1075,206)),("motorcycle",(1075,138,1128,210)),("armored_truck",(1129,132,1201,206)),("road_cleaner",(1195,130,1268,206))]
for n, b in EN1 + EN2:
    out(cutout(b), f"enemies/enemy_{n}.png")
BOSS = [("monster_truck",(1284,38,1374,122)),("helicopter",(1369,38,1460,116)),("tank",(1447,42,1523,122)),
        ("drill_truck",(1284,138,1385,226)),("ufo",(1366,138,1449,218)),("mecha",(1437,130,1521,226))]
for n, b in BOSS:
    out(cutout(b), f"vehicles/bosses/boss_{n}.png")

# ---------------------------------------------------------------- TILES (3 rows x 8 cols, tiny: stretched to square at runtime)
TX = [(541,587),(594,637),(644,687),(693,735),(741,781),(786,824),(830,868),(874,922)]
TY = [(336,376),(382,423),(430,474)]
TILES = [
  ["road_dashed_yellow_h","road_lane_v","road_turn_arrow","road_arrow_up","road_arrow_down","grass_with_slab","road_edge_grass","asphalt_cracked"],
  ["road_dashed_white_h","road_double_yellow_v","road_arrow_right","road_t_junction","asphalt_plain","road_corner_yellow","grass_flowers","hazard_stripes"],
  ["manhole","road_lane_v_dashed","roundabout","crosswalk_books","parking_p","grass_patch","grass_dry","concrete_cracked"],
]
for ri, row in enumerate(TILES):
    for ci, n in enumerate(row):
        b = (TX[ci][0], TY[ri][0], TX[ci][1], TY[ri][1])
        out(paper_cut(b, radius=0), f"environment/roads/tile_{n}.png")

PROPS = [("traffic_light",(540,481,578,601)),("street_lamp",(578,481,645,562)),("junction_box",(662,481,718,527)),
         ("speed_camera",(723,481,766,553)),("tree",(759,481,829,561)),("bench",(826,481,886,528)),("bin_blue",(888,483,923,529)),
         ("bush",(634,507,688,552)),("barricade_a",(577,554,643,602)),("barricade_b",(639,548,691,591)),("stop_sign",(687,524,728,602)),
         ("one_way_sign",(718,550,788,602)),("bush_rocks",(783,546,840,602)),("hydrant",(832,525,870,577)),("trash_can",(877,529,925,600)),
         ("rock",(842,568,884,602))]
for n, b in PROPS:
    out(cutout(b), f"environment/props/prop_{n}.png")

# ---------------------------------------------------------------- UI: buttons (text baked -> we rebuild blanks in make_ui.py), icons
BTN = {"play":(19,644,133,675),"units":(19,683,133,715),"customize":(19,722,133,754),"leaderboard":(19,761,133,793),
       "shop":(145,644,252,675),"quests":(145,683,252,715),"inventory":(145,722,252,754),"settings":(145,761,252,793)}
for n, b in BTN.items():
    out(paper_cut(b, radius=3), f"ui/buttons/ui_button_{n}_baked.png")
ICON = {"coin":(280,642,322,682),"gem":(335,643,383,686),"ticket":(394,641,446,677),"gear":(455,632,499,674),"crown":(508,631,547,669),
        "lock":(280,688,322,730),"heart":(338,693,376,728),"bolt":(392,688,432,734),"trophy":(447,688,493,731),"xp":(503,688,543,722),
        "calendar":(282,730,318,770),"mail":(338,730,376,767),"cone":(390,735,427,777),"pump":(442,737,490,777),"rank_shield":(503,714,543,754),
        "star":(282,772,320,806),"alert":(335,768,373,806),"jerrycan":(393,779,424,804),"remote":(450,775,478,806),"tire":(499,758,545,804)}
for n, b in ICON.items():
    out(cutout(b), f"ui/icons/ui_icon_{n}.png")

# ---------------------------------------------------------------- FX
FX = {"boom_burst":(953,643,1047,717),"smoke_big":(1047,643,1124,712),"smoke_med":(1128,643,1177,696),"smoke_small":(997,696,1072,752),
      "smoke_tiny":(953,718,992,760),"explosion_orange":(1056,722,1110,800),"arrow_red_a":(1103,693,1142,737),
      "arrow_red_b":(1142,690,1176,720),"smoke_cloud_b":(1117,722,1183,790),"streaks":(1185,690,1247,772),"arrow_small":(1170,755,1200,790),
      "rock_a":(1198,771,1233,806),"debris_a":(1030,750,1058,796),"rock_b":(1000,775,1042,806),"rock_c":(1157,783,1186,806),"shard_blue":(1010,775,1042,806),
      "arrow_blue":(1196,768,1235,806),"cone_big":(954,756,1000,806)}
for n, b in FX.items():
    out(cutout(b), f"fx/fx_{n}.png")

# ---------------------------------------------------------------- NUMBERS & LABEL STICKERS
DIG = {0:(1300,641,1338,688),1:(1349,641,1377,688),2:(1384,639,1421,687),3:(1426,639,1464,687),4:(1468,636,1511,684),
       5:(1298,692,1335,741),6:(1342,690,1379,739),7:(1383,690,1420,740),8:(1423,689,1462,737),9:(1470,686,1508,737)}
for n, b in DIG.items():
    out(cutout(b), f"ui/numbers/ui_digit_{n}.png")
LBL = {"wave":(1287,739,1346,772),"boss":(1350,741,1406,771),"critical":(1409,737,1472,769),"miss":(1478,736,1521,767),
       "block":(1287,772,1358,808),"merge":(1369,774,1430,806),"combo":(1438,772,1522,806)}
for n, b in LBL.items():
    out(cutout(b, thr_white=False, thr=45), f"ui/numbers/ui_label_{n}.png")

# ---------------------------------------------------------------- BIOMES / MODE CARDS / PANELS / MAP
BIOME = {"city_center":(950,288,1049,365),"suburbs":(1059,288,1170,365),"highway":(1180,288,1278,365),
         "industrial":(950,389,1049,471),"desert":(1059,389,1170,471),"snow_town":(1180,389,1278,471),
         "beach_road":(950,498,1049,581),"countryside":(1059,498,1170,581),"night_city":(1180,498,1278,581)}
for n, b in BIOME.items():
    out(paper_cut(b, radius=1), f"biomes/biome_{n}.png")
MODE = {"story":(565,840,671,952),"survival":(677,840,783,952),"coop":(792,840,897,952),"pvp":(904,840,1010,952)}
for n, b in MODE.items():
    out(paper_cut(b, radius=3), f"ui/cards/ui_mode_{n}.png")
CUT = {"panel_1":(1036,845,1139,906),"panel_2":(1154,845,1254,906),"panel_3":(1268,840,1383,906),"panel_4":(1397,838,1513,904)}
for n, b in CUT.items():
    out(paper_cut(b, radius=1), f"cutscenes/cutscene_{n}.png")
out(paper_cut((1313,285,1508,592), radius=1), "ui/map/ui_map_art.png")
MAPN = {"lock":(1387,292,1419,328),"boss":(1335,317,1376,374),"star":(1355,478,1388,513),"start":(1337,535,1369,569)}
for n, b in MAPN.items():
    out(cutout(b, thr_white=True), f"ui/map/ui_map_node_{n}.png")

# ---------------------------------------------------------------- EMOTES, BUBBLES, MARKETING
out(cutout((785,968,835,1018)), "ui/icons/ui_tire_big.png")
LOGO = cutout((14,14,262,184), thr_white=False, thr=70, erode=0, pad=0)
out(LOGO, "ui/logo/logo_title_block.png")
out(cutout((74,160,228,236), thr_white=False, thr=40, erode=0, pad=0), "ui/logo/logo_tagline.png")
out(cutout((12,234,216,266), thr_white=False, thr=40, erode=0, pad=0), "ui/logo/logo_strapline.png")
out(cutout((212,166,272,252)), "ui/logo/logo_cone.png")
print("wrote", count, "source assets")
