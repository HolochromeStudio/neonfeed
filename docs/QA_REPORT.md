# QA Report: Gate B (duel logic)

Owner: A17 QA. Scope: `DuelSystem`, `DrawSystem`, `DamageSystem`, `TargetSystem`, `InputSystem`, with `src/data/duelConfig.ts`.
Method: adversarial and property tests in `tests/qa/**`. No `src/` file was modified. Known bugs were pinned with `it.fails`; all have since been fixed and the pins converted (see Gate B re-check). The "Bugs found" section below is the original (pre-fix) record.

Run result (`npm test`, whole repo): 16 files, 307 tests, 0 failing. 8 of those are `it.fails` known-bug pins (listed below). `tsc --noEmit` is clean for `tests/qa`.

## What was tested

| File | Content |
|---|---|
| `tests/qa/duelFuzz.test.ts` | Seeded-Rng fuzz, 5000 runs each for normal timing, wild timing (zero gaps, 5 s jumps, backwards stamps) and hostile coordinates (NaN, +-Infinity, -1e6, 1e9). Random hero/enemy hp 1..6 and random opponent params, including extreme ones. Invariants checked after every input: never throws, phase valid, hp finite, in [0, max], never negative, `now` never goes backwards, event times never go backwards, outcome set iff RESOLVE/RETRY, exactly one `onResolve` per attempt, WIN implies enemy hp 0, LOSE implies hero hp 0, only legal phase edges, F1 (first enemy shot >= 450 ms after cue), F5 (plan identical on every retry), no NaN. A coverage test guards against vacuous passes: the fuzzer reaches WIN, LOSE, every phase except WAIT, retries and 2 or more loss causes. Determinism: `replayDuel` of `inputLog` matches the live run (2000 runs), and frame-stepped play (16.7 ms `advanceTo` between inputs) matches unstepped play (1500 runs, 0 divergences). Retry reproduces the enemy shot ms on 4 consecutive attempts (1000 runs). 3000 extreme-config runs (slowMo 0..5, damage 0..1e9, gaps 0, assist 400 px, etc.). |
| `tests/qa/duelEdge.test.ts` | Time: NaN, Infinity, negative dt, past-stamped input, 5 s jumps while waiting and while aiming. Coordinates: nasty values for aim and fire, fire without a reticle, fire with only x. Wrong-phase input: after resolve, during RESOLVE, double retry (input and API), draw/lift spam, flinch grading. Exact-ms ties: draw at cue ms and cue-1, fire at the lethal enemy ms and +1, draw at the enemy-shot ms, autoFire deadline vs enemy shot. Disarm and its aftermath. Extreme config: hp 0 and 1, huge damage, slowMo 0, zero-gap shot flood (hang guard). Throwing listeners, a listener that calls `retry()`, `inputLog` clamping. |
| `tests/qa/drawBoundaries.test.ts` | Tier boundaries 219/220/221, 349/350, 549/550 plus fractional and extreme values, both through `gradeDraw` and through real duel input. Crit and budget bonus only for perfect. Flinch shifting the boundary. |
| `tests/qa/targetEdge.test.ts` | Assist at exactly 14 px (14 hit, 14.0001 miss, diagonal euclidean, via the full duel), zone priority (head > limb > prop > body), tie-breaking independent of array order, hostile numbers, degenerate rects. |
| `tests/qa/inputEdge.test.ts` | Swipe thresholds exactly (28 px, 600 ms, 60 deg), zero-length swipe, NaN samples, 5000-run noise fuzz, `SwipeTracker` lifecycle, multi-touch. |
| `tests/qa/helpers.ts` | Shared recorder, random log, opponent and config generators. |

## Bugs found

Severity: High = can break a live session. Medium = reachable in plausible play or integration. Low = config or edge only.

### QA-01 (Medium): a NaN timestamp poisons the clock and can freeze the enemy forever
Pins: `advanceTo(NaN) must not poison the clock`, `a NaN timestamp mid-duel must not make the enemy immortal` (both `it.fails`).

Cause: `advanceTo(t)` guards with `if (t < this.now)`, which is false for NaN. `step(NaN)` then passes `t <= now` (false) and sets `now = NaN`. If the cue has already fired, `enemyT += NaN * scale` makes `enemyT` NaN permanently. `enemyRealTime()` is then NaN, `NaN < t` is false, and the enemy never shoots again. The hero becomes immortal until retry. Before the cue, the clock self-heals on the next finite call (pinned as a passing test). `inputLog` also records the NaN stamp.

Repro:
```ts
const d = new DuelSystem({ seed: 1, heroHp: 1 });
d.advanceTo(1100);                    // cue fired
d.input({ type: 'hold', t: NaN });
d.advanceTo(101000);                  // still CUE, hero alive
```
Likely trigger: a bad `dt` or `performance.now` hiccup in the scene, or a 0/0 in a future input adapter.

Fix: at the top of `advanceTo`, use `if (!Number.isFinite(t) || t < this.now) return;` (or `t = this.now`). Do the same in `input`, which should also drop non-finite `ev.t`.

### QA-01b (Medium): `advanceTo(Infinity)` leaves `now = Infinity`, which soft-locks later play
Pin: `after advanceTo(Infinity) a retry must still be playable` (`it.fails`). The duel itself terminates correctly (the loop is guarded). Afterwards `now` is Infinity, so every later finite `advanceTo` is clamped to the past. A retry then starts at `Infinity`, with the cue deadline at `Infinity`. The same one-line fix as QA-01 covers it.

### QA-03 (Low): hp 0 start values give inconsistent outcomes
Pins (`it.fails`): `enemyHp 0 is already dead: a hit must WIN`, and `heroHp 0: the duel should not start already lost on a missing enemy shot`.
- `enemyHp: 0`: `applyDamage` returns `killed: false` for an already-dead target, so the enemy is invulnerable and a hit never produces WIN.
- `heroHp: 0`: the hero is dead from the start but only LOSEs if an enemy shot happens to hit. A missing shot lets the duel continue with a dead hero.

Reachability: future perks or depth scaling (A08) that subtract hp to 0 or below. Fix: clamp hp to `max(1, hp)` in the constructor, or treat `isDead` after a shot regardless of `res.killed`.

### QA-04 (Low): `applyDamage(h, NaN)` sets `hp = NaN`
Pin (`it.fails`). `amount <= 0` is false for NaN, so `Math.max(0, hp - NaN)` gives NaN, and the duel then never ends on hp. Likely source: a config or multiplier typo (for example `Infinity * 0`, `undefined * n`). Other hostile amounts (negative, 0, Infinity, 1e308) are handled correctly (tested). Fix: `if (!(amount > 0)) return ...` (this also covers NaN).

### QA-07 (Low): backwards pointer timestamps manufacture a swipe
Pin: `timestamps going backwards must not manufacture a fast swipe` (`it.fails`). `analyzeSwipe` clamps `dt` to 1 ms, so a sample stamped earlier than the previous one reads as 40 px/ms. Real browsers rarely produce this, but replayed or merged event streams could. Fix: skip samples with `t < previous.t`, or treat negative dt as an invalid sample.

### QA-07b (Medium, integration): `SwipeTracker` has no pointer identity, so multi-touch can fake a draw
Pin: `multi-touch: two stationary fingers interleaved must not read as one swipe` (`it.fails`). `begin`/`move` take only coordinates. A second finger resting elsewhere (for example a thumb on the holster zone while the other hand taps) produces `move` events that are appended to the first finger's samples. A 200 px "jump" in 8 ms registers an instant PERFECT draw. A second `begin()` also silently discards a swipe in progress. DuelScene (A02) must filter by `pointer.id` (track only the first active pointer) before calling the tracker. This was not verified in the scene because Phaser is not unit-testable here. The unit-level API should take an id, or the scene must own the guard. Needs a scene-level review.

### QA-06 (Low): phase events are inconsistent around WAIT and retry
`begin()` assigns `phase = 'WAIT'` directly, without `setPhase`. `onPhase` therefore never reports WAIT, neither at construction nor after a retry. Listeners that mirror state from `onPhase` see RETRY or RESOLVE and then CUE with `prev: 'WAIT'`. They must also use `onRetry` and `onWait`. The test helper's legal-edge table encodes this. Fix: emit `onPhase` from `begin()` on retry, or document it in the file header.

### QA-08 (Low): NaN leaks to `onShot` for a fire with no reticle
Firing before any aim (auto-fire with no touch) emits `onShot` with `x: NaN, y: NaN`. Pinned as current behaviour, with a comment in the test. VFX and audio consumers (A03, A13) that use these as positions will propagate NaN into Phaser sprites. Fix: emit the hero-facing default aim point instead, or make `x`/`y` optional in the event type.

### QA-09 (Balance observation, not a bug): limb auto-fire is a zero-risk loop
With the reticle parked on the limb zone, auto-fire re-hits it every follow-up (about 600 ms real time). Each limb hit cancels the pending enemy shot and re-plans it at least 250 ms of enemy time out. The enemy clock runs at 0.35 while aiming, so the enemy gains about 307 ms per cycle against a required delay of 650 ms and never fires. The enemy dies after hp / 0.75 shots without ever shooting (pinned by test `OBSERVATION: reticle parked on the limb...`). With default `enemyHp 2` this takes 3 shots and is harmless. It becomes a free win on deeper, higher-hp enemies. Suggest A18 / A06: cap consecutive disarms per enemy, or add a limb damage floor or diminishing returns.

### Not bugs (verified)
- Tie rule: a player input on the same ms as an enemy shot lands first, and an autoFire deadline also precedes an enemy shot on the same ms (tested).
- Exactly one resolution holds in every fuzz run, including after a listener that retries from `onResolve`.
- F1 holds for opponents that request 0 or negative timings. F5 holds across 4 retries.
- Frame-stepped and unstepped runs agree, even with the 0.35 slow-mo factor (no float-rounding flips seen in 1500 runs).
- The 14 px assist boundary is inclusive and euclidean. Priority is head > limb > prop > body.
- Grade boundaries: 219 perfect, 220/221 good, 349 good, 350 ok, 549 ok, 550 slow.
- A throwing event listener never breaks the duel.
- `DuelScene` calls `advanceTo(this.nowMs())` with no dt clamp. A 5 s tab-background jump while aiming replays the whole interval, including auto-fire shots and enemy shots, in one call. It terminates and stays valid (tested), but the player can lose or win "offscreen". Suggest the scene pause on `visibilitychange` or clamp dt (design decision for A02/A01).

## Coverage gaps
- No Phaser or scene-level tests: `DuelScene` pointer-id handling, multi-touch, `visibilitychange`, orientation changes, and any use of `reticleFromTouch` are untested.
- `OpponentController` implementations that return NaN or Infinity are not fuzzed here (`enemyAI.test.ts` covers the real AI's F1). `DuelSystem` does not sanitise them: `Math.max(NaN, x)` is NaN.
- Real wall-clock behaviour (long frames, `performance.now` drift) is simulated only via `advanceTo`.
- Audio and haptics side effects are discarded (`quietAudio`); event-order assertions on `audioBus` are not included.
- Fuzzed hp is capped at 10 and uses `Fixed` or `BasicOpponent` only. Other AI types (boss, dual-wield) were not exercised through `DuelSystem`.
- No save, economy, or run-system coverage (out of scope for this gate).
- `describeLoss` text is not checked against F4 for every cause.

## Gate B re-check (after A02 fixes, commit ec7828f)

### 1. Review of A02's edits to `tests/qa`
| Edit | Verdict |
|---|---|
| `.fails` removed on QA-01, 01b, 03 (enemyHp 0, heroHp 0), 04, 07 | Legitimate: the bugs are fixed and the assertions are unchanged. |
| `helpers.ts` LEGAL table gains `WAIT->WAIT`, `RESOLVE->WAIT`, `RETRY->WAIT`; fuzz coverage now requires WAIT | Legitimate contract change (QA-06: onPhase now announces WAIT). It did loosen the transition check, so I added two stricter fuzz invariants: WAIT->WAIT is never announced twice in a row, and anything after RESOLVE/RETRY must be WAIT or RETRY. |
| `duelEdge` QA-08 test: NaN shot point becomes `isFinite` | Legitimate (QA-08 fixed, pinned by `tests/duelHardening.test.ts`). |
| `duelEdge` limb-disarm OBSERVATION test now sets `maxDisarms: Infinity` | Legitimate, not weakened: it keeps documenting the raw mechanic. The new default cap (QA-09) is tested in `tests/duelHardening.test.ts` "disarm limit". |
| `inputEdge` QA-07 | Legitimate (assertion unchanged). |

No weakened assertion found. Only change: tightened LEGAL usage as above.

### 2. Soak run
`QA_FUZZ_RUNS=40000 npx vitest run tests/qa` (new env override, default stays 5000): 3 x 40000 duels plus extreme configs, 129 tests, 0 failures, about 12 s. No regression from the fixes (disarm cap, clamps, WAIT announcement, hp clamping).

### 3. Flick distance and QA-07b
- Flick distance: keep **28 px** for now. The tests pin 28 literally (`inputEdge`: 28 registers, 27.99 does not). A03's gain is about 10 ms for a fast flick, within noise next to the 550 ms draw window, and UX_FLOW calls 28 deliberate; going to 24 is a one-line `minDistancePx` change plus two literals in `inputEdge.test.ts`. Only change if playtests show missed flicks. Decision belongs to A03/A01.
- QA-07b: the `it.fails` pin is **converted into real tests** of the pointer-id API (`SwipeTracker.begin(x,y,t,id)`, `ownerId`, id-filtered `move`/`end`, `cancel`, `reanchor`, re-own on a new `begin`). Ids stay opt-in (null = legacy behaviour), also tested.

### 4. Scene-level coverage (no Phaser, `src/` untouched)
Not testable as is, because all of it is private methods on the Phaser scene. Extract these to pure modules (suggested `src/systems/SceneClock.ts` and `src/systems/PointerOwner.ts`), then I will add tests:
1. `nowMs()` (DuelScene.ts ~L226): pure `class FrameClock { constructor(maxFrameMs); now(real: number): number; pause/resume(real) }` holding `lastReal`, `skew`. Tests: gap > 100 ms is compressed to exactly 100, monotonic, hidden tab then resume adds no time (see `visibilityChanged`, ~L252 `skew += real - lastReal`), `reset` zeroes skew.
2. `eventMs()` (~L236): pure `eventTime(now, rawTimeStamp, t0, skew)`: non-number/NaN/Infinity falls back to `now`, never later than `now`.
3. Pointer ownership in `bindInput` (~L503-576): pure `class PointerOwner { down(id, isActiveStillDown): boolean; owns(id); up(id); retryId }` encapsulating `activeId`/`retryId`: a second finger is ignored while the first is down, a lost `up` cannot wedge it (stale id replaced when the old pointer is no longer down), the retry-press finger never flinches on lift, `up` of a non-owner is a no-op.
4. `pointerById`/`trackedPointer` take the Phaser pointer list; pass `isDown` as a callback so the owner class stays Phaser-free.
With those three extractions the remaining scene code is wiring only.

## Gate B final recommendation: PASS

- QA-01, 01b, 03, 04, 06, 07, 07b, 08, 09 are fixed and covered by green tests (the former `it.fails` pins are now regular assertions; `tests/duelHardening.test.ts` adds A02's own coverage).
- No open High or Medium finding. The single-pointer guard is present in `DuelScene` (reviewed by reading, `activeId` gating at pointerdown/move/up) and `SwipeTracker` has id support with tests. The offscreen-tab concern is addressed by the frame clock cap (`maxFrameMs` 100) and `visibilitychange` handling in the scene.
- Residual risk (not blocking): scene pointer logic and the frame clock are verified by code reading only, until the extraction in section 4 lands. OpponentController returning NaN is still unsanitised (Low).

Run result: `npm test` 17 files, 324 tests, 0 failing, 0 `it.fails` left in `tests/qa`; `npm run typecheck` clean.

## How to run
`npx vitest run tests/qa` (about 5 s). Soak: `QA_FUZZ_RUNS=40000 npx vitest run tests/qa`. To re-find a failing fuzz seed, the error message contains the seed. The helpers in `tests/qa/helpers.ts` (`randomLog`, `randomOpponent`) regenerate its log from that seed.
