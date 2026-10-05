# Run Design (A08)

Owner: A08 Roguelite Systems. Reviewer: A18 Balance. Consumers: A02 duel, A06 enemies, A07 bosses, A09 economy, A10 UI.
Code: `src/systems/RunSystem.ts`, `src/systems/PerkSystem.ts`, `src/data/{perks,events,regions}.ts`. Tests: `tests/run*.test.ts`, `tests/perk.test.ts`.
No Phaser, no `Math.random`; every random choice comes from `Rng` (D4).

## 1. Public API

```ts
const run = startRun(seed, { regions?, startPerks?, startCoins?, startItems?, hasArena? });  // regions default: first release (3)
run.getChoices();               // MapNode[] reachable now
const enc = run.enterNode(id);  // DuelEncounter for duel/elite/boss, else the node kind
run.getDuel();                  // DuelEncounter (seed, enemyId, difficulty 0..1, arenaId, modifiers, patched config, heroHp, retryCost)
run.completeDuel(result);       // { status: 'won' | 'refight' | 'dead', canRetry, retryCost }
run.retryDuel();                // pay coins, same seed (RULE F5), once per node
run.getReward(); run.rerollReward(); run.applyReward({ perkId } | { skip: true });
run.getShop(); run.shopBuy/shopReroll/shopHeal/shopRemoveCurse/shopSell(); run.getRest(); run.doRest(...);
run.getEvent(); run.previewEventChoice(i); run.chooseEvent(i); run.whiskeyReroll();
run.getTreasure(); run.openTreasure(disarm?); run.leaveNode(); run.abandon();
run.serialize(): RunSave;  restoreRun(save);
```

`RunDuelResult` (what the duel scene hands back, a subset of `DuelResult`): `{ outcome: 'WIN'|'LOSE', heroHp, tier?, reactionMs?, headshots?, dodges?, consumedPerks? }`.
`DuelEncounter` carries everything the scene needs: `enemyId` (always a roster id for `createOpponent`), `bossId` (null unless boss), `difficulty`, `seed`, `arenaId`, `heroHp`, `elite`, `enemyHpBonus`, `modifiers: DuelModifiers`, `config: DuelConfig` (DUEL_CONFIG patched with what works today).

### Save shape
`serialize()` returns exactly `RunSave { seed, rngState, nodeIndex, hp, perks, coins, map }`.
- `nodeIndex` = next global layer (nodes completed on the chosen route).
- `perks` = `id` for tier 1, `id+` for tier 2.
- `map` is the opaque blob `{ v: 1, graph, state }`: the generated graph plus items, buffs, consumed once-per-run perks, reputation, flags, pending reward, the current node's encounter (shop offers, event id, duel seed...), stats. Restoring mid-node works (tested).

## 2. Run map

- Seeded by a map-only RNG (`seed ^ 0x9e3779b9`): same seed + same region list = identical map, regardless of play.
- A region is 7 layers: `L0 duel (1 node) -> L1 branch -> L2 branch -> L3 SHOP (1 node) -> L4 branch -> L5 REST (1 node) -> L6 BOSS (1 node)`. Branch layers are 2-3 lanes wide; waist layers force every path through the shop and the rest.
- Rules enforced (tested over 300 seeds x 7 regions): first node always a duel; shop layer is never adjacent to another shop; rest directly before the boss; at most 1 elite and 1 treasure per region; at least 1 event per region; every branch layer keeps a duel lane; every node is reachable and reaches the final boss.
- Elites only appear from L2; skull = `type: 'elite'` (the UI shows `getVisibleMap()` types). Goldspire adds an extra shop lane on L1 (shop-heavy).
- Default lookahead is 1 layer (the choices); Pathfinder widens it via `getVisibleMap()`.
- Region order for a full run: Dust Creek, Canyon, Railroad, Saloon, Goldspire, Widow's Peak, Blackwater Bay (21 layers for the first release, 49 for all seven).

### Regions (data/regions.ts)
| Region | Elite | Boss id (fight until A07 maps it) | Arena | Notes |
|---|---|---|---|---|
| Dust Creek | bounty_hunter | mad_dog_mcgraw | dust_creek | tutorial pool: rookie, bandit first |
| Canyon | sniper | the_undertaker | canyon -> dust_creek | |
| Railroad | train_guard | the_conductor (fallback train_guard) | railroad -> dust_creek | |
| Saloon | drunk | lady_luck (fallback gunslinger) | saloon_interior | |
| Goldspire | bounty_hunter | the_banker (fallback bounty_hunter) | goldspire -> dust_creek | coins x1.5 |
| Widow's Peak | knife_thrower | el_diablo_vanguard (fallback knife_thrower) | widows_peak -> dust_creek | |
| Blackwater Bay | dual_wielder | el_diablo (fallback bounty_hunter) | dust_creek_night | coins x1.25 |

Arena ids that do not exist fall back to `dust_creek` through `resolveArenaId`. Enemy pools are explicit per band (early/mid/late layer), because only 4-5 roster enemies have native affinity to later regions; native affinity in `enemies.ts` is a hint, not a constraint.
Boss ids not in `BOSS_IDS` (`the_conductor`, `the_banker`, `el_diablo_vanguard`) are placeholders for A07: the encounter's `enemyId` is the fallback roster enemy, `bossId` is the real id.

## 3. Difficulty, hp, coins

- `difficulty = 0.05 + 0.9 * layer / (totalLayers - 1)`, +0.08 elite, +0.10 boss, clamped 0..1. One ramp over the whole run (it does not reset per region). Passed straight to `createOpponent(enemyId, rng, difficulty)`. It never shortens reaction windows (RULE F1 is the enemy AI's job).
- Hero hp carries over: the next duel starts at the previous `heroHp`. Rest heals 1 (or full with Healer's Touch). Boss kill heals 1. Max hp is 3 plus perk modifiers; events never kill (floor of 1).
- A loss with lives left = free immediate refight (same seed). A loss at 0 lives: `status: 'dead'`; `retryDuel()` pays `10 + 3 * layer` coins (x0.5 Slush Fund), restores entry hp, once per node; otherwise `abandon()`.
- Duel reward: `(10 + 20 * difficulty) * regionCoinMult * perkMult`, elite x2, boss x3, plus Perfect +5, headshot +3, no-damage +4, dodges x Slip Away, Pickpocket, wager payout, boss Interest. Standard duels use `coinMultDuel`; elites and bosses use `coinMultElite`.
- Duel win offers 3 perks (skip = +5 coins). Elite: 3 rare+. Boss: 3 rare+ with legend weight x4. Events fights (ambush, bandit toll) pay coins only. Slush Fund retries pay nothing (coins and perks).
- Shop: 3 perks (+1 Trader's Eye), 1 consumable, heal (20), reroll (10, +5 each), remove a curse (25). Prices: common 30, rare 55, legend 100, cursed 20; reputation shifts prices up to +-20%.
- Treasure: coins or a perk; 35% trapped (lose 1 life unless you pay 5 to disarm). Rest: heal, upgrade a perk to tier 2, or drop a perk for coins.
- All numbers live in `RUN_TUNING` and `data/perks.ts` for A18.

## 4. Perks

57 perks: 25 common, 21 rare, 5 legend (boss rewards), 6 cursed. Tags DRAW/AIM/DODGE/COIN/LUCK/LIFE/CURSE; synergy groups (`perfect_chain`, `stagger`, `dodge_counter`, `economy`, `feint`, `precision`, `multi_shot`, `info`, `events`, `rest`, `risk`, `comeback`, ...) mark designed combos. Rarity weights: common 60, rare 30, legend 4, cursed 6 (cursed only from the shop curse slot). `rarityLuck` in -1..1 moves weight common -> rare/legend.

`rollPerkChoices(rng, owned, rarityLuck, n, opts)`: rarity is rolled first, then a perk. Never offers an owned perk (either tier), a duplicate, or anything that conflicts (`excludes`, symmetric) with owned or already-offered perks. 30% of non-final slots favour tags you hold; the final slot is an off-tag wildcard. Options: `minRarity`, `bossBoost`, `onlyRarity`, `allowCursed`, `exclude`.

Tier 2 (rest upgrade) adds a second effect. Where the second effect is data (`duel2`/`run2`) it is wired; for the other upgrades the `upgrade` text is the design spec and the matching duel/run support does not exist yet (see section 6).

### Modifier contract
`composePerks(owned, ctx)` returns `{ duel: DuelModifiers, run: RunRules, hexTag, disabled, buffLuck }`, plain JSON data. Neutral = no perk. Composition: `*Mult` multiplies, other numbers add, booleans OR, `heroHpOverride` takes the minimum. `ctx` holds the enemy id, elite/boss, first-duel-of-region, consumed once-per-run perks and active buffs; conditional perks (Matador, Tell Reader, Iron Skin) only fire when their condition holds. Hex doubles the most-held tag and disables every other tag's perks. `duelConfigFor(mods)` clones `DUEL_CONFIG` and applies what the duel already understands (`perfectMs`, `flinchPenaltyMs`, `aim.budgetMs`, `damage.enemyDamage`, `damage.baseDamage` for one-hit kills, `maxDisarms`, `heroHp`). Everything else stays on `DuelModifiers` for A02/A06 to read. Do not branch on perk ids in duel code; read the modifier fields.

`DuelModifiers` fields by owner: draw (`perfectWindowMult`, `flinchPenaltyMult`, `flinchNoTimeCost`, `flinchDisablesCrit`, `goodAsPerfectPerDuel`, `perfectStaggers`, `drawFromEitherSide`, `tellCueLeadMs`, `bluffFeint`, `afterHitAutoPerfect`, `perfectStreakLifeAt`, `aimPenaltyIgnoredOnPerfect`, `fakeTellEveryDuel`), aim (`aimBudgetMult`, `lastStandBudgetMult`, `aimBudgetStillBonus`, `fireOnRelease`, `headStagger`, `ricochet`, `maxDisarmsDelta`, `disarmDropsGun`, `calledShot`, `oneShotRefundsBudget`, `buckshot`, `reticleSnapBack`, `rapidFollowUp`, `weakPointGlowMs`, `propShotsHitEnemy`, `alwaysCrit`, `oneHitKill`), dodge (`dodgeWindowMult`, `dodgeGuaranteesCrit`, `dodgeCloudBlocksShot`, `dodgeWhileAiming`, `tumbleBudgetCost`, `baitEnabled`, `phantomStep`), life (`heroHpDelta`, `heroHpOverride`, `ignoreFirstHits`, `reviveCharges`, `enemyDamageMult`), coins (read by RunSystem: `coinMultDuel`, `coinMultElite`, `coinPerDodge`, `pickpocketPerPerfect`, `coinLossPerDuel`, `wagerEnabled`). `RunRules` (shop, rest, map, events) is consumed only by RunSystem.

Temporary buffs (`BUFF_DEFS`): `focus` (Perfect window x1.3), `awareness` (cue 80 ms early), `blurry` (aim budget x0.8, from Whiskey Luck), `lucky`/`unlucky` (offer luck until the region ends). They tick down after each won duel.

## 5. Events

`data/events.ts` has one handler per `effectKey` in `RANDOM_EVENTS` (25 keys). `resolveEffect(key, { rng, state })` is pure and returns an `EventOutcome` (coins, hp, reputation, buffs, perks, items, upgrade, forced duel, flags). Unknown keys throw `Unknown event effectKey`. `previewEffect` returns the exact outcome without consuming the RNG (Lucky Charm). Paid choices return `blocked: 'cannot_afford'` and apply nothing; `getEffectCost(key)` lets the UI grey them out. Body Shield negates hp loss; Whiskey Luck restores a snapshot and re-rolls. Test `tests/runEvents.test.ts` fails if a key is added without a handler or a handler is unused.
Interpretation notes for A12/A18: `item` = half the time a common perk, otherwise a consumable (`tonic` heals 1, `flask` = focus); `upgrade_weapon` upgrades a random perk to tier 2 (no charge if nothing can be upgraded); `bounty_risk` has a 50% chance the next standard duel becomes a Bounty Hunter ambush; reputation (-5..5) moves shop prices +-10% per step up to +-20%.

## 6. Which perks need new duel support

`today` = works with current code (DuelConfig fields via `duelConfigFor`, `DuelParams.heroHp`, or RunSystem itself). `a02` = needs DuelSystem/InputSystem/DamageSystem work. `a06` = needs EnemyAISystem work. Perks marked `today` with a note have a tier-2 or secondary effect that still needs support.

### today (26)

| id | name | rarity | tags | what is missing |
|---|---|---|---|---|
| `quickdraw_scar` | Quickdraw Scar | rare | DRAW | Tier 2 flag needs DuelSystem (a02); tier 1 uses DuelConfig |
| `reflex_tonic` | Reflex Tonic | common | DRAW | Tier 2 needs DuelSystem (a02) |
| `disarmer` | Disarmer | common | AIM | maxDisarms works today; drop-beat needs EnemyAI (a06) |
| `body_shield` | Body Shield | common | DODGE, LIFE | Event half works today; prop-dodge half needs DuelSystem (a02) |
| `bounty_hunter_creed` | Bounty Hunter | rare | COIN |  |
| `pawn_shop` | Pawn Shop | common | COIN |  |
| `loaded_dice` | Loaded Dice | common | COIN, LUCK |  |
| `tip_jar` | Tip Jar | common | COIN, LIFE |  |
| `interest` | Interest | rare | COIN |  |
| `gamblers_fallacy` | Gambler's Fallacy | rare | COIN, CURSE |  |
| `slush_fund` | Slush Fund | common | COIN |  |
| `pickpocket` | Pickpocket | rare | COIN, DRAW |  |
| `lucky_charm` | Lucky Charm | common | LUCK |  |
| `black_cat` | Black Cat | common | LUCK |  |
| `horseshoe` | Horseshoe | rare | LUCK, LIFE |  |
| `traders_eye` | Trader's Eye | common | LUCK, COIN |  |
| `pathfinder` | Pathfinder | rare | LUCK |  |
| `wanted_poster` | Wanted Poster | rare | LUCK, DRAW |  |
| `whiskey_luck` | Whiskey Luck | common | LUCK, CURSE | Blurry aim penalty uses aimBudgetMult (config today) |
| `bullet_belt` | Bullet Belt | common | LIFE, COIN |  |
| `iron_skin` | Iron Skin | common | LIFE |  |
| `healers_touch` | Healer's Touch | common | LIFE |  |
| `blood_money` | Blood Money | cursed | CURSE, COIN |  |
| `hex` | Hex | cursed | CURSE | Resolved in PerkSystem.composePerks |
| `glass_cannon` | Glass Cannon | cursed | CURSE, LIFE |  |
| `widows_wager` | Widow's Wager | cursed | CURSE, COIN |  |

### a02 (28)

| id | name | rarity | tags | what is missing |
|---|---|---|---|---|
| `hair_trigger` | Hair Trigger | common | DRAW, AIM | InputSystem: release-fire rule |
| `ambidextrous` | Ambidextrous | common | DRAW | InputSystem: dual holster zones |
| `cold_open` | Cold Open | rare | DRAW | DuelSystem + EnemyAI: stagger beat |
| `steady_hands` | Steady Hands | common | DRAW | DamageSystem: crit gating |
| `spit_and_polish` | Spit and Polish | rare | DRAW | DuelSystem: tier promotion |
| `tell_reader` | Tell Reader | common | DRAW, LUCK | DuelScene: early cue overlay (visual only, F1 floor untouched) |
| `second_wind` | Second Wind | rare | DRAW, LIFE | DuelSystem: auto-perfect flag |
| `showman` | Showman | legend | DRAW, LIFE | RunSystem tracks streak from DuelResult.tier (works once duels report it); life grant via heroHp |
| `steady_breath` | Steady Breath | common | AIM | DuelSystem: still-reticle budget extension |
| `dead_eye` | Dead Eye | rare | AIM | DamageSystem: stagger on head |
| `ricochet` | Ricochet | rare | AIM | DuelSystem: multi-target + bounce |
| `called_shot` | Called Shot | legend | AIM | InputSystem: zone-tap pre-select; DamageSystem: multiplier lock |
| `marksman_pact` | Marksman Pact | common | AIM | DuelSystem: budget refund |
| `buckshot_rounds` | Buckshot Rounds | rare | AIM | TargetSystem: cone hit test |
| `long_barrel` | Long Barrel | rare | AIM | TargetSystem: snap-back assist |
| `rapid_fire` | Rapid Fire | legend | AIM | DuelSystem: bonus follow-up shot state |
| `weak_spotter` | Weak Spotter | common | AIM | DuelScene: weak point glow overlay |
| `trick_shot` | Trick Shot | rare | AIM, LUCK | DuelSystem: prop effects (barrel exists in DUEL_CONFIG) |
| `counter_roll` | Counter Roll | rare | DODGE | DuelSystem: dodge action + crit grant |
| `dust_kick` | Dust Kick | common | DODGE | DuelSystem: dodge action |
| `matador` | Matador | common | DODGE | DuelSystem: dodge window multiplier |
| `slip_away` | Slip Away | common | DODGE, COIN | DuelResult.dodges count (RunSystem already pays it when reported) |
| `tumble` | Tumble | rare | DODGE, AIM | InputSystem: dodge during AIM |
| `phantom_step` | Phantom Step | legend | DODGE | DuelSystem: shot window state after miss |
| `tin_star` | Tin Star | rare | LIFE | DamageSystem: hit-ignore counter |
| `revive_flask` | Revive Flask | legend | LIFE | DamageSystem: lethal-hit prevention; reports DuelResult.consumedPerks |
| `last_stand` | Last Stand | common | LIFE, AIM | DuelSystem: hp-conditional budget |
| `mad_dogs_collar` | Mad Dog's Collar | cursed | CURSE, AIM | DamageSystem: forced crit (double damage works today) |

### a06 (3)

| id | name | rarity | tags | what is missing |
|---|---|---|---|---|
| `bluff` | Bluff | rare | DRAW, DODGE | EnemyAI: react to flinch; DuelSystem: guaranteed miss beat |
| `bait` | Bait | rare | DODGE | EnemyAI: react to a held input |
| `devils_deal` | Devil's Deal | cursed | CURSE, DRAW | EnemyAI: force fake tell (window part works today) |

### Suggested A02 order (by value per effort)
1. `perfectStaggers`, `headStagger`, stagger beat (Cold Open, Dead Eye; shared with A06).
2. Dodge action (Counter Roll, Dust Kick, Matador, Slip Away, Phantom Step, Tumble); the DuelResult must report `dodges`.
3. Crit rules: `alwaysCrit`, `flinchDisablesCrit`, first-shot crit; hit-ignore counter and lethal-hit prevention (Tin Star, Revive Flask; report `consumedPerks`).
4. Tier promotion and auto-Perfect (Spit and Polish, Second Wind, Showman streak is already tracked by RunSystem from `tier`).
5. Input changes: fire on release, zone-tap pre-select, dual holster zones, snap-back reticle.

## 7. Known gaps
- Boss ids `the_conductor`, `the_banker`, `el_diablo_vanguard` do not exist in `BOSS_IDS` yet (A07/A12).
- Arenas for Canyon, Railroad, Goldspire, Widow's Peak fall back to `dust_creek` (A11).
- Tier-2 upgrade texts without `duel2`/`run2` data are design spec only.
- No meta unlock filter on the perk pool yet; `rollPerkChoices` has an `exclude` hook for it (A09).
