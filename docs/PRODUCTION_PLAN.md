# Production Plan

Owner: Lead (A01). Source of truth with AGENT_ASSIGNMENTS.md and DECISIONS.md.

## Supplied art status
| Sheet | On disk | Contents |
|---|---|---|
| Town & interior | `assets/source/town_interior_sheet.webp` | buildings, sections, doors/windows, rooftops, signs, props, saloon walls/tiles/furniture, misc |
| Characters | **NOT on disk** (shared only inline in chat) | Bandit, Gunslinger, Sheriff, Dual Wielder, Sniper, Knife Thrower, Prospector, Bartender, Townsfolk Woman, Train Guard, Boss Outlaw, Horse Rider: 5–6 frames each (idle, idle2, aim, shoot, hit, dead) |
| Desert terrain & props | **NOT on disk** | sand/dirt/rock tiles, canyon cliffs, rocks, cacti, plants, bones, signposts, fences, rails, ladders, mine entrances, oasis |

**Blocker B1:** the character and desert sheets must be committed to `assets/source/` (`characters_sheet.*`, `desert_sheet.*`) before A04 can slice them. Until then the game uses the town sheet plus clearly labelled placeholders. There is also **no player hero** in the characters sheet; the hero is a recolour-free placeholder (see MISSING_ASSETS.md) until supplied.

## Task graph
```
Scaffold(A01) -> Assets(A04) -> AnimDefs(A05) -> Duel(A02) -> Feel(A03) -> QA(A17)  [Gate B]
                                                   -> Bandit(A06) + DustCreek(A11)
Parallel from scaffold: UX flow(A10), Narrative(A12), Save(A14), Audio(A13)
After Gate B: Run(A08), Economy(A09), Boss(A07), UI screens(A10) -> Balance(A18) -> QA -> Perf(A16) -> Release(A19)
```

## Batches
| # | Tasks (parallel within batch) | Gate |
|---|---|---|
| 0 | A01 scaffold + lead docs | — |
| 1 | A04 slice town sheet; A10 UX flow; A12 narrative; A14 save+services; A13 audio/haptics arch | A: assets (A04+A05) |
| 2 | A05 animation defs; A04 placeholder hero + missing-asset report | A |
| 3 | A02 duel; A03 review; A17 tests | B |
| 4 | A06 Bandit; A11 Dust Creek; A13/A14 integration | — |
| 5 | Integrate Dust Creek duel; feel pass | playable |
| 6 | A08 run; A09 economy; A07 McGraw; A10 reward/shop | C, D |
| 7 | A18, A17, A16 review; then content scale, A15, A19 | E, F |

## Status
| Item | Status |
|---|---|
| Lead docs | done (this batch) |
| Scaffold | done |
| Batch 1 (assets, UX, narrative, save, audio) | done, verified |
| Gate A (town sheet) | PASSED (A04 + A05) |
| Placeholders (hero/enemy/FX) | done |
| Animation defs + state graph | done |
| Core duel (A02) | done |
| Gate B (core duel) | PASSED (A02 + A03 + A17); human feel playtest outstanding |
| Batch 6 (run, economy, boss, UI screens) | in progress (A08, A09, A07, A10) |
| Follow-ups queued | A02: extract FrameClock/eventTime/PointerOwner; enemy dodge; A18 balance pass (maxDisarms, perfectMs vs display lag) |
| Everything else | pending |

## Blockers
- B1: character + desert sheets not on disk (see above).
