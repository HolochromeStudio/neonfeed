# NEONFEED balance simulation report (profile standard)

DuelSystem perk hooks present in this checkout: yes.


## Target checks

| id | target | band | measured | status |
| --- | --- | --- | --- | --- |
| T1a | novice clean-win vs Rookie (d 0.1) | 80% to 90% | 97.9% | TOO EASY |
| T1b | novice clean-win vs Bandit (d 0.1) | 55% to 70% | 46.0% | TOO HARD |
| T1c | average clean-win vs Bandit (d 0.1) | 70% to 90% | 62.6% | TOO HARD |
| T1d | average clean-win vs Gunslinger (d 0.5) | 40% to 60% | 31.9% | TOO HARD |
| T1e | expert clean-win vs Gunslinger (d 0.5) | 70% to 95% | 87.4% | ok |


## Duel matrix (enemy x depth x skill)

#### Difficulty 0.1

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 98% / 100% / 0.02 / 3.0s | 100% / 100% / 0.00 / 2.7s | 100% / 100% / 0.00 / 2.6s | 100% / 100% / 0.00 / 2.5s |
| Bandit (T1, hp 2) | 46% / 100% / 0.54 / 3.5s | 63% / 100% / 0.37 / 3.1s | 85% / 100% / 0.15 / 2.8s | 98% / 100% / 0.02 / 2.6s |
| Gunslinger (T2, hp 2) | 26% / 100% / 0.74 / 3.5s | 42% / 100% / 0.58 / 3.1s | 62% / 100% / 0.38 / 2.8s | 89% / 100% / 0.11 / 2.6s |
| Coward (T2, hp 1) | 66% / 100% / 0.34 / 3.6s | 81% / 100% / 0.19 / 3.3s | 92% / 100% / 0.08 / 3.1s | 95% / 100% / 0.05 / 3.0s |
| Drunk (T2, hp 2) | 91% / 100% / 0.09 / 3.7s | 98% / 100% / 0.02 / 3.2s | 100% / 100% / 0.00 / 3.0s | 100% / 100% / 0.00 / 2.8s |
| Sheriff (T3, hp 3) | 30% / 100% / 0.72 / 4.7s | 43% / 100% / 0.57 / 3.7s | 63% / 100% / 0.38 / 3.2s | 90% / 100% / 0.10 / 3.0s |
| Dual Wielder (T4, hp 2) | 31% / 100% / 0.79 / 3.7s | 56% / 100% / 0.45 / 3.3s | 85% / 100% / 0.15 / 3.0s | 99% / 100% / 0.01 / 2.8s |
| Sniper (T3, hp 2) | 79% / 100% / 0.21 / 4.2s | 97% / 100% / 0.03 / 3.8s | 100% / 100% / 0.00 / 3.5s | 100% / 100% / 0.00 / 3.3s |
| Knife Thrower (T3, hp 2) | 48% / 100% / 0.54 / 3.5s | 88% / 100% / 0.12 / 3.1s | 99% / 100% / 0.01 / 2.8s | 100% / 100% / 0.00 / 2.6s |
| Train Guard (T3, hp 3) | 37% / 100% / 0.63 / 4.2s | 49% / 100% / 0.51 / 3.6s | 76% / 100% / 0.24 / 3.2s | 96% / 100% / 0.04 / 3.0s |
| Horse Rider (T3, hp 2) | 51% / 100% / 0.49 / 4.5s | 81% / 100% / 0.19 / 3.6s | 98% / 100% / 0.02 / 3.2s | 100% / 100% / 0.00 / 2.9s |
| Bounty Hunter (T5, hp 4) | 14% / 100% / 1.02 / 4.8s | 22% / 100% / 0.86 / 4.0s | 39% / 100% / 0.63 / 3.6s | 66% / 100% / 0.34 / 3.3s |
| **mean of roster** | **51% / - / 0.51 / 3.9s** | **68% / - / 0.32 / 3.4s** | **83% / - / 0.17 / 3.1s** | **94% / - / 0.06 / 2.9s** |

#### Difficulty 0.5

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 97% / 100% / 0.03 / 3.1s | 100% / 100% / 0.00 / 2.8s | 100% / 100% / 0.00 / 2.7s | 100% / 100% / 0.00 / 2.6s |
| Bandit (T1, hp 2) | 38% / 100% / 0.62 / 3.6s | 57% / 100% / 0.43 / 3.2s | 81% / 100% / 0.19 / 2.9s | 98% / 100% / 0.02 / 2.7s |
| Gunslinger (T2, hp 2) | 13% / 100% / 0.87 / 3.6s | 32% / 100% / 0.69 / 3.2s | 55% / 100% / 0.45 / 2.9s | 87% / 100% / 0.13 / 2.7s |
| Coward (T2, hp 1) | 55% / 100% / 0.45 / 3.9s | 73% / 100% / 0.27 / 3.5s | 85% / 100% / 0.15 / 3.3s | 90% / 100% / 0.10 / 3.1s |
| Drunk (T2, hp 2) | 90% / 100% / 0.10 / 3.8s | 98% / 100% / 0.02 / 3.3s | 100% / 100% / 0.00 / 3.1s | 100% / 100% / 0.00 / 2.9s |
| Sheriff (T3, hp 3) | 20% / 100% / 0.82 / 4.8s | 35% / 100% / 0.65 / 3.8s | 57% / 100% / 0.42 / 3.3s | 89% / 100% / 0.12 / 3.1s |
| Dual Wielder (T4, hp 2) | 21% / 100% / 0.92 / 3.8s | 49% / 100% / 0.52 / 3.3s | 83% / 100% / 0.17 / 3.1s | 99% / 100% / 0.01 / 2.9s |
| Sniper (T3, hp 2) | 79% / 100% / 0.21 / 4.3s | 97% / 100% / 0.03 / 3.8s | 100% / 100% / 0.00 / 3.6s | 100% / 100% / 0.00 / 3.4s |
| Knife Thrower (T3, hp 2) | 39% / 100% / 0.64 / 3.6s | 86% / 100% / 0.14 / 3.1s | 99% / 100% / 0.01 / 2.9s | 100% / 100% / 0.00 / 2.7s |
| Train Guard (T3, hp 3) | 29% / 100% / 0.71 / 4.3s | 42% / 100% / 0.58 / 3.6s | 74% / 100% / 0.26 / 3.3s | 96% / 100% / 0.04 / 3.1s |
| Horse Rider (T3, hp 2) | 45% / 100% / 0.55 / 4.6s | 79% / 100% / 0.21 / 3.7s | 98% / 100% / 0.02 / 3.2s | 100% / 100% / 0.00 / 3.0s |
| Bounty Hunter (T5, hp 4) | 9% / 100% / 1.13 / 4.9s | 17% / 100% / 0.96 / 4.1s | 34% / 100% / 0.70 / 3.7s | 62% / 100% / 0.38 / 3.4s |
| **mean of roster** | **45% / - / 0.59 / 4.0s** | **64% / - / 0.38 / 3.5s** | **80% / - / 0.20 / 3.2s** | **93% / - / 0.07 / 3.0s** |

#### Difficulty 0.9

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 89% / 100% / 0.11 / 3.6s | 98% / 100% / 0.02 / 3.2s | 100% / 100% / 0.01 / 2.9s | 100% / 100% / 0.00 / 2.8s |
| Bandit (T1, hp 2) | 22% / 100% / 0.78 / 4.2s | 26% / 100% / 0.74 / 3.6s | 50% / 100% / 0.50 / 3.3s | 87% / 100% / 0.13 / 3.0s |
| Gunslinger (T2, hp 2) | 2% / 100% / 0.98 / 4.2s | 4% / 100% / 0.96 / 3.6s | 12% / 100% / 0.88 / 3.3s | 53% / 100% / 0.47 / 3.0s |
| Coward (T2, hp 1) | 30% / 100% / 0.71 / 5.0s | 44% / 100% / 0.56 / 4.2s | 62% / 100% / 0.38 / 3.8s | 77% / 100% / 0.23 / 3.5s |
| Drunk (T2, hp 2) | 77% / 100% / 0.23 / 4.4s | 90% / 100% / 0.10 / 3.8s | 96% / 100% / 0.04 / 3.4s | 100% / 100% / 0.00 / 3.2s |
| Sheriff (T3, hp 3) | 9% / 100% / 0.95 / 5.4s | 23% / 100% / 0.77 / 4.1s | 42% / 100% / 0.58 / 3.6s | 77% / 100% / 0.23 / 3.3s |
| Dual Wielder (T4, hp 2) | 1% / 100% / 1.53 / 4.3s | 9% / 100% / 1.06 / 3.8s | 46% / 100% / 0.55 / 3.4s | 89% / 100% / 0.11 / 3.2s |
| Sniper (T3, hp 2) | 47% / 100% / 0.53 / 4.8s | 87% / 100% / 0.14 / 4.3s | 99% / 100% / 0.01 / 3.9s | 100% / 100% / 0.00 / 3.7s |
| Knife Thrower (T3, hp 2) | 10% / 100% / 1.09 / 4.1s | 44% / 100% / 0.58 / 3.6s | 78% / 100% / 0.22 / 3.2s | 98% / 100% / 0.03 / 3.0s |
| Train Guard (T3, hp 3) | 16% / 100% / 0.84 / 4.9s | 17% / 100% / 0.83 / 4.0s | 29% / 100% / 0.71 / 3.6s | 70% / 100% / 0.30 / 3.3s |
| Horse Rider (T3, hp 2) | 25% / 100% / 0.76 / 5.5s | 49% / 100% / 0.51 / 4.2s | 85% / 100% / 0.15 / 3.6s | 99% / 100% / 0.01 / 3.3s |
| Bounty Hunter (T5, hp 4) | 8% / 100% / 1.14 / 5.0s | 17% / 100% / 0.99 / 4.2s | 34% / 100% / 0.71 / 3.8s | 62% / 100% / 0.39 / 3.5s |
| **mean of roster** | **28% / - / 0.80 / 4.6s** | **42% / - / 0.61 / 3.9s** | **61% / - / 0.40 / 3.5s** | **84% / - / 0.16 / 3.2s** |


## Bosses

| Boss case | skill | clean win | 3-life win | hits/duel | sec | reaches ph2 | reaches ph3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mad Dog McGraw, 3-region run (d 0.42, hp 3) | novice | 49% | 100% | 0.52 | 4.2 | 100% | 84% |
|  | average | 61% | 100% | 0.39 | 3.6 | 100% | 79% |
|  | skilled | 83% | 100% | 0.17 | 3.3 | 97% | 72% |
|  | expert | 97% | 100% | 0.03 | 3.0 | 81% | 62% |
| Mad Dog McGraw, 1-region run (d 1.00, hp 4) | novice | 35% | 100% | 0.65 | 4.8 | 100% | 90% |
|  | average | 38% | 100% | 0.63 | 4.0 | 100% | 78% |
|  | skilled | 48% | 100% | 0.53 | 3.6 | 100% | 64% |
|  | expert | 78% | 100% | 0.22 | 3.3 | 100% | 52% |
| The Undertaker, 3-region run (d 0.74, hp 4; phases 2-3 run phase-1 numbers) | novice | 44% | 100% | 0.56 | 5.2 | 100% | 90% |
|  | average | 51% | 100% | 0.49 | 4.5 | 100% | 78% |
|  | skilled | 82% | 100% | 0.18 | 4.1 | 100% | 64% |
|  | expert | 99% | 100% | 0.01 | 3.8 | 100% | 52% |
| Lady Luck (not on a first-release map; d 0.70, hp 4) | novice | 36% | 100% | 0.64 | 5.0 | 100% | 90% |
|  | average | 36% | 100% | 0.64 | 4.3 | 100% | 78% |
|  | skilled | 46% | 100% | 0.54 | 3.9 | 100% | 64% |
|  | expert | 74% | 100% | 0.26 | 3.6 | 100% | 52% |
| El Diablo (final; d 0.95, hp 6) | novice | 32% | 100% | 0.68 | 6.4 | 100% | 100% |
|  | average | 30% | 100% | 0.70 | 5.3 | 100% | 100% |
|  | skilled | 26% | 100% | 0.74 | 4.8 | 100% | 100% |
|  | expert | 54% | 100% | 0.46 | 4.4 | 100% | 100% |


## Perfect window vs display lag

Perfect-draw rate and clean-win rate vs a Bandit (d 0.3) by perfectMs and display lag.

| perfectMs | lag ms | novice | average | skilled | expert |
| --- | --- | --- | --- | --- | --- |
| 220 | 0 | 1% (clean 44%) | 4% (clean 64%) | 19% (clean 88%) | 63% (clean 99%) |
| 220 | 25 | 0% (clean 42%) | 1% (clean 61%) | 5% (clean 83%) | 26% (clean 98%) |
| 220 | 40 | 0% (clean 41%) | 1% (clean 59%) | 1% (clean 80%) | 10% (clean 97%) |
| 240 | 0 | 1% (clean 44%) | 10% (clean 64%) | 38% (clean 88%) | 86% (clean 99%) |
| 240 | 25 | 0% (clean 42%) | 3% (clean 61%) | 15% (clean 83%) | 56% (clean 98%) |
| 240 | 40 | 0% (clean 41%) | 1% (clean 59%) | 6% (clean 80%) | 34% (clean 97%) |
| 260 | 0 | 4% (clean 44%) | 19% (clean 64%) | 58% (clean 88%) | 96% (clean 99%) |
| 260 | 25 | 1% (clean 42%) | 8% (clean 61%) | 33% (clean 83%) | 82% (clean 98%) |
| 260 | 40 | 1% (clean 41%) | 4% (clean 59%) | 19% (clean 80%) | 63% (clean 97%) |


## Gun-arm disarm loop (QA-09)

Limb-camper = reticle parked on the gun arm, never fires manually (autofire only). Columns are `fairness.maxDisarms`.

| Enemy | player | maxDisarms 0 | maxDisarms 1 | maxDisarms 2 | maxDisarms 3 | maxDisarms inf |
| --- | --- | --- | --- | --- | --- | --- |
| Gunslinger d.9 (hp 3) | limb camper | 100% win, 0% clean, 1.00 hits, 5s | 100% win, 22% clean, 0.78 hits, 5s | 100% win, 22% clean, 0.78 hits, 5s | 100% win, 22% clean, 0.78 hits, 5s | 100% win, 22% clean, 0.78 hits, 5s |
|  | expert, normal play | 100% win, 53% clean, 0.47 hits, 3s | 100% win, 53% clean, 0.47 hits, 3s | 100% win, 53% clean, 0.47 hits, 3s | 100% win, 53% clean, 0.47 hits, 3s | 100% win, 53% clean, 0.47 hits, 3s |
| Sheriff d.9 (hp 4, armour) | limb camper | 100% win, 0% clean, 1.00 hits, 6s | 100% win, 50% clean, 0.50 hits, 6s | 100% win, 50% clean, 0.50 hits, 6s | 100% win, 50% clean, 0.50 hits, 6s | 100% win, 50% clean, 0.50 hits, 6s |
|  | expert, normal play | 100% win, 37% clean, 0.63 hits, 3s | 100% win, 77% clean, 0.23 hits, 3s | 100% win, 77% clean, 0.23 hits, 3s | 100% win, 77% clean, 0.23 hits, 3s | 100% win, 77% clean, 0.23 hits, 3s |
| Train Guard d.9 (hp 4) | limb camper | 100% win, 5% clean, 0.95 hits, 6s | 100% win, 63% clean, 0.37 hits, 6s | 100% win, 63% clean, 0.37 hits, 6s | 100% win, 63% clean, 0.37 hits, 6s | 100% win, 63% clean, 0.37 hits, 6s |
|  | expert, normal play | 100% win, 70% clean, 0.30 hits, 3s | 100% win, 70% clean, 0.30 hits, 3s | 100% win, 70% clean, 0.30 hits, 3s | 100% win, 70% clean, 0.30 hits, 3s | 100% win, 70% clean, 0.30 hits, 3s |
| Bounty Hunter d.9 (hp 4) | limb camper | 100% win, 0% clean, 1.32 hits, 7s | 100% win, 41% clean, 0.60 hits, 7s | 100% win, 61% clean, 0.39 hits, 7s | 100% win, 61% clean, 0.39 hits, 7s | 100% win, 61% clean, 0.39 hits, 7s |
|  | expert, normal play | 100% win, 62% clean, 0.39 hits, 4s | 100% win, 62% clean, 0.39 hits, 4s | 100% win, 62% clean, 0.39 hits, 4s | 100% win, 62% clean, 0.39 hits, 4s | 100% win, 62% clean, 0.39 hits, 4s |
| McGraw d1 (boss hp 4) | limb camper | 100% win, 27% clean, 0.75 hits, 6s | 100% win, 94% clean, 0.06 hits, 6s | 100% win, 94% clean, 0.06 hits, 6s | 100% win, 16% clean, 0.89 hits, 6s | 100% win, 94% clean, 0.06 hits, 6s |
|  | expert, normal play | 100% win, 78% clean, 0.22 hits, 3s | 100% win, 78% clean, 0.22 hits, 3s | 100% win, 78% clean, 0.22 hits, 3s | 100% win, 78% clean, 0.22 hits, 3s | 100% win, 78% clean, 0.22 hits, 3s |

Gunslinger timings at d 0.5 with the enemy hp overridden; shows from which hp the gun-arm loop becomes a free win.

| Enemy | player | maxDisarms 0 | maxDisarms 1 | maxDisarms 2 | maxDisarms 3 | maxDisarms inf |
| --- | --- | --- | --- | --- | --- | --- |
| enemy hp 2 | limb camper (perfect placement) | 6% clean, 0.94 hits, 4s | 29% clean, 0.71 hits, 4s | 29% clean, 0.71 hits, 4s | 29% clean, 0.71 hits, 4s | 29% clean, 0.71 hits, 4s |
|  | average, normal play | 28% clean, 0.72 hits, 3s | 32% clean, 0.69 hits, 3s | 32% clean, 0.69 hits, 3s | 32% clean, 0.69 hits, 3s | 32% clean, 0.69 hits, 3s |
| enemy hp 4 | limb camper (perfect placement) | 6% clean, 0.94 hits, 6s | 29% clean, 0.71 hits, 6s | 29% clean, 0.71 hits, 6s | 29% clean, 0.71 hits, 6s | 29% clean, 0.71 hits, 6s |
|  | average, normal play | 6% clean, 0.94 hits, 4s | 10% clean, 0.90 hits, 4s | 10% clean, 0.90 hits, 4s | 10% clean, 0.90 hits, 4s | 10% clean, 0.90 hits, 4s |
| enemy hp 6 | limb camper (perfect placement) | 1% clean, 1.83 hits, 7s | 2% clean, 1.62 hits, 7s | 29% clean, 0.71 hits, 7s | 29% clean, 0.71 hits, 7s | 29% clean, 0.71 hits, 7s |
|  | average, normal play | 6% clean, 0.94 hits, 4s | 9% clean, 0.91 hits, 4s | 9% clean, 0.91 hits, 4s | 9% clean, 0.91 hits, 4s | 9% clean, 0.91 hits, 4s |
| enemy hp 8 | limb camper (perfect placement) | 0% clean, 1.88 hits, 9s | 2% clean, 1.62 hits, 9s | 2% clean, 1.64 hits, 9s | 1% clean, 1.64 hits, 9s | 29% clean, 0.71 hits, 9s |
|  | average, normal play | 6% clean, 0.95 hits, 5s | 9% clean, 0.91 hits, 5s | 9% clean, 0.91 hits, 5s | 9% clean, 0.91 hits, 5s | 9% clean, 0.91 hits, 5s |
| enemy hp 12 | limb camper (perfect placement) | 0% clean, 2.80 hits, 11s | 0% clean, 2.56 hits, 12s | 0% clean, 2.58 hits, 12s | 1% clean, 1.64 hits, 12s | 29% clean, 0.71 hits, 12s |
|  | average, normal play | 3% clean, 1.33 hits, 6s | 5% clean, 1.16 hits, 6s | 6% clean, 1.14 hits, 6s | 6% clean, 1.14 hits, 6s | 6% clean, 1.14 hits, 6s |


## Rookie accuracy

Clean-win rate vs a Rookie at depth difficulty 0.05 (Rookie hp 1).

| Rookie variant | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| current: aim 10-70 (about 23% hit), lead 900 | 98% | 100% | 100% | 100% |
| aim 10-55 (about 31%) | 97% | 100% | 100% | 100% |
| aim 6-45 (about 46%) | 97% | 100% | 100% | 100% |
| aim 4-40 (about 56%) | 96% | 100% | 100% | 100% |
| aim 4-40, lead 750 | 89% | 98% | 100% | 100% |
| aim 0-38 (Bandit accuracy), lead 700 | 84% | 97% | 99% | 100% |
| aim 0-38 (Bandit accuracy), lead 620 | 73% | 95% | 99% | 100% |


## Tell-lead ladder for early enemies

Clean-win rate by `tell.leadMs` (floor 450). Rookie rows also use aim 4-40.

| enemy | tell.leadMs | novice | average | skilled | expert |
| --- | --- | --- | --- | --- | --- |
| rookie (d 0.05) aim 4-40 | 900 | 96% | 100% | 100% | 100% |
| rookie (d 0.05) aim 4-40 | 800 | 92% | 99% | 100% | 100% |
| rookie (d 0.05) aim 4-40 | 750 | 89% | 98% | 100% | 100% |
| rookie (d 0.05) aim 4-40 | 700 | 86% | 98% | 99% | 100% |
| bandit (d 0.1) | 620 | 46% | 63% | 84% | 98% |
| bandit (d 0.1) | 660 | 49% | 69% | 91% | 99% |
| bandit (d 0.1) | 700 | 52% | 76% | 96% | 100% |
| bandit (d 0.1) | 740 | 55% | 84% | 98% | 100% |
| gunslinger (d 0.5) | 560 | 14% | 32% | 56% | 87% |
| gunslinger (d 0.5) | 600 | 17% | 36% | 66% | 94% |
| gunslinger (d 0.5) | 640 | 19% | 43% | 78% | 97% |
| gunslinger (d 0.5) | 680 | 23% | 53% | 87% | 99% |
| sheriff (d 0.5) | 600 | 21% | 34% | 58% | 88% |
| sheriff (d 0.5) | 640 | 23% | 39% | 72% | 95% |
| sheriff (d 0.5) | 680 | 25% | 45% | 82% | 97% |
| sheriff (d 0.5) | 720 | 26% | 52% | 88% | 98% |
| sniper (d 0.5) | 1000 | 80% | 98% | 100% | 100% |
| sniper (d 0.5) | 860 | 58% | 94% | 99% | 100% |
| sniper (d 0.5) | 760 | 36% | 81% | 98% | 100% |
| sniper (d 0.5) | 700 | 25% | 63% | 94% | 100% |
| knife_thrower (d 0.5) | 780 | 39% | 85% | 99% | 100% |
| knife_thrower (d 0.5) | 720 | 29% | 69% | 96% | 100% |
| knife_thrower (d 0.5) | 660 | 22% | 52% | 86% | 99% |
| knife_thrower (d 0.5) | 600 | 17% | 40% | 70% | 95% |
| horse_rider (d 0.5) | 820 | 46% | 79% | 98% | 100% |
| horse_rider (d 0.5) | 740 | 39% | 70% | 97% | 100% |
| horse_rider (d 0.5) | 680 | 35% | 60% | 92% | 100% |
| horse_rider (d 0.5) | 620 | 31% | 50% | 80% | 98% |
| drunk (d 0.5) | 800 | 89% | 98% | 100% | 100% |
| drunk (d 0.5) | 700 | 84% | 94% | 99% | 100% |
| drunk (d 0.5) | 640 | 80% | 92% | 98% | 100% |
| drunk (d 0.5) | 600 | 78% | 90% | 97% | 100% |


## Boss hp sensitivity (McGraw)

Mad Dog McGraw at d 0.42 with boss hp overridden (data: 3, +1 at d >= 0.75).

| boss hp | skill | clean win | hits/duel | sec | reaches phase 3 |
| --- | --- | --- | --- | --- | --- |
| 3 | average | 61% | 0.39 | 3.6 | 79% |
| 3 | skilled | 83% | 0.17 | 3.3 | 72% |
| 3 | expert | 97% | 0.03 | 3.0 | 62% |
| 4 | average | 49% | 0.51 | 3.9 | 74% |
| 4 | skilled | 57% | 0.43 | 3.5 | 64% |
| 4 | expert | 82% | 0.18 | 3.2 | 52% |
| 5 | average | 47% | 0.53 | 4.2 | 76% |
| 5 | skilled | 44% | 0.56 | 3.7 | 65% |
| 5 | expert | 59% | 0.41 | 3.4 | 60% |
| 6 | average | 47% | 0.53 | 4.5 | 78% |
| 6 | skilled | 43% | 0.57 | 4.0 | 68% |
| 6 | expert | 49% | 0.51 | 3.6 | 56% |


## Full runs

#### Three-region run (first release), random perk picks, retries on

| skill | run win | clear Dust Creek | clear Canyon (if reached) | clear Railroad (if reached) | run min | min per region (cleared) | duels | hits taken | deaths | paid retries |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 88% | 97% | 94% | 97% | 6.1 | 2.1 / 2.1 / 2.2 | 13.2 | 6.1 | 0.3 | 0.2 |
| average | 98% | 99% | 99% | 99% | 6.1 | 2.0 / 2.1 / 2.1 | 13.3 | 4.3 | 0.1 | 0.0 |
| skilled | 100% | 100% | 100% | 100% | 6.1 | 2.0 / 2.0 / 2.0 | 13.4 | 2.2 | 0.0 | 0.0 |
| expert | 100% | 100% | 100% | 100% | 6.1 | 2.0 / 2.0 / 2.0 | 13.4 | 0.8 | 0.0 | 0.0 |

#### Dust Creek only (one-region run, ramp reaches 1.0 at the boss)

| skill | clear | min | duels | hits taken | hp entering boss | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | 97% | 2.1 | 4.6 | 2.3 | 2.9 | bandit 6, bounty_hunter 3, coward 2 |
| average | 99% | 2.1 | 4.6 | 1.9 | 3.0 | bounty_hunter 2, bandit 1 |
| skilled | 100% | 2.0 | 4.6 | 1.2 | 3.1 |  |
| expert | 100% | 2.0 | 4.6 | 0.5 | 3.1 |  |

#### Income and healing per three-region run

| skill | coins earned | spent | held at end | rest heals | shop heals | tonics | boss heals | event heals | perks owned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 597.4 | 273.4 | 323.9 | 1.8 | 1.8 | 0.3 | 0.1 | 0.0 | 18.8 |
| average | 666.2 | 291.8 | 374.3 | 1.3 | 1.5 | 0.2 | 0.1 | 0.0 | 20.1 |
| skilled | 711.4 | 296.6 | 414.8 | 0.7 | 0.9 | 0.1 | 0.0 | 0.0 | 20.7 |
| expert | 740.0 | 298.7 | 441.3 | 0.3 | 0.4 | 0.0 | 0.0 | 0.0 | 21.0 |

#### Perk rarity seen (average skill, random picks)

| rarity | offered per run | share of offers | taken per run | nominal weight |
| --- | --- | --- | --- | --- |
| common | 17.7 | 44.8% | 10.2 | 60 |
| rare | 17.3 | 43.8% | 7.6 | 30 |
| legend | 4.5 | 11.4% | 1.7 | 4 |
| cursed | 0.0 | 0.0% | 0.0 | 6 |


## Full runs under package C

#### Three-region run (first release), random perk picks, retries on

| skill | run win | clear Dust Creek | clear Canyon (if reached) | clear Railroad (if reached) | run min | min per region (cleared) | duels | hits taken | deaths | paid retries |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 16% | 39% | 55% | 76% | 2.9 | 2.1 / 2.2 / 2.2 | 7.1 | 4.2 | 1.5 | 0.7 |
| average | 30% | 51% | 81% | 74% | 3.7 | 2.1 / 2.1 / 2.1 | 8.6 | 4.1 | 1.3 | 0.6 |
| skilled | 59% | 69% | 96% | 89% | 4.6 | 2.1 / 2.1 / 2.1 | 10.6 | 2.9 | 0.8 | 0.4 |
| expert | 77% | 80% | 100% | 96% | 5.1 | 2.0 / 2.0 / 2.0 | 11.6 | 1.4 | 0.4 | 0.2 |

#### Dust Creek only (one-region run, ramp reaches 1.0 at the boss)

| skill | clear | min | duels | hits taken | hp entering boss | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | 32% | 1.8 | 4.3 | 3.0 | 2.2 | bounty_hunter 104, BOSS mad_dog_mcgraw 97, bandit 57 |
| average | 38% | 1.9 | 4.5 | 2.9 | 2.1 | bounty_hunter 116, BOSS mad_dog_mcgraw 106, bandit 21 |
| skilled | 54% | 1.9 | 4.6 | 2.1 | 2.1 | bounty_hunter 110, BOSS mad_dog_mcgraw 70, bandit 5 |
| expert | 74% | 1.9 | 4.5 | 1.1 | 2.1 | bounty_hunter 81, BOSS mad_dog_mcgraw 22 |

#### Income and healing per three-region run

| skill | coins earned | spent | held at end | rest heals | shop heals | tonics | boss heals | event heals | perks owned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 186.1 | 99.9 | 86.2 | 0.5 | 0.6 | 0.1 | 0.0 | 0.0 | 7.4 |
| average | 290.6 | 152.4 | 138.2 | 0.4 | 0.7 | 0.2 | 0.0 | 0.0 | 10.5 |
| skilled | 465.7 | 215.7 | 250.0 | 0.3 | 0.5 | 0.2 | 0.0 | 0.0 | 14.8 |
| expert | 587.6 | 248.6 | 339.0 | 0.1 | 0.2 | 0.1 | 0.0 | 0.0 | 17.4 |

#### Perk rarity seen (average skill, random picks)

| rarity | offered per run | share of offers | taken per run | nominal weight |
| --- | --- | --- | --- | --- |
| common | 10.9 | 50.5% | 5.8 | 60 |
| rare | 8.6 | 39.7% | 3.6 | 30 |
| legend | 2.1 | 9.7% | 0.8 | 4 |
| cursed | 0.0 | 0.0% | 0.0 | 6 |


## Difficulty ramp: one curve per run vs per region

| skill | ramp | run win | clear R1 | clear R2 (if reached) | clear R3 (if reached) | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | one curve per run (current) | 88% | 97% | 94% | 97% | gunslinger 16, bandit 8 |
| novice | restarts each region | 91% | 97% | 96% | 98% | gunslinger 11, bandit 9 |
| novice | one curve + 0.12 per region | 85% | 97% | 92% | 94% | gunslinger 19, train_guard 12 |
| average | one curve per run (current) | 98% | 99% | 99% | 99% | train_guard 4, gunslinger 3 |
| average | restarts each region | 99% | 99% | 100% | 100% | bounty_hunter 2, gunslinger 1 |
| average | one curve + 0.12 per region | 97% | 99% | 99% | 99% | train_guard 4, gunslinger 4 |
| skilled | one curve per run (current) | 100% | 100% | 100% | 100% |  |
| skilled | restarts each region | 100% | 100% | 100% | 100% |  |
| skilled | one curve + 0.12 per region | 100% | 100% | 100% | 100% | train_guard 1 |
| expert | one curve per run (current) | 100% | 100% | 100% | 100% |  |
| expert | restarts each region | 100% | 100% | 100% | 100% |  |
| expert | one curve + 0.12 per region | 100% | 100% | 100% | 100% |  |

#### Same comparison under package C

| skill | ramp | run win | clear R1 | clear R2 (if reached) | clear R3 (if reached) | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | one curve per run (current) | 16% | 39% | 55% | 76% | bounty_hunter 104, BOSS mad_dog_mcgraw 77 |
| novice | restarts each region | 15% | 33% | 59% | 76% | bounty_hunter 105, BOSS mad_dog_mcgraw 95 |
| novice | one curve + 0.12 per region | 15% | 39% | 54% | 71% | bounty_hunter 104, BOSS mad_dog_mcgraw 77 |
| average | one curve per run (current) | 30% | 51% | 81% | 74% | bounty_hunter 113, BOSS mad_dog_mcgraw 62 |
| average | restarts each region | 26% | 39% | 76% | 86% | bounty_hunter 116, BOSS mad_dog_mcgraw 103 |
| average | one curve + 0.12 per region | 28% | 51% | 71% | 77% | bounty_hunter 113, BOSS mad_dog_mcgraw 62 |
| skilled | one curve per run (current) | 59% | 69% | 96% | 89% | bounty_hunter 103, BOSS mad_dog_mcgraw 17 |
| skilled | restarts each region | 49% | 54% | 94% | 96% | bounty_hunter 106, BOSS mad_dog_mcgraw 73 |
| skilled | one curve + 0.12 per region | 55% | 69% | 92% | 87% | bounty_hunter 103, BOSS the_undertaker 18 |
| expert | one curve per run (current) | 77% | 80% | 100% | 96% | bounty_hunter 79, train_guard 10 |
| expert | restarts each region | 71% | 74% | 99% | 97% | bounty_hunter 82, BOSS mad_dog_mcgraw 22 |
| expert | one curve + 0.12 per region | 76% | 80% | 99% | 96% | bounty_hunter 79, train_guard 8 |


## Perk contribution

Baseline (no perk), stress scenario: lives 2, difficulty +0.3, average skill: run win 66.5%, clear Dust Creek 86.0%, N=400. Duel panel baseline (10 enemies, d 0.5, average): 0.359 hits/duel, clean 64.1%.

| perk | rarity | tags | support (data) | hits/duel (panel) | clean win | perfect | run win | delta win | z | coins/run delta | hits/run delta | flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tin Star | rare | LIFE | a02 | 0.000 | 100.0% | 0.4% | 100.0% | +33.5pp | 12.7 | +233 | -4.6 | DOMINANT |
| Bullet Belt | common | LIFE+COIN | today | 0.359 | 64.1% | 0.4% | 91.8% | +25.3pp | 8.8 | +133 | +0.7 | DOMINANT |
| Revive Flask | legend | LIFE | a02 | 0.359 | 64.1% | 0.4% | 85.8% | +19.3pp | 6.4 | +133 | +0.2 | DOMINANT |
| Tip Jar | common | COIN+LIFE | today | 0.359 | 64.1% | 0.4% | 79.0% | +12.5pp | 4.0 | +54 | +0.1 |  |
| Devil's Deal | cursed | CURSE+DRAW | a06 | 0.316 | 68.4% | 96.8% | 75.8% | +9.3pp | 2.9 | +117 | -0.7 |  |
| Quickdraw Scar | rare | DRAW | today | 0.317 | 68.3% | 88.3% | 75.5% | +9.0pp | 2.8 | +110 | -0.6 |  |
| Dead Eye | rare | AIM | a02 | 0.318 | 68.2% | 0.4% | 74.8% | +8.3pp | 2.6 | +69 | -0.6 |  |
| Cold Open | rare | DRAW | a02 | 0.359 | 64.1% | 0.4% | 73.3% | +6.8pp | 2.1 | +49 | -0.7 |  |
| Spit and Polish | rare | DRAW | a02 | 0.332 | 66.8% | 59.5% | 71.3% | +4.8pp | 1.5 | +71 | -0.4 |  |
| Blood Money | cursed | CURSE+COIN | today | 0.359 | 64.1% | 0.4% | 69.3% | +2.8pp | 0.8 | +893 | -0.4 | no measurable effect (run/shop perk?) |
| Trick Shot | rare | AIM+LUCK | a02 | 0.359 | 64.1% | 0.4% | 68.5% | +2.0pp | 0.6 | +32 | -0.4 | DEAD (support a02) |
| Reflex Tonic | common | DRAW | today | 0.328 | 67.2% | 0.5% | 68.0% | +1.5pp | 0.5 | +22 | -0.4 |  |
| Steady Hands | common | DRAW | a02 | 0.328 | 67.2% | 0.5% | 68.0% | +1.5pp | 0.5 | +22 | -0.4 |  |
| Wanted Poster | rare | LUCK+DRAW | today | 0.359 | 64.1% | 0.4% | 68.0% | +1.5pp | 0.5 | -2 | -0.2 | no measurable effect (run/shop perk?) |
| Bounty Hunter | rare | COIN | today | 0.359 | 64.1% | 0.4% | 67.5% | +1.0pp | 0.3 | +462 | -0.5 | no measurable effect (run/shop perk?) |
| Ricochet | rare | AIM | a02 | 0.359 | 64.1% | 0.4% | 67.3% | +0.8pp | 0.2 | +16 | -0.2 | DEAD (support a02) |
| Buckshot Rounds | rare | AIM | a02 | 0.359 | 64.1% | 0.4% | 67.3% | +0.8pp | 0.2 | +20 | -0.3 | DEAD (support a02) |
| Rapid Fire | legend | AIM | a02 | 0.359 | 64.1% | 0.4% | 67.3% | +0.8pp | 0.2 | -3 | -0.2 | DEAD (support a02) |
| Called Shot | legend | AIM | a02 | 0.359 | 64.1% | 0.4% | 67.0% | +0.5pp | 0.2 | +10 | -0.2 | DEAD (support a02) |
| Hair Trigger | common | DRAW+AIM | a02 | 0.359 | 64.1% | 0.4% | 66.8% | +0.3pp | 0.1 | -5 | -0.4 | DEAD (support a02) |
| Bluff | rare | DRAW+DODGE | a06 | 0.359 | 64.1% | 0.4% | 66.8% | +0.3pp | 0.1 | +39 | -0.4 | DEAD (support a06) |
| Second Wind | rare | DRAW+LIFE | a02 | 0.359 | 64.1% | 0.4% | 66.8% | +0.3pp | 0.1 | +17 | -0.2 | DEAD (support a02) |
| Long Barrel | rare | AIM | a02 | 0.359 | 64.1% | 0.4% | 66.8% | +0.3pp | 0.1 | +24 | -0.2 | DEAD (support a02) |
| Pathfinder | rare | LUCK | today | 0.359 | 64.1% | 0.4% | 66.8% | +0.3pp | 0.1 | +14 | -0.3 | no measurable effect (run/shop perk?) |
| Tell Reader | common | DRAW+LUCK | a02 | 0.359 | 64.1% | 0.4% | 66.5% | +0.0pp | 0.0 | +0 | -0.3 | DEAD (support a02) |
| Steady Breath | common | AIM | a02 | 0.359 | 63.4% | 0.4% | 66.5% | +0.0pp | 0.0 | -1 | -0.1 | DEAD (support a02) |
| Disarmer | common | AIM | today | 0.359 | 64.1% | 0.4% | 66.5% | +0.0pp | 0.0 | +1 | -0.1 | no measurable effect (run/shop perk?) |
| Weak Spotter | common | AIM | a02 | 0.359 | 64.1% | 0.4% | 66.5% | +0.0pp | 0.0 | +10 | -0.1 | DEAD (support a02) |
| Pickpocket | rare | COIN+DRAW | today | 0.359 | 64.1% | 0.4% | 66.5% | +0.0pp | 0.0 | -3 | -0.3 | no measurable effect (run/shop perk?) |
| Marksman Pact | common | AIM | a02 | 0.359 | 64.1% | 0.4% | 66.3% | -0.3pp | -0.1 | -1 | -0.2 | DEAD (support a02) |
| Loaded Dice | common | COIN+LUCK | today | 0.359 | 64.1% | 0.4% | 66.3% | -0.3pp | -0.1 | -11 | -0.3 | no measurable effect (run/shop perk?) |
| Tumble | rare | DODGE+AIM | a02 | 0.359 | 64.1% | 0.4% | 66.0% | -0.5pp | -0.1 | +22 | -0.4 | DEAD (support a02) |
| Slip Away | common | DODGE+COIN | a02 | 0.359 | 64.1% | 0.4% | 65.5% | -1.0pp | -0.3 | -5 | -0.3 | DEAD (support a02) |
| Trader's Eye | common | LUCK+COIN | today | 0.359 | 64.1% | 0.4% | 65.5% | -1.0pp | -0.3 | -11 | -0.4 | no measurable effect (run/shop perk?) |
| Ambidextrous | common | DRAW | a02 | 0.359 | 64.1% | 0.4% | 65.3% | -1.3pp | -0.4 | -10 | -0.3 | DEAD (support a02) |
| Iron Skin | common | LIFE | today | 0.359 | 64.1% | 0.4% | 65.3% | -1.3pp | -0.4 | +2 | -0.3 | no measurable effect (run/shop perk?) |
| Counter Roll | rare | DODGE | a02 | 0.359 | 64.1% | 0.4% | 65.0% | -1.5pp | -0.4 | +15 | -0.3 | DEAD (support a02) |
| Bait | rare | DODGE | a06 | 0.359 | 64.1% | 0.4% | 64.8% | -1.8pp | -0.5 | +12 | -0.3 | DEAD (support a06) |
| Slush Fund | common | COIN | today | 0.359 | 64.1% | 0.4% | 64.8% | -1.8pp | -0.5 | -11 | -0.0 | no measurable effect (run/shop perk?) |
| Whiskey Luck | common | LUCK+CURSE | today | 0.359 | 64.1% | 0.4% | 64.8% | -1.8pp | -0.5 | +6 | -0.2 | no measurable effect (run/shop perk?) |
| Healer's Touch | common | LIFE | today | 0.359 | 64.1% | 0.4% | 64.8% | -1.8pp | -0.5 | -3 | +0.0 | no measurable effect (run/shop perk?) |
| Widow's Wager | cursed | CURSE+COIN | today | 0.359 | 64.1% | 0.4% | 64.8% | -1.8pp | -0.5 | -8 | -0.2 | no measurable effect (run/shop perk?) |
| Phantom Step | legend | DODGE | a02 | 0.359 | 64.1% | 0.4% | 64.5% | -2.0pp | -0.6 | -1 | -0.3 | DEAD (support a02) |
| Showman | legend | DRAW+LIFE | a02 | 0.359 | 64.1% | 0.4% | 64.3% | -2.3pp | -0.7 | -3 | -0.1 | DEAD (support a02) |
| Dust Kick | common | DODGE | a02 | 0.359 | 64.1% | 0.4% | 64.3% | -2.3pp | -0.7 | +2 | -0.2 | DEAD (support a02) |
| Matador | common | DODGE | a02 | 0.359 | 64.1% | 0.4% | 64.3% | -2.3pp | -0.7 | +2 | -0.2 | DEAD (support a02) |
| Gambler's Fallacy | rare | COIN+CURSE | today | 0.359 | 64.1% | 0.4% | 64.3% | -2.3pp | -0.7 | +4 | -0.1 | no measurable effect (run/shop perk?) |
| Last Stand | common | LIFE+AIM | a02 | 0.359 | 64.1% | 0.4% | 64.3% | -2.3pp | -0.7 | +8 | +0.1 | DEAD (support a02) |
| Body Shield | common | DODGE+LIFE | today | 0.359 | 64.1% | 0.4% | 64.0% | -2.5pp | -0.7 | +7 | -0.1 | no measurable effect (run/shop perk?) |
| Interest | rare | COIN | today | 0.359 | 64.1% | 0.4% | 63.7% | -2.8pp | -0.8 | +19 | -0.3 | no measurable effect (run/shop perk?) |
| Pawn Shop | common | COIN | today | 0.359 | 64.1% | 0.4% | 63.2% | -3.3pp | -1.0 | -8 | -0.2 | no measurable effect (run/shop perk?) |
| Lucky Charm | common | LUCK | today | 0.359 | 64.1% | 0.4% | 63.0% | -3.5pp | -1.0 | -9 | -0.2 | no measurable effect (run/shop perk?) |
| Black Cat | common | LUCK | today | 0.359 | 64.1% | 0.4% | 63.0% | -3.5pp | -1.0 | -9 | -0.2 | no measurable effect (run/shop perk?) |
| Horseshoe | rare | LUCK+LIFE | today | 0.359 | 64.1% | 0.4% | 62.5% | -4.0pp | -1.2 | -17 | -0.3 | no measurable effect (run/shop perk?) |
| Hex | cursed | CURSE | today | 0.359 | 64.1% | 0.4% | 44.8% | -21.8pp | -6.2 | -132 | +0.9 | HARMFUL |
| Glass Cannon | cursed | CURSE+LIFE | today | 0.124 | 87.6% | 0.4% | 43.0% | -23.5pp | -6.7 | -136 | -3.2 | HARMFUL |
| Mad Dog's Collar | cursed | CURSE+AIM | a02 | 0.606 | 69.7% | 0.4% | 12.0% | -54.5pp | -15.8 | -424 | -1.3 | HARMFUL |


## Perk pick policies

Perk-pick policies, stress scenario: lives 2, difficulty +0.3, average skill.

| policy | run win | clear R1 | perks owned | hits taken | coins earned |
| --- | --- | --- | --- | --- | --- |
| random | 67% | 86% | 16.6 | 4.7 | 606.2 |
| smart | 64% | 85% | 16.0 | 5.1 | 685.8 |
| tag:DRAW | 69% | 85% | 16.6 | 4.5 | 596.0 |
| tag:AIM | 60% | 84% | 15.7 | 4.8 | 539.1 |
| tag:LIFE | 79% | 88% | 17.9 | 4.1 | 629.5 |
| tag:DODGE | 63% | 85% | 16.0 | 4.8 | 540.8 |
| tag:COIN | 75% | 87% | 17.3 | 5.0 | 721.9 |


## Perk what-ifs

stress scenario: lives 2, difficulty +0.3, average skill, one start perk, N=400.

| change | run win before | run win after |
| --- | --- | --- |
| Tin Star only works against elites and bosses | 100.0% | 63.2% |
| Bullet Belt: coin loss 1 -> 4 per duel | 91.8% | 91.5% |
| Mad Dog's Collar: damage taken x2 -> x1.5 | 12.0% | 70.5% |
| Revive Flask unchanged (control) | 85.8% | 85.8% |

#### Single start perk under package C (lives 2, boss and elite hit for 2), average skill, N=400; no-perk-start baseline 30.0%

| perk | run win | delta |
| --- | --- | --- |
| tin_star | 96.8% | +66.8pp |
| bullet_belt | 78.5% | +48.5pp |
| revive_flask | 57.8% | +27.8pp |
| tip_jar | 34.8% | +4.7pp |
| quickdraw_scar | 43.3% | +13.3pp |
| dead_eye | 45.3% | +15.3pp |
| cold_open | 40.8% | +10.7pp |
| spit_and_polish | 39.5% | +9.5pp |
| horseshoe | 32.8% | +2.8pp |
| healers_touch | 35.5% | +5.5pp |


## Economy pacing

#### Unlock pacing with simulated run outcomes (median over meta seeds; run index at which each tier is complete)

| coin supply | learner | first unlock | tier 1 | tier 2 | tier 3 | tier 4 | Canyon bought | Railroad bought | banked per run (first 20) | bounty-board claims per run (first 20) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current data | slow learner (t=0.3+0.012i) | 1 | 3 | 23 | 25 | 27 | 5 | 12 | 238.8 | 295.7 |
| current data | typical learner (t=0.5+0.025i) | 1 | 3 | 20 | 25 | 26 | 5 | 12 | 244.4 | 297.3 |
| current data | fast learner (t=0.8+0.04i) | 1 | 3 | 18 | 25 | 26 | 5 | 12 | 249.9 | 304.5 |
| in-run coins x0.5 | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 33 | 6 | 14 | 173.4 | 294.8 |
| in-run coins x0.33 | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 36 | 6 | 14 | 150.9 | 292.7 |
| in-run coins x0.2 | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 40 | 6 | 15 | 133.2 | 291.7 |
| no bounty-board claims (runs only) | typical learner (t=0.5+0.025i) | 1 | 5 | 37 | 42 | 62 | 18 | 36 | 155.9 | 0.0 |
| bounty-board rewards x0.5 | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 40 | 9 | 19 | 203.4 | 135.1 |
| bounty-board rewards x0.25 | typical learner (t=0.5+0.025i) | 1 | 3 | 29 | 31 | 49 | 12 | 26 | 187.5 | 62.0 |
| first capture 15% -> 5% of poster | typical learner (t=0.5+0.025i) | 1 | 3 | 21 | 25 | 28 | 6 | 13 | 208.2 | 295.9 |
| bank 40/50% -> 20/25% | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 33 | 6 | 14 | 173.4 | 294.8 |
| first capture 5% + bank 20/25% | typical learner (t=0.5+0.025i) | 1 | 3 | 24 | 25 | 36 | 6 | 15 | 138.7 | 290.1 |
| package C (lives 2, boss and elite hit for 2) | slow learner (t=0.3+0.012i) | 1 | 3 | 47 | 32 | 65 | 9 | 26 | 104.4 | 160.6 |
| package C (lives 2, boss and elite hit for 2) | typical learner (t=0.5+0.025i) | 1 | 3 | 31 | 26 | 50 | 9 | 22 | 107.4 | 167.0 |
| package C (lives 2, boss and elite hit for 2) | fast learner (t=0.8+0.04i) | 1 | 3 | 25 | 25 | 42 | 9 | 20 | 133.4 | 194.8 |

A09 documented medians: first 2-3, tier 1 about 14, tier 2 about 27, tier 3 about 40, tier 4 about 52 (A09 used a crude win model, see docs/ECONOMY.md). Coins x k scales only `RunSummary.coins` (the held-coin part of settlement); bounty captures are unchanged.

#### Run outcomes by skill step t (0 novice, 1 average, 2 skilled, 3 expert) and open regions

| t | regions open | run win | in-run coins earned | held at end | banked, first-ever run (incl. first-capture bounties) | banked, steady state (captures already made) | minutes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.2 | 1 | 95% | 186.8 | 146.6 | 270.1 | 111.1 | 2.0 |
| 0.2 | 2 | 95% | 385.2 | 224.5 | 674.2 | 202.5 | 4.2 |
| 0.2 | 3 | 82% | 562.1 | 313.4 | 709.0 | 245.4 | 5.7 |
| 1 | 1 | 97% | 194.3 | 152.1 | 279.6 | 115.3 | 2.0 |
| 1 | 2 | 93% | 386.9 | 224.7 | 663.0 | 200.8 | 4.0 |
| 1 | 3 | 95% | 650.4 | 372.1 | 797.9 | 286.2 | 6.0 |
| 1.8 | 1 | 98% | 201.4 | 157.2 | 285.2 | 118.4 | 2.0 |
| 1.8 | 2 | 100% | 412.6 | 242.8 | 701.9 | 215.0 | 4.1 |
| 1.8 | 3 | 100% | 709.0 | 409.7 | 849.7 | 310.7 | 6.1 |
| 2.6 | 1 | 100% | 214.7 | 165.2 | 295.1 | 123.6 | 2.0 |
| 2.6 | 2 | 100% | 434.3 | 263.5 | 714.7 | 225.8 | 4.1 |
| 2.6 | 3 | 100% | 744.3 | 443.1 | 867.9 | 327.8 | 6.1 |


## Region length and run time

Average skill. Minutes per region use the time model in runSim.ts TIME_MODEL (3 s per map pick, 8 s duel framing, 14 s boss framing, 30 s shop, 8 s rest, 14 s event, 8 s treasure).

| nodes per region | data | min per region (cleared) | min per 3-region run | duels per run | clear region 1 | win 3 regions |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | current data | 2.1 | 6.1 | 13.3 | 99% | 98% |
| 7 | package C | 2.1 | 3.7 | 8.6 | 51% | 30% |
| 10 | current data | 2.8 | 8.0 | 19.7 | 96% | 89% |
| 10 | package C | 2.9 | 4.8 | 12.6 | 51% | 39% |
| 14 | current data | 3.9 | 9.0 | 24.2 | 74% | 68% |
| 14 | package C | 3.9 | 5.0 | 14.3 | 35% | 28% |
| 20 | current data | 5.4 | 10.1 | 29.0 | 54% | 51% |
| 20 | package C | 5.5 | 6.0 | 17.9 | 29% | 24% |


## One change at a time

Cell = P(clear Dust Creek incl. boss) / P(win all three regions).

| scenario | novice | average | skilled | expert | avg min in region 1 | avg hits taken |
| --- | --- | --- | --- | --- | --- | --- |
| baseline (current data) | 97% / 89% | 99% / 97% | 100% / 100% | 100% / 100% | 2.0 | 4.3 |
| no perks taken at all | 97% / 75% | 98% / 94% | 100% / 99% | 100% / 100% | 2.0 | 6.3 |
| lives 3 -> 2 (damage.heroHp) | 77% / 50% | 86% / 76% | 94% / 93% | 100% / 100% | 2.1 | 4.0 |
| lives 3 -> 4 | 100% / 99% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.3 |
| boss heal 1 -> 0 (RUN_TUNING.bossHeal) | 97% / 71% | 99% / 92% | 100% / 100% | 100% / 100% | 2.0 | 4.2 |
| shop heal 20 -> 40 (RUN_TUNING.healPrice) | 96% / 87% | 99% / 97% | 100% / 100% | 100% / 100% | 2.0 | 4.4 |
| boss hits for 2 (design doc) | 92% / 69% | 97% / 91% | 100% / 100% | 100% / 100% | 2.1 | 5.2 |
| boss + elite hit for 2 (design doc) | 81% / 61% | 86% / 80% | 95% / 95% | 100% / 100% | 2.1 | 5.4 |
| enemy hit tolerance 24 -> 32 px | 96% / 81% | 99% / 96% | 100% / 100% | 100% / 100% | 2.0 | 5.0 |
| draw animation 120 -> 180 ms | 96% / 83% | 98% / 94% | 100% / 100% | 100% / 100% | 2.1 | 4.8 |
| aim slow-mo 0.35 -> 0.5 | 96% / 85% | 99% / 95% | 100% / 100% | 100% / 100% | 2.0 | 5.0 |
| aim slow-mo 0.35 -> 1.0 (none; limit case) | 92% / 70% | 97% / 89% | 98% / 96% | 100% / 100% | 2.0 | 6.2 |
| enemy reload 1500 -> 700 ms | 97% / 87% | 99% / 97% | 100% / 100% | 100% / 100% | 2.0 | 4.3 |
| enemy tell lead x0.85 (floor 450) | 95% / 82% | 98% / 93% | 100% / 99% | 100% / 100% | 2.0 | 5.1 |
| enemy hp +1 on tier 2+ | 96% / 82% | 99% / 94% | 100% / 99% | 100% / 100% | 2.1 | 5.1 |
| depth difficulty +0.2 | 97% / 86% | 99% / 95% | 100% / 99% | 100% / 100% | 2.1 | 4.8 |


## Candidate packages vs targets

Cell = P(clear Dust Creek incl. boss) / P(win all three regions).

| scenario | novice | average | skilled | expert | avg min in region 1 | avg hits taken |
| --- | --- | --- | --- | --- | --- | --- |
| baseline (current data) | 97% / 89% | 99% / 97% | 100% / 100% | 100% / 100% | 2.0 | 4.3 |
| A: lives 2 | 77% / 50% | 86% / 76% | 94% / 93% | 100% / 100% | 2.1 | 4.0 |
| B: lives 2 + boss hits for 2 | 51% / 23% | 66% / 42% | 89% / 79% | 99% / 98% | 2.1 | 4.4 |
| C: lives 2 + boss and elite hit for 2 | 39% / 16% | 50% / 30% | 67% / 58% | 79% / 75% | 2.1 | 4.1 |
| D: lives 3 + boss and elite hit for 2 | 81% / 61% | 86% / 80% | 95% / 95% | 100% / 100% | 2.1 | 5.4 |
| E: C + boss heal 0 + shop heal 40 | 36% / 14% | 49% / 27% | 67% / 58% | 79% / 75% | 2.1 | 3.8 |
| F: C + tell lead x0.9 + hit tolerance 28 | 30% / 10% | 46% / 24% | 62% / 50% | 75% / 71% | 2.1 | 4.4 |
| G: lives 2, lead x0.8, tolerance 30, draw 160, boss heal 0, shop heal 40 (no 2-damage hits) | 50% / 9% | 65% / 20% | 81% / 56% | 97% / 94% | 2.1 | 4.1 |
