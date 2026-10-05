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
