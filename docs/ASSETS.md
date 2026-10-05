# ASSETS

Owner: A04 Asset Pipeline. Source of truth for art is `assets/source/` (D5: no restyling). Everything else under `assets/` is generated; do not hand-edit it.

## Rerun

```
npm run assets            # all sheets whose source file exists
npm run assets -- town    # one sheet id from assets/source/sheets.json
node scripts/sliceSprites.mjs town   # preview detected components/bboxes only
```

The script is idempotent and deterministic (two runs produce byte-identical output; no timestamps). It exits non-zero on validation errors. Per-run diagnostics (odd sizes, warnings) go to `assets/generated/report.json`.

## Layout

| Path | Contents |
|---|---|
| `assets/source/` | Original sheets + `sheets.json` (slicing config) |
| `assets/buildings/` | building fronts, sections, rooftops, doors and windows |
| `assets/tiles/` | saloon interior walls, floor/wall tiles, pillars and trim |
| `assets/props/` | signs, town props, saloon furniture, misc details |
| `assets/sprites/` | character frames (empty until the characters sheet lands) |
| `assets/generated/` | `catalogue.json`, `town_atlas.png/.json`, `report.json` |

## Pipeline (how pixels are handled)

1. Background colour is sampled (median of 8 border points: `254,244,222` for the town sheet).
2. True alpha: flood fill from the sheet border through pixels within L1 distance 36 of that colour. Cream pixels inside sprites are never touched by this step. Enclosed gaps (fence rails, wheel spokes) are cleared only when a region of >=40 px is almost exactly background (L1<=8); the paler ring around it is then grown out (L1<=44). A sprite can opt out with `"keepHoles": true` (used for `section_sheriff`, white clapboard).
3. Section titles are erased via `labelRects` before detection so text can neither become a sprite nor glue itself to one.
4. Connected components of the foreground, dilated by 3 px to merge dithered fragments, give sprite boxes. Components touching each other can be separated with `split` entries: `[x,y]` (re-label un-dilated) or `[x,y,"x"|"y",pos]` (cut at a column/row).
5. Each sprite keeps only the pixels its own component owns, tight-cropped. No resampling, scaling or recolouring; alpha is binary (0/255). A 1-3 px cream fringe against transparency is stripped (opaque edge pixels within L1<=48 of the background).
6. Names come from `sheets.json`: an `at: [x,y]` anchor inside the sprite's detected box (smallest box wins). Unnamed components produce a warning, unmatched anchors an error, so layout drift is caught.
7. Validation per PNG: has alpha channel, no background-coloured halo pixels on the transparent edge (L1<=40), odd-size report (<12 px, >256 px, aspect >5:1, alpha coverage <12%).

## Atlas keys

Atlas `town_atlas` (1024x1102, 114 frames, Phaser JSON-hash, 2 px padding, shelf-packed, no rotation/trim).

```ts
this.load.atlas('town', 'assets/generated/town_atlas.png', 'assets/generated/town_atlas.json');
this.add.image(x, y, 'town', 'saloon_front');
```

The frame key equals the catalogue key and the PNG basename (e.g. `saloon_front`, `barrel_a`). Set `origin` to (0.5, 1) for buildings/props so they sit on a ground line. Pixel-art note: keep `pixelArt: true` (D2) and integer scaling; the sheet art is roughly 2x the 360x640 logical scale for buildings, so scale props by the same factor (0.5 is not integer; pick a scale per use and review with A05/A11).

`assets/generated/catalogue.json` maps `name -> {x,y,w,h,category,sheet,file,atlas}` where x,y,w,h is the tight crop in the source sheet.

## Adding the characters / desert sheets

1. Drop `characters_sheet.png|webp|jpg` / `desert_sheet.*` into `assets/source/`.
2. Entries `characters` and `desert` already exist in `assets/source/sheets.json`.
   - `characters` (`mode: "characters"`): components are grouped into rows by vertical centre (`rowTolerance`), sorted left to right, and named `<row.name>_<frame>` from the `rows` list (default frames: idle, idle2, aim, shoot, hit, dead). Output goes to `assets/sprites/`, atlas `characters_atlas`. Row/frame count mismatches are reported as warnings. Add `labelRects` for any title text and use `split` if frames touch.
   - `desert` (`mode: "auto"`): every component is exported as `desert_NNN`. After reviewing, convert to `mode: "named"` with `sprites: [{name, category, dir, at}]`.
3. Run `npm run assets`; check warnings and `report.json`.

## Catalogue (town sheet, 114 sprites)

### building_front (7)

| key | size | file |
|---|---|---|
| `bank_front` | 181x231 | `buildings/bank_front.png` |
| `general_store_front` | 198x208 | `buildings/general_store_front.png` |
| `jail_front` | 171x223 | `buildings/jail_front.png` |
| `saloon_front` | 207x223 | `buildings/saloon_front.png` |
| `sheriff_front` | 177x206 | `buildings/sheriff_front.png` |
| `stable_front` | 212x201 | `buildings/stable_front.png` |
| `station_front` | 208x232 | `buildings/station_front.png` |

### interior_furniture (15)

| key | size | file |
|---|---|---|
| `bar_counter` | 235x136 | `props/bar_counter.png` |
| `barrel_interior_a` | 39x56 | `props/barrel_interior_a.png` |
| `barrel_interior_b` | 46x60 | `props/barrel_interior_b.png` |
| `cactus_potted` | 35x69 | `props/cactus_potted.png` |
| `candelabra` | 72x72 | `props/candelabra.png` |
| `chair_red` | 37x59 | `props/chair_red.png` |
| `chair_wood` | 38x59 | `props/chair_wood.png` |
| `piano` | 161x139 | `props/piano.png` |
| `railing_balcony` | 126x65 | `props/railing_balcony.png` |
| `rug_red` | 246x61 | `props/rug_red.png` |
| `staircase` | 165x165 | `props/staircase.png` |
| `stool_red_a` | 31x47 | `props/stool_red_a.png` |
| `stool_red_b` | 36x38 | `props/stool_red_b.png` |
| `table_round` | 85x60 | `props/table_round.png` |
| `table_round_bottle` | 82x79 | `props/table_round_bottle.png` |

### town_prop (23)

| key | size | file |
|---|---|---|
| `barrel_a` | 45x58 | `props/barrel_a.png` |
| `barrel_b` | 45x58 | `props/barrel_b.png` |
| `bench` | 81x71 | `props/bench.png` |
| `cactus_tall` | 48x93 | `props/cactus_tall.png` |
| `crate_small` | 39x55 | `props/crate_small.png` |
| `crate_stack` | 77x66 | `props/crate_stack.png` |
| `dirt_patch` | 74x51 | `props/dirt_patch.png` |
| `fence_gate_cross` | 100x55 | `props/fence_gate_cross.png` |
| `fence_post` | 14x55 | `props/fence_post.png` |
| `fence_rail` | 171x53 | `props/fence_rail.png` |
| `hay_bale` | 37x58 | `props/hay_bale.png` |
| `hay_patch_a` | 55x32 | `props/hay_patch_a.png` |
| `hay_patch_b` | 54x31 | `props/hay_patch_b.png` |
| `hay_pile` | 67x56 | `props/hay_pile.png` |
| `hitching_post` | 73x73 | `props/hitching_post.png` |
| `hitching_rail` | 100x73 | `props/hitching_rail.png` |
| `lamp_post` | 31x165 | `props/lamp_post.png` |
| `rocks_small` | 48x26 | `props/rocks_small.png` |
| `shrub_green_a` | 47x38 | `props/shrub_green_a.png` |
| `shrub_green_b` | 52x41 | `props/shrub_green_b.png` |
| `signpost_wood` | 56x103 | `props/signpost_wood.png` |
| `wagon` | 162x82 | `props/wagon.png` |
| `water_trough` | 68x38 | `props/water_trough.png` |

### misc (13)

| key | size | file |
|---|---|---|
| `bed` | 131x78 | `props/bed.png` |
| `bookshelf_bottles` | 107x87 | `props/bookshelf_bottles.png` |
| `bottles_a` | 54x52 | `props/bottles_a.png` |
| `cow_skull` | 58x58 | `props/cow_skull.png` |
| `crate_stack_b` | 62x65 | `props/crate_stack_b.png` |
| `lasso` | 43x56 | `props/lasso.png` |
| `painting_framed` | 63x65 | `props/painting_framed.png` |
| `rail_wood` | 89x30 | `props/rail_wood.png` |
| `rocking_chair` | 90x101 | `props/rocking_chair.png` |
| `saddle` | 68x89 | `props/saddle.png` |
| `safe` | 63x78 | `props/safe.png` |
| `side_table_lantern` | 62x89 | `props/side_table_lantern.png` |
| `wall_pegs` | 61x34 | `props/wall_pegs.png` |

### rooftop (7)

| key | size | file |
|---|---|---|
| `chimney_stone` | 26x85 | `buildings/chimney_stone.png` |
| `roof_gray_slate` | 68x74 | `buildings/roof_gray_slate.png` |
| `roof_green_shingles` | 83x76 | `buildings/roof_green_shingles.png` |
| `roof_parapet_stone` | 101x82 | `buildings/roof_parapet_stone.png` |
| `roof_red_tiles` | 80x74 | `buildings/roof_red_tiles.png` |
| `roof_wood_dark` | 87x78 | `buildings/roof_wood_dark.png` |
| `roof_wood_planks` | 82x77 | `buildings/roof_wood_planks.png` |

### sign_decor (4)

| key | size | file |
|---|---|---|
| `clock_sign` | 60x56 | `props/clock_sign.png` |
| `lantern_hanging` | 39x64 | `props/lantern_hanging.png` |
| `signpost_arm` | 37x64 | `props/signpost_arm.png` |
| `signpost_directions` | 68x78 | `props/signpost_directions.png` |

### door_window (10)

| key | size | file |
|---|---|---|
| `door_dark` | 48x85 | `buildings/door_dark.png` |
| `door_glass` | 46x85 | `buildings/door_glass.png` |
| `door_jail` | 51x85 | `buildings/door_jail.png` |
| `door_saloon_swing` | 72x73 | `buildings/door_saloon_swing.png` |
| `door_wood` | 54x85 | `buildings/door_wood.png` |
| `window_dark_a` | 61x61 | `buildings/window_dark_a.png` |
| `window_dark_b` | 54x61 | `buildings/window_dark_b.png` |
| `window_jail` | 53x63 | `buildings/window_jail.png` |
| `window_wood_small` | 50x66 | `buildings/window_wood_small.png` |
| `window_wood_tall` | 48x69 | `buildings/window_wood_tall.png` |

### interior_trim (8)

| key | size | file |
|---|---|---|
| `pillar_a` | 32x111 | `tiles/pillar_a.png` |
| `pillar_b` | 27x110 | `tiles/pillar_b.png` |
| `trim_post_short` | 24x73 | `tiles/trim_post_short.png` |
| `trim_post_tall_a` | 19x96 | `tiles/trim_post_tall_a.png` |
| `trim_post_tall_b` | 26x97 | `tiles/trim_post_tall_b.png` |
| `trim_rail_long` | 191x18 | `tiles/trim_rail_long.png` |
| `trim_rail_medium` | 118x16 | `tiles/trim_rail_medium.png` |
| `trim_rail_short` | 45x24 | `tiles/trim_rail_short.png` |

### building_section (10)

| key | size | file |
|---|---|---|
| `porch_awning` | 110x76 | `buildings/porch_awning.png` |
| `porch_frame` | 74x76 | `buildings/porch_frame.png` |
| `porch_shed` | 88x73 | `buildings/porch_shed.png` |
| `section_door_glass` | 64x86 | `buildings/section_door_glass.png` |
| `section_general_store` | 95x120 | `buildings/section_general_store.png` |
| `section_jail` | 86x120 | `buildings/section_jail.png` |
| `section_saloon` | 79x113 | `buildings/section_saloon.png` |
| `section_sheriff` | 91x113 | `buildings/section_sheriff.png` |
| `section_station` | 100x115 | `buildings/section_station.png` |
| `section_window_glass` | 71x86 | `buildings/section_window_glass.png` |

### sign (6)

| key | size | file |
|---|---|---|
| `sign_bank` | 63x54 | `props/sign_bank.png` |
| `sign_jail` | 63x59 | `props/sign_jail.png` |
| `sign_saloon` | 72x58 | `props/sign_saloon.png` |
| `sign_sheriff` | 78x62 | `props/sign_sheriff.png` |
| `sign_stable` | 78x49 | `props/sign_stable.png` |
| `sign_store` | 72x54 | `props/sign_store.png` |

### interior_tile (6)

| key | size | file |
|---|---|---|
| `tile_carpet_red` | 103x110 | `tiles/tile_carpet_red.png` |
| `tile_carpet_runner` | 75x107 | `tiles/tile_carpet_runner.png` |
| `tile_floor_planks` | 137x111 | `tiles/tile_floor_planks.png` |
| `tile_sand_a` | 74x107 | `tiles/tile_sand_a.png` |
| `tile_sand_wainscot` | 78x107 | `tiles/tile_sand_wainscot.png` |
| `tile_stone_wall` | 76x107 | `tiles/tile_stone_wall.png` |

### interior_wall (5)

| key | size | file |
|---|---|---|
| `wall_saloon_lantern` | 95x127 | `tiles/wall_saloon_lantern.png` |
| `wall_saloon_painting` | 126x126 | `tiles/wall_saloon_painting.png` |
| `wall_saloon_plain` | 85x127 | `tiles/wall_saloon_plain.png` |
| `wall_saloon_shelf` | 131x127 | `tiles/wall_saloon_shelf.png` |
| `wall_saloon_wanted_skull` | 119x126 | `tiles/wall_saloon_wanted_skull.png` |

## Quality notes

- Source is AI-generated and slightly soft (webp artefacts); edges were not sharpened, per D5.
- `dirt_patch` is a scatter of pale blobs and a rock; very pale blobs close to the sheet background colour are lost to the background flood fill, so some speckle is missing compared with the sheet.
- Balusters/rails of `railing_balcony`, `section_*` railings keep their cream gaps where the gaps are narrower than the hole threshold.
- Sizes flagged by the odd-size report (all intentional): `lamp_post` 31x165, `trim_post_tall_a` 19x96, `trim_rail_long` 191x18, `trim_rail_medium` 118x16 (extreme aspect ratio).
