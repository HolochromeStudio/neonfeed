# TRAFFIC JAM — Merge · Defend · Survive

A complete portrait mobile game (Godot 4.3, GDScript): **randomized merge + tower defense + roguelite + deck builder**,
drawn end-to-end as retro pixel art (top-down intersection battlefield).

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
| Customization | Modular pixel doll (skin/hair/hat/glasses/extras/top/bottom/shoes), 48 cosmetics, unlocked by level / shop / achievements |
| Story | Intro (4 animated panels), 9 chapter cutscenes + dialogue (cast of 10 with mood-driven animation), boss intros, outros |
| Polish | Pixel UI (button press/overshoot, popup unfold, stamps, card flips), animated vehicles (spawn drive-in, brake, idle rumble, recoil, merge pop…), VFX, procedural audio + haptic hooks |
| Dev | Dev menu (backtick / `--dev`), FPS counter, god mode, unlock-all, content validator, headless tests, balance harness |

## Controls

* **DEPLOY** — spawns a random deck vehicle into a random empty slot.
* **Drag** one vehicle onto another of the same unit & rank to **merge** (result = random deck unit, rank+1). Drag onto another vehicle/empty slot to swap/move.
* **Tap** a vehicle for stats/sell; tap the deck cards to inspect.
* **NEXT»** calls the next wave early for bonus SP; **x1/x2/x3** speed; **BUILD** lists synergies/upgrades/relics.

## Art pipeline (`tools/pix/`)

All art is drawn **in code** (no scans, no AI images) at native low resolution and nearest-upscaled x4, so one art pixel = 4 screen
pixels on the 1080x1920 canvas:

```
pip install pillow numpy
python3 tools/build_atlas.py   # draws everything and packs assets/runtime/atlas_*.png + atlas.json + tex/*.png
```

| Module | Draws |
|---|---|
| `vehicles.py`, `vkit.py` | 60 top-down player vehicles, 10 enemy vehicles, 6 bosses (rotated for lane direction) |
| `arena.py` | the baked top-down battlefields (9 biomes x 2 layouts) with road, crosswalks, lots, sidewalks and decor |
| `ui_px.py`, `icons_px.py`, `text_px.py` | panels, buttons, bars, cards, ribbons, icons, status badges, digits and sticker labels |
| `chars_px.py` | tintable modular doll parts, cosmetics, NPCs, animals, avatar presets |
| `scenes_px.py`, `props_px.py` | logo, mode cards, map nodes, biome panoramas, story panels, props, ground tiles, menu backgrounds |
| `fx_px.py` | glow, rings, smoke, explosions, debris |

`arena.py` replicates the road geometry of `BattleSim._build_path`; `tests/unit_test.tscn` checks they stay in sync.

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
* Fonts: Silkscreen, Pixelify Sans, VT323 (SIL OFL, see `assets/fonts/LICENSE.txt`).
