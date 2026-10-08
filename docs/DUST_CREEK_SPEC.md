# DUST CREEK: THE LAST DRAW — source-of-truth spec

Owner: Lead (A01). This condenses the user's master prompt (the original message was cut off after section 21 "Game feel", so sections about the rest of audio polish, tests, performance and deliverables were NOT received; see "Assumptions"). Decision log: `docs/DECISIONS.md` D22+. Contract types: `src/dc/contracts.ts`. The previous game ("Dust & Draw", swipe-based) stays in `src/` untouched until this one is playable; the new game lives in `src/dc/**`.

## 0. Non-negotiables from the user
- Complete, playable, polished western pixel-art game for browser, mobile-first, portrait, design resolution **390 x 844**, responsive scaling, **no stretched pixels**.
- Use the supplied pack (`public/assets/`, registry `src/data/packAssets.ts`, `packUrl()`). **Never invent asset paths.** Never silently replace supplied art with emojis/CSS drawings. Where assets are missing, create new ones in the same pixel style and label them. The pack is simplified placeholder art (docs/ASSET_PACK_AUDIT.md): identify that honestly in reports.
- Stack: TypeScript, Phaser 3, Vite, Canvas, Web Audio, LocalStorage. Optional React/Zustand/Howler only with a clear benefit (default: not used).
- Pixel rules: `pixelArt: true`, `roundPixels: true`, nearest-neighbour, `image-rendering: pixelated`, integer positions where blur would result.
- Browsers: iPhone Safari, Android Chrome, desktop Chrome/Safari/Firefox.
- Reaction time measured with `performance.now()`, never `Date.now()`.
- Controls: tap SHOOT, tap DODGE; desktop SPACE = shoot, SHIFT = dodge, ESC = pause. Touch + mouse. Prevent scroll and double-tap zoom. Touch targets >= 44 CSS px.
- Every button works. No decorative dead buttons.
- Enemy stats/weapons/perks/economy live in config files, not hardcoded in the engine.

## 1. Duel
Phases (in order): `INTRO -> STANDOFF -> WARNING -> DRAW -> REACTION -> RESOLUTION -> REWARD`.
- INTRO: opponent name and entrance, short introduction line.
- STANDOFF: idle animations, countdown.
- WARNING: opponent plays its **tell** animation; warning duration varies per enemy.
- DRAW: show "DRAW!"; the player may shoot now.
- REACTION: player taps SHOOT; reaction ms = `performance.now()` delta from the DRAW signal.
- RESOLUTION: compare player vs opponent reaction; apply accuracy, damage, dodge, weapon modifiers, perks; show hit/miss and animations.
- REWARD: coins, upgrade offer, next duel.
- **False start**: shooting before DRAW is penalised (configurable penalty, e.g. stun/lost time/damage).
- Grades (configurable defaults): Excellent < 200 ms, Great 200-350, Good 350-500, Slow > 500.

## 2. Player
White hat, blue vest, gold neckerchief; faces RIGHT. Frames: idle, idle2, draw1, draw2, aim, shoot1, shoot2, hit, dead, dodge. State machine states: IDLE, PREPARING, DRAWING, AIMING, SHOOTING, DODGING, HIT, DEAD; incompatible animations never play together. Initial timings: idle 350 ms/frame, draw 100, shoot 80, hit 180, dodge 250 (tune after playtest).

## 3. Enemies (config-driven; each supports idle, idle2, aim, shoot, hit, dead, tell)
- **Rookie**: slow reaction, low accuracy, predictable, long warning.
- **Coward**: fake draw movements, hesitation, unpredictable timing.
- **Drunk**: erratic reaction, lower accuracy, occasional lucky shots.
- **Elite Bounty Hunter**: fast reaction, high accuracy, short warning, stronger weapon.

## 4. Bosses (each: introduction, unique arena presentation, distinct mechanics, phase transitions, victory sequence; must NOT be just more HP)
1. **Mad Dog McGraw** (dog-skin cape): rapid draws, aggressive, unpredictable warning signals.
2. **The Undertaker**: dynamite attacks, delayed draw, explosive damage.
3. **Lady Luck**: playing-card attacks, randomized patterns, critical modifiers.
4. **El Diablo** (final): multiple phases, extremely fast draws, fake signals, special attacks.

## 5. Arenas (layers: BACKGROUND SKY, DISTANT PARALLAX, MIDGROUND, GROUND, FOREGROUND, FX)
Dust Creek (desert sky, mesas, wooden buildings, dusty street), Canyon (red cliffs, ledges, mine, vegetation), Railroad (tracks, boxcars, water tower, platforms). Keep the central combat area readable; characters contrast with the environment. Subtle animation only: floating dust, small wind movement, occasional tumbleweed, gentle background drift. No excessive particles.

## 6. Run and progression
Run = multiple duels (HUD example "ROUND 4 / 12"), final boss El Diablo. Coins per duel. After selected encounters offer **3 upgrades, pick 1**. Rarities COMMON/RARE/EPIC/LEGENDARY with configurable probabilities; no upgrade makes the game impossible to lose. Example upgrades: Quick Draw, Steady Hand, Iron Heart, Lucky Bullet, Dust Dancer, Double Tap, Gold Rush, Last Stand. **Weapons**: Starter Revolver, Quickdraw Six, Ironhammer, Golden Eagle, Ghost Barrel; stats damage, accuracy, drawSpeed, criticalChance, reloadTime; distinct value each. Persistent save in LocalStorage (continue, unlocks, settings, coins).

## 7. Screens (all navigable)
Splash, Main menu (PLAY, CONTINUE, CHARACTERS, UPGRADES, SETTINGS, HOW TO PLAY; wooden plank buttons with NORMAL/HOVER/PRESSED/DISABLED), How to play, Tutorial, Character selection, Arena introduction, Duel, Pause, Victory, Defeat, Upgrade selection, Weapon shop, Perk collection, Settings (volume), Boss introduction, Run summary, Final victory, Credits. Menu background: Dust Creek with subtle motion and idle character.

## 8. HUD
Player health (brass hearts), coins (coin icon), round "ROUND n / 12", opponent name, reaction timer, weapon status, SHOOT button, DODGE button, PAUSE button. Must not obstruct characters.

## 9. Tutorial (uses the real engine, not a fake)
1 "Welcome to Dust Creek, partner." 2 "Keep your hand steady." 3 "Wait for DRAW!" 4 player must successfully SHOOT 5 false-start penalty explained 6 player must dodge an incoming attack 7 choose first perk 8 "You're ready for the frontier."

## 10. Cutscenes (skippable, pixel-art, no blur)
Intro: camera over desert, Dust Creek in the distance, "Out here, legends are written in lead.", player arrives. Boss intros: portrait, environment, pixel text, camera move, sfx. Final: sunrise over town, "THE LAST DRAW", then "THE LEGEND LIVES ON." Use pack cutscene art (`cutscenes/*`, templates).

## 11. Audio
Menu nav, clicks, revolver draw, gunshots, impacts, dodge, damage, death, coins, upgrade select, boss intro, victory, defeat; music for menu/combat/boss/victory; respect autoplay (unlock on first interaction); volume settings; procedural sfx if no files; no copyrighted music. Existing `src/core/AudioManager.ts` (procedural WebAudio, PLACEHOLDER-labelled) and `HapticsManager.ts` can be reused.

## 12. Game feel (as far as received)
Responsive button feedback, strong gunshot timing, brief hit-stop, subtle camera shake, floating damage numbers, coin collection feedback.

## 13. Animation quality
Phaser animation timelines; animation logic separate from combat logic; playback never blocks input unless by design; use completion events; frames played in manifest order (never alphabetical). Idle loops, draw, shoot recoil, hit, death, dodge, boss phase transitions.

## Assumptions (user message was truncated after section 21)
- Missing sections (rest of game feel, final audio polish, testing, performance, deliverables) are covered by our existing quality gates: tests for pure logic, Playwright playthroughs with screenshots, perf budget in `docs/PERFORMANCE.md`.
- Agent names from the prompt (Game Director, Gameplay, Pixel Art & Animation, UI/UX, World, Progression, Audio, QA) map onto our existing role system (docs/AGENT_ASSIGNMENTS.md); skills named in the prompt (ui-ux-pro-max, frontend-design, game-development, animation, testing, performance-optimization) are not installed here: closest available specialists are `general-purpose` agents with those briefs.
- The pack's characters are 168x144 canvases drawn at 3x nearest-neighbour (logical art ~56x48). They are rendered at their native canvas size (1:1 PNG pixels) inside the 390x844 logical canvas; backgrounds are 960x360 strips cropped/parallaxed; tiles are 96x96 (32 logical px x 3).
- Because the pack art is placeholder quality (docs/ASSET_PACK_AUDIT.md), visual distinction between enemies relies on tint/props/idle motion and added overlays that we create in the same style, labelled in `docs/MISSING_ASSETS.md`.
