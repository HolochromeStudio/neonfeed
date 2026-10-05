# TRAFFIC JAM — Merge · Defend · Survive

A complete portrait mobile game (Godot 4.3, GDScript): **randomized merge + tower defense + roguelite + deck builder**,
built end-to-end from the supplied cut-paper TRAFFIC JAM master sheet.

> Small cars. Big chaos. Deploy random vehicles from your deck, merge matching ranks (the result is *any* deck vehicle),
> pick run-defining upgrades, build synergies, beat elites and bosses, and keep the Jam out of the city.

## Run it

1. Install **Godot 4.3+** (standard build, GL Compatibility renderer — works on iOS/Android).
2. `godot --path . ` (or open `project.godot` in the editor and press ▶).  Main scene: `res://scenes/main.tscn`.
3. A brand new player gets: boot → title → animated opening → player creation → interactive tutorial → home. Nothing else is required.

Export presets for Android (arm64) and iOS are in `export_presets.cfg` (portrait, 1080×1920 reference, `canvas_items` stretch, safe-area aware).

## What is in the game

| Area | Content |
|---|---|
| Core loop | Deck (5) → DEPLOY random vehicle (SP cost rises) → drag-merge equal rank → risk the board → upgrades/relics → elite → boss |
| Vehicles | **60** fully functional units (10 per rarity: Common → Mythic), each with role(s), tags, traits/ability, targeting, scaling, flavour text, audio def |
| Rarity | Rarity ≠ power: commons carry builds (aura/economy/ramping units), rarer units are more specialised |
| Run upgrades | **138** (16 categories incl. Rule Changers: NO PARKING, BUMPER TO BUMPER, GRIDLOCK, EMERGENCY LANE, RUSH HOUR, CARPOOL, GREEN WAVE, OVERTIME, ONE WAY, PARKING BAN, CHAOS THEORY…), offered 3 at a time with context-aware weighting (deck, tags, board, synergies, HP, boss proximity, mode, chapter) |
| Relics | **50** run relics (elites/bosses) |
| Synergies | 19 tag-driven synergies with tiers (TAXI RANK → RUSH SERVICE, FIRST RESPONDERS, PUBLIC TRANSPORT, ROAD CREW, OLD SCHOOL, ELECTRIC GRID …) |
| Status system | 14 statuses with interactions (WET+SHOCK chain, OIL+BURN, MARKED+POLICE …) |
| Enemies / bosses | 10 traffic types + elites, 6 bosses with unique mechanics (stomp-stun, bombs, silence shells, burrow, abduct, 3-phase mecha) |
| Modes | Story campaign (9 chapters / biomes × 6 levels, boss each chapter), Survival (endless, boss every 10 waves), **PvP** (offline simulated rival, same-seed waves, "send" pressure), **Co-op** (offline simulated partner on a shared 6-row board), interactive Tutorial |
| Meta | Collection, 3 decks, unit levels (cards + coins), Shop (packs/boosters, in-game currency only), daily reward, daily/weekly quests, 44 achievements, local leaderboards, profile & statistics, Codex |
| Customization | Modular paper-doll (skin/hair/hat/glasses/extras/top/bottom/shoes), 48 cosmetics, unlocked by level / shop / achievements |
| Story | Intro (4 animated panels), 9 chapter cutscenes + dialogue (cast of 10 with mood-driven animation), boss intros, outros |
| Polish | Paper UI (button press/overshoot, popup unfold, stamps, card flips), animated vehicles (spawn drive-in, brake, idle rumble, wheel spin, recoil, merge pop…), VFX, procedural audio + haptic hooks |
| Dev | Dev menu (backtick / `--dev`), FPS counter, god mode, unlock-all, content validator, headless tests, balance harness |

## Controls

* **DEPLOY** — spawns a random deck vehicle into a random empty slot.
* **Drag** one vehicle onto another of the same unit & rank to **merge** (result = random deck unit, rank+1). Drag onto another vehicle/empty slot to swap/move.
* **Tap** a vehicle for stats/sell; tap the deck cards to inspect.
* **NEXT»** calls the next wave early for bonus SP; **x1/x2/x3** speed; **BUILD** lists synergies/upgrades/relics.

## Art pipeline (`tools/`)

The supplied sheet (`assets/source/reference/traffic_jam_master_sheet.webp`) is the *only* art source. Everything is reproducible:

```
pip install pillow numpy scipy opencv-python-headless
python3 tools/extract_assets.py   # sheet -> clean transparent PNGs in assets/source/<category>/ (semantic names)
python3 tools/make_units.py       # 60 vehicle arts = sheet sprites (recoloured/stretched variants, see tools/roster_art.py)
python3 tools/make_ui.py          # procedural cut-paper UI kit, status icons, scraps, houses/pines, wheel overlay
python3 tools/make_doll.py        # modular paper-doll parts (tintable) + faces
python3 tools/wheels.py           # per-vehicle wheel positions (template matching) -> assets/runtime/wheels.json
python3 tools/build_atlas.py      # runtime atlases (assets/runtime/atlas_*.png + atlas.json) + seamless ground textures
```

Notes on fidelity (honest limits): the master sheet is 1536×1024, so individual sprites are ~40–60 px. They are segmented
(flood/threshold + hole fill + feather), kept as native source PNGs, and only upscaled 2× with a light unsharp pass at atlas
build time. Scenes that cannot hold up to scaling (biome pictures, cutscene panels) get a bilateral "repaint" instead of blur.
Items that were too small/damaged to reuse (UI panels/buttons, speech bubbles, map backdrop, houses, doll parts, wheels,
status icons, paper scraps, grain/halftone) were **reconstructed** in the sheet's palette and style rather than cropped.

## Architecture (`scripts/`)

```
core/    atlas · save (atomic JSON + .bak) · audio (procedural SFX/music) · game (router, run lifecycle, rewards) · dev
data/    units · enemies · upgrades · relics · synergies · meta (chapters/quests/achievements/cosmetics) · story
sim/     battle_sim.gd  – deterministic, node-free simulation (events out, apply_action in)   bot_ai.gd
battle/  battle_view · unit_node · enemy_node · pvp_mini      (renders sim events; no gameplay logic)
modes/   match_transport (loopback/websocket) · bot_peers (offline rival/partner) · pvp_match · coop_match
ui/      ui toolkit · paper_button · paper_popup · dialogue_box · doll · road_scene · prerun
screens/ boot title intro create home modes map units customize quests shop inventory leaderboard settings profile codex cutscene battle results
```

Multiplayer architecture: PvP and Co-op talk to a `MatchTransport` using small JSON messages (`hello/state/send/emote/input/end`).
Offline play plugs in `BotPeers.Rival` / `BotPeers.Partner`; a real server only needs to implement the same transport
(`MatchTransport.WebSocket` is included). `tests/net_test.gd` proves the protocol over a JSON loopback (PvP pressure/state and
co-op lockstep inputs).

## Tests / QA

```
godot --headless --path . res://tests/validate.tscn                 # content validator (art, tags, traits, unlock paths, story, …)
godot --headless --path . res://tests/stress.tscn                   # every unit/upgrade/relic/boss through the simulator
godot --headless --path . res://tests/net_test.tscn                 # multiplayer message layer
godot --headless --path . res://tests/flow_test.tscn -- --save=t.json --fresh   # new player → tutorial → campaign → save/load
tools/balance.sh "1 1" "4 3" "9 6"                                   # headless balance sweep (win rate per level)
tools/smoke.sh                                                       # every screen under Xvfb, fails on SCRIPT ERROR
tools/shot.sh out.png 120 --goto=battle --args=bot:1,speed:4         # screenshots / automation
```

## Known limits

* Online PvP/Co-op needs a relay server (the client side/protocol is implemented and tested; offline simulation is the shipped experience).
* No store SDKs/IAP — the shop only uses earned in-game currency.
* Procedural audio is synthesised at boot (~2 s); replace with authored stems via `Audio.sfx/music` hooks when available.
* Fonts: Lilita One, Patrick Hand, Bangers (SIL OFL, see `assets/fonts/LICENSE.txt`).
