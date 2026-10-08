# Asset Brief (for an image generator such as ChatGPT)

Owner: Lead. Purpose: explain the game completely so every missing asset can be generated in the right style, size and layout. Paste section 3 into the image tool; sections 1 and 2 are context. Companion docs: `docs/GAME_DESIGN.md`, `docs/ASSETS.md`, `docs/MISSING_ASSETS.md`.

## 1. What the game is

**Dust & Draw** (working title) is a one-thumb, portrait (360x640 logical px) western duel roguelite for phones. A run is a chain of short duels on a branching map; between duels you pick perks, shop and rest. When you die you start over. After a run you bank coins into a saloon account that unlocks options.

### One duel (about three seconds)
1. **WAIT**: standoff. The player holds a thumb on the holster zone. Lifting early is a *flinch* (+300 ms penalty).
2. **CUE**: the enemy shows a *tell* (a readable sign: hand to holster, eye flash, hat tip, lens glint, bell toll...). A big "!" appears.
3. **DRAW**: the player flicks the thumb up as fast as possible. Under 220 ms is a PERFECT draw.
4. **AIM**: time slows. The player drags a crosshair over the enemy (head, body, gun arm, or an enemy-specific weak point).
5. **BANG**: releasing fires. The enemy fires on its own timeline. The screen shows `YOU 214 ms` vs `ENEMY 380 ms`.
6. **Dodge** (optional): a horizontal flick just before an enemy shot makes that one shot miss.
The hero has 2 lives. Elites and bosses cost 2 lives per hit.

### A run
Branching map, 7 nodes per region, ending in a boss. Node types: duel, elite (skull marker), shop, event (text card with 2-3 choices), rest (saloon), treasure, boss. One currency: coins. 57 perks that change rules (no plain stat boosts). Regions: Dust Creek, Canyon, Railroad (first release); Saloon Interior, Goldspire, Widow's Peak, Blackwater Bay (later).

### Screens that use art
Main menu, run map, duel (hero left, enemy right, arena behind), reward (3 perk cards), shop, event/notice boards, results (death or victory, with a wanted poster of the defeated enemy), settings.

### Enemies and bosses (all human, Western)
Rookie, Bandit, Gunslinger, Coward, Drunk, Sheriff, Dual Wielder (two guns), Sniper (rifle, long glint), Knife Thrower, Train Guard, Horse Rider (on a horse), Elite Bounty Hunter. Bosses: Mad Dog McGraw (Dust Creek), The Undertaker (Canyon: coffin and dynamite), Lady Luck (Saloon: cards, dice, roulette), El Diablo (Blackwater Bay: fog, mirror image). NPCs for the saloon: Prospector, Bartender, Townsfolk Woman.

## 2. Art status

| Status | Content |
|---|---|
| Have, in use | Town + saloon interior sheet (buildings, props, interior tiles, signs); sliced into 114 sprites |
| Have (shown in chat), NOT yet committed as files | Characters sheet (Bandit, Gunslinger, Sheriff, Dual Wielder, Sniper, Knife Thrower, Prospector, Bartender, Townsfolk Woman, Train Guard, Boss Outlaw, Horse Rider; 5-6 frames each) and Desert sheet (terrain, cliffs, rocks, cacti, bones, signs, fences, rails, mine entrances). Put both in `assets/source/` as `characters_sheet.*` and `desert_sheet.*` |
| Missing (needed) | **The hero**; Rookie, Coward, Drunk, Elite Bounty Hunter; bosses The Undertaker, Lady Luck, El Diablo (and Mad Dog McGraw if "Boss Outlaw" is not him); FX; sky/mountain/ground backgrounds; Canyon and Railroad arenas |
| Missing (optional) | UI kit, 57 perk icons, wanted-poster portraits, later-region arenas |

Right now the hero, FX and UI are placeholders with a magenta corner pixel. They are replaced under the same frame names when real art arrives.

## 3. Prompt brief (paste into the image generator)

**Style bible.** Create western pixel-art sprite sheets in the exact style of the reference sheets attached. Chunky pixels (the same pixel size across all sheets), dark-brown 1-px outlines (never pure black), no anti-aliasing, no blur, no gradients, no dithering, no soft shadows. Limited palette: warm browns, tan/cream, denim blue, brick red, brass gold, olive green. Light from the top-left. Cozy, readable, slightly weathered.

**Sheet layout rules (a script slices the sheet automatically, so follow these).**
- One flat, solid cream background identical to the reference sheets: no texture, no shadow, no vignette.
- Every sprite separated from its neighbours by at least 20 px of background. Nothing touches or overlaps.
- Short uppercase section labels are allowed in the top-left of a section, never over a sprite.
- In a character row, frames run left to right in the order given below, with feet on one shared baseline.
- Same scale for every character (head-to-toe height equal to the characters on the reference sheet).
- All characters face RIGHT (the game mirrors enemies).
- Output as large as possible, PNG.

**Sheet 1: Hero (the player).** A gunslinger who looks clearly different from every enemy: white hat, blue vest, gold neckerchief. One row, 10 frames in this order: idle, idle2, draw1, draw2 (hand sweeping to the gun), aim, shoot1, shoot2 (recoil), hit (flinch), dead (lying down), dodge (side-step lean).

**Sheet 2: Missing enemies.** One row of 7 frames each, in order: idle, idle2, tell (the pose that signals he is about to draw), aim, shoot, hit, dead. Characters: Rookie (nervous kid, oversized hat), Coward (twitchy, hunched, sweating), Drunk (swaying, bottle in hand), Elite Bounty Hunter (long coat, wanted posters on the belt, gold trim).

**Sheet 3: Bosses.** Same 7-frame order, larger and more detailed than normal enemies, plus one extra "phase change" pose each. The Undertaker (black suit, coffin, dynamite), Lady Luck (gambler in red, playing cards), El Diablo (dark figure in fog, red eyes). If Mad Dog McGraw is missing: a wild, rabid-looking outlaw with a dog-skin cape.

**Sheet 4: FX.** Muzzle flash (3 frames), bullet, hit spark (3 frames), dust puff (3 frames), death puff (3 frames), an exclamation mark "!" (red, chunky), an aiming crosshair. Pointing right.

**Sheet 5: Arena backgrounds.** Wide strips without characters. Dust Creek: day sky, mesa/mountain silhouettes (two parallax layers), dusty ground. Canyon: red cliffs, ledges, a mine entrance. Railroad: boxcars, track, water tower. Keep the central lane empty so a character reads clearly against it.

**Sheet 6 (optional): UI.** Wooden plank buttons (normal and pressed), parchment panel, brass hearts (full and empty), a coin, perk icons 32x32.

## 4. Notes for whoever integrates

- Pipeline: drop sheets into `assets/source/`, add an entry in `assets/source/sheets.json`, run `npm run assets`. It removes the background by flood fill from the border, finds sprites as connected components, keeps original pixels, and builds a Phaser atlas.
- AI-generated art is rarely pixel-exact and frames may drift between poses. The pipeline can align feet and anchors but cannot repaint. Ask for one character row at a time and reuse the same reference.
- Real frame keys map onto the existing placeholder keys: `hero_*`, `enemy_*`, `muzzle_flash_*`, `bullet`, `impact_spark_*`, `dust_puff_*`, `ui_exclaim`, `ui_crosshair` (see `docs/MISSING_ASSETS.md`).
- Row order and frame counts on the characters sheet are assumptions until the real file is sliced; the pipeline warns when counts differ.
- Do not rename existing town sprites until the characters/desert pass (decision D10).
