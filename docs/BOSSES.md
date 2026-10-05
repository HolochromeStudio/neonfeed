# Bosses

Owner: A07. Code: `src/data/bosses.ts` (data), `src/systems/BossSystem.ts` (controller + encounter state machine). Tests: `tests/boss.test.ts`. No Phaser imports. Randomness only via the Rng DuelSystem passes in (D4).

## Usage
```ts
const { opponent, boss, enemyHp } = createBossEncounter('mad_dog_mcgraw', rng, difficulty /* 0..1 */);
const duel = new DuelSystem({ seed, opponent, enemyHp });   // enemyHp = bossHpFor(def, difficulty): 3 (4 at difficulty >= 0.75)
boss.attachDuel(duel);                                       // hp -> phases, defeat, failure, retries, prop hits
boss.events.on('onPhaseChange', e => ui.banner(e.name, e.signpost, e.lines));
```
`createBossOpponent(bossId, rng, difficulty)` alone gives just the controller. `BossSystem` also works without a duel (call `start/beginFight/updateHp/propHit/playerDefeated/restartAttempt/advanceTo` with ms timestamps).

## Encounter state machine
`idle -> entrance -> fighting -> defeated (terminal)` or `fighting -> failed -> (restartAttempt) fighting`.
| Event | When |
|---|---|
| `onEntrance` | once on `start`: banner, subtitle, camera id, entrance dialogue lines, phase-1 tell id to preview, arena id |
| `onFightStart` | entrance over (`advanceTo`), or first cue/hit |
| `onHpChange` | every boss hp change |
| `onPhaseChange` | once per phase, in order (1->2, 2->3; a big hit that skips a threshold fires both in order; a killing blow fires none). Carries name, signpost text, phaseChange dialogue line, windUpMs, invulnerableMs |
| `onInvulnerable` / `onVulnerable` | short window after a phase change (500/600 ms for McGraw, max 800), ended by `advanceTo` |
| `onEnvironment` | a boss prop target shot in a phase where it matters (once per phase): effect key + stagger |
| `onFailure` | player lost: phase, F4 cause, per-phase hint, retryable |
| `onAttemptRestart` | retry: back to phase 1, full hp, same seed (F5) |
| `onDefeat` | once; reward id and defeat lines. Terminal: every later call is a no-op |

`attachDuel` wires `onWait` (attempt 1 starts the entrance, later attempts restart), `onCue`, `onHit` (enemy -> hp from `duel.snapshot()`, prop -> `propHit`), `onShot`, `onResolve`.

## Controller (OpponentController plus extras)
Extras: `phase`, `setPhase`, `tellKind`, `fakeTell`, `shots`, `dodgeWindowMs`, `aimBudgetScale`, `shotPlans` (per-shot telegraph plan: `tellAtMs`, `leadMs`, `delayMs`, `fake`, `pattern`), `stagger(ms)`.
Rng draws per call are fixed: `waitMs` 2, `drawMs` 1, `shotDelayMs` 3, `aimErrorPx` 1, so streams never drift between phases. `waitMs` resets the controller to phase 1 (a new attempt). A phase change takes effect from the next shot DuelSystem has not planned yet (DuelSystem plans one shot ahead), starting a fresh volley after the wind-up.

Every lethal shot has its own tell at least 450 ms before it: the first shot from the cue; an opener from its tell; a follow-up's tell is the beat that starts at the previous shot (gap >= 450). Difficulty only changes fake chance, aim error (x0.72), WAIT spread and follow-up tempo (x0.85, floor 450). Stagger and wind-up only add time.

## Mad Dog McGraw (implemented, 3 hp, Dust Creek)
Tell language: dog growl + eye flash. Fake: whine + ear twitch (own kind, F6). Timing: WAIT 1.5-2.9 s, reaction 100-170, draw 260-340.
| Phase | Enters at | Behaviour | Signpost / counter |
|---|---|---|---|
| 1 Straight Duel | start | one shot per tell, tell lead 720-840, 900 ms quiet between shots, no fakes | "Growl, flash, bang." Faster draw or gun-arm hit |
| 2 Rage | hp <= 67% | volleys of 2: follow-up on a 640-760 ms beat (own tell), opener preceded by a fake whine 50-90% of the time (real tell >= 450 ms after the fake ends) | "Whine and twitch is a fake. Wait for the eye flash." Shoot the sign: +700 ms stagger |
| 3 The Charge | hp <= 34% | volleys of 3 on one tempo (470-540 ms beat, picked once per volley), pattern bark-bark-BANG, no fakes, scene may shrink aim budget to 0.8x | "Bark, bark, BANG on the beat." Gun-arm hit cancels a shot (maxDisarms 2); shoot the barrel: +900 ms |
Reward `legend_mad_dog_fang`, unlocks Canyon. Failure hints per phase in data.

## Other bosses: data complete, behaviour TODO
`implemented: false`: the controller runs their phase-1 numbers in every phase (stub), the encounter machine, events, rewards, failure, hints and dialogue all work.
| Boss | hp | Tell | Phases (data) | TODO |
|---|---|---|---|---|
| The Undertaker (canyon) | 4 | bell toll countdown, fake = muffled toll | 1 behind coffin, 2 dynamite (target `dynamite`), 3 pallbearer adds | cover (needs armour-like body block), dynamite prop, multi-enemy adds |
| Lady Luck (saloon) | 4 | card flick, fake = riffle | 1 cards (pick a rule), 2 dice (rule shown before beat), 3 roulette (bet a zone) | card-pick/bet UI, per-beat rule modifiers, zone bonus |
| El Diablo (blackwater) | 5 | matches phase: fog flicker / mirror flash / medley | 1 fog silhouette, 2 mirror image, 3 every tell in sequence | decoy target in DuelSystem, per-shot tell kinds, lantern light |
Unique reward ids: `legend_undertaker_bell`, `legend_lady_luck_ace`, `legend_devil_horn`. Arena ids `canyon` is not built yet (`getArena` falls back to Dust Creek). `el_diablo` uses `dust_creek_night` until a Blackwater arena exists.

## Proposed additions (A02/A03/A11), all optional and ignored today
1. **Invulnerability**: DuelSystem could skip damage while `boss.isInvulnerable(now)`. Today it is cosmetic (banner/flash). If enforced, the boss's pending shot must also be held until the window ends, or F3 is broken.
2. **Stagger**: after a prop hit DuelSystem should push the pending enemy shot by `staggerMs` (adds time only). `BossSystem` already calls `opponent.stagger`, which delays only shots planned afterwards.
3. **Aim budget**: apply `opponent.aimBudgetScale` (>= 0.7) to the aim budget; slow-mo stays (F7).
4. **Scene**: for each shot read `opponent.shotPlans[snapshot().enemyShotIndex]`: play `fake` at `startMs`, the real `tellKind` at `tellAtMs`, `pattern` as the on-screen beat. Wire DuelScene prop ids: arena target ids are `sign` and `barrel_target`; the duel prop is `barrel` (both accepted).
5. **Hp tiers**: `bossHpFor` is 3 (+1 at difficulty >= 0.75); phase thresholds are fractions, so they scale.
6. **Arena**: add a `canyon` arena (A11) for the Undertaker.
