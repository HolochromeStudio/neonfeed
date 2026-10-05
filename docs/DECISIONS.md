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
