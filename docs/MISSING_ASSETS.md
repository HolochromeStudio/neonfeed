# MISSING ASSETS

Owner: A04. Per D5, missing art is replaced by clearly labelled placeholders until the real source arrives. Nothing below exists on disk in `assets/source/` yet.

## Awaiting source files (blocker B1)

| Sheet | Expected file | Contents (shown in chat, not committed) | Pipeline status |
|---|---|---|---|
| Characters | `assets/source/characters_sheet.*` | Bandit, Gunslinger, Sheriff, Dual Wielder, Sniper, Knife Thrower, Prospector, Bartender, Townsfolk Woman, Train Guard, Boss Outlaw, Horse Rider; frames idle / idle2 / aim / shoot / hit / dead | Config entry `characters` ready (row-based grouping, atlas `characters_atlas`). Row order and frame count are assumptions to verify |
| Desert terrain/props | `assets/source/desert_sheet.*` | desert terrain tiles, desert props | Config entry `desert` ready (auto mode, atlas `desert_atlas`) |

Dropping the files in and running `npm run assets` slices them; no script changes needed.

## Not present in any sheet (need to be supplied or drawn)

| Gap | Impact | Interim plan |
|---|---|---|
| Player hero sprite (no hero on the characters sheet) | Duel scene has no player | Labelled placeholder (A04/A05 to generate a flat silhouette named `hero_placeholder_*`); real art needed |
| FX: muzzle flash, bullet/projectile, hit spark, dust, death puff | No shot/hit feedback art | Code-drawn primitives (Phaser graphics/particles) |
| UI frames: panels, buttons, health/draw bars, bounty cards, icons | A10 cannot use sheet art for HUD | Code-drawn rectangles/text |
| Desert terrain / enemy sheets on disk | Duel arenas limited to the town sheet | Use town props on flat colour backgrounds |
| Town sheet: no ground/street tile, no sky/background, no dust or night variants | Arena builder (A11) has no floor strip | Flat colour ground and sky gradient in code |
| Town sheet: no animation frames (doors, swing doors, lantern flicker) | Static only | Tween rotation/alpha in code |

## Known quality gaps in sliced town assets

- `dirt_patch` loses some very pale speckle (close to the sheet background colour).
- Narrow cream gaps between balusters in railing sprites stay opaque.
