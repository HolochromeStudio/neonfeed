# Feel Review - Gate B (A03 Game Feel reviewing A02 duel)

Reviewed: `src/scenes/DuelScene.ts`, `src/systems/DuelSystem.ts`, `src/systems/InputSystem.ts`, `src/data/duelConfig.ts`.
Juice layer delivered: `src/systems/FeelSystem.ts` + `src/data/feel.ts` (see "Juice layer" at the end).
Findings are ranked by impact on how the duel feels. Numbers are from code reading plus one executed repro (item 1).

## Verdicts

| Area | Verdict |
|---|---|
| Hold then flick (input latency, qualification vs release) | **NEEDS CHANGE (blocker, item 1)** |
| Flick registers on qualification, not release | approve (works as designed: `SwipeTracker.move` -> `draw` input at the qualifying sample) |
| Follow-up shots | **NEEDS CHANGE (item 3)** |
| Cue-to-feedback delay | approve with tweak (items 5, 6) |
| Flinch handling | approve (logic), feedback added by FeelSystem |
| Aim reticle offset | approve (48 px matches UX_FLOW 4.6; reticle shows on the qualifying move) |
| Recoil lock (150 ms) and draw anim (120 ms) | approve |
| Bullet tracer vs hit timing | **NEEDS CHANGE (item 4)** |
| Result timing and retry speed | **NEEDS CHANGE (item 2)** |
| Overlong animations / text | needs minor change (item 8) |

## Ranked changes for A02

### 1. BLOCKER: a flick after holding more than 600 ms never registers
Repro (run during this review): `SwipeTracker.begin(180,560,t=0)`, finger holds still, then at t=1500 ms moves up 6 samples x 10 px at 8 ms spacing -> `move()` returns `null` forever. The same gesture from a fresh `begin` at t=1500 returns a swipe.
Cause: `analyzeSwipe` measures `elapsed = p.t - samples[0].t` and `break`s at `cfg.input.maxDurationMs` (600). The tracker starts at pointer-down, but the WAIT hold lasts `wait.minMs..maxMs` = 1000..3000 ms, so by the cue the gesture is already "too old". Only players who press the holster less than 600 ms before the cue can draw. This will read as "the game ignores my flick" and is the worst feel bug in the duel.
Fix (pick one, A02):
- `DuelScene.ts` `ev.on('onCue')`: re-anchor the touch: `const p = this.input.activePointer; if (p.isDown) this.tracker.begin(p.x, p.y, this.nowMs());` (preferred, 1 line, keeps `maxDurationMs` meaning "flick within 600 ms of the cue").
- or `InputSystem.ts` `SwipeTracker.move`: drop samples older than `cfg.speedWindowMs` before analysing while `phase` is WAIT (also stops the sample array growing for 3 s, which makes each `move` O(n)).
Add a regression test in `tests/duelInput.test.ts`: hold 1500 ms then flick must return a swipe.

### 2. Retry is gated by a 700 ms dead hold (target: retry available in under 400 ms)
Today: kill/death -> `RESOLVE` for `resolve.holdMs` = 700 ms -> `RETRY` (the retry button is only made visible on `onPhase RETRY`, `DuelScene.ts` line ~253) -> tap. Fastest possible loss-to-retry = 700 ms + travel + tap, about 1000 ms. The tap itself is instant: `retry()` runs synchronously inside `pointerdown` and `enterWaitVisuals()` is synchronous, so button-to-WAIT is one frame (about 17 ms). The cost is all in the hold.
Changes:
- `src/data/duelConfig.ts`: `resolve.holdMs` 700 -> **300**. Loss-to-retry becomes 300 ms + tap, button-to-WAIT <= 17 ms, so loss-to-WAIT is about 320 ms of system time (target < 400). 300 ms still doubles as the accidental-tap guard for a thumb that was mashing. The result readout stays on screen through RETRY, so the player still reads cause and reaction time.
- `DuelScene.ts` `buildRetryButton`/`retryHit`: move the plank into the thumb zone the player is already touching: centre (180, 568), hit rect `{x:40, y:532, w:280, h:72}` (was centre (180,468), 200x56 at y 440..496). That removes about 100 px of thumb travel, roughly 150 to 250 ms of human time.
- Keep the existing rule that the touch that pressed Retry does not flinch (the `touchOnButton` guard is correct).

### 3. Follow-up shots need another full flick
`DuelScene.ts` pointer handlers: `aim` input and `fire` only happen when `tracker.swiped`. After the first shot the finger is up; a new touch starts a new `SwipeTracker`. A tap or slow drag in AIM sends `lift` (ignored) and the reticle never moves (aim is only sent after `swiped`), so the follow-up shot (`aim.followUpBudgetMs` 450) auto-fires at the old reticle. The player needs a 28 px fast flick just to re-aim.
Change in `DuelScene.ts` (`pointerdown` / `pointermove` / `up`): when the phase is AIM (follow-up), treat any pointer-down as aiming: send `aim` on every move and `fire` on release regardless of `tracker.swiped`, using `reticleFromTouch(...)`. Gate on `this.system.snapshot().phase === 'AIM'` so WAIT/CUE rules (flinch, draw flick) are unchanged.

### 4. Hit lands 90 ms before the bullet
`Projectile` default `durationMs = 90` and `DuelScene` passes `90` for the enemy tracer. `DuelSystem` resolves the hit instantly, and A02's handlers set `hit`/`dead` state, pips and zone text on the same frame as the shot, so the target reacts about 5 frames before the bullet visibly arrives (about 180 px at 2 px/ms).
Changes:
- `src/entities/Projectile.ts` default `durationMs` 90 -> **45**; `DuelScene.ts` enemy `new Projectile(..., 90, COL.red)` -> **45**; player tracer duration = `clamp(distance / 4, 20, 60)` ms (matches `FEEL.tracer.pxPerMs = 4`, `maxDelayMs = 60`).
- FeelSystem already delays hit-stop, shake, flash, ring and particles by `distance / 4` ms (capped 60) so those land on bullet arrival. A02's `setState('hit'|'dead')` and pip updates should be deferred the same way (`this.time.delayedCall(delay, ...)`) or left, because 45 ms is about 3 frames and reads as simultaneous.
Do NOT delay any DuelSystem event: gameplay stays instant, only the presentation lags by <= 60 ms.

### 5. Input timestamps are taken at handler time, not event time
`DuelScene.nowMs()` is called inside Phaser pointer callbacks, which Phaser dispatches in `preStep`, up to one frame (about 8 ms average, 16 ms worst case at 60 Hz) after the real touch. The reaction is quantised to frame time and carries 0..16 ms of jitter.
Change: in the pointer handlers use `const t = (p.event as Event).timeStamp - this.t0` (DOM timestamps share `performance.now()`'s origin) instead of `this.nowMs()`, and pass it to `tracker.begin/move/end` and `system.input`. `DuelSystem.input` already clamps `t` to `now`, so it can never go backwards.

### 6. Reaction is measured from the scheduled cue, but seen about 25 ms later (balance flag for A02/A18)
The cue becomes visible on the first frame after `cueAt` (0..16.7 ms, plus about 8 ms display scan), and the draw sound comes through WebAudio (about 20 to 40 ms on mobile). The player is charged from `cueAt`. Add `draw.displayLagCompMs` (suggest **20**) to `duelConfig.ts` and subtract it from `raw` in `DuelSystem.onDrawInput` (floor at 0). PERFECT is 220 ms; the unfair 25 ms is more than 10% of that window. Alternatively A18 can move `draw.perfectMs` 220 -> 240. Only one of the two.

### 7. Flick threshold (low)
`input.minDistancePx` 28 -> **24** (UX_FLOW says 28 deliberate, but a fast flick covers 24 px about 10 ms sooner and the angle/speed checks already reject taps). Keep `minSpeedPxPerMs` 0.12, `speedWindowMs` 120, `tapMaxTravelPx` 10.

### 8. Overlong text and tints (low)
- `DuelScene.flashZone` 700 ms -> **450** ms: zone text outlives the 150 ms recoil lock by 4x and collides with the next shot's text. FLINCH text may stay 700 ms (it is a lesson), pass the duration as a parameter.
- `slowMoTint` hard-cuts 0 -> 0.2 -> 0 on every AIM start/end (twice per follow-up). Tween alpha over 60 ms (`this.tweens.add({targets: tint, alpha, duration: 60})`).
- `onDraw` writes `"PERFECT 183 ms"` into `phaseText` at (180,100); the feel layer now pops the same reaction time large at (180,190) where the `!` cue was. Change the `onDraw` handler to leave `phaseText` as `DRAW!` to avoid duplicate numbers.
- Optional: reveal `readout` 120 ms after `onResolve` so the kill frame and hit-stop read before the panel covers them. Retry stays available at 300 ms.

## Approved numbers (do not change)
`draw.drawAnimMs` 120 (short, hero reacts instantly on `onDraw`), `aim.recoilMs` 150 (FeelSystem recoil kick+settle is squeezed to fit inside it, tested), `aim.reticleOffsetY` 48, `aim.assistRadiusPx` 14, `fairness.minLethalMs` 450, `draw.flinchPenaltyMs` 300, `retry` resets with the same seed.

## Flinch handling notes
A lift or an early swipe in WAIT sets `flinched` once and later ones only bump `ignored` (good, no stacking). The penalty (300 ms on reaction and on draw time) pushes a typical 250 ms raw reaction to 550 ms = SLOW and locks the draw for 420 ms. That is harsh but is the design (GAME_DESIGN "Flinch"). The only complaint was zero feedback beyond text; the feel layer adds a 3 px hero twitch and a light haptic (`FEEL.flinch`, `FEEL.haptics.flinch`).

## Juice layer (Task 2)

Files: `src/data/feel.ts` (all tunables and caps), `src/systems/FeelSystem.ts` (pure helpers plus `FeelSystem` and `installFeel`), `tests/feel.test.ts` (pure tests plus a fake-scene integration suite, no Phaser).

**One-line hook (A02/Lead must add this to `DuelScene.ts`).** After `this.startSystem();` in `create()`:

```ts
import { installFeel } from '../systems/FeelSystem';
// ... in create(), after this.startSystem():
installFeel(this, duelFeedback);
```

It is idempotent per scene, detaches itself on scene `shutdown`/`destroy`, and `bus` is a parameter (not an import) so `FeelSystem.ts` never loads Phaser at runtime and the tests run without it. Optional third argument: `{ settings: () => ({ reducedShake: save.settings.reducedShake }), targets: { hero, enemy } }`. Without it, reducedShake defaults to the OS `prefers-reduced-motion` and the hero/enemy display objects are found by their arena position.

What it does (all in `FEEL`):
| Effect | Value |
|---|---|
| Perfect draw | camera zoom punch +2% (45 ms in, 90 ms out), 0xfff3c4 flash alpha 0.18 for 70 ms, slow-mo 0.5x for 110 ms, haptic from audioBus (`perfect_draw`) |
| Muzzle flash | `fx_muzzle_flash` anim at the hero (+24,-40) / enemy (-24,-40) on the shot event frame (delay 0); circle fallback 70 ms; max 3 live |
| Recoil | 5 px kick 45 ms + 90 ms settle (squeezed to <= `aim.recoilMs`), restored to rest x on cancel |
| Impact | delayed to bullet arrival: `distance / 4 px/ms`, cap 60 ms; ring flash 70 ms, <= 8 particles |
| Hit-stop | head 45, body 30, limb 20, prop 0, hero 40, crit +10, kill 60 (hard cap 60 ms) |
| Slow-mo | enemy kill 0.35x for 160 ms, hero death 0.5x for 90 ms, perfect draw 0.5x for 110 ms (caps: >= 0.3x, <= 200 ms) |
| Shake | head 3 px/100 ms, body 2/80, limb 1.5/60, prop 1/50, hero 3.5/120; kill x1.25, crit x1.3; caps 4 px / 140 ms; reducedShake = 25% and no zoom punch, flash and hit-stop remain |
| Haptics | only what the audio bus does not already play: flinch `light`, head/crit hit `medium` (hit, death, gunshot, perfect_draw, draw_cue come from `HAPTIC_FOR_EVENT`) |
| Reaction pop | `PERFECT\n183 ms` at (180,190), scale 0.6 -> 1.25 in 80 ms -> 1 in 70 ms, holds 600 ms, fades 150 ms |

Hard limits (enforced in code, asserted in tests):
- Visual only: FeelSystem holds no reference to `DuelSystem` or the pointer handlers, so it cannot block or delay input, a shot or a retry.
- Hit-stop and slow-mo set `scene.tweens.timeScale` / `scene.anims.globalTimeScale` only (never `scene.time`, so A02's `delayedCall`s are unaffected) and count down on REAL frame deltas, so a frozen frame always ends on schedule; worst case total scale-down is 60 + 200 ms and it cannot stack past that.
- Particles <= 24 live (<= 10 per burst); muzzle flashes <= 3; shake <= 4 px and <= 140 ms; flash alpha <= 0.35; zoom <= 3%; nothing lives longer than 900 ms.
- `onRetry`, `onWait` and scene shutdown cancel all timers, tweens, spawned objects, camera zoom/shake, time scales, and restore recoiled sprites to rest x.

Known interplay: `duelFeedback` fires before A02's own `wireVisuals` handlers for the same event (forwarders register first). That is harmless here because the feel layer only adds objects/tweens.

## Dodge feel review (A03, 2026-10-06; addressed to A02 and A18)

Method: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/duelPlaythrough.mjs` (Dust Creek vs Bandit, `dodgeWindowMs` 380), screenshots `scripts/out/play_9..14`, plus code reading of `DuelSystem.onDodgeInput` and `duelConfig.dodge`. The scripted bot reacts in about 0 ms, so it proves the flow works but says nothing about human reachability; the numbers below are estimates from typical visual reaction (200-250 ms) and thumb flick speeds (0.3-1.5 px/ms), and need a real-device or A18 bot-with-human-latency check.
Observed: early dodge gave `early` (TOO EARLY +300ms shown), the window prompt (muzzle glint + "<< DODGE NOW >>", 18 px, readable) showed, a bot flick at window open gave `perfect` with eta 106 ms left and the shot was `miss:dodge`. The run threw at the very end of the script (line 184, "Execution context was destroyed", the page navigated after RETRY while A02/GameFlow is mid-edit); this is not caused by the feel layer and the `dodges === 1` assertion was not reached.

Dodge feedback shipped in the Feel layer (`FEEL.dodge`, `planDodge`, all inside the existing caps):

| Event | Camera shake | Flash | Slow-mo | Zoom | Dust | Haptic / audio |
|---|---|---|---|---|---|---|
| perfect | 1.5 px / 70 ms | 0xc9f3ff a0.10 / 60 ms | 0.6x / 90 ms | +1% | 4 | `perfect_draw` pattern (replaces the bus `light`), layered `dodge_perfect` chime |
| ok | 1 px / 50 ms | a0.05 / 50 ms | none | none | 3 | none extra (bus `dodge` = light) |
| early / late | 1.5 px / 60 ms | red 0xd24a3a a0.10 / 60 ms | none | none | 0 | none extra (bus `miss` = light); `dodge_fail` placeholder exists for A02 to swap in |
| evaded enemy shot (`onMiss.evaded`) | 1 px / 50 ms | none | none | none | 2 (+5 for dust) | none |
| `cloud` (Dust Kick) | adds 5 dust particles only, never flash/slow-mo, none on failure | | | | | |

reducedShake: shake x0.25, zoom removed, flash kept. Everything cancels on onRetry/onWait/shutdown. Slow-mo only scales tweens/anims; the dodge window is real ms in DuelSystem, so slow-mo can never eat the window.

### Ranked recommendations (numbers; gameplay owner decides)

1. **PERFECT is not reachable by reaction (A02 `dodge.perfectFrac`, A18 to verify).** PERFECT = first 35% of a 380 ms window = the first 133 ms after the prompt opens. Reaction (about 220 ms) plus flick travel (below) lands at 260-350 ms, i.e. OK at best; PERFECT only happens by anticipating the shot. Recommend `perfectFrac` 0.35 -> 0.55 (about 210 ms for the bandit) and A18 re-run PERFECT rate with a 220 ms +/- 40 ms human-latency bot; target 10-20% PERFECT for an attentive player.
2. **No lead on "DODGE NOW" (A02 DuelScene `updateDodgeHint` / enemy `dodgeTell`).** The prompt appears exactly when `eta <= windowMs`, so the player starts reacting at window open and the window is eaten by reaction time. Recommend the tell (muzzle raise glint) starts 100-120 ms before the credited window opens (or, equivalently, the window is credited from `tellStart + 100 ms`), and the small grey "< flick sideways to dodge >" turns into the big prompt at tell start. Also for the 300 ms enemy (`dodgeWindowMs: 300`): raise to >= 360 ms; 300 ms is below reaction (220) + flick (40-130) for most thumbs.
3. **Flick speed 0.3 px/ms and 40 px minimum (A02 `dodge.input`).** At the 0.3 floor a 40 px flick takes about 133 ms before it even qualifies, which is a third of the window; fast thumbs (about 1 px/ms) qualify in about 40 ms. Slow, careful thumbs are the risky group (and they are the ones who will hit the "TOO EARLY" re-flick). Recommend `minSpeedPxPerMs` 0.3 -> 0.2, `minDistancePx` 40 -> 32 (keep `speedWindowMs` 100 and the angle tolerance so a reticle drag still is not a dodge), and credit the flick from touch-move start, not qualification: subtract up to 60 ms of travel from the measured `eta` before classifying.
4. **Failure penalty 300 ms (A02 `dodge.failPenaltyMs`).** Same value as the flinch, but an early dodge in CUE also delays the draw while the bandit's first shot is about 800 ms away. A late failure is already shot, so its penalty only affects the follow-up. Recommend `early` 250 ms and `late` 300 ms (two values), or a flat 250 ms. Do not go below 200 ms or mashing becomes free. The "TOO EARLY +300ms" label overlaps the SALOON sign in the mid-arena band; give it the same dark stroke as the pop text or move it to y about 470.
5. **Hint copy (low).** While stumbling, `STUMBLING` is correct; in the screenshot taken after the early dodge the hint already read DODGE NOW again (the screenshot lands about 250 ms later, so probably the stumble had ended); A18 should verify the hint flips to STUMBLING within one frame of the failed dodge.
6. **Audio (A13).** `dodge_perfect` (layered chime, emitted by the Feel layer) and `dodge_fail` are PLACEHOLDER synths. The duel currently emits `miss` for a failed dodge; A02 may emit `dodge_fail` instead (it has no haptic of its own, `miss` keeps the light buzz).
