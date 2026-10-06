# PERFORMANCE (A16)

Target: stable 60 FPS on reasonable mobile devices, low texture memory, small startup cost.
Owner of this doc: A16 (Performance). Source fixes belong to the file owners; every recommendation below names file, change and expected gain.

Tools (all under `scripts/perf/`, none touch `src/`):

| Command | What it does |
|---|---|
| `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/perf/profile.mjs [--throttle=4] [--gfxprobe] [--loops=3] [--dev]` | Builds into `scripts/perf/out/dist`, plays menu -> map -> duel (real input) -> reward -> 3 extra duels, prints per-scene frame stats, writes `scripts/perf/out/profile.json` |
| `node scripts/perf/assetReport.mjs` | Atlas sizes, power-of-two check, packing %, GPU memory estimate, per-scene texture memory |
| `node scripts/perf/optimizePng.mjs [--write]` | Lossless PNG recompression. Dry run by default; `--write` replaces a file only if the decoded RGBA is byte-identical |

## 1. Honest caveat on the runtime numbers

Headless Chromium here renders WebGL through SwiftShader (software) at 360x640 with DPR 2, with the CPU throttled 4x. That is not a mobile GPU: fill-rate, driver behaviour, thermal throttling and memory bandwidth are all different, and the container was shared with other agents running tests (the second and third profile runs are visibly noisier). Treat the numbers as relative hot spots (which scene is heavier, what disappears when X is removed) and as a before/after yardstick on the same machine. Do not quote them as device FPS. Real-device validation (a mid-range Android plus an older iPhone, Chrome/Safari remote debugging, 60 s of play) is still owed, see section 8.

## 2. Bundle (task 1) - done, `vite.config.ts` added

Config: `target: es2020`, `sourcemap: false`, `manualChunks` puts `node_modules/phaser` in its own `phaser-[hash].js` chunk, `chunkSizeWarningLimit: 1600` (Phaser itself is 1.48 MB minified and cannot be split; the warning now fires only if something grows past that).

| | before (single chunk) | after |
|---|---|---|
| game + phaser JS (raw) | 1,759,990 B (`index-*.js`, 434 kB gzip per Vite) | 1,763,000 B total, split |
| `phaser-*.js` | - | 1,478,579 B raw, 339.7 kB gzip |
| `index-*.js` (game code) | - | 284.1 kB raw, 94.9 kB gzip (at time of build; grows as agents add code) |
| JS gzip total | 434.0 kB | ~434.5 kB |
| build warning | yes (>500 kB, then 1.7 MB) | none |
| sourcemaps in dist | none (Vite default) | none (explicit) |

The point of the split is caching, not size: the 340 kB-gzip engine chunk is content-hashed and only changes when Phaser is upgraded, so every game release re-downloads only ~95 kB gzip. Total JS gzip is unchanged.

Not done (needs a decision): a custom Phaser build. Phaser 3 ships ESM source (`phaser/src/phaser.js`) with feature flags (`phaser/src/phaser-core`, plus excluding Arcade/Matter physics, Spine, Video, DOM element, Facebook Instant, Tilemaps, Mesh, Rope). The game uses none of physics/tilemaps/video, so a custom entry could plausibly drop 300-500 kB raw (~80-120 kB gzip). Expected gain: ~25% of the startup JS. Risk: it touches `src/main.ts` imports, so it needs the owner of `main.ts`; verify with `npm test` and the playthrough scripts.

Other bundle notes:
- `town_atlas.png` is 2,158,843 B and is by far the largest download (more than all JS gzipped). See section 3.
- `placeholder_atlas.png` (3.7 kB) is inlined as base64 into `index-*.js` by Vite's 4 kB inline limit. Harmless.
- Production serving: ensure the host sends `Cache-Control: immutable` for `/assets/*` and gzip/brotli for JS and JSON (PNG gains nothing).

## 3. Assets and texture memory (task 2)

Output of `assetReport.mjs`:

| atlas | size | pow2 | frames | packing | GPU memory (w*h*4) | PNG on disk |
|---|---|---|---|---|---|---|
| `town` | 1024x1102 | no | 114 | 83.6% | 4.30 MB | 2,108 KB, 127,472 unique colours |
| `placeholder` | 256x256 | yes | 30 | 48.1% | 0.25 MB | 3.6 KB, 30 colours |

Findings:
1. **NPOT is a non-issue on WebGL2/modern WebGL1 here, do not pad it.** Phaser's pixelArt mode uses NEAREST and no mipmaps, so NPOT textures are legal and cost exactly w*h*4. Padding 1024x1102 to a power of two would be 1024x2048 = 8.0 MB, nearly double. If someone wants a tidy size, repack to at most 1024x1024 (content is 0.94 Mpx of 1.05 Mpx, so it only fits with 1-px padding removed, not recommended) or split the atlas (below).
2. **Load behaviour is already correct.** `src/ui/assets.ts:15-16` (`loadUiAtlases`, called from `UiScene.preload`, `src/ui/UiScene.ts:15`) and `DuelScene.preload` (`src/scenes/DuelScene.ts:200-206`) all guard with `textures.exists(key)`. The game-wide `TextureManager` is shared, so each atlas is fetched, decoded and uploaded once per page, never per duel or per scene. Measured: texture count and estimate stay flat across 3 repeated duels (section 5).
3. **Every scene pays for both atlases.** All eight scenes load `town` + `placeholder` = 4.55 MB GPU on the first scene visited, then 0 extra. The first screen (main menu) needs only 4 town frames (`saloon_front`, `cactus_tall`, `hitching_rail`, `barrel_a`, `src/ui/backdrops.ts:112-122`) but waits on the full 2.1 MB PNG, plus it decodes 4.3 MB of RGBA. That is the biggest startup cost in the project.
   - Recommendation (asset owner A04 + `src/ui/assets.ts` owner): split `town` into `town_ui` (menu street, icons, lanterns, about 15 frames, about 0.3 MB) loaded by every scene, and `town_arena` (duel props/tiles) loaded lazily at the first duel start behind the existing `RunMap` scene or during the menu idle. Expected gain: first-paint download from 2.1 MB to ~0.3 MB, and menu texture memory from 4.55 MB to ~0.6 MB; total resident unchanged once a duel has been played.
4. **Lossless PNG gain: -22.9% (2,158,843 -> 1,664,315 B)** with sharp `compressionLevel: 9, adaptiveFiltering: true`, verified byte-identical on decoded RGBA by `optimizePng.mjs` (output staged in `scripts/perf/out/png/town_atlas.png`; the original in `assets/generated` was NOT overwritten). Apply with `node scripts/perf/optimizePng.mjs --write` after the atlas owner agrees, or better: set those two options in `scripts/processAssets.mjs` where the atlas is written so regeneration keeps the gain. Do not pass `effort` to sharp's `png()`: any value silently enables palette quantisation (a lossy 532 kB result that changes pixels; the script's verifier caught this and rejects it).
   - The placeholder atlas cannot be shrunk byte-exactly (palette mode only differs in the RGB of fully transparent texels, 0 visible pixels; use `--allow-invisible` if you accept that; saving ~1.1 kB, not worth it).
   - Lossless WebP of the town atlas is 1,158 kB (-46%) and visually identical, but transparent-texel RGB differs, so it fails the byte-identical rule. If the project accepts "visually identical" it is the largest remaining download win (Phaser loads WebP fine in all current mobile browsers).
5. All 114 `town` frames are referenced somewhere in `src/` (name match), so there is no dead-frame trimming to do. Frame packing is 83.6%, fine.
6. **Canvas back buffer is only 360x640 (0.88 MB)** and is CSS-scaled by `zoom` (`src/main.ts` `Scale.NONE` + zoom). This is a deliberate big fill-rate win on DPR 2-3 phones; keep it. Do not switch Phaser to a DPR-sized canvas without re-profiling.

Estimated texture memory per scene (resident while the scene is active; atlases are shared so it is not additive across scenes):

| scene | atlases | PixelText canvases | other | total |
|---|---|---|---|---|
| MainMenu | town 4.30 + placeholder 0.25 | 0.07 MB (8) | back buffer 0.88 | ~5.5 MB |
| RunMap | same | 0.11 MB (13) | | ~5.5 MB |
| Duel | same | 0.11 MB | 10 Text canvases (~0.15 MB), 11 anim/fx textures | ~5.7 MB |
| Reward | same | 0.25-0.40 MB (31-34) | | ~5.7 MB |
| whole session after one full loop | | 0.4 MB (34, never freed) | | ~5.9 MB |

That is small in absolute terms (mobile WebGL budgets are hundreds of MB); texture memory is not the risk. The risk is the one-off 2.1 MB download and the decode of the 4.3 MB atlas at boot.

## 4. Runtime profile (task 3)

Run: `profile.mjs` defaults (production build, 4x CPU throttle, 360x640 DPR 2, WEBGL via SwiftShader). Frame times in ms from `requestAnimationFrame` deltas. "dropped" counts frames missed vs 60 Hz (round(dt/16.67)-1). Headline run (`scripts/perf/out/profile.json`, quiet machine):

| segment | frames | avg fps | p50 | p95 | p99 | max | dropped % | long tasks |
|---|---|---|---|---|---|---|---|---|
| menu (idle) | 141 | 32.1 | 33.3 | 50.1 | 83.4 | 116.6 | 46.6 | 1 (62 ms) |
| run map (idle) | 148 | 35.4 | 33.3 | 33.4 | 50.1 | 183.3 | 41.0 | 1 (166 ms) |
| duel (wait to result, real input) | 141 | 56.4 | 16.7 | 33.3 | 33.4 | 33.5 | 6.0 | 0 |
| duel result panel | 78 | 57.1 | 16.7 | 16.7 | 66.7 | 66.7 | 4.9 | 1 (79 ms) |
| reward (idle) | 144 | 33.5 | 33.3 | 50.0 | 66.6 | 100 | 44.2 | 0 |
| reward, card selected | 61 | 30.3 | 33.3 | 50.0 | 50.0 | 50.0 | 49.6 | 0 |
| repeat duel 1 (includes first-duel asset/anim setup) | 121 | 42.7 | 16.7 | 49.9 | 83.3 | 333.3 | 28.8 | 0 |
| repeat duel 2 | 144 | 56.5 | 16.7 | 16.7 | 33.3 | 150 | 5.9 | 0 |
| repeat duel 3 | 150 | 59.2 | 16.7 | 16.8 | 16.8 | 50 | 1.3 | 0 |

Same walk at 1x throttle (`--throttle=1`): menu 49.5 fps (p95 33.4), map 44.6, reward 46.9, duel 60.0 (p95 16.8, 0% dropped), repeat duels 60.0.

**The headline result is the shape, not the absolute value: the duel (the only scene that needs frame precision) is the lightest scene, while the three UI scenes are 2x heavier despite showing almost nothing.** Static screens at 30-35 fps under throttle with a handful of objects (20-24 display objects) means the cost is per-frame redraw work, not object count. The profiler records why:

| scene | display objects | Graphics objects | Graphics draw commands (re-tessellated every frame) |
|---|---|---|---|
| menu | 23 | 4 | 2,676 |
| run map | 24 | 14 | 5,871 |
| reward | 20 | 2 | 4,846 |
| duel | 34 | 6 | 1,792 |

Phaser 3 WebGL replays a `Graphics` object's whole command buffer through its path tessellator every frame, even if nothing changed. The UI is drawn with `rect()`/`drawBitmap()` helpers that emit one `fillRect` per lit bitmap pixel (`src/ui/draw.ts:20-34`, `src/ui/bitmaps.ts:32`), so a few thousand commands are rebuilt 60 times a second for a static picture. A probe (`--gfxprobe`, hides all Graphics in the current UI scene) confirmed it at 1x throttle: menu 49.5 -> 60.0 fps, map 44.6 -> 57.5, reward 46.9 -> 54.0 (the 4x probe run was noisier because other agents were loading the machine, but menu showed 45.6 -> 58.4). Upper bound of the win from baking, minus the cost of the replacement textured quads.

Memory: JS heap after forced GC is 6.8 MB at the start of the repeat loop and 7.0 MB after three more duels (+0.2 MB, within noise). Texture count stabilises at 47-48, display objects at 33-35, tweens 0-1 at rest. DOM stays 11 nodes (canvas-only UI). No page errors. No leak in duel restart was found by measurement.

## 5. Code review findings, ranked by impact (task 4)

Read-only review; no `src/` edits were made. Line numbers are as of this session (other agents are editing; re-grep if drifted).

### HIGH

**H1. UI scenes redraw static `Graphics` every frame (measured, section 4).** `src/ui/draw.ts:20-34` (`rect`, `drawBitmap`: one `fillRect` per pixel), `src/ui/backdrops.ts:10,36,58,67,91,128` (`paintBoardwalk` alone is hundreds of rects: lines 62-81), `src/ui/ParchmentPanel.ts:27-38`, `src/ui/PlankButton.ts:68-83` (3 Graphics per button), `src/ui/WantedPoster.ts:41,55`, `src/ui/CoinCounter.ts:37-39`, `src/ui/StampText.ts:28`, `src/scenes/RewardScene.ts:127-155`.
Change: bake each static Graphics once. Cheapest robust way: after drawing, call `g.generateTexture(key, w, h)` (key from the draw parameters, cached with `textures.exists`) then replace it with `scene.add.image(x, y, key).setOrigin(0)` and `g.destroy()`. Do this inside one helper (`bakeGraphics(scene, w, h, drawFn, key)` in `src/ui/draw.ts`) and call it from `paintBoardwalk`, `ParchmentPanel`, `PlankButton` (up/down/off states become three cached textures per size), `paintHangingSign`, `drawNail`/icons. Keep `Graphics` only for things that actually change per frame (`HeartPips` redraw is event-driven and tiny: leave, or bake the 2 heart bitmaps once).
Expected gain: menu/map/reward back to a flat 60 fps at 1x and about 2x frame time at 4x throttle; this is the single biggest runtime win (measured upper bound 49 -> 60, 45 -> 58 fps). Memory cost: one canvas texture per distinct panel size (a few hundred KB at most; bake only the panel size actually used, not full-screen).

**H2. `DuelScene.updateDodgeHint` calls `setColor()` every frame in the CUE window.** `src/scenes/DuelScene.ts:562-564`. In Phaser 3.80 `Text.setText` and `setFontSize` are guarded against no-op changes, but `TextStyle.setColor` is not: it always calls `parent.updateText()` (canvas clear, re-measure, redraw and a texture re-upload). It runs on every `update()` while the hint is shown, which is exactly the reaction-test window where a frame hitch is felt hardest.
Change: remember the last state in a field (`private hintState: 'stumble' | 'open' | 'idle' | 'hidden'`), and only call `setText/setColor/setFontSize` when it changes. Expected gain: removes 1 canvas re-render + upload per frame during CUE/dodge (about 0.3-1 ms CPU per frame on a throttled mobile core, and a small GC reduction).

**H3. ArenaBuilder stamps one Image per tile and re-draws arena Graphics per frame.** `src/scenes/ArenaBuilder.ts:92-103` (loop creates `rows*cols` Images, each with `setCrop` + `setTint`, e.g. `tile_floor_planks` 3x4 = 12 and wall panels, `src/data/arenas/saloonInterior.ts:23-33`), `:56-84` (`drawItem`: bands, ridges and `speckle` emit up to hundreds of `fillRect`s into a Graphics that Phaser replays every frame), `:117-123` (lights: 6 additive concentric `fillCircle`s per light, `ADD` blend breaks sprite batching and `fillCircle` is tessellated every frame).
Duel profile shows 1,792 Graphics commands per frame for 6 Graphics objects, so this is a large share of the duel's frame cost too (the duel already holds 60 fps at 1x in this environment, so the gain matters on weak devices).
Change: after `buildArena`, bake every static layer (everything except target props that tween, `def.props` with `id`) into one `RenderTexture` (`scene.add.renderTexture(0,0,ARENA_W,ARENA_H)` then `.draw(objs)` then destroy the sources), or per layer-group when parallax is needed (`setScroll` is unused by the static duel: `ArenaHandle.setScroll` comment says so). Pre-bake the light glow once to a small radial texture and use it as an ADD sprite (1 quad instead of 6 tessellated circles). Expected gain: from ~40-60 draw items plus ~1.8k tessellated commands to ~12 items, no per-frame tessellation. The 1-px crop workaround (`:94-99`) disappears when baked once.

### MEDIUM

**M1. `PixelText` creates a new canvas texture per distinct string and never frees it.** `src/ui/PixelText.ts:51` (`textures.createCanvas(key, w, h)` with the whole string in the key, line 49). `setPixelText` (`:87`) is used by animated counters: `src/ui/CoinCounter.ts:83` (8 steps per change), `src/scenes/ResultsScene.ts:138-141` (12 steps per count-up), `RewardScene.ts:197` (detail text per card). Measured: 8-34 canvas textures per scene visit (0.07-0.4 MB), none released. Over a long run with varied coin totals this grows unbounded (each canvas is also a separate GPU texture and breaks sprite batching on every swap). Cost per string is small (a few KB), so this is a slow memory/GPU-texture-count leak rather than a frame-time problem.
Change: (a) track keys created per scene and `textures.remove(key)` on scene `SHUTDOWN` (or keep an LRU of 64 and remove the oldest unreferenced keys); (b) better, render digit/tick strings (CoinCounter, ResultsScene) from a single pre-baked glyph atlas (10 digits + `+ , .`) with `Image`s or a `BitmapText` made from it, so counting animations create zero textures. Expected gain: texture count flat at its current ~47, removes per-step canvas allocation and upload (8-12 uploads during each count-up, which land on the busiest frames of the Results screen).

**M2. `Duel` feedback particles: three objects per particle, no pooling.** `src/systems/FeelSystem.ts:775-796`: each particle = `add.rectangle` + `tweens.addCounter` + closures, destroyed on completion. Budgets are capped (`caps.maxParticlesPerBurst`, `particleBudget`), so the steady state is bounded, but a burst allocates 2n objects plus closures and a tween per particle in a single frame, and the destroy storm 0.4 s later generates GC. Same pattern in `reactionPop` (`:802-840`, nested tweens, one `Text` canvas per pop created via `add.text` at `:808`), `spawnMuzzle` (`:722-740`), the flash ring (`:747`), `Projectile` (`src/entities/Projectile.ts:19-26`: new sprite + tween per shot), `DuelScene.playTargetEffect` (`:493` creates 7 rectangles + 7 tweens per barrel burst, `:826-828` a circle per flash).
Change: pool these. A small `Pool<T>` (array stack with `acquire()`/`release()`; particles as `Rectangle` with `setActive/setVisible`) shared by `FeelSystem`, `Projectile` and DuelScene effects; drive all particles from one `update` loop (positions integrated from `deltaMs`) instead of one tween each. Expected gain: removes allocation and GC spikes at impact (p99 frame time) and replaces N tweens by one loop. Matters most on low-end Android where a minor GC costs 5-15 ms. Reaction-pop `Text` can be created once and re-used by `setText` (it is only 3-4 distinct strings: `reactionPop` texts are enumerated in `data/feel.ts`).

**M3. Static scene text uses canvas `Text` objects (10 in the duel).** `src/scenes/DuelScene.ts:244-260` etc. Each Phaser `Text` owns a canvas texture; `setText` on `readout`/`causeText` re-renders it with stroke (stroke text is the most expensive path in canvas 2D). They only change on phase changes, so cost is small, but the 120 px stroked `cueText` ("!") allocates a large canvas at scene start. Prefer the PixelText path or pre-render once. Low gain, easy: skip `setText('')` when already empty (`:437-444` call 6 `setText/setColor` on every `enterWaitVisuals`, which `setColor` re-renders each time, cheap but redundant).

**M4. Per-frame allocation in `DuelScene.update`.** `src/scenes/DuelScene.ts:893-911`: `system.snapshot()` (`src/systems/DuelSystem.ts:421`) builds a fresh object (and nested `dodge`, reticle) each frame, then `reticleGfx.clear()` + 5 draw calls every frame, `glowGfx.clear()` every frame even when the perk is off (`:882`). Pointer move handlers (`:722-780`) call `system.snapshot()` again per event.
Change: skip `reticleGfx.clear()` and `glowGfx.clear()` when nothing was drawn last frame (track a `drewReticle` flag); draw the reticle as a pre-baked ring+cross `Image` that is moved (and a mask/arc only when `aimRemainingMs` is shown); give `DuelSystem` a `peek()`/`currentPhase` getters for the handlers instead of full snapshots. Expected gain: a few small objects per frame saved, mainly GC pressure; measurable only on weak CPUs.

**M5. `FeelSystem` scheduler allocates two arrays per tick while anything is pending.** `src/systems/FeelSystem.ts:299-300` (`filter` twice). Change: single in-place partition loop (swap-remove), zero allocations. Expected gain: small (only runs while delayed effects are queued), trivial to fix.

### LOW / hygiene

**L1. Scene shutdown and restart.** `DuelScene.teardown` (`:350-362`) removes input listeners, forwarders, boss listeners, the visibility listener and the arena; `FeelSystem` detaches on `shutdown`/`destroy` and destroys all tracked tweens, particles and transient objects (`FeelSystem.ts:400-446`); `UiScene` has no state leak. Measured: no growth in textures, objects, tweens or heap across 3 restarts. Remaining nits: (a) `window.__duel` (`DuelScene.ts:271`) keeps the whole scene reachable after shutdown; clear it in `teardown` when `window.__duel?.scene === this`. (b) `this.load.on('loaderror', ...)` in `preload` (`:208`) is added on every restart; use `once` or check once. (c) `input.off('pointerdown')` without a handler (`:353-356`) removes all listeners for those events on the scene input; fine today but would remove a future listener from another system, prefer storing the handler references.

**L2. Timers.** The only `setInterval` is `AudioManager.musicTimer` (`src/core/AudioManager.ts:400`, 100 ms scheduler, cleared in `stopMusicTimer` `:405`). It keeps ticking while the tab is hidden unless the AudioContext suspends; make sure `visibilitychange` stops the timer (browsers throttle it to 1 Hz in the background but it still burns wake-ups). Game timers use `scene.time` / tweens, which die with the scene. No bare `setTimeout`s found.

**L3. `PixelText` bitmap font path cost.** The font itself is cheap: `measureText` and `litPixels` run once per distinct string and the result is cached as a texture; per-frame cost is one textured quad. Cost is at creation: `litPixels` allocates an array of `[x,y]` tuples for every lit pixel and the canvas gets one `fillRect` per lit pixel per layer (shadow + outline = up to 6 passes: `src/ui/PixelText.ts:55-66`). For a 20-char string at scale 2 that is roughly 1,000 `fillRect`s, hundreds of microseconds on desktop, a few ms on a throttled phone. Fine for static labels; it is the reason M1(b) (glyph atlas) is preferable to caching strings for counters. Also `[...line]` is used for width (`pixelFont.ts:103`) and wrap (`:116-125`): allocation per call, ignore unless profiling shows it.

**L4. `ArenaBuilder` crop workaround.** (`:92-99`) Every stamped tile is a separate cropped Image (the 1-px halo workaround for A04's tiles). Static at runtime, but it multiplies display objects; disappears with H3, and fully with normalised tiles (DECISIONS D9).

**L5. Config knobs not set.** `src/main.ts` creates `new Phaser.Game({...})` with only `pixelArt: true`. Consider `render: { powerPreference: 'low-power', antialias: false, batchSize: 4096 }`, `fps: { target: 60, smoothStep: true }` and `disableContextMenu: true`. Expected gain: negligible CPU, helps battery on dual-GPU devices.

## 6. Mobile thermal and frame-rate policy

- Today the game runs uncapped at the display refresh (60 Hz; 90/120 Hz phones will render at 90/120 because Phaser follows `requestAnimationFrame`). That is wasteful: the pixel-art duel has no motion that benefits from more than 60 fps and sustained 120 Hz heats the SoC and triggers thermal throttling within minutes. Recommended: `fps: { target: 60, limit: 60 }` (Phaser `fps.limit` skips frames above 60). Owner: `src/main.ts`.
- 30 fps fallback: duel timing is wall-clock (`FrameClock`, `nowMs()` from `performance.now`, not frame-count), so dropping the render rate does not change the hit windows or the reaction time measured; input is stamped with the DOM event timestamp (`eventMs`). A 30 fps render only reduces visual smoothness (up to 33 ms later visual feedback, so it should apply to UI scenes and idle only). Suggested policy: adaptive cap, starting at 60; if the rolling p95 frame time over 3 s exceeds 24 ms in a UI scene or over 20 ms in a duel, drop UI scenes to 30 fps (never the duel's input handling) and show nothing to the player; return to 60 after 10 s of p95 < 14 ms. A settings toggle ("Battery saver: 30 FPS UI") gives the player control.
- Low-power mode idea (cheap, mostly UI): after H1 (baked UI) the menu/map/reward are nearly free, so low-power mode can pause the render loop on static screens (`game.loop.sleep()`, wake on pointer or tween) and keep a 30 fps cap elsewhere; reduce `FeelSystem` particle caps (`caps.maxParticlesPerBurst`) by half and skip the additive light glows; honour `prefers-reduced-motion` and the existing reducedShake setting; pause everything on `visibilitychange` (the duel already pauses its clock, `DuelScene.ts:290-305`).
- The 360x640 back buffer is the biggest thermal protection already in place (about 230 k pixels per frame instead of ~920 k at DPR 2). Keep the logical resolution; if a sharper look is ever wanted, make it an opt-in "High quality" setting, off by default.
- Audio: the procedural music scheduler wakes every 100 ms; it is cheap, but make sure it is stopped when music volume is 0 or the tab is hidden.

## 7. Regression budget (QA / Release)

Check these before release (numbers from this session; "at 4x throttle" figures are only comparable on the same class of machine, so QA should run `profile.mjs` before and after a change and compare, and treat the absolute 4x values as a guide).

| metric | budget | current | how to check |
|---|---|---|---|
| `phaser-*.js` gzip | <= 345 kB (change only with a Phaser upgrade) | 339.7 kB | `npm run build` output |
| game chunk `index-*.js` gzip | <= 110 kB | 94.9 kB | `npm run build` |
| total JS gzip | <= 460 kB | ~435 kB | `npm run build` |
| build warnings | none | none | `npm run build` |
| sourcemaps in `dist/` | 0 files | 0 | `ls dist/assets/*.map` |
| `town_atlas.png` | <= 1.7 MB after lossless pass (today 2.16 MB) | 2.16 MB | `node scripts/perf/optimizePng.mjs` |
| first-scene download (HTML+JS+atlases, gzip) | <= 1.0 MB once atlas split (today ~2.6 MB) | ~2.6 MB | network panel / `du dist` |
| texture memory estimate | <= 8 MB total, <= 6 MB menu | ~5.9 MB | `node scripts/perf/assetReport.mjs` + `profile.mjs` stats |
| PixelText canvas textures after a 3-duel loop | <= 64, and not growing across loops | 34 | `profile.mjs` leak table |
| duel frame time p95 | <= 20 ms at 1x, <= 33.4 ms at 4x throttle | 16.8 / 33.3 | `profile.mjs [--throttle=1]` |
| duel frame time p99 | <= 33.4 ms at 1x, <= 50 ms at 4x | 16.8 / 33.4 | same |
| duel dropped-frame % | <= 2% at 1x, <= 10% at 4x | 0% / 6.0% | same |
| UI scenes (menu/map/reward) p95 | <= 20 ms at 1x, <= 33.4 ms at 4x | 33.4-50 / 50 (fails; fix H1) | same |
| long tasks during a duel | 0 over 50 ms | 0 (1 on result panel, 79 ms) | same |
| JS heap after GC, after 3 repeat duels | <= 12 MB and <= +1 MB vs loop 0 | 7.0 MB, +0.2 MB | `profile.mjs` leak table |
| display objects at rest (duel) | <= 60 | 34 | `profile.mjs` stats |
| Graphics draw commands per frame (UI scene) | <= 500 after H1 (today 2.7-5.9 k) | 2,676 / 5,871 / 4,846 | `profile.mjs` stats (`gfxCmds`) |
| page errors during profile | 0 | 0 | `profile.mjs` |

## 8. Prioritised recommendations (owners)

1. H1 bake static UI Graphics to textures (`src/ui/draw.ts` + callers; owner: UI). Biggest measured win, UI scenes 2x cheaper.
2. Split `town` atlas into `town_ui` (eager) + `town_arena` (lazy) and apply lossless PNG recompression in `scripts/processAssets.mjs` (owner: assets A04, `src/ui/assets.ts`). Startup download 2.1 MB -> ~0.3 MB for first paint.
3. H2 cache dodge-hint state in `DuelScene.updateDodgeHint` (owner: DuelScene). Trivial, removes a per-frame canvas upload in the CUE window.
4. H3 bake the static arena into one RenderTexture and pre-bake the light glow (owner: `ArenaBuilder.ts`).
5. M1 PixelText: free textures on shutdown or use a glyph atlas for digits (owner: `src/ui/PixelText.ts`).
6. M2 pool particles/popups/projectiles and drive particles from one update loop (owner: `FeelSystem.ts`, `Projectile.ts`).
7. Frame cap `fps.limit: 60`, optional 30 fps UI saver, `render.powerPreference` (owner: `src/main.ts`).
8. Custom Phaser build without physics/tilemaps/video (owner: `src/main.ts`), about -80 to -120 kB gzip, to be verified.
9. L1 nits: clear `window.__duel` on teardown, `load.once`, keep input handler references.
10. Add `scripts/perf/out/` to `.gitignore` (profile JSON and staged PNGs are generated artifacts and were swept into an earlier WIP commit by another agent; this doc and `scripts/perf/profile.mjs` carry the method, not the outputs).
11. Real-device pass: run the walk-through on one mid-range Android and one older iPhone with remote DevTools (Performance panel, 60 s), record p95 frame time and heat after 10 minutes, and replace the relative numbers here with device numbers.
