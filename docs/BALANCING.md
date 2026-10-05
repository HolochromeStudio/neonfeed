# Balancing (A18)

Owner: A18 Balance / Playtest Analyst. Reviewers: A08 (run, perks), A09 (economy), A02 (duel), A06 (enemies), A07 (bosses).
Code: `scripts/sim/**` (simulators and report), `tests/sim/**` (checks). Run: `npm run sim` (about 6 min, standard profile) or `npm run sim -- --profile=quick` (about 40 s, noisy) or `--only=duels,runs`. Output: `scripts/sim/out/report.md` (all tables) and `results.json`. Quick and `--only` runs write `report.quick.md` / `report.partial.md` and never overwrite the full report.
No game data or system was edited. Every number below is a recommendation for the owner; each one names file, constant, current value, proposed value and evidence. All simulations are seeded and deterministic: the same checkout prints the same numbers.

Snapshot: simulated against the working tree of 2026-10-05 (DuelSystem already had the A02 perk hooks `params.modifiers`, `heroMaxHp`, `staggerEnemy`; DuelScene already passes `enemyHpBonus` and boss ids). If those change, re-run.

## 1. Read this first

1. **The game is far too easy against the adopted targets.** With current data an average-skill player clears Dust Creek (boss included) 99% of the time and wins the whole 3-region run 98% of the time; skilled and expert win 100%. Even a novice wins 88% of 3-region runs. The target was 35-50% for average.
2. **Why: only the opening shot is dangerous.** The aim phase runs the enemy clock at 0.35x, so after the first exchange the hero finishes the duel before any reload shot lands. A duel costs at most about one life (0.3 hits per duel for average, 0.06 for expert on the roster at depth 0.1), and 3 lives plus about 3 heals per run (rest 1.3, shop 1.5, tonic 0.2) absorb it. Tuning enemy hit tolerance, draw animation, slow-mo scale, reload, enemy hp or depth difficulty one at a time moves average region-clear by 0 to 3 points (section 6, table "one change at a time"). Lives and elite/boss damage are the only levers with real effect.
3. **Recommended package C** (starting lives 3 -> 2, elites and bosses hit for 2 as GAME_DESIGN section 2 already says): average clears Dust Creek 50%, skilled 67%, expert 79%, novice 39%; 3-region win 30 / 58 / 75 / 16%. Two knobs, both in the design doc. Alternative F tightens novices (30%) at a small cost to skilled (62%).
4. **Three perks dominate and 16 are no-ops.** Tin Star makes the hero invulnerable (0.000 hits per duel, +33pp run win in the stress scenario, +67pp under package C). Bullet Belt (common, +1 life) is +25pp. Revive Flask +19pp. 16 of 51 non-cursed perks (31%) have no engine hook at all, so 68% of three-perk offers contain at least one dead pick.
5. **PERFECT (220 ms) is nearly unreachable once display lag is counted.** With 25 ms lag the perfect rate is expert 26%, skilled 5%, average 1%. Fix with `displayLagCompMs` 20 (FEEL_REVIEW item 6, option A) or `perfectMs` 240, not both; they are equivalent (section 5).
6. **The early ladder is lumpy.** A novice beats the Rookie 98% of the time (target 80-90) but the Bandit only 46% (target 55-70). Rookie accuracy is irrelevant (raising it from 23% to 56% hit chance moves novice 98% -> 96%); the Rookie is slow, not inaccurate.
7. **Region time is 2.1 minutes, not 10-15.** A 3-region run is 6.1 minutes, a full 7-region run about 15. The 10-15 minute target is met per full run, not per region.
8. **Economy pacing is 1.5-2x faster than A09's curve** when the daily bounty board is claimed every run (A09's own test assumption): tier 2 at run 20, tier 3 at 25, tier 4 at 26 versus 27 / 40 / 52. Runs alone (no board) land at 37 / 42 / 62, close to A09. The board pays about 295 coins per run, more than a run banks (about 245).

## 2. Method

### What is real and what is emulated
- **Real code**: `DuelSystem`, `createOpponent`, `createBossOpponent` + `BossSystem` (phases driven by hits through `attachDuel`), `RunSystem` (map, rewards, shop, rest, events, retries, hp carry-over), `PerkSystem` (composition, `duelConfigFor`, offers), `EconomySystem`, `BountySystem`. Perk modifiers go into `DuelSystem` through `params.modifiers`.
- **Emulated in the driver** (`emulate: true`, default), because `DuelSystem` does not implement them yet: Sheriff armour (body hits blocked until a head or limb hit), Coward evasion (`evadeChance * (0.5 + 0.5 d)`), Horse Rider and Train Guard motion (lateral offset times `1 - trackLead`). Dodge is NOT emulated by default (the game has no dodge action); `dodge: true` turns on a skill-based dodge for enemies that declare `dodgeWindowMs`, used nowhere in the tables below. A fake tell can make the player flinch only before the cue; later boss fakes have no effect in `DuelSystem` because the hero has already drawn.
- **Player model** (`scripts/sim/skills.ts`): inputs are generated as a timed log and fed to the real duel: optional early lift (flinch: from a fake tell or impatience), draw at `cue + lognormal reaction + display lag`, then per shot an `aim` plus `fire` after a lognormal AIM dwell, with a 2D gaussian reticle error around the chosen zone (head or body by preference; body when one hit from dead; head or arm against armour). Follow-up shots repeat after the 150 ms recoil.

| Skill | reaction median / sigma | fumble: early lift / bite a fake | aim sigma px | head pref | AIM dwell median ms |
|---|---|---|---|---|---|
| novice | 380 ms / 0.22 | 10% / 60% | 20 | 10% | 300 |
| average | 300 / 0.18 | 5% / 35% | 13 | 35% | 230 |
| skilled | 250 / 0.15 | 2% / 15% | 8.5 | 55% | 185 |
| expert | 210 / 0.12 | 0.5% / 5% | 5 | 75% | 150 |

Display lag added to every reaction: 25 ms (FEEL_REVIEW 6). Reaction floors 150 / 140 / 130 / 120 ms. The medians are the brief's; every other column is an assumption of mine (not measured on people) and the biggest source of uncertainty. Aim sigma matters least (a head zone is 32 x 25 px with a 14 px assist); reaction and AIM dwell matter most, because the first-shot race decides almost every hit.

### Metrics
- **Clean-win rate** = P(win without taking a hit) = P(win of a 1-life duel), exactly, because the player model's random stream does not depend on hp. This is the pure duel-difficulty metric. The brief's "novice beats Rookie 80-90%" only makes sense on this metric: with 3 lives the duel win rate is about 100% for every skill and enemy (the fight is never lost, hp is lost).
- **Hits per duel** (lives lost), **duel seconds** (WAIT included).
- **Region clear** = boss beaten. "Clear Canyon (if reached)" is conditional on clearing Dust Creek.
- Run time uses `TIME_MODEL` in `scripts/sim/runSim.ts`: duel length + 0.3 s hold + 8 s framing (14 s for bosses), 3 s per map pick, 30 s shop, 8 s rest, 14 s event, 8 s treasure, 6 s retry. A standard duel plus framing comes to 11-13 s, inside the brief's 12-20 s.
- **Perk contribution** is a single start perk against no perk with the same run seeds. The real game saturates at about 98% win, so the perk table uses a **stress scenario** (lives 2, difficulty +0.3, average skill; baseline run win 66.5%, N=400, standard error about 2.4pp) so effects are visible. A perk is flagged DOMINANT at more than +15pp, HARMFUL below -10pp (z < -2), no-op when nothing moves (duel panel, perfect rate, run win, coins).
- **Run policies**: node choice (avoid elites when hurt, prefer rest/shop when low, treasure disarmed when trapped), shop (heal first, then best affordable perk, tonic), rest (heal, else upgrade), events (static score per `effectKey`), retry when affordable, tonic at 1 life, flask before elites and bosses. Perk picks: `random` (default), `smart` (prefers working perks and rarity), `tag:X`.

### Determinism, speed, tests
Seeds: duel i uses seed `1000 + 7919 i` for every skill and option set (common random numbers); runs use seeds 1..N; the player stream is derived from the duel/run seed. `withPatch` (what-ifs) mutates live data in memory and restores it in place, including when the callback throws (tested). A duel simulates in about 15 microseconds, a run in about 5 ms. `npx vitest run tests/sim` (about 1 s, part of `npm test`) checks determinism, skill medians, monotonicity, boss phases, run bookkeeping and patch restoration; `SIM=1 npx vitest run tests/sim` also builds the whole quick report.

## 3. Targets adopted

| id | Metric | Band | Current | Status |
|---|---|---|---|---|
| T1 | novice clean-win vs Rookie (d 0.1) | 80-90% | 97.9% | too easy |
| T2 | novice clean-win vs Bandit (d 0.1) | 55-70% | 46.0% | too hard |
| T3 | average clean-win vs Bandit (d 0.1) | 70-90% | 62.6% | too hard |
| T4 | average clean-win vs Gunslinger (d 0.5) | 40-60% | 31.9% | too hard |
| T5 | expert clean-win vs Gunslinger (d 0.5) | 70-95% | 87.4% | ok |
| R1 | clear Dust Creek incl. boss, 3-region run: novice / average / skilled / expert | 15-30 / 35-50 / 65-80 / 85-95% | 97 / 99 / 100 / 100% | far too easy |
| R2 | expert is never trivially 100% through the first boss and the run | first boss clean-win below 95%, run win below 92% | 97% (d .42), run 100% | too easy |
| P1 | perfect-draw rate novice / average / skilled / expert | under 1 / 2-8 / 10-25 / 40-60% | 0 / 1 / 5 / 26% | too low (lag) |
| P2 | no single perk above +15pp run win (stress); at most 10% of the pool are engine no-ops | | 3 dominant; 31% no-ops | fail |
| L1 | minutes per region | 10-15 | 2.1 | see 5.5 |
| E1 | unlock pacing (A09): first 2-3, tier 1 about 14, tier 2 about 27, tier 3 about 40, tier 4 about 52 | | 1 / 3 / 20 / 25 / 26 (board on) | too fast |

T1-T5 are the brief's, applied to clean-win. R1 and P1 are my adoption: a region should be a real risk for an average player, expert should stay safely above it, and PERFECT should be a skill badge rather than a lottery. The bands are ordinary choices, not facts about what players want; owners can move them and the sim will re-score.

## 4. Results

### 4.1 Duels (full tables: report sections "Duel matrix")
Roster mean clean-win % / hits per duel, all 12 enemies, by depth difficulty:

| depth d | novice | average | skilled | expert |
|---|---|---|---|---|
| 0.1 | 51% / 0.51 | 68% / 0.32 | 83% / 0.17 | 94% / 0.06 |
| 0.5 | 45% / 0.59 | 64% / 0.38 | 80% / 0.20 | 93% / 0.07 |
| 0.9 | 28% / 0.80 | 42% / 0.61 | 61% / 0.40 | 84% / 0.16 |

Mean duel length 2.5-5.5 s (WAIT is 1.3-3.5 s of it). Depth difficulty works well per enemy (Gunslinger average 42% -> 4% from d 0.1 to 0.9) but runs hit the same enemies at all depths, so the effect on a run is small.

The tiers are not monotone. At d 0.5 (average): Gunslinger 32%, Sheriff 35%, Train Guard 42%, Bounty Hunter 17% are the real pillars; Drunk 98%, Sniper 97%, Knife Thrower 86%, Horse Rider 79% are easy because the mechanics they were designed around (dodge, tracking, cover) are not in the game yet (sniper lead is 1000 ms, accuracy is irrelevant if the sniper never fires). Dual Wielder 49% is fair.

### 4.2 Bosses (average / skilled / expert clean-win at the depth a boss really has)
| Boss | novice | average | skilled | expert | note |
|---|---|---|---|---|---|
| McGraw in a 3-region run (d 0.42, hp 3) | 49% | 61% | 83% | 97% | easier than a regular Gunslinger (average 32% at d .5) |
| McGraw in a Dust-only run (d 1.0, hp 4) | 35% | 38% | 48% | 78% | |
| Undertaker (d 0.74, hp 4; phases 2-3 = phase-1 numbers) | 44% | 51% | 82% | 99% | |
| Lady Luck (d 0.7, hp 4, stub) | 36% | 36% | 46% | 74% | |
| El Diablo (d 0.95, hp 6, stub) | 32% | 30% | 26% | 54% | |

Boss fights last 3-6 s. McGraw phase 2 is reached 100% of the time, phase 3 62-90%, so the design is exercised, but every boss duel is still 100% won with 3 lives. Phase invulnerability is cosmetic (DuelSystem ignores it) and boss damage is 1 like everyone else. The same boss at depth 0.42 (hp 3) versus 1.0 (hp 4) is a 20-point swing for skilled players: the `bossHpFor` +1 at d >= 0.75 makes a Dust-only run harder than the first boss of a 3-region run.

### 4.3 Runs (3 regions, random perk picks, retries on, N=400 per skill)
| skill | run win | clear Dust Creek | Canyon (if reached) | Railroad (if reached) | run min | duels | hits taken | deaths | paid retries |
|---|---|---|---|---|---|---|---|---|---|
| novice | 88% | 97% | 94% | 97% | 6.1 | 13.2 | 6.1 | 0.3 | 0.2 |
| average | 98% | 99% | 99% | 99% | 6.1 | 13.3 | 4.3 | 0.1 | 0.0 |
| skilled | 100% | 100% | 100% | 100% | 6.1 | 13.4 | 2.2 | 0.0 | 0.0 |
| expert | 100% | 100% | 100% | 100% | 6.1 | 13.4 | 0.8 | 0.0 | 0.0 |

Coins earned per run 600 / 666 / 711 / 740 (novice to expert), about 290 spent, the rest held. Healing per run (average): rest 1.3, shop 1.5, tonic 0.2, boss 0.1, events 0.0: heals offset about 72% of the 4.3 hits taken. Perks owned at the end: about 20 (10 common, 7.6 rare, 1.7 legend taken). Under package C the same table is 16 / 30 / 59 / 77% run win, 1.3 deaths per run for average, 0.6 paid retries, 7-17 perks owned, 3.7 minutes per average run (deaths shorten runs).

Perk rarity seen on reward screens (average): common 44.8%, rare 43.8%, legend 11.4% of offers, cursed 0%. The nominal weights (60/30/4/6) are not what a player sees: elite rewards are rare+, boss rewards are rare+ with legend x4 (35% legend at a boss), and cursed (weight 6) only exists in the shop curse slot, so that weight is inert. Shop offers are not counted here.

### 4.4 Perks (stress scenario; full 57-row table in the report)
| Perk | rarity | run win delta | other | verdict |
|---|---|---|---|---|
| Tin Star | rare | +33.5pp (z 12.7) | 0.000 hits per duel | DOMINANT: invulnerability, because a duel has at most about one hit |
| Bullet Belt | common | +25.3pp | +133 coins, hits +0.7 | DOMINANT: +1 life while lives are the only attrition |
| Revive Flask | legend | +19.3pp | | strong but legend, once per run: acceptable |
| Tip Jar | common | +12.5pp | free tonic per rest | high for a common |
| Quickdraw Scar / Devil's Deal / Dead Eye / Cold Open | rare/cursed | +9 / +9 / +8 / +7pp | | healthy |
| Hex | cursed | -21.8pp | | harmful, no upside (curse slot only) |
| Glass Cannon | cursed | -23.5pp | 0.124 hits per duel | harmful: kills in 1 hit, but nothing needs killing faster |
| Mad Dog's Collar | cursed | -54.5pp | 0.606 hits per duel | broken: damage x2 for a crit nobody needs |

Under package C (average, baseline 30.0%): Tin Star +66.8pp, Bullet Belt +48.5pp, Revive Flask +27.8pp, Dead Eye +15.3pp, Quickdraw Scar +13.3pp, Cold Open +10.7pp, Spit and Polish +9.5pp, Healer's Touch +5.5pp, Tip Jar +4.7pp, Horseshoe +2.8pp. Life perks get more valuable the harder the game is.

Pick policies (stress): random 67%, smart 64%, tag:DRAW 69%, tag:AIM 60%, tag:LIFE 79%, tag:COIN 75%, tag:DODGE 63%. Life-first and coin-first builds win; AIM and DODGE builds lose to random because most of their perks are no-ops.

**No-op perks.** 23 of 51 non-cursed perks moved nothing in the sim. 16 have no engine hook (Ricochet, Buckshot Rounds, Rapid Fire, Called Shot, Hair Trigger, Bluff, Long Barrel, Marksman Pact, Ambidextrous, Bait and the dodge family: Counter Roll, Dust Kick, Matador, Slip Away, Tumble, Phantom Step). 5 are supported by DuelSystem but the player model never triggers them (Trick Shot needs prop shots, Steady Breath a still reticle, Last Stand 1 life, Second Wind a wounded start, Showman three Perfects in a row): their value is unmeasured, not zero. 2 are presentation-only (Tell Reader, Weak Spotter) and cannot show in win rate. The data `support` field is stale for several perks: Tin Star, Revive Flask, Dead Eye, Cold Open, Spit and Polish, Steady Hands and Mad Dog's Collar are marked `a02` but now work. Run/shop perks (COIN, LUCK) show no win effect by construction; their coin effect is real (Blood Money +893 coins per run, Bounty Hunter +462, Quickdraw Scar +110 through faster wins). `RunSystem.completeDuel` pays bosses with `coinMultElite`, so Bounty Hunter and Blood Money also multiply boss pay, which the perk text does not say.

### 4.5 Economy pacing (report section "Economy pacing")
Run outcomes come from the real run sim at each skill step and open region count, drawn into A09's own meta loop (`settleRunWithBounties`, `claimAll` once per run on a fresh day, greedy cheapest gameplay purchase). Median run index at which each tier is complete (typical learner, 15 meta seeds):

| coin supply | first unlock | tier 1 | tier 2 | tier 3 | tier 4 | Canyon bought | Railroad bought | banked per run | board per run |
|---|---|---|---|---|---|---|---|---|---|
| current data, board on | 1 | 3 | 20 | 25 | 26 | 5 | 12 | 244 | 297 |
| runs only (no board) | 1 | 5 | 37 | 42 | 62 | 18 | 36 | 156 | 0 |
| board x0.5 | 1 | 3 | 24 | 25 | 40 | 9 | 19 | 203 | 135 |
| board x0.25 | 1 | 3 | 29 | 31 | 49 | 12 | 26 | 188 | 62 |
| in-run coins x0.33 | 1 | 3 | 24 | 25 | 36 | 6 | 14 | 151 | 293 |
| first capture 15% -> 5% | 1 | 3 | 21 | 25 | 28 | 6 | 13 | 208 | 296 |
| package C difficulty | 1 | 3 | 31 | 26 | 50 | 9 | 22 | 107 | 167 |
| A09 documented | 2-3 | about 14 | about 27 | about 40 | about 52 | | | | |

Findings: (a) income is dominated by the bounty board (about 295 per run) plus the first run's first-capture bounties (a fresh meta banks about 280 on run 1, versus about 115 in steady state); (b) tier 3 is pinned at run 25 by the saloon gate (`saloon_3` needs 25 runs), so more coins never speed it up and fewer coins only slow tier 4; (c) tier 1 completes at run 3 because the first run already banks 250-300 coins and the saloon gate is 3 runs; (d) A09's curve is reproduced by runs-only income within 20% (tier 3 42 vs 40, tier 4 62 vs 52), so A09's crude run model was not far off on run income, it left the board out of the budget; (e) a harder game (package C) halves banked coins and slows tier 2 to 31 for a typical learner, 47 for a slow one.

### 4.6 Region length and run time (average skill)
| nodes per region | min per region | min per 3-region run | duels per run | clear region 1 (current data / package C) |
|---|---|---|---|---|
| 7 (current) | 2.1 | 6.1 / 3.7 | 13.3 / 8.6 | 99% / 51% |
| 10 | 2.8 | 8.0 / 4.8 | 19.7 / 12.6 | 96% / 51% |
| 14 | 3.9 | 9.0 / 5.0 | 24.2 / 14.3 | 74% / 35% |
| 20 | 5.4 | 10.1 / 6.0 | 29.0 / 17.9 | 54% / 29% |

A 7-node region has 4.6 duels on the shortest path (L0, two branch layers, boss) plus shop, rest and sometimes an event: 2.1 minutes. No node count reaches 10-15 minutes a region without making the early game brutal; the number of nodes also changes the hit budget, so length and difficulty must be tuned together.

## 5. Open questions

### 5.1 QA-09: `maxDisarms` default 2
The loop (reticle parked on the gun arm, autofire only) is real but, with default 2, not a free win on normal enemies. Limb camper with perfect placement versus the same duel at hp 2 / 4 / 6 / 8 / 12 (Gunslinger timings, d 0.5), mean hits taken (average player, normal play: 0.69 / 0.90 / 0.91 / 0.91 / 1.14):

| maxDisarms | hp 2 | hp 4 | hp 6 | hp 8 | hp 12 |
|---|---|---|---|---|---|
| 0 | 0.94 | 0.94 | 1.83 | 1.88 | 2.80 |
| 1 | 0.71 | 0.71 | 1.62 | 1.62 | 2.56 |
| 2 (current) | 0.71 | 0.71 | 0.71 | 1.64 | 2.58 |
| 3 (Disarmer perk) | 0.71 | 0.71 | 0.71 | 1.64 | 1.64 |
| infinite | 0.71 | 0.71 | 0.71 | 0.71 | 0.71 |

With cap 2 the loop is a free win for enemies up to hp 6 (current roster tops out at hp 4, bosses 3-6), and from hp 4 up it beats average normal play (0.71 vs 0.90 hits) with no skill beyond one reticle placement. Disarmer (+1) extends it to hp 8. Keep 2 for hp <= 3; use 1 for effective hp >= 4 and bosses (an `EnemyDef.maxDisarms` or encounter override). Not game-breaking today, hence rank 11. Side observation: disarm re-plans from the current enemy clock, so the pending shot after the last allowed disarm depends on the boss phase at that moment: McGraw d1 camper clean-win is 94% at cap 1, 2 and infinity but 16% at cap 3 (the third disarm lands in a short in-volley beat). Non-monotonic in the cap; worth a look by A02/A07.

### 5.2 PERFECT 220 ms vs display lag (FEEL_REVIEW item 6)
Perfect-draw rate (Bandit d 0.3):

| perfectMs | lag ms | novice | average | skilled | expert |
|---|---|---|---|---|---|
| 220 | 0 | 1% | 4% | 19% | 63% |
| **220** | **25 (current)** | **0%** | **1%** | **5%** | **26%** |
| 220 | 40 | 0% | 1% | 1% | 10% |
| 240 | 25 | 0% | 3% | 15% | 56% |
| 260 | 25 | 1% | 8% | 33% | 82% |

`displayLagCompMs` 20 (effective lag 5) and `perfectMs` 240 produce the same perfect rates (expert 56%, skilled 15%, average 3%), inside target P1. Prefer the compensation: the reaction time printed on screen then matches the player's real reaction. Do not do both (260-equivalent: expert 82%, skilled 33%). Clean-win is unaffected by 220 vs 240 (expert 98% either way), so PERFECT is cosmetic plus crit and the +30% aim budget.

### 5.3 Rookie accuracy about 25% (23% hit chance at aim 10-70)
Raising accuracy does nothing: novice clean-win vs Rookie is 98% at current accuracy, 97% at 31%, 97% at 46% and 96% at 56% hit chance. The Rookie dies before it fires because its tell lead is 900 ms against a novice kill time of about 700 ms. What moves it is the lead: with aim [4, 40] the novice rate is 96% at lead 900, 92% at 800, **89% at 750**, 86% at 700. Recommendation: lead 750 and aim [4, 40] together (T1 in band: 89%), which also gives the Rookie a real threat to the rare novice who flinches.

### 5.4 McGraw phase difficulty
Phase 2 is reached by everyone, phase 3 by 52-90%; the fight is 3.0-4.8 s. At d 0.42 it is easier than a regular Gunslinger. hp sensitivity at d 0.42 (clean-win average / skilled / expert): hp 3 61 / 83 / 97, **hp 4 49 / 57 / 82**, hp 5 47 / 44 / 59, hp 6 47 / 43 / 49. hp 4 puts average 12 points under a Gunslinger-equivalent and expert at 82% (near R2). The Dust-only run already gets hp 4 (+1 at d >= 0.75), so a 3-region run and a one-region run would then differ by one hp tier less; consider flattening `bossHpFor` for bosses. Phase counters (shoot the sign / barrel) cannot be evaluated, the player model never shoots props.

### 5.5 Difficulty ramp: one curve per run vs per region
Under package C (the only setting where it can show), average skill, region clear (R1 / R2 if reached / R3 if reached):

| ramp | average | skilled | expert |
|---|---|---|---|
| one curve per run (current) | 51 / 81 / 74% | 69 / 96 / 89% | 80 / 100 / 96% |
| restart each region (base 0.05 + 0.15 per region, +0.6 across the region) | 39 / 76 / 86% | 54 / 94 / 96% | 74 / 99 / 97% |
| one curve + 0.12 per region index | 51 / 71 / 77% | 69 / 92 / 87% | 80 / 99 / 96% |

(N=400 each.) Per-region restart makes region 1 harder (average 39 vs 51%) and region 3 easier (86 vs 74%), the opposite of a rising curve, and does not equalise risk. The steeper single curve lowers region 2 by ten points and leaves region 3 flat. All settings leave later regions easier than region 1 for survivors (71-86% conditional against 39-51%) because perks and gear snowball (about 10 perks by the end under C) faster than depth difficulty rises. Keep one curve per run; if later regions should stay at about 50%, add depth difficulty or a heal tax per region, not a reset. Note where package C kills: the optional Bounty Hunter elite ends 113 of 400 average runs in the first region and McGraw 62; if that feels punishing, use package B (boss-only 2-damage hits: 66 / 42%). Depth difficulty is also a weak lever in itself (+0.2 depth moves average run win 97 -> 95%).

### 5.6 GAME_DESIGN open questions
- Lives 3 vs 4: 4 lives is trivial (novice 3-region win 99%, everyone else 100%). 3 is already too many (section 6, rank 1).
- Retry cost `10 + 3 * layer` coins, once per node: retries are almost never bought today (0.0-0.2 per run) and affordable at death (held coins 86-340), so cost is not binding. Under package C 0.2-0.7 retries per run at 86-339 coins held: still affordable. Leave until package C is in, then re-measure; the cost only starts to matter if coin income drops (4.5).

## 6. Ranked recommendations

Confidence: **H** = the effect is large, repeatable across N, and the mechanism is understood; **M** = direction is solid, size depends on assumed player model or on a number I could not test; **L** = a judgement call backed by thin evidence. "Pkg C" means the combined package in section 6.2.

| # | Owner | File: constant | Current -> proposed | Evidence | Conf |
|---|---|---|---|---|---|
| 1 | A02 + A08 | `src/data/duelConfig.ts`: `damage.heroHp`; `src/systems/RunSystem.ts` `getDuel()` / `RUN_TUNING` (new `eliteDamage`, `bossDamage`) | 3 -> 2 lives; elite and boss duels get `config.damage.enemyDamage` x2 (GAME_DESIGN section 2: "elite/boss may hit for 2") | Package C: Dust Creek clear 97/99/100/100 -> 39/50/67/79% (novice/avg/skilled/expert), 3-region win 88/98/100/100 -> 16/30/58/75%. Lives 2 alone: 77/86/94/100%. 2-damage hits alone: 81/86/95/100%. | H direction, M size |
| 2 | A08 | `src/data/perks.ts`: `tin_star.duel.ignoreFirstHits` (1, all duels) | restrict to elites and bosses (`when: c => c.elite \|\| c.boss`) | 0.000 hits per duel, +33.5pp stress, +66.8pp under C. Elite/boss only: 100% -> 63.2% stress (baseline 66.5%), so near neutral; add a second clause (e.g. also at 1 life) if it should stay a pick. | H |
| 3 | A08 + A02 | `src/data/perks.ts`: the 16 engine no-ops (section 4.4); `rollPerkChoices` | gate offers on a `shipped` flag (or on `support === 'today'` plus the now-wired a02 perks) until the hook exists | 31% of non-cursed perks do nothing; P(a 3-perk offer has a dead pick) = 68%; tag:AIM and tag:DODGE builds underperform random by 7 and 4pp. Also refresh the stale `support` field (7 perks marked a02 now work). | H |
| 4 | A08 | `src/data/perks.ts`: `bullet_belt` (common, `heroHpDelta: 1`, `coinLossPerDuel: 1`) | at least rare; make the extra life cost something real, e.g. exclusive with `revive_flask`/`tip_jar`, or +1 life only from the first rest onward | +25.3pp stress, +48.5pp under C. Coin loss 1 -> 4 changes nothing (91.8 -> 91.5%): coins are not scarce, so a coin cost is no cost. Not simulated: the exclusivity variants. | M |
| 5 | A03 / A02 | `src/data/duelConfig.ts`: `draw.displayLagCompMs` (new, FEEL_REVIEW item 6) or `draw.perfectMs` | `displayLagCompMs` 20 and keep 220 (or `perfectMs` 240 and no compensation) | Perfect rate at lag 25: 0 / 1 / 5 / 26% -> 0 / 3 / 15 / 56% (novice/avg/skilled/expert) either way. Not both (82% expert at 260-equivalent). | H (equivalence), M (target) |
| 6 | A06 | `src/data/enemies.ts`: `rookie.tell.leadMs`, `rookie.aimErrorPx`; `bandit.tell.leadMs` | 900 -> 750 and [10,70] -> [4,40]; 620 -> 740 | Novice vs Rookie 98 -> 89% (T1 in band); novice vs Bandit 46 -> 55%, average 63 -> 84% (T2, T3 in band). Accuracy alone: no effect (98 -> 96%). | M |
| 7 | A06 | `src/data/enemies.ts`: `gunslinger.tell.leadMs`, `sheriff.tell.leadMs` | 560 -> 640; 600 -> 680 | Average clean-win at d 0.5: Gunslinger 32 -> 43%, Sheriff 35 -> 45% (T4 in band 40-60); novice 13 -> 19 / 20 -> 25%. Skilled 55 -> 78%. | M |
| 8 | A08 | `src/data/perks.ts`: `mad_dogs_collar.duel.enemyDamageMult` | 2 -> 1.5 | Stress win 12.0% -> 70.5% (baseline 66.5%): from -55pp to neutral. Crits are irrelevant when duels already end in 2 shots, so the curse has no upside to pay for the penalty. | H |
| 9 | A07 | `src/data/bosses.ts`: `mad_dog_mcgraw.hp`; `bossHpFor` | 3 -> 4; drop or soften the +1 at d >= 0.75 | McGraw at d .42: average 61 -> 49%, skilled 83 -> 57%, expert 97 -> 82% clean. Today he is easier than a Gunslinger. | M |
| 10 | A09 | `src/data/missions.ts`: bounty board reward values (all rewards) | x0.25 to x0.5 | Typical learner tier 2 / 3 / 4 at run 20 / 25 / 26 -> 29 / 31 / 49 (x0.25) or 24 / 25 / 40 (x0.5); A09 target 27 / 40 / 52. Tier 3 stays gate-bound at 25 unless `saloon_3` run gate also rises (e.g. 25 -> 35). Assumes one run and one full board claim per day, as A09's test does. | M |
| 11 | A06 + A02 | `src/data/enemies.ts` Sniper / Knife Thrower / Horse Rider `tell.leadMs`; or implement dodge and tracking | interim: Sniper 1000 -> 760, Knife Thrower 780 -> 660, Horse Rider 820 -> 680 | Average clean-win at d .5: Sniper 98 -> 81%, Knife Thrower 85 -> 52%, Horse Rider 79 -> 60%. These enemies are easy only because dodge/tracking are missing; re-tune when those land. | L |
| 12 | A02 / A07 | `src/data/duelConfig.ts`: `fairness.maxDisarms`; per-enemy override | keep 2 for hp <= 3; 1 for effective hp >= 4 and bosses | Section 5.1 table: cap 2 is a free win up to hp 6 and beats normal average play from hp 4. Disarmer (+1) extends to hp 8. Not game-breaking at today's hp. | L-M |
| 13 | A08 | `src/systems/RunSystem.ts`: `RUN_TUNING.bossHeal`, `healPrice` | `bossHeal` 1 -> 0 | 3-region win novice 89 -> 71%, average 97 -> 92%, Dust Creek clear unchanged. `healPrice` 20 -> 40 has no effect (coins not scarce). Do this after rank 1, it is a novice lever. | M |
| 14 | A08 | `src/data/regions.ts`: `nodeCount` / re-scope the L1 target | decide: keep 7 and call the target "10-15 min per full run" (7 regions = about 15 min), or 10-14 nodes with package C | 2.1 min per region now; 20 nodes needed for 5.4 min. No setting reaches 10-15 min a region. Length and difficulty are coupled (clear region 1 falls from 99% to 54% between 7 and 20 nodes at current data). | M |
| 15 | A08 | `src/systems/RunSystem.ts` `completeDuel()`: `coinMultElite` for bosses | use a separate boss multiplier, or document | Bosses use the elite multiplier, so Bounty Hunter's creed and Blood Money double boss pay. Measured Bounty Hunter +462 coins per run (stress). Read from code; attribution of the full +462 is probable not proven. | M |
| 16 | A08 | `src/systems/RunSystem.ts` `difficultyAt()` | keep one curve per run; no per-region reset | Section 5.5 (package C, average): reset gives R1 39% / R3 86% (inverted curve); +0.12 per region index gives 51 / 71 / 77% against 51 / 81 / 74%. | M |
| 17 | A09 | `src/data/economy.ts`: `RUN_END.firstCaptureRate` | 0.15 -> 0.05 | First run banks about 280 vs 115 in steady state; tier 4 26 -> 28 (small). Cosmetic for pacing, but removes a 2.4x windfall on run 1. | L |
| 18 | A08 | `src/data/perks.ts`: `hex`, `glass_cannon` | review or give an upside | -21.8pp and -23.5pp with no measurable upside. Curse-slot only, so low impact. | L |

### 6.1 One change at a time (current data; Dust Creek clear / 3-region win)
| scenario | novice | average | skilled | expert | hits/run |
|---|---|---|---|---|---|
| baseline | 97 / 89% | 99 / 97% | 100 / 100% | 100 / 100% | 4.3 |
| no perks taken at all | 97 / 75% | 98 / 94% | 100 / 99% | 100 / 100% | 6.3 |
| lives 3 -> 2 | 77 / 50% | 86 / 76% | 94 / 93% | 100 / 100% | 4.0 |
| lives 3 -> 4 | 100 / 99% | 100 / 100% | 100 / 100% | 100 / 100% | 4.3 |
| boss heal 1 -> 0 | 97 / 71% | 99 / 92% | 100 / 100% | 100 / 100% | 4.2 |
| shop heal 20 -> 40 | 96 / 87% | 99 / 97% | 100 / 100% | 100 / 100% | 4.4 |
| boss hits for 2 | 92 / 69% | 97 / 91% | 100 / 100% | 100 / 100% | 5.2 |
| boss and elite hit for 2 | 81 / 61% | 86 / 80% | 95 / 95% | 100 / 100% | 5.4 |
| enemy hit tolerance 24 -> 32 px | 96 / 81% | 99 / 96% | 100 / 100% | 100 / 100% | 5.0 |
| draw animation 120 -> 180 ms | 96 / 83% | 98 / 94% | 100 / 100% | 100 / 100% | 4.8 |
| aim slow-mo 0.35 -> 0.5 | 96 / 85% | 99 / 95% | 100 / 100% | 100 / 100% | 5.0 |
| aim slow-mo off (1.0) | 92 / 70% | 97 / 89% | 98 / 96% | 100 / 100% | 6.2 |
| enemy reload 1500 -> 700 ms | 97 / 87% | 99 / 97% | 100 / 100% | 100 / 100% | 4.3 |
| enemy tell lead x0.85 (floor 450) | 95 / 82% | 98 / 93% | 100 / 99% | 100 / 100% | 5.1 |
| enemy hp +1 on tier 2+ | 96 / 82% | 99 / 94% | 100 / 99% | 100 / 100% | 5.1 |
| depth difficulty +0.2 | 97 / 86% | 99 / 95% | 100 / 99% | 100 / 100% | 4.8 |

Even removing slow-mo entirely leaves the average player at 97%: more hits are not enough because the heal economy (about 3 heals per run) and the perk snowball absorb them. Only a cap on lives, with damage that can take two lives in one blow, produces real failure.

### 6.2 Candidate packages (Dust Creek clear / 3-region win; targets R1: 15-30 / 35-50 / 65-80 / 85-95)
| package | novice | average | skilled | expert |
|---|---|---|---|---|
| baseline | 97 / 89% | 99 / 97% | 100 / 100% | 100 / 100% |
| A: lives 2 | 77 / 50% | 86 / 76% | 94 / 93% | 100 / 100% |
| B: lives 2 + boss hits for 2 | 51 / 23% | 66 / 42% | 89 / 79% | 99 / 98% |
| **C: lives 2 + boss and elite hit for 2** | **39 / 16%** | **50 / 30%** | **67 / 58%** | **79 / 75%** |
| D: lives 3 + boss and elite hit for 2 | 81 / 61% | 86 / 80% | 95 / 95% | 100 / 100% |
| E: C + boss heal 0 + shop heal 40 | 36 / 14% | 49 / 27% | 67 / 58% | 79 / 75% |
| F: C + tell lead x0.9 + hit tolerance 28 | 30 / 10% | 46 / 24% | 62 / 50% | 75 / 71% |
| G: lives 2, lead x0.8, tolerance 30, draw 160, boss heal 0, shop heal 40 (no 2-damage hits) | 50 / 9% | 65 / 20% | 81 / 56% | 97 / 94% |

C meets the average and skilled bands and sits 9 points high for novice and 6 low for expert; it needs only two knobs that the design doc already describes. F brings the novice into band at the cost of skilled (62). G needs five number changes and gives a flatter skill gradient (expert 97). A novice at 39% is not necessarily wrong for a first-region boss; I would take C and look at novice onboarding (Practice mode, rank 6) before shrinking the skill band further.

## 7. Limitations and how to extend

- The skill models are assumptions, not measurements. Replace `scripts/sim/skills.ts` values with telemetry or a playtest session (reaction medians, flinch rate, accuracy) and re-run; the tables will move, the rankings of levers should not (verify with `npm run sim -- --only=levers,packages`).
- A policy bot plays runs. A human takes better shop and node decisions than the bot, and worse ones under stress; perk deltas are single-perk and do not capture combos (the `synergy` tags). Run-level numbers are uncertain by about plus or minus 3pp at N=400.
- Not modelled: dodge (no action), real prop shots (Trick Shot, McGraw's sign and barrel), called shots, the Wanted Poster choice, wager, whiskey rerolls, daily duel. Armour, evasion and motion are driver-side approximations.
- Boss stubs (Undertaker phases 2-3, Lady Luck, El Diablo) run their phase-1 numbers; their rows are placeholders until A07 builds them.
- The meta loop reuses A09's assumptions (one run per day, full board claimed). If players run several times a day the board income per run falls and the economy gets slower than shown.
- Standard error of a clean-win cell at N=1000 is about 1.5pp; a region-clear cell at N=400 about 2.5pp.
- To add a what-if: write a `Lever` in `scripts/sim/levers.ts` (`patch` mutates data, `opts` sets `RunSimOptions`) and run `npm run sim -- --only=levers,packages`. To audit a new perk: `--only=perks,whatifs` (add an entry to `PERK_WHATIFS`). Files: `skills.ts` (player), `duelSim.ts` (duel driver), `runSim.ts` (run driver and policies), `sections.ts` (every report section), `report.ts` (profiles, assembly), `levers.ts` (scenarios), `scenarios.ts` (in-memory patching), `run.ts` (CLI).
