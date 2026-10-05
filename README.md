# BUGBYTE

A GBA-style creature-collecting RPG for mobile, built with **TypeScript + Phaser 3 + Vite**.
The world's underlying reality behaves like software ("the Signal"). Living glitches called **Bytekin** appear when damaged
pieces of reality try to repair themselves. You are one of the first people able to bond with them.

> This repository currently contains the **Vertical Slice (v0.1)** plus **Chapter 2 (v0.2)**: title -> character creation -> Rivermoor -> Old Signal Relay ->
> Route 01 -> Briarfield -> Signal Node 1 -> **ROOT KEY 01** + **PULSE**, plus Clean State's arrival (Director Voss);
> then Route 02 -> Whisperwood (day/night path changes) -> Bellwether -> Signal Node 2 (numbers station, keypad, transmitter tuning, Sona) -> **ROOT KEY 02** + **FREQUENCY**, the radio shed, and 49 Bytekin.
> Every system in the slice is fully playable and tested. The rest of the campaign (Nodes 2-8, Root, postgame) is data-driven and
> described in `docs/ROADMAP.md`; the engine already supports everything it needs.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (use your browser's mobile emulation, landscape)
npm run build        # production build to dist/
npm test             # engine, content-validation and balance-simulation tests
npm run sim          # verbose bot-vs-bot balance report (starters, roster, Node 1 boss, CONTAIN odds)
```

Controls (keyboard): **Arrows/WASD** move - **Z/Enter/Space** A - **X/Esc/Backspace** B - **C/Tab/M** menu - **Shift** run - **F1** debug overlay.
Touch: on-screen D-pad, A, B, MENU and RUN-toggle (outside the 3:2 gameplay frame; opacity/side configurable in OPTIONS).
Gamepads work through the browser Gamepad API (Phaser). Debug API in the console: `bb.warp('briarfield',15,2)`, `bb.give('patch_kit',5)`,
`bb.mon('voidlynx',20)`, `bb.keys(3)`, `bb.flag('node_1_complete')`, `bb.time(22)`, `bb.battle('glitchling',6)` ...

## Mobile (Capacitor)

`capacitor.config.json` is included. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, then
`npx cap add ios && npx cap add android && npm run cap:sync`. Audio unlocks on first touch; saves use `localStorage`
(versioned schema + migrations in `src/core/state.ts`).

## Architecture

```
src/
  data/            all content as JSON - edit without touching code
    bytekin.json moves.json abilities.json statusEffects.json types.json items.json shops.json
    encounters.json trainers.json bosses.json quests.json worldmap.json stamps.json
    maps/*.json    tile-op maps (fill/rows/stamp/scatter/patch/speckle, flag-conditional ops)
    scripts/*.json cutscene + NPC scripts (say/ask/if/move/battle/give/quest/warp/... see WorldScene.exec)
  battle/          pure, deterministic engine (engine.ts), AI (ai.ts), CONTAIN (contain.ts), type rules (rules.ts)
  core/            mon.ts (stats/exp/evolution), state.ts (flags, quests, bag, saves+migrations), input.ts
  gfx/             procedural pixel art: tiles, characters, creatures (64x64 generator + auto outline/shading/glitch), font, windows
  audio/           WebAudio chiptune sequencer, SFX and per-species cries (tracks are data in tracks.ts)
  scenes/          Boot, Title, Char (opening + creator), World (overworld+scripts), Battle, Credits
  ui/              windows/dialogue, party+summary+Byte Vault, bag+shop, ByteDex, quest log, map, options/saves, evolution
tests/             vitest: battle rules, content validation (maps connect, scripts resolve), bot simulations
tools/             headless Chromium playtest bot (browser.mjs, bot.mjs)
```

All art is original and generated at boot from code: tiles, characters, 180-ready creature generator, UI, backgrounds.
All music/SFX are original WebAudio synthesis. Nothing is ripped or copied.

## Systems in the slice

- **Overworld**: tile movement/collision, ledges, doors, day/night tint, rain, animated tiles, NPC wander/look, trainer line-of-sight,
  hidden scan points (FIELD SCAN), item balls, signs, terminals (save / Byte Vault / rest), flag-driven world reactivity (Rivermoor corrupts after the relay).
- **Puzzles**: Old Signal Tower symbol routing (TRIANGLE, CIRCLE, SQUARE), Node 1 irrigation valves (a small GF(2) logic puzzle with in-world hints),
  PULSE-gated barn vault.
- **Battle**: turns, 12-type chart, 8 status conditions, abilities, stat stages, priority, multi-hit, drain/recoil, fields, EXP/level-ups/move learning,
  evolution (level, item, **low-stability alternate**), AI archetypes (random/basic/smart), difficulty (Casual/Standard/Expert), boss rules (**CACHE LINK**).
- **CONTAIN**: stability meter + HP + status + rarity + Debugger level; scan lines -> pixel fragmentation -> stream into the Debugger -> shakes -> flash.
  Stability behaviours: frenzy / calm / flee / regen. Contain Modules, Stability Clamps.
- **Meta**: 3 save slots + autosave, Byte Vault (sort/filter/favorites), ByteDex (silhouettes), quest log (Main/Side/Research/Done), region map with quest markers,
  Debugger card, options (text/game speed, difficulty, encounter mode Classic/Visible/Hybrid, volumes, scanlines, pad opacity/side...).

## Quality gates

`npm test` runs: type-chart/damage/EXP/evolution/contain unit tests; static content validation over every map and script
(warps land on walkable tiles, every warp is reachable, NPCs not on solid tiles, scripts/items/species/quests resolve, quest flags are set somewhere);
and thousands of bot-vs-bot simulated battles asserting starter balance, roster outliers, boss beatability and CONTAIN odds.
`tools/bot.mjs` drives the real game in headless Chromium with keyboard input for end-to-end playthrough checks.
