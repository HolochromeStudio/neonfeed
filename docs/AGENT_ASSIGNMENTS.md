# Agent Assignments

Owner: Lead Game Director (A01). Updated at every gate.

## Capability map (inspected 2026-10-05)
Available Agent types: `general-purpose`, `claude`, `Explore` (read-only), `Plan` (read-only architect), `claude-code-guide`, `statusline-setup`.
Skills: generic only (`code-review`, `simplify`, `run`, `security-review`, ...). No game/art/audio-specific agents or skills exist.

**Documented fallback:** no dedicated specialists exist, so every role below is a `general-purpose` agent spawned with a role brief, an owned-file list and the TASK COMPLETE handoff block. `Plan` is used for architecture/design review, `Explore` for read-only surveys, `code-review` skill for second-reviewer passes. Specialists never edit files outside their ownership without Lead approval.

## Roles, ownership, review
| # | Role | Agent type | Owns | Reviewer | QA |
|---|---|---|---|---|---|
| 01 | Lead / Orchestrator | Lead (me) | docs/PRODUCTION_PLAN, AGENT_ASSIGNMENTS, DECISIONS, ARCHITECTURE, scaffold config | — | — |
| 02 | Gameplay Engineer | general-purpose | scenes/DuelScene, systems/{Duel,Draw,Damage,Target,Input}System, entities/{Hero,Projectile} | A03 Game Feel | A17 |
| 03 | Game Feel | general-purpose | feel tuning constants (data/feel.ts), reviews A02 | A02 | A17 |
| 04 | Asset Pipeline | general-purpose | assets/**, scripts/processAssets, sliceSprites, docs/ASSETS, MISSING_ASSETS | A05 | A17 |
| 05 | Animation TA | general-purpose | src/animation/, data/animations.ts | A04 | A17 |
| 06 | Enemy AI | general-purpose | systems/EnemyAISystem, data/enemies, entities/Enemy | A02 | A17 |
| 07 | Boss | general-purpose | data/bosses, systems/BossSystem | A06, then A03 | A17 |
| 08 | Roguelite Systems | general-purpose | systems/{Run,Perk}System, data/{perks,events,regions} | A18 | A17 |
| 09 | Economy / Meta | general-purpose | systems/{Economy,Bounty}System, data/{economy,missions} | A18 | A17 |
| 10 | Mobile UX/UI | general-purpose | src/ui/, scenes/{MainMenu,Reward,Shop,Results}Scene, docs/UX_FLOW | A01 | A17 |
| 11 | World / Level | general-purpose | data/arenas/, scenes/ArenaBuilder | A01 | A17 |
| 12 | Narrative | general-purpose | data/dialogue.ts, data/wanted.ts | A01 | — |
| 13 | Audio / Haptics | general-purpose | core/{Audio,Haptics}Manager | A03 | A17 |
| 14 | Save / Services | general-purpose | core/SaveManager, services/ | A17 | A17 |
| 15 | Mobile Platform | general-purpose | capacitor.config, ios/, android/, docs/BUILD_* | A19 | A17 |
| 16 | Performance | general-purpose | profiling scripts, perf review notes | A01 | A17 |
| 17 | QA | general-purpose | tests/ | A01 | — |
| 18 | Balance | general-purpose | docs/BALANCING, sim scripts | A08/A09 | A17 |
| 19 | Release | general-purpose | docs/RELEASE_CHECKLIST, CI | A01 | A17 |

## Systems → who builds / reviews / tests / depends on
| System | Builds | Reviews | Tests | Depends on |
|---|---|---|---|---|
| Asset slicing + atlas | A04 | A05 | A17 | source sheets |
| Animation defs | A05 | A04 | A17 | atlas |
| Core duel (draw/aim/shoot/damage/retry) | A02 | A03 | A17 | scaffold, hero placeholder |
| Bandit AI | A06 | A02 | A17 | Gate B |
| Dust Creek arena | A11 | A01 | A17 | atlas |
| Audio architecture | A13 | A03 | A17 | scaffold |
| Save architecture | A14 | A17 | A17 | scaffold |
| Run / perks | A08 | A18 | A17 | Gate B, enemies |
| Economy / bounties | A09 | A18 | A17 | save |
| Boss Mad Dog McGraw | A07 | A06 + A03 | A17 | enemy AI, duel |
| Portrait UI screens | A10 | A01 | A17 | UX flow |
| Narrative | A12 | A01 | — | — |
| Mobile build | A15 | A19 | A17 | playable build |

## Temporary file ownership (current batch)
| File/dir | Owner | Status |
|---|---|---|
| package.json, tsconfig, vite/vitest config | A01 | scaffold |
| assets/, scripts/processAssets.*, docs/ASSETS.md | A04 | batch 1 |
| docs/UX_FLOW.md | A10 | batch 1 |
| src/data/dialogue.ts, wanted.ts | A12 | batch 1 |
| src/core/SaveManager.ts, src/services/ | A14 | batch 1 |
| src/core/AudioManager.ts, HapticsManager.ts | A13 | batch 1 |

## Handoff format (mandatory)
TASK COMPLETE / Files changed / Systems affected / Dependencies / Tests performed / Known issues / Needs review from / Recommended next task.
