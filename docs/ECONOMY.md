# Economy and Meta Progression (A09)

One currency: **coins** (D3). No gems, energy, timers, or pay-to-win. Meta unlocks are options (sidegrades, regions, looks), never raw power.
Code: `src/data/economy.ts`, `src/data/missions.ts`, `src/systems/EconomySystem.ts`, `src/systems/BountySystem.ts`. Tests: `tests/economy*.test.ts`, `tests/bounty.test.ts`. Numbers are starting values for A18.

## Run-end conversion (`settleRun`)
Pure: `settleRun(meta, RunSummary) -> MetaSave`. `computeSettlement` gives the breakdown for the Results screen (`banked`, `bountyFirst`, `bountyRepeat`, `total`).
| Source | Rule |
|---|---|
| In-run coins held at end | 40% on death, 50% on victory (spent coins are already gone: shops are real sinks) |
| Poster first capture | 15% of the `wanted.ts` reward, once per poster ever, cap 300 (`stats.capture_<id>`) |
| Poster repeat capture | 3% of reward, once per poster per run, cap 40 |
| Hard cap | 5000 coins banked per run |
| Practice mode | pays and records nothing |
Also updates stats: `runs, wins, duels_won, perfect_draws, headshots, no_damage_duels, bosses_defeated, boss_<id>, region_clear_<id>, capture_<id>, coins_lifetime`, and `bestReactionMs`. Missions: `settleRunWithBounties(meta, summary, dayKey)` = settle + mission progress.

## Catalogue and saloon flow
`purchase(meta, id)` / `tryPurchase` (reason codes) / `checkPurchase` / `canAfford(meta, id|cost)`. Atomic, non-mutating, idempotent, never negative.
The **Saloon** has levels 1-3 (`saloon_1..3`, 250 / 600 / 1500 coins, run-count gated 3 / 12 / 25, must be bought in order). Level N opens tier N+1 stock; this is the "tier unlock". Tier-1 stock needs no saloon level.
| Tier | Gameplay items (price) |
|---|---|
| 1 | Lawman's Special 80, Rabbit's Foot 130, Bullet Necklace 150, Drifter 150, Saloon 1 (250) |
| 2 | Hand Cannon 320, Brass Compass 340, Silver Spur 380, Outlaw Belle 360 (25 perfect draws), Canyon 400 (beat Mad Dog), Saloon 2 (600) |
| 3 | Derringer Pair 800, Widow's Locket 850, Old Marshal 900 (2 run wins), Railroad 900 (beat Undertaker), Saloon 3 (1500) |
| 4 | Golden Colt 1800, Devil's Tooth 2000, Masked Rider 2000 (stat gates: bosses defeated 6-8). Staged regions 4-7 are listed but unbuyable (`staged`) |
Cosmetics (80-1000) are pure looks, tier-gated by saloon level, not part of pacing. Starters (Peacemaker, Gunslinger, Dust Creek) are implicitly owned: `isOwned` is true, they are never in `meta.unlocks`.

## Target curve (and how it is tested)
- First meaningful unlock after ~2 runs (median 2-3).
- A full tier completes every ~10-15 runs (median gaps 8-18 in tests). Simulated medians: tier 1 about run 14, tier 2 about 27, tier 3 about 40, tier 4 about 52.
- Nobody finishes tiers 1-3 before run 25, even when lucky.
`tests/economyCurve.test.ts` simulates 15 seeds x 90 runs: skill grows 0.022/run, region-by-region runs, greedy cheapest-gameplay-first buying, daily board claimed every run. If A18 changes prices or rates, re-run it; it is the pacing regression test.

## In-run shop (`shopPrice(id, ctx)`, paid from run coins)
Base: common perk 45, rare 90, legend 180, cursed 30, consumable 30, heal 40, remove curse 60, reroll 12 (+8 per reroll, max 60), retry 30 (+15 per depth).
Perk/consumable prices scale +6% per depth (cap 2x). Context: `depth, rerollCount, regionId (goldspire x1.15), priceMult (Blood Money = 2), discount (max 70%)`. Result is always an integer >= 1; unknown ids return `Infinity`. Perk sell value = 40% of base (`perkSellValue`). `spendRunCoins` is the atomic in-run spend.

## Bounty board and missions
- All rotation is seeded by a caller-supplied date key `"YYYY-MM-DD"` (FNV-1a hash into `Rng`); no clock reads. Week key = Monday of that week.
- Per day: 3 daily missions (distinct events), 2 weekly (stable for the week), 3 wanted-poster contracts (easy / mid / hard) paying 20% of the poster reward rounded to 5 (5-150). Plus 11 permanent achievements.
- Events: `duel_won, perfect_draw, headshot, no_damage_duel, boss_defeated, wanted_defeated, region_clear, run_played, run_won`. `eventsFromRun(summary)` builds a batch; `applyMissionEvents(meta, events, dayKey)` applies it. `perRun` missions use the best single batch, so feed them a whole run. Progress is monotonic and capped at target.
- `claimMission` is idempotent. **Ethics:** no streaks, no login rewards, no expiry of completed missions (they stay claimable until claimed; `pruneMissions` only drops incomplete stale ones).
- Stored in existing `meta.missions` keyed `defId@period` (`bounty_<enemyId>@<day>` for contracts, bare id for achievements).
- Max repeatable board income per day is under 400 coins (tested), versus 80-250 for tier-1 items.

## Anti-exploit checks (tested)
Only starters cost 0; requirement graph is acyclic and every non-staged item is reachable; unknown stat keys and non-boss `boss_` gates fail the test; purchases never add coins; spend equals the sum of owned prices; per-run bank is capped; contracts always pay less than the poster; repeat captures once per run.

## No SaveManager change needed
Everything fits the current `MetaSave` v1: `coins`, `unlocks.*`, `missions`, `stats` (saloon level in `stats.saloon_level`). No migration required. Optional future additions for A14 (not required): `stats` is an open number map, so new counters are free. If a "last claimed day" or equipped loadout is wanted, add `loadout: { weapon: string; charm: string; character: string }` with migration v1->v2 `d => ({ ...d, loadout: { weapon: 'peacemaker', charm: '', character: 'gunslinger' } })` and extend `validateMeta`. Equipped items are the UI/run owner's concern today.

## Integration notes
- A10 UI: show `checkPurchase(...).reason` ('locked' -> list `unmetRequirements`), results breakdown from `computeSettlement`, board from `getBoard(meta, dayKey)`.
- Caller supplies `dayKey` (local date string). Daily Duel one-attempt enforcement is not here.
- A08: `RunSummary.defeated` needs one wanted id per duel won (repeats allowed); `shopPrice` context takes depth and perk multipliers.
