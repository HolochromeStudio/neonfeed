# Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Phaser 3 + TypeScript + Vite + Vitest, Capacitor later | Spec; fast web iteration, mobile packaging path |
| D2 | Portrait logical resolution 360x640, `pixelArt: true`, integer-scale only, Scale.FIT with letterbox | Crisp pixels, one-thumb portrait play |
| D3 | One primary currency: coins | Spec economy rule |
| D4 | Seeded RNG (mulberry32) for runs; no `Math.random` in game logic | Deterministic tests |
| D5 | Supplied sheets are the visual source of truth; no restyling; missing art = labelled placeholders listed in MISSING_ASSETS.md | Spec |
| D6 | Specialists are general-purpose agents with role briefs (no dedicated specialists exist) | Capability inspection |
| D7 | Services (analytics/ads/purchases/leaderboard) are interfaces with no-op defaults; game logic never imports a provider | Spec |
| D8 | Sheets are AI-generated, not on a strict grid: slicing uses connected-component detection on the background colour, not fixed cells | Observed art |
| D9 | World sprites render at integer scale only (1x default). No 0.5x. Duel arenas are compact: at most 1-2 building fronts as backdrop, never a full street. Tiles are stamped, not TileSprite-repeated, until A04 normalises them | A05 review: buildings ~200px wide on a 360px screen |
| D10 | Asset renames from ANIMATION_REVIEW.md (section_* -> building_section_*, clock_sign -> sign_clock, barrel naming, category fixes) are deferred and batched with the characters/desert sheet pass, followed by one A05 anchor re-sync. No renames while duel code is being built | Avoid churn across parallel agents |
| D11 | Gate A (town sheet) PASSED: A04 built, A05 reviewed. Characters/desert sheets remain open under blocker B1 | Review matrix |
| D12 | Flick minimum stays 28 px (A17: tests pin 28/27.99, gain of 24 px is ~10 ms, UX_FLOW calls 28 deliberate). Revisit only after human playtest | Gate B re-check |
| D13 | Gate B PASSED: A02 built, A03 approved feel, A17 PASS (no open High/Medium). Caveat: scene pointer/clock logic verified by code reading only; A02 to extract FrameClock, eventTime, PointerOwner for testing. Human playtest of feel still outstanding (cannot be judged headless) | Review matrix |
| D14 | Adopt A18 package C: hero lives 3 -> 2; elites and bosses hit for 2 (GAME_DESIGN already allows it). Rationale: sim shows average skill clears a region 97-99% (target 35-50%); only lives and elite/boss damage move it. CAVEAT: skill models are assumptions, not telemetry. Constants stay in config so a human playtest can revert or soften (package B = boss-only 2-dmg) | BALANCING.md s.6 |
| D15 | Tin Star must not grant invulnerability (restrict to once per region or equivalent; A08 chooses and re-sims). Bullet Belt (+1 life common) and Revive Flask re-priced by rarity/effect | A18: +33..67pp run win |
| D16 | Dead perks (no engine hook) are excluded from offers until their hook exists (flag in perks.ts); the stale `perk.support` data is corrected | A18: 68% of 3-perk offers had a dead pick |
| D17 | PERFECT window / display-lag compensation is DEFERRED: it changes pinned contract tests (220/350/550) and needs A03+A17 together after a human latency check | Avoid blind contract change |
| D18 | Build a dodge action next (unlocks ~6 dodge perks and gives the duel a second decision); enemy tells expose dodgeWindowMs already (A06) | A02/A18 gap list |
| D19 | One difficulty curve per run (no per-region reset); keep QA-09 maxDisarms=2 for enemy hp<=3, use 1 for hp>=4 and bosses | A18 s.5 |
| D20 | Dodge tuning (A03 review): adopt as targets perfectFrac 0.35 -> ~0.55, dodge flick minSpeed 0.3 -> 0.2 px/ms and minDistance 40 -> 32 px (dodge flick only; the 28 px draw flick stays per D12), failure penalty ~250 ms (never below 200), 'DODGE NOW' tell 100-120 ms earlier, windows >= 360 ms for the 300 ms enemies. NOT applied blind: A02 applies after the current task, then A18 re-sims with a human-latency bot + slow-thumb profile; keep values only if the PERFECT rate and clean-win rates stay in band. All are config constants | A03 FEEL_REVIEW dodge section |
