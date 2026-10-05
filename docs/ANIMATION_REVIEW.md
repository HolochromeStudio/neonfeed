# Animation / Sprite Review (Gate A)

Owner: A05. Reviewed: `assets/generated/catalogue.json` (114 sprites), `report.json`, `docs/ASSETS.md`. Nothing was renamed or edited; A04 owns all assets.

## 1. Anchors

Authoritative table: `SPRITE_ANCHORS` in `src/data/animations.ts` (one entry per catalogue key; a test fails if the catalogue and table drift apart). Use `anchorFor(key)` then `setOrigin(a.x, a.y)`.

| Group | Anchor | Keys |
|---|---|---|
| Building fronts, sections, roofs, chimney, doors, `door_saloon_swing` | bottom-centre (0.5, 1) | all `*_front`, `section_*` (except `section_window_glass`), `roof_*`, `chimney_stone`, `door_*`, `porch_*` |
| Props (outdoor and furniture) | bottom-centre (0.5, 1) | everything not listed below |
| Tiles, interior walls, floor strips | top-left (0, 0) | `tile_*`, `wall_saloon_*`, `trim_rail_*`, `rug_red` |
| Wall hangings, windows, signs, small desk items | centre (0.5, 0.5) | `window_*`, `section_window_glass`, `sign_*`, `signpost_arm`, `clock_sign`, `painting_framed`, `wall_pegs`, `lasso`, `candelabra`, `bottles_a`, `cow_skull` |
| Hanging item | top-centre (0.5, 0) | `lantern_hanging` |

Placeholder atlas: `hero_*`/`enemy_*` bottom-centre (feet on ground line), fx and ui centre (`PLACEHOLDER_ANCHORS`). Characters from the real sheet should also be bottom-centre.

Caveats:
- Frames are tight-cropped, so bottom-centre means the lowest opaque pixel. Props with overhang (`wagon`, `lamp_post`, `hitching_*`) may need a per-sprite `yOffset` once placed; add to `SPRITE_ANCHORS` with a custom y rather than shifting in scenes.
- Pivot for animated swing: `door_saloon_swing` should rotate about its top hinge, not its bottom. If it is animated by tween, split into two half-doors or use origin (0.5, 0) plus a position offset. Not decided here; A11 to confirm.

## 2. Odd sizes

From `report.json`: `lamp_post` 31x165, `trim_post_tall_a` 19x96, `trim_rail_long` 191x18, `trim_rail_medium` 118x16 (extreme aspect). All acceptable; they are legitimately long/thin. My additions:
- Interior tiles are non-uniform and non-power-of-two (`tile_carpet_red` 103x110, `tile_floor_planks` 137x111, `tile_sand_a` 74x107, `tile_stone_wall` 76x107 ...). They cannot be used as a seamless repeating tile grid; place them as individual stamped sprites, or have A04 normalise to a common cell (e.g. 64x64 or 96x96) if a repeating floor is wanted. They are not "tiles" in the Phaser TileSprite sense.
- Interior wall pieces are 85-131 wide x 126-127 tall; heights are consistent (good), widths vary, so a wall run needs per-piece widths from the atlas, not a fixed step.
- `section_*` (64-100 x 86-120) look like building cut-outs overlapping `*_front`. Confirm they are not duplicates before shipping both to the atlas (atlas budget 1024x1102 is already non-square; consider 1024x1024 or 2048 height for mobile GPU friendliness).
- Atlas 1024x1102 height is not a power of two. Fine for WebGL2 but A16 should confirm on low-end mobile.
- Scale note: buildings ~200px wide at 360px logical width means a building is more than half the screen; scale 0.5 is non-integer (breaks D2 integer-scale pixel rule). Decide one world scale before arenas are built.

## 3. Naming consistency and recommended renames

Convention proposed: `<group>_<name>[_<variant>]`, variants as `_a/_b`, no group word is repeated as a suffix.

| Current | Issue | Recommended |
|---|---|---|
| `barrel_a`, `barrel_b` vs `barrel_interior_a/b` | interior marker is in the middle; others use no marker | `barrel_a/b` (outdoor), `barrel_indoor_a/b` or keep; pick `*_interior` as a suffix for all indoor variants consistently (`chair_*`, `stool_*`, `table_*` have none) |
| `section_*` | ambiguous with section of what | `building_section_*` (matches category) |
| `sign_*` (6) vs `signpost_*` (3) vs `clock_sign`, `lantern_hanging` | three prefixes for related things; `clock_sign` suffix style | `sign_clock`; keep `sign_<building>` for storefront signs; `signpost_*` fine |
| `crate_stack_b` (misc) vs `crate_stack` (town_prop) | same family in two categories | `crate_stack_b` category -> `town_prop` |
| `rail_wood` (misc) vs `fence_rail`, `hitching_rail`, `trim_rail_*` | unclear purpose | confirm use; likely `railing_wood` or `fence_rail_short` |
| `hay_bale`, `hay_patch_a/b`, `hay_pile` | fine | none |
| `bottles_a` | no `_b` exists | `bottles` or keep |
| `roof_wood_dark`, `roof_wood_planks`, `roof_red_tiles` etc. | material order inconsistent (`wood_dark` vs `gray_slate`) | acceptable; no change |
| `bookshelf_bottles`, `side_table_lantern`, `table_round_bottle` | noun_with_item pattern; fine | none |
| `cactus_potted` category `interior_furniture`, `cactus_tall` `town_prop` | fine, but `shrub_green_a` has colour while `cactus` doesn't | none |

Category fixes: `crate_stack_b` -> `town_prop`; `rail_wood`, `bed`, `bookshelf_bottles`, `bottles_a`, `painting_framed`, `rocking_chair`, `safe`, `side_table_lantern`, `wall_pegs` sit in `misc` but mostly belong in `interior_furniture`/`sign_decor`; `sign_*` (category `sign`) vs `signpost_*`/`clock_sign` (category `sign_decor`) should merge or be clearly split.

Do not rename without telling A05/A11: any rename invalidates `SPRITE_ANCHORS` keys (test will fail loudly, which is the intent).

## 4. Animation system (Task 2) summary

- `src/animation/types.ts`: `AnimationDef {key, atlas, frames, frameRate, repeat, oneShot, next?}`.
- `src/animation/AnimationStateGraph.ts`: pure graph. `dead` terminal; `hit` interrupts idle/draw/aim/shoot; `AUTO_NEXT` = draw->aim, shoot->aim, hit->idle. `complete()` applies it.
- `src/animation/registerAnimations.ts`: `registerAnimations(scene)` (duplicate-safe, takes any object with `anims.exists/create`), `playCharacterState(sprite, prefix, state)`.
- `src/animation/characterSheet.ts`: `characterAnimsFromSheet(prefix, atlas)` for frames `<prefix>_idle, _idle2, _aim, _shoot, _hit, _dead`. Real sheet has no draw frames, so `draw` is idle2 -> aim. `characterDefsFor(prefix)` in data wraps it for `characters_atlas`.
- `src/data/animations.ts`: contract frames, placeholder defs, fx defs (`fx_muzzle_flash`, `fx_impact_spark`, `fx_dust_puff`).

Animation keys: `hero_|enemy_` + `idle|draw|aim|shoot|hit|dead`. `bullet`, `ui_exclaim`, `ui_crosshair` are static frames (no animation). Timings: idle 3 fps loop, draw 16 fps, shoot 14 fps, hit 8 fps (hit-stop/flash timing belongs to A03).
