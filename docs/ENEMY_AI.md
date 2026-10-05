# Enemy AI

Owner: A06. Code: `src/data/enemies.ts` (data), `src/systems/EnemyAISystem.ts` (controllers), `src/entities/Enemy.ts` (Phaser-free bundle).

## Usage
```ts
const opponent = createOpponent('bandit', rng, difficulty /* 0..1 */);   // OpponentController
new DuelSystem({ seed, opponent, enemyHp: enemyHpFor(getEnemyDef('bandit'), difficulty) });
```
Controllers use only the Rng DuelSystem passes in (D4). rng order is stable: `waitMs` draws variant (bounty hunter only), wait, fake roll, fake start, reaction (always the same count); `drawMs` one draw; each shot one delay draw and two aim draws. Retries re-create the duel from the same seed, so the plan is identical (F5).

## Timeline (all relative to the cue = tell frame)
`reactionMs` (enemy starts drawing) + `drawTimeMs` = gun out. First shot = `max(tell.leadMs + U(0, jitterMs), gun-out)`, with `leadMs >= 450` (F1). Later shots: `shotGapMs`, never under 250 ms; after the sequence (`shots`) a 1.5 s reload.

## Difficulty axes (never a shorter tell-to-lethal)
| Axis | Effect of difficulty 0 -> 1 |
|---|---|
| Information | Fake-tell chance rises (bandit 0 -> 30%, gunslinger 15 -> 45%, coward 50 -> 80%, hunter feint 30 -> 60%) |
| Precision | Max aim error shrinks to 72% (more enemy shots land) |
| Rhythm | WAIT range widens (min -250 ms, max +700 ms) |
| Sequence | Follow-up shot gap x0.8 (floor 250); +1 hp at difficulty >= 0.75 (`enemyHpFor`) |

## Fake tells (Bandit, Gunslinger, Coward, Hunter)
Plan exposed as `opponent.fakeTell` after `waitMs()`: `{kind, startMs, durationMs, recoverMs}` (ms from WAIT start). The real cue is always at least 400 ms after the fake ends, and the fake has a different kind (distinct silhouette and pitch, F6). A player who waits for the real tell is never punished; only a flinch on the fake is. WAIT length returned already includes the fake, so the current DuelSystem works unchanged (it just has a longer WAIT).

## Proposed DuelSystem / scene additions (A02), all optional
The controller already provides these as extras on `EnemyOpponent`; DuelSystem may read them with `'fakeTell' in opponent`. Proposed additions to `OpponentController`:
```ts
interface OpponentController {
  // existing members unchanged
  readonly tellKind?: string;                       // which tell animation/sfx to play at the cue
  readonly fakeTell?: { kind: string; startMs: number; durationMs: number; recoverMs: number } | null; // valid after waitMs()
  readonly shots?: number;                          // length of the shot sequence (dual wielder 2, knife thrower 2)
  readonly dodgeWindowMs?: number;                  // default 250; window opens at each shot's muzzle-raise tell
  readonly variantId?: string | null;               // bounty hunter: announced on the poster
  evades?(rng: Rng, playerShotIndex: number): boolean; // coward sidesteps a player shot (call only when the player fires)
}
```
Scene behaviour implied: (1) on `fakeTell.startMs` play `fakeTell.kind` with its own sfx pitch and DO NOT start the reaction clock; flinch during a fake should report cause "Fell for fake tell" (F4); (2) per-shot muzzle-raise telegraph `dodgeWindowMs` before each shot >= 450 ms after the cue; (3) the second shot of a sequence needs its own tell (left then right glint); (4) `evades()` consumes rng, so it must be called in a fixed order after the plan is made, e.g. at each player fire.

Data flags that need DuelSystem support (data only for now, ignored today): `armor.blocksBody` (sheriff: body hits blocked until head or limb), `motion` (horse rider circle, train guard sway: moves the enemy rect), `weakPoint` (sheriff badge), `evadeChance`.

## Roster summary (difficulty 0)
| Enemy | hp | tell -> first shot | notes |
|---|---|---|---|
| rookie | 1 | 750-900 | inaccurate (aim 4-40), tutorial |
| bandit | 2 | 740-880 | baseline; fake tell from difficulty > 0 |
| gunslinger | 2 | 560-680 | feint tell |
| coward | 1 | 700-860 | frequent fake, late evade |
| drunk | 2 | 800-1220 | erratic timing, 40% wild misses |
| sheriff | 3 | 600-720 | armour (needs support) |
| dual_wielder | 2 | 640-760, second 380-520 later | two shots |
| sniper | 2 | 1000-1140 | long glint, accurate |
| knife_thrower | 2 | 780-900, second 520-680 later | dodge matters |
| train_guard | 3 | 680-840 | sway (needs support) |
| horse_rider | 2 | 820-960 | circling (needs support) |
| bounty_hunter | 4 | variant: feint / glint / dual | announced `variantId` |

Sprite prefixes: real sheet for bandit, gunslinger, sheriff, dual_wielder, sniper, knife_thrower, train_guard, horse_rider; rookie, coward, drunk, bounty_hunter use the `enemy` placeholder (`resolveSpritePrefix`).

## Scene integration notes (A02, DuelScene)
`DuelScene` builds the opponent with `createOpponent(enemyId, rng, difficulty)` (scene data `enemyId` default `'bandit'`, `difficulty` default 0.3, hp from `enemyHpFor`), shows `def.name`, and picks the sprite prefix with `resolveSpritePrefix` against the `placeholder` atlas.

| Extra | State |
|---|---|
| Multi-shot | Works through `shotDelayMs`/`aimErrorPx` (DuelSystem already plays every shot). The scene also telegraphs each follow-up shot (index >= 1) with a glint at the gun `dodgeWindowMs` (default 250) before it, using `snapshot().enemyShotIndex` / `enemyShotEtaMs`. Visual only. |
| Fake tell | Played in WAIT at `fakeTell.startMs` (enemy twitch plus a small grey tell-name bubble, no `!`, no sound). It never starts the reaction clock and never fires. An early draw during the fake window is the normal flinch (+300 ms) and its text reads "FELL FOR THE FAKE". |
| tellKind | Not played yet (the real cue is the shared red `!`). Needs per-kind art/sfx. |
| Dodge (`dodgeWindowMs` as a player dodge, `evades`) | NOT implemented. DuelSystem has no dodge input, and `evades()` would need to be called in a fixed rng order at each player shot. Later task. |
| `armor`, `motion`, `weakPoint`, `evadeChance` | Still data only (no DuelSystem support). |
| Variant (`variantId`) | Not shown on a poster yet. |

QA-09 (limb disarm loop): `DUEL_CONFIG.fairness.maxDisarms` (default 2) caps limb disarms per attempt; later limb hits still deal damage. Now per enemy: see "maxDisarms" below.

## Early ladder retune (A18 BALANCING s.6 rank 6, applied)
Rookie `tell.leadMs` 900 -> 750 and `aimErrorPx` [10,70] -> [4,40]; Bandit `tell.leadMs` 620 -> 740. F1 untouched (all leads >= 450). Measured with `npm run sim -- --only=duels` on live data (clean-win, depth difficulty per row, N standard profile), before -> after:

| Row | novice | average | skilled | expert |
|---|---|---|---|---|
| Rookie d 0.05 | 98 -> 90% | 100 -> 98% | 100 -> 100% | 100 -> 100% |
| Bandit d 0.1 | 46 -> 56% | 63 -> 84% | 85 -> 98% | 98 -> 100% |
| Rookie (second block of the same table) | 97 -> 88% | 100 -> 98% | 100 | 100 |
| Bandit (second block) | 38 -> 48% | 57 -> 81% | 81 -> 97% | 98 -> 100% |

`--only=rookie,leads` reproduces the A18 patch rows (Rookie 750 + aim 4-40: 89 / 98 / 100 / 100; Bandit 740: 55 / 84 / 98 / 100). Live data matches within sim noise: novice beats Rookie ~89-90% (target about 89%) and Bandit 56% on the clean-win metric. A18 asked for 55-70%: the novice sits at the bottom of the band and average at 84%; raising Bandit lead further would only help novices at the cost of the reading skill, so stop at 740. Rank 7 (Gunslinger 640, Sheriff 680) and rank 11 (sniper, knife, rider) are not applied: they are off the early ladder and rank 11 should wait for dodge/tracking.

## Dodge contract (for A02's DODGE action)
Data (all optional on `EnemyDef`, always set in the roster): `dodgeWindowMs`, `dodgeTell` (`DodgeTellKind`); controller extras `dodgeWindowMs` (default 250), `dodgeTellKind` (default `muzzle_raise`).

* Window semantics: for every enemy shot the telegraph (`dodgeTell`) opens at `shotAt - dodgeWindowMs`; a dodge input accepted in `[shotAt - dodgeWindowMs, shotAt]` (plus the dodge's own duration, A02's call) avoids that shot. Multi-shot enemies get one window per shot.
* Minimum `DODGE_MIN_WINDOW_MS = 250`. Reasoning: sim reaction medians are 210 (expert), 250 (skilled), 300 (average), 380 ms (novice), plus about 25 ms display lag and about 40 ms touch latency. 250 is reachable by reaction for a skilled player and by anticipation for anyone who has seen the telegraph once; below that the dodge is a lottery on touch. Beginner enemies (rookie 420, bandit 380, drunk 420, coward 380) exceed the novice median plus lag so a pure reaction works.
* Never undodgeable (tested over 300 seeds x difficulty 0 and 1, all enemies and bounty variants): `shotAt(0) - dodgeWindowMs >= DODGE_MIN_OPEN_AFTER_CUE_MS (250)` so the window never opens while the player is still answering the cue; and `shotGap(i) >= dodgeWindowMs` for follow-up shots so windows never overlap and a dodge for shot 1 cannot be spent on shot 2. If A02 adds `dodgeWindowMult` (perk) it should clamp to the same floor.
* Values: rookie 420, bandit 380, gunslinger 300 (`muzzle_raise`), coward 380, drunk 420, sheriff 300, dual wielder 280 (`double_raise`: left then right, the tightest because the gap floor after depth scaling is 304 ms), sniper 320 (`glint_late`: the glint holds for about 680 ms and the window opens only in its last 320 ms, so the long glint is a tell for aiming, not for dodging), knife thrower 360 (`projectile`: knife travel is the cue), train guard 320 and horse rider 340 (`motion`: the raise lands on a beat of the sway or circle), bounty hunter 280.
* This does not change any shot timing (F1/F5 unchanged); the sim does not model dodge, so no balance numbers move. A18 should re-tune leads (rank 11) once dodge lands.

## maxDisarms (D19) - owner notes for A02 / A07
`EnemyDef.maxDisarms?: number` is in the data now (optional; 2 for hp <= 3, 1 for bounty_hunter hp 4). Helper `maxDisarmsFor(def, difficulty)` returns `min(def.maxDisarms ?? 2, 1 if enemyHpFor(def, difficulty) >= 4)`, i.e. an hp-3 enemy at depth >= 0.75 also gets 1. The controller exposes it as `opponent.maxDisarms`. A02: when building the duel, pass `fairness.maxDisarms = opponent.maxDisarms + perkDelta` (Disarmer `maxDisarmsDelta` +1). Nothing reads it yet, so behaviour is unchanged until A02 wires it. A07: bosses are not in `enemies.ts`; give `BossDef` the same optional field and default it to 1 (D19, BALANCING 5.1 table: cap 2 is a free win up to hp 6). Also look at the non-monotonic McGraw result (cap 3 clean-win 16% vs 94% at 1, 2 and infinity: the third disarm lands in a short in-volley beat); the drop-beat below makes that re-plan explicit.
Hp proposal (A07/A18): McGraw hp 3 -> 4 (rank 9) and flatten the +1 at depth for bosses; for regular enemies keep `enemyHpFor` as is.

## Perk hooks (optional controller extras, all default off)
`createOpponent(id, rng, difficulty, options?: OpponentOptions)`; `Enemy` takes the same as a fifth argument; `opponentOptionsFromModifiers(mods)` maps `DuelModifiers` (`fakeTellEveryDuel`, `bluffFeint`, `baitEnabled`, `disarmDropsGun`). With no options the controller is byte-identical (tested). All hook methods are rng-free, so retries (F5) stay identical.

| Perk | Option | API | Behaviour |
|---|---|---|---|
| Devil's Deal | `forceFakeTell` | none, just plan: `fakeTell` is non-null after `waitMs()` | Every duel plans a fake. Enemies with their own fake use it; others use `GENERIC_FAKE` (`generic_feint`, 300 ms, 450 ms recovery). Draw count is unchanged (the roll is still drawn), so the later rng stream is aligned. F1 and the 400 ms recovery still hold. |
| Bluff | `bluff` | `reactToFlinch(): {fireAfterMs, aimErrorPx} \| null` | Call when the player flinches (early draw during WAIT). First call per plan returns a shot after the enemy's min reaction + 150 ms with `aimErrorPx = 64` (> 24 tolerance: guaranteed miss); later calls return null (resets on the next `waitMs`). The bluffed shot is not a lethal-from-cue shot, so F1 does not apply; DuelSystem must treat it as a forced miss (the "guaranteed miss beat" in perks.ts) and then restore the normal flow; the upgrade (auto-Good draw after the miss) is DuelSystem's. |
| Bait | `bait`, `baitDrunk` (upgrade) | `reactToHold(heldMs): {cueAtMs} \| null` | After `BAIT_HOLD_MS = 700` ms of no input during WAIT, a planned fake tell is abandoned and the real cue moves to `cueAtMs = max(900, heldMs + 250)` (and not within 400 ms of a fake that already played), only when this is earlier than the planned cue. Works on any enemy with a fake (coward, bandit, gunslinger, hunter feint); `baitDrunk` extends it to the Drunk. The cue is still a full lead before the shot (F1). DuelSystem reschedules the cue at `cueAtMs` (the player already holds still, so the reaction clock is fair). |
| Disarmer | `disarmDropsGun`, `disarmBossFloor` (upgrade) | `disarmPickupMs(disarmIndex, boss?)` | Extra ms (1 beat = `DISARM_BEAT_MS` 300; 2 beats for bosses with the upgrade) A02 adds to the re-planned shot after a limb disarm. 0 when off. |

Not tractable inside A06: none of the four needs more than DuelSystem calling the method at the right time (flinch, hold, disarm) or reading `fakeTell`. The pieces that stay in DuelSystem/DuelScene (A02): a hold-input detector for bait, the forced-miss resolution for bluff, the pick-up delay applied to the next shot plan, and wiring `opponentOptionsFromModifiers(this.mods)` where the opponent is built. Perk data `support: 'a06'` can flip to `'today'` for devils_deal once the scene passes the options; bluff, bait and the disarmer drop beat flip when A02 calls the methods.
