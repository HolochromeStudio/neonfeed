# Asset pack audit: Western_Game_Assets.zip

Owner: A04 (asset pipeline), written by the Lead. Inventory numbers: `docs/ASSET_PACK_AUDIT_GENERATED.md` (regenerate with `node scripts/buildAssetRegistry.mjs`). Registry: `src/data/packAssets.ts`. Files: `public/assets/` (pack layout and filenames preserved).

## Result in one line
Technically clean (353 PNGs, manifest matches disk, all decode with alpha), but **artistically these are programmatic starter placeholders**, far below the hand-made sheets already integrated in this project.

## What the pack says about itself
README: "Original programmatic pixel-art starter assets ... Assets are simplified placeholders, NOT pixel-perfect recreations of supplied reference sheets." The manifest notes: "UI and cutscenes are templates."

## Findings (verified by looking at the files)
| Area | Finding |
|---|---|
| Structure | 353 PNG: 9 characters (hero 10 frames, 8 others 7 frames), 93 tiles (31 x 3 regions, 96x96), 18 background layers (960x360), 84 button images (21 buttons x 4 states, 240x68), 13 panels, 30 icons, 25 fx frames, 11 cutscenes and 13 screens (640x360 templates), 1 font reference image. |
| Integrity | Manifest and disk agree exactly. No invalid files, no missing files. |
| Characters | 168x144 canvases at 3x scale. Every character has the same body silhouette as the hero (8 of 9 idle alpha masks are byte-identical to the hero's), only colour and hat differ. Mad Dog's "dog-skin cape" is a red zig-zag line. |
| Animation | Frames are nearly static: idle == idle2 == hit for every enemy and boss; tell == aim for the 4 regular enemies; hero idle == draw1 == hit == dodge; shoot1 == shoot2. "dodge" and "hit" have no visible pose. The animation state machine would have no visible motion. |
| Backgrounds | Flat trapezoid mesas on a flat sky and a speckled ground rectangle. Usable as a placeholder only. |
| Tiles | 96x96 single-name tiles (cactus, wagon, boxcar...). Not inspected one by one; not a seamless tileset. |
| UI | Buttons are flat rectangles with smooth-looking text ("PLAY"); panels are plain rectangles; screens are wireframe templates ("MAIN_MENU"). None of it has the planks, brass and parchment look the UX docs require. |
| Font | `bitmap_glyph_reference.png` is a visual reference only (README): not a loadable font. |
| Resolution | Characters 168x144 and backgrounds 960x360 do not match this project's 360x640 portrait, 1x integer-scale world (D2/D9). The hand-made characters sheet shown earlier is ~65x100 per frame. |

## Missing or not production-ready
- Real animation (distinct draw/hit/dodge/tell/phase poses), distinct character designs, real UI chrome, a loadable bitmap font, finished cutscene art, any audio.
- Nothing is "unused-but-needed": the game currently loads none of the pack.

## Compared with art already in the project
Town sheet (114 sprites + atlas), the hand-made characters sheet and the desert sheet (shown in chat; still not committed as files, blocker B1) are all much more detailed and match the style bible. Per decision D5 the supplied sheets are the visual source of truth; this pack should not silently replace them.

## Recommendation
Keep the pack as a stopgap for what we lack (hero frames, enemy/boss stand-ins, FX, backgrounds for Canyon and Railroad) only if a quality drop is acceptable, otherwise generate those from the ASSET_BRIEF. Decision needed from the user: see the Lead's message.
