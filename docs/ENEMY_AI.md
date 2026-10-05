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
| rookie | 1 | 900-1050 | very inaccurate, tutorial |
| bandit | 2 | 620-760 | baseline; fake tell from difficulty > 0 |
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

QA-09 (limb disarm loop): `DUEL_CONFIG.fairness.maxDisarms` (default 2) caps limb disarms per attempt; later limb hits still deal damage. A18 should tune it per enemy tier (or make it an `EnemyDef` field).
