# NEONFEED balance simulation report (profile quick)

DuelSystem perk hooks present in this checkout: yes.


## Target checks

| id | target | band | measured | status |
| --- | --- | --- | --- | --- |
| T1a | novice clean-win vs Rookie (d 0.1) | 80% to 90% | 98.0% | TOO EASY |
| T1b | novice clean-win vs Bandit (d 0.1) | 55% to 70% | 47.3% | TOO HARD |
| T1c | average clean-win vs Bandit (d 0.1) | 70% to 90% | 62.7% | TOO HARD |
| T1d | average clean-win vs Gunslinger (d 0.5) | 40% to 60% | 32.7% | TOO HARD |
| T1e | expert clean-win vs Gunslinger (d 0.5) | 70% to 95% | 86.0% | ok |


## Duel matrix (enemy x depth x skill)

#### Difficulty 0.1

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 97% / 100% / 0.03 / 3.0s | 100% / 100% / 0.00 / 2.7s | 100% / 100% / 0.00 / 2.6s | 100% / 100% / 0.00 / 2.5s |
| Bandit (T1, hp 2) | 44% / 100% / 0.56 / 3.5s | 60% / 100% / 0.40 / 3.0s | 81% / 100% / 0.19 / 2.8s | 97% / 100% / 0.03 / 2.6s |
| Gunslinger (T2, hp 2) | 25% / 100% / 0.75 / 3.5s | 39% / 100% / 0.61 / 3.0s | 59% / 100% / 0.41 / 2.8s | 83% / 100% / 0.17 / 2.6s |
| Coward (T2, hp 1) | 66% / 100% / 0.34 / 3.6s | 85% / 100% / 0.15 / 3.2s | 95% / 100% / 0.05 / 3.0s | 99% / 100% / 0.01 / 2.9s |
| Drunk (T2, hp 2) | 90% / 100% / 0.10 / 3.6s | 98% / 100% / 0.02 / 3.2s | 100% / 100% / 0.00 / 2.9s | 100% / 100% / 0.00 / 2.8s |
| Sheriff (T3, hp 3) | 27% / 100% / 0.76 / 4.8s | 37% / 100% / 0.63 / 3.7s | 60% / 100% / 0.40 / 3.2s | 93% / 100% / 0.07 / 3.0s |
| Dual Wielder (T4, hp 2) | 31% / 100% / 0.81 / 3.7s | 53% / 100% / 0.48 / 3.2s | 82% / 100% / 0.18 / 3.0s | 97% / 100% / 0.03 / 2.8s |
| Sniper (T3, hp 2) | 77% / 100% / 0.23 / 4.2s | 99% / 100% / 0.01 / 3.7s | 100% / 100% / 0.00 / 3.5s | 100% / 100% / 0.00 / 3.3s |
| Knife Thrower (T3, hp 2) | 49% / 100% / 0.55 / 3.5s | 87% / 100% / 0.13 / 3.0s | 99% / 100% / 0.01 / 2.8s | 100% / 100% / 0.00 / 2.6s |
| Train Guard (T3, hp 3) | 33% / 100% / 0.67 / 4.2s | 43% / 100% / 0.57 / 3.5s | 71% / 100% / 0.29 / 3.2s | 95% / 100% / 0.05 / 3.0s |
| Horse Rider (T3, hp 2) | 51% / 100% / 0.49 / 4.5s | 77% / 100% / 0.23 / 3.6s | 100% / 100% / 0.00 / 3.1s | 100% / 100% / 0.00 / 2.9s |
| Bounty Hunter (T5, hp 4) | 15% / 100% / 0.99 / 4.7s | 20% / 100% / 0.88 / 4.0s | 42% / 100% / 0.60 / 3.6s | 61% / 100% / 0.39 / 3.3s |
| **mean of roster** | **50% / - / 0.52 / 3.9s** | **66% / - / 0.34 / 3.3s** | **82% / - / 0.18 / 3.0s** | **94% / - / 0.06 / 2.9s** |

#### Difficulty 0.5

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 96% / 100% / 0.04 / 3.1s | 100% / 100% / 0.00 / 2.8s | 100% / 100% / 0.00 / 2.7s | 100% / 100% / 0.00 / 2.6s |
| Bandit (T1, hp 2) | 37% / 100% / 0.63 / 3.6s | 53% / 100% / 0.47 / 3.1s | 79% / 100% / 0.21 / 2.9s | 96% / 100% / 0.04 / 2.7s |
| Gunslinger (T2, hp 2) | 16% / 100% / 0.84 / 3.6s | 31% / 100% / 0.69 / 3.1s | 53% / 100% / 0.47 / 2.9s | 81% / 100% / 0.19 / 2.7s |
| Coward (T2, hp 1) | 55% / 100% / 0.45 / 3.8s | 73% / 100% / 0.27 / 3.4s | 85% / 100% / 0.15 / 3.2s | 92% / 100% / 0.08 / 3.1s |
| Drunk (T2, hp 2) | 89% / 100% / 0.11 / 3.7s | 98% / 100% / 0.02 / 3.3s | 100% / 100% / 0.00 / 3.0s | 100% / 100% / 0.00 / 2.9s |
| Sheriff (T3, hp 3) | 19% / 100% / 0.83 / 4.8s | 31% / 100% / 0.69 / 3.7s | 55% / 100% / 0.45 / 3.3s | 91% / 100% / 0.09 / 3.0s |
| Dual Wielder (T4, hp 2) | 26% / 100% / 0.87 / 3.8s | 47% / 100% / 0.54 / 3.3s | 81% / 100% / 0.19 / 3.1s | 97% / 100% / 0.03 / 2.9s |
| Sniper (T3, hp 2) | 77% / 100% / 0.23 / 4.3s | 99% / 100% / 0.01 / 3.8s | 100% / 100% / 0.00 / 3.6s | 100% / 100% / 0.00 / 3.4s |
| Knife Thrower (T3, hp 2) | 41% / 100% / 0.63 / 3.6s | 87% / 100% / 0.13 / 3.1s | 99% / 100% / 0.01 / 2.9s | 100% / 100% / 0.00 / 2.7s |
| Train Guard (T3, hp 3) | 27% / 100% / 0.73 / 4.2s | 37% / 100% / 0.63 / 3.6s | 69% / 100% / 0.31 / 3.3s | 95% / 100% / 0.05 / 3.0s |
| Horse Rider (T3, hp 2) | 45% / 100% / 0.55 / 4.6s | 75% / 100% / 0.25 / 3.7s | 100% / 100% / 0.00 / 3.2s | 100% / 100% / 0.00 / 3.0s |
| Bounty Hunter (T5, hp 4) | 8% / 100% / 1.11 / 4.8s | 14% / 100% / 0.97 / 4.1s | 35% / 100% / 0.71 / 3.7s | 57% / 100% / 0.43 / 3.4s |
| **mean of roster** | **45% / - / 0.59 / 4.0s** | **62% / - / 0.39 / 3.4s** | **80% / - / 0.21 / 3.1s** | **92% / - / 0.08 / 2.9s** |

#### Difficulty 0.9

Cell = clean-win % (no hit taken = 1-life win) / 3-life win % / mean hits taken per duel / mean duel seconds (WAIT included).

| Enemy | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| Rookie (T1, hp 1) | 89% / 100% / 0.11 / 3.6s | 99% / 100% / 0.01 / 3.2s | 100% / 100% / 0.00 / 2.9s | 100% / 100% / 0.00 / 2.7s |
| Bandit (T1, hp 2) | 23% / 100% / 0.77 / 4.1s | 25% / 100% / 0.75 / 3.5s | 45% / 100% / 0.55 / 3.2s | 81% / 100% / 0.19 / 3.0s |
| Gunslinger (T2, hp 2) | 3% / 100% / 0.97 / 4.1s | 3% / 100% / 0.97 / 3.5s | 11% / 100% / 0.89 / 3.2s | 41% / 100% / 0.59 / 3.0s |
| Coward (T2, hp 1) | 30% / 100% / 0.71 / 4.8s | 46% / 100% / 0.54 / 4.0s | 65% / 100% / 0.35 / 3.7s | 79% / 100% / 0.21 / 3.4s |
| Drunk (T2, hp 2) | 80% / 100% / 0.20 / 4.3s | 91% / 100% / 0.09 / 3.7s | 98% / 100% / 0.02 / 3.4s | 100% / 100% / 0.00 / 3.2s |
| Sheriff (T3, hp 3) | 7% / 99% / 0.99 / 5.4s | 17% / 100% / 0.83 / 4.1s | 39% / 100% / 0.61 / 3.6s | 75% / 100% / 0.25 / 3.3s |
| Dual Wielder (T4, hp 2) | 1% / 100% / 1.48 / 4.3s | 8% / 100% / 1.08 / 3.7s | 37% / 100% / 0.65 / 3.4s | 84% / 100% / 0.16 / 3.2s |
| Sniper (T3, hp 2) | 51% / 100% / 0.49 / 4.8s | 86% / 100% / 0.14 / 4.2s | 100% / 100% / 0.00 / 3.9s | 100% / 100% / 0.00 / 3.7s |
| Knife Thrower (T3, hp 2) | 12% / 100% / 1.09 / 4.1s | 43% / 100% / 0.57 / 3.5s | 77% / 100% / 0.23 / 3.2s | 97% / 100% / 0.03 / 3.0s |
| Train Guard (T3, hp 3) | 17% / 100% / 0.83 / 4.8s | 18% / 100% / 0.82 / 4.0s | 29% / 100% / 0.71 / 3.6s | 65% / 100% / 0.35 / 3.3s |
| Horse Rider (T3, hp 2) | 29% / 100% / 0.73 / 5.5s | 51% / 100% / 0.49 / 4.2s | 81% / 100% / 0.19 / 3.6s | 100% / 100% / 0.00 / 3.3s |
| Bounty Hunter (T5, hp 4) | 8% / 100% / 1.11 / 4.9s | 15% / 100% / 0.99 / 4.2s | 35% / 100% / 0.70 / 3.8s | 57% / 100% / 0.43 / 3.5s |
| **mean of roster** | **29% / - / 0.79 / 4.5s** | **42% / - / 0.61 / 3.8s** | **60% / - / 0.41 / 3.5s** | **82% / - / 0.18 / 3.2s** |


## Bosses

| Boss case | skill | clean win | 3-life win | hits/duel | sec | reaches ph2 | reaches ph3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mad Dog McGraw, 3-region run (d 0.42, hp 3) | novice | 46% | 100% | 0.55 | 4.1 | 100% | 81% |
|  | average | 57% | 100% | 0.43 | 3.5 | 100% | 77% |
|  | skilled | 80% | 100% | 0.20 | 3.3 | 99% | 74% |
|  | expert | 96% | 100% | 0.04 | 3.0 | 81% | 59% |
| Mad Dog McGraw, 1-region run (d 1.00, hp 4) | novice | 35% | 100% | 0.65 | 4.7 | 100% | 91% |
|  | average | 35% | 100% | 0.65 | 4.0 | 100% | 77% |
|  | skilled | 45% | 100% | 0.55 | 3.6 | 100% | 60% |
|  | expert | 73% | 100% | 0.27 | 3.3 | 100% | 53% |
| The Undertaker, 3-region run (d 0.74, hp 4; phases 2-3 run phase-1 numbers) | novice | 43% | 100% | 0.57 | 5.2 | 100% | 91% |
|  | average | 50% | 100% | 0.50 | 4.4 | 100% | 77% |
|  | skilled | 79% | 100% | 0.21 | 4.0 | 100% | 60% |
|  | expert | 99% | 100% | 0.01 | 3.7 | 100% | 53% |
| Lady Luck (not on a first-release map; d 0.70, hp 4) | novice | 35% | 100% | 0.65 | 4.9 | 100% | 91% |
|  | average | 33% | 100% | 0.67 | 4.2 | 100% | 77% |
|  | skilled | 44% | 100% | 0.56 | 3.8 | 100% | 60% |
|  | expert | 69% | 100% | 0.31 | 3.5 | 100% | 53% |
| El Diablo (final; d 0.95, hp 6) | novice | 31% | 100% | 0.69 | 6.3 | 100% | 100% |
|  | average | 28% | 100% | 0.72 | 5.3 | 100% | 100% |
|  | skilled | 22% | 100% | 0.78 | 4.7 | 100% | 100% |
|  | expert | 55% | 100% | 0.45 | 4.3 | 100% | 100% |


## Perfect window vs display lag

Perfect-draw rate and clean-win rate vs a Bandit (d 0.3) by perfectMs and display lag.

| perfectMs | lag ms | novice | average | skilled | expert |
| --- | --- | --- | --- | --- | --- |
| 220 | 0 | 0% (clean 42%) | 3% (clean 62%) | 18% (clean 89%) | 61% (clean 97%) |
| 220 | 25 | 0% (clean 40%) | 0% (clean 57%) | 3% (clean 81%) | 25% (clean 96%) |
| 220 | 40 | 0% (clean 39%) | 0% (clean 55%) | 0% (clean 78%) | 11% (clean 94%) |
| 240 | 0 | 0% (clean 42%) | 11% (clean 62%) | 39% (clean 89%) | 86% (clean 97%) |
| 240 | 25 | 0% (clean 40%) | 1% (clean 57%) | 17% (clean 81%) | 55% (clean 96%) |
| 240 | 40 | 0% (clean 39%) | 0% (clean 55%) | 5% (clean 78%) | 35% (clean 94%) |
| 260 | 0 | 2% (clean 42%) | 17% (clean 62%) | 58% (clean 89%) | 97% (clean 97%) |
| 260 | 25 | 0% (clean 40%) | 11% (clean 57%) | 35% (clean 81%) | 81% (clean 96%) |
| 260 | 40 | 0% (clean 39%) | 3% (clean 55%) | 18% (clean 78%) | 61% (clean 94%) |


## Gun-arm disarm loop (QA-09)

Limb-camper = reticle parked on the gun arm, never fires manually (autofire only). Columns are `fairness.maxDisarms`.

| Enemy | player | maxDisarms 0 | maxDisarms 1 | maxDisarms 2 | maxDisarms 3 | maxDisarms inf |
| --- | --- | --- | --- | --- | --- | --- |
| Gunslinger d.9 (hp 3) | limb camper | 100% win, 0% clean, 1.00 hits, 5s | 100% win, 17% clean, 0.83 hits, 5s | 100% win, 17% clean, 0.83 hits, 5s | 100% win, 17% clean, 0.83 hits, 5s | 100% win, 17% clean, 0.83 hits, 5s |
|  | expert, normal play | 100% win, 41% clean, 0.59 hits, 3s | 100% win, 41% clean, 0.59 hits, 3s | 100% win, 41% clean, 0.59 hits, 3s | 100% win, 41% clean, 0.59 hits, 3s | 100% win, 41% clean, 0.59 hits, 3s |
| Sheriff d.9 (hp 4, armour) | limb camper | 100% win, 0% clean, 1.00 hits, 6s | 100% win, 45% clean, 0.55 hits, 6s | 100% win, 45% clean, 0.55 hits, 6s | 100% win, 45% clean, 0.55 hits, 6s | 100% win, 45% clean, 0.55 hits, 6s |
|  | expert, normal play | 100% win, 39% clean, 0.61 hits, 3s | 100% win, 75% clean, 0.25 hits, 3s | 100% win, 75% clean, 0.25 hits, 3s | 100% win, 75% clean, 0.25 hits, 3s | 100% win, 75% clean, 0.25 hits, 3s |
| Train Guard d.9 (hp 4) | limb camper | 100% win, 7% clean, 0.93 hits, 6s | 100% win, 68% clean, 0.32 hits, 6s | 100% win, 68% clean, 0.32 hits, 6s | 100% win, 68% clean, 0.32 hits, 6s | 100% win, 68% clean, 0.32 hits, 6s |
|  | expert, normal play | 100% win, 65% clean, 0.35 hits, 3s | 100% win, 65% clean, 0.35 hits, 3s | 100% win, 65% clean, 0.35 hits, 3s | 100% win, 65% clean, 0.35 hits, 3s | 100% win, 65% clean, 0.35 hits, 3s |
| Bounty Hunter d.9 (hp 4) | limb camper | 100% win, 0% clean, 1.29 hits, 7s | 100% win, 38% clean, 0.62 hits, 7s | 100% win, 58% clean, 0.42 hits, 7s | 100% win, 58% clean, 0.42 hits, 7s | 100% win, 58% clean, 0.42 hits, 7s |
|  | expert, normal play | 100% win, 57% clean, 0.43 hits, 3s | 100% win, 57% clean, 0.43 hits, 3s | 100% win, 57% clean, 0.43 hits, 3s | 100% win, 57% clean, 0.43 hits, 3s | 100% win, 57% clean, 0.43 hits, 3s |
| McGraw d1 (boss hp 4) | limb camper | 100% win, 25% clean, 0.77 hits, 6s | 100% win, 96% clean, 0.04 hits, 6s | 100% win, 96% clean, 0.04 hits, 6s | 100% win, 12% clean, 0.92 hits, 6s | 100% win, 96% clean, 0.04 hits, 6s |
|  | expert, normal play | 100% win, 73% clean, 0.27 hits, 3s | 100% win, 73% clean, 0.27 hits, 3s | 100% win, 73% clean, 0.27 hits, 3s | 100% win, 73% clean, 0.27 hits, 3s | 100% win, 73% clean, 0.27 hits, 3s |

Gunslinger timings at d 0.5 with the enemy hp overridden; shows from which hp the gun-arm loop becomes a free win.

| Enemy | player | maxDisarms 0 | maxDisarms 1 | maxDisarms 2 | maxDisarms 3 | maxDisarms inf |
| --- | --- | --- | --- | --- | --- | --- |
| enemy hp 2 | limb camper (perfect placement) | 9% clean, 0.91 hits, 4s | 27% clean, 0.73 hits, 4s | 27% clean, 0.73 hits, 4s | 27% clean, 0.73 hits, 4s | 27% clean, 0.73 hits, 4s |
|  | average, normal play | 29% clean, 0.71 hits, 3s | 31% clean, 0.69 hits, 3s | 31% clean, 0.69 hits, 3s | 31% clean, 0.69 hits, 3s | 31% clean, 0.69 hits, 3s |
| enemy hp 4 | limb camper (perfect placement) | 9% clean, 0.91 hits, 6s | 27% clean, 0.73 hits, 6s | 27% clean, 0.73 hits, 6s | 27% clean, 0.73 hits, 6s | 27% clean, 0.73 hits, 6s |
|  | average, normal play | 9% clean, 0.91 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s |
| enemy hp 6 | limb camper (perfect placement) | 0% clean, 1.81 hits, 7s | 3% clean, 1.61 hits, 7s | 27% clean, 0.73 hits, 7s | 27% clean, 0.73 hits, 7s | 27% clean, 0.73 hits, 7s |
|  | average, normal play | 9% clean, 0.91 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s | 11% clean, 0.89 hits, 4s |
| enemy hp 8 | limb camper (perfect placement) | 0% clean, 1.85 hits, 9s | 3% clean, 1.61 hits, 9s | 1% clean, 1.69 hits, 9s | 1% clean, 1.65 hits, 9s | 27% clean, 0.73 hits, 9s |
|  | average, normal play | 9% clean, 0.91 hits, 5s | 11% clean, 0.89 hits, 5s | 11% clean, 0.89 hits, 5s | 11% clean, 0.89 hits, 5s | 11% clean, 0.89 hits, 5s |
| enemy hp 12 | limb camper (perfect placement) | 0% clean, 2.74 hits, 11s | 0% clean, 2.57 hits, 12s | 0% clean, 2.62 hits, 12s | 1% clean, 1.65 hits, 12s | 27% clean, 0.73 hits, 12s |
|  | average, normal play | 5% clean, 1.35 hits, 6s | 7% clean, 1.18 hits, 6s | 7% clean, 1.18 hits, 6s | 7% clean, 1.18 hits, 6s | 7% clean, 1.18 hits, 6s |


## Rookie accuracy

Clean-win rate vs a Rookie at depth difficulty 0.05 (Rookie hp 1).

| Rookie variant | novice | average | skilled | expert |
| --- | --- | --- | --- | --- |
| current: aim 10-70 (about 23% hit), lead 900 | 98% | 100% | 100% | 100% |
| aim 10-55 (about 31%) | 98% | 100% | 100% | 100% |
| aim 6-45 (about 46%) | 97% | 100% | 100% | 100% |
| aim 4-40 (about 56%) | 97% | 100% | 100% | 100% |
| aim 4-40, lead 750 | 91% | 99% | 100% | 100% |
| aim 0-38 (Bandit accuracy), lead 700 | 85% | 98% | 99% | 100% |
| aim 0-38 (Bandit accuracy), lead 620 | 72% | 96% | 99% | 100% |


## Full runs

#### Three-region run (first release), random perk picks, retries on

| skill | run win | clear Dust Creek | clear Canyon | reached | clear Railroad | reached | run min | min per region (cleared) | duels | hits taken | deaths | paid retries |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 90% | 98% | 92% | 100% | 6.0 | 2.1 / 2.1 / 2.2 | 12.9 | 5.6 | 0.3 | 0.2 |
| average | 100% | 100% | 100% | 100% | 6.2 | 2.0 / 2.1 / 2.1 | 13.2 | 4.1 | 0.0 | 0.0 |
| skilled | 100% | 100% | 100% | 100% | 6.1 | 2.0 / 2.1 / 2.0 | 13.2 | 2.1 | 0.0 | 0.0 |
| expert | 100% | 100% | 100% | 100% | 6.1 | 2.0 / 2.0 / 2.0 | 13.2 | 0.8 | 0.0 | 0.0 |

#### Dust Creek only (one-region run, ramp reaches 1.0 at the boss)

| skill | clear | min | duels | hits taken | hp entering boss | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | 95% | 2.1 | 4.7 | 2.4 | 2.9 | coward 1, bandit 1 |
| average | 100% | 2.1 | 4.7 | 1.9 | 3.0 |  |
| skilled | 100% | 2.0 | 4.7 | 1.1 | 3.0 |  |
| expert | 100% | 2.0 | 4.7 | 0.5 | 3.1 |  |

#### Income and healing per three-region run

| skill | coins earned | spent | held at end | rest heals | shop heals | tonics | boss heals | event heals | perks owned |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| novice | 574.2 | 259.4 | 314.8 | 1.6 | 1.8 | 0.2 | 0.2 | 0.0 | 18.5 |
| average | 645.8 | 281.4 | 364.3 | 1.4 | 1.5 | 0.1 | 0.1 | 0.0 | 20.3 |
| skilled | 655.9 | 281.6 | 374.3 | 0.7 | 1.0 | 0.0 | 0.0 | 0.0 | 20.6 |
| expert | 718.9 | 288.8 | 430.1 | 0.3 | 0.3 | 0.0 | 0.0 | 0.0 | 20.8 |

#### Perk rarity seen (average skill, random picks)

| rarity | offered per run | share of offers | taken per run | nominal weight |
| --- | --- | --- | --- | --- |
| common | 16.9 | 43.1% | 10.5 | 60 |
| rare | 17.7 | 45.1% | 7.4 | 30 |
| legend | 4.7 | 11.9% | 1.8 | 4 |
| cursed | 0.0 | 0.0% | 0.0 | 6 |


## Difficulty ramp: one curve per run vs per region

| skill | ramp | run win | clear R1 | clear R2 | reached | clear R3 | reached | top killers |
| --- | --- | --- | --- | --- | --- | --- |
| novice | one curve per run (current) | 90% | 98% | 92% | 100% | bandit 2, gunslinger 1 |
| novice | restarts each region | 88% | 95% | 92% | 100% | bandit 3, coward 2 |
| average | one curve per run (current) | 100% | 100% | 100% | 100% |  |
| average | restarts each region | 100% | 100% | 100% | 100% |  |
| skilled | one curve per run (current) | 100% | 100% | 100% | 100% |  |
| skilled | restarts each region | 100% | 100% | 100% | 100% |  |
| expert | one curve per run (current) | 100% | 100% | 100% | 100% |  |
| expert | restarts each region | 100% | 100% | 100% | 100% |  |


## Perk contribution

Baseline (no perk), stress scenario: lives 2, difficulty +0.3, average skill: run win 67.5%, clear Dust Creek 80.0%, N=40. Duel panel baseline (10 enemies, d 0.5, average): 0.332 hits/duel, clean 66.8%.

| perk | rarity | tags | support (data) | hits/duel (panel) | clean win | perfect | run win | delta win | z | coins/run delta | hits/run delta | flag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tin Star | rare | LIFE | a02 | 0.000 | 100.0% | 0.0% | 100.0% | +32.5pp | 3.9 | +205 | -4.6 | DOMINANT |
| Bullet Belt | common | LIFE+COIN | today | 0.332 | 66.8% | 0.0% | 92.5% | +25.0pp | 2.8 | +130 | +0.3 | DOMINANT |
| Tip Jar | common | COIN+LIFE | today | 0.332 | 66.8% | 0.0% | 80.0% | +12.5pp | 1.3 | +47 | +0.0 |  |
| Revive Flask | legend | LIFE | a02 | 0.332 | 66.8% | 0.0% | 77.5% | +10.0pp | 1.0 | +70 | +0.0 |  |
| Steady Breath | common | AIM | a02 | 0.335 | 64.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +42 | -0.3 |  |
| Disarmer | common | AIM | today | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +42 | -0.4 |  |
| Marksman Pact | common | AIM | a02 | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +42 | -0.4 |  |
| Weak Spotter | common | AIM | a02 | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +41 | -0.4 |  |
| Dust Kick | common | DODGE | a02 | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +36 | -0.4 |  |
| Matador | common | DODGE | a02 | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +36 | -0.4 |  |
| Body Shield | common | DODGE+LIFE | today | 0.332 | 66.8% | 0.0% | 75.0% | +7.5pp | 0.7 | +51 | -0.1 |  |
| Buckshot Rounds | rare | AIM | a02 | 0.332 | 66.8% | 0.0% | 72.5% | +5.0pp | 0.5 | -4 | -0.4 | DEAD (support a02) |
| Counter Roll | rare | DODGE | a02 | 0.332 | 66.8% | 0.0% | 72.5% | +5.0pp | 0.5 | +72 | -0.2 | DEAD (support a02) |
| Devil's Deal | cursed | CURSE+DRAW | a06 | 0.285 | 71.5% | 96.2% | 72.5% | +5.0pp | 0.5 | +48 | -0.8 |  |
| Quickdraw Scar | rare | DRAW | today | 0.285 | 71.5% | 91.8% | 70.0% | +2.5pp | 0.2 | +50 | -0.7 |  |
| Reflex Tonic | common | DRAW | today | 0.312 | 68.8% | 0.0% | 70.0% | +2.5pp | 0.2 | +46 | -0.9 |  |
| Steady Hands | common | DRAW | a02 | 0.312 | 68.8% | 0.0% | 70.0% | +2.5pp | 0.2 | +46 | -0.9 |  |
| Dead Eye | rare | AIM | a02 | 0.287 | 71.3% | 0.0% | 70.0% | +2.5pp | 0.2 | +64 | -0.5 |  |
| Bait | rare | DODGE | a06 | 0.332 | 66.8% | 0.0% | 70.0% | +2.5pp | 0.2 | +59 | -0.2 | DEAD (support a06) |
| Hair Trigger | common | DRAW+AIM | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +28 | -0.6 | DEAD (support a02) |
| Ambidextrous | common | DRAW | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +10 | -0.4 | DEAD (support a02) |
| Cold Open | rare | DRAW | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | -7 | -0.6 | DEAD (support a02) |
| Spit and Polish | rare | DRAW | a02 | 0.307 | 69.3% | 65.3% | 67.5% | +0.0pp | 0.0 | +17 | -0.7 |  |
| Second Wind | rare | DRAW+LIFE | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | -50 | -0.3 | DEAD (support a02) |
| Rapid Fire | legend | AIM | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +14 | -0.3 | DEAD (support a02) |
| Trick Shot | rare | AIM+LUCK | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +50 | -0.6 | DEAD (support a02) |
| Slip Away | common | DODGE+COIN | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +15 | -0.4 | DEAD (support a02) |
| Tumble | rare | DODGE+AIM | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +31 | -0.7 | DEAD (support a02) |
| Phantom Step | legend | DODGE | a02 | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +23 | -0.2 | DEAD (support a02) |
| Pawn Shop | common | COIN | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | -7 | -0.4 | no measurable effect (run/shop perk?) |
| Loaded Dice | common | COIN+LUCK | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | -41 | -0.4 | no measurable effect (run/shop perk?) |
| Pickpocket | rare | COIN+DRAW | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +7 | -0.3 | no measurable effect (run/shop perk?) |
| Trader's Eye | common | LUCK+COIN | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +18 | -0.3 | no measurable effect (run/shop perk?) |
| Pathfinder | rare | LUCK | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | +28 | -0.5 | no measurable effect (run/shop perk?) |
| Iron Skin | common | LIFE | today | 0.332 | 66.8% | 0.0% | 67.5% | +0.0pp | 0.0 | -0 | -0.3 | no measurable effect (run/shop perk?) |
| Tell Reader | common | DRAW+LUCK | a02 | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | -26 | -0.5 | DEAD (support a02) |
| Bluff | rare | DRAW+DODGE | a06 | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +14 | -0.5 | DEAD (support a06) |
| Showman | legend | DRAW+LIFE | a02 | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +16 | -0.1 | DEAD (support a02) |
| Ricochet | rare | AIM | a02 | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +17 | -0.2 | DEAD (support a02) |
| Called Shot | legend | AIM | a02 | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +6 | -0.1 | DEAD (support a02) |
| Wanted Poster | rare | LUCK+DRAW | today | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | -20 | -0.4 | no measurable effect (run/shop perk?) |
| Whiskey Luck | common | LUCK+CURSE | today | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +32 | -0.5 | no measurable effect (run/shop perk?) |
| Healer's Touch | common | LIFE | today | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | -6 | -0.1 | no measurable effect (run/shop perk?) |
| Blood Money | cursed | CURSE+COIN | today | 0.332 | 66.8% | 0.0% | 65.0% | -2.5pp | -0.2 | +894 | -0.2 | no measurable effect (run/shop perk?) |
| Long Barrel | rare | AIM | a02 | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | +27 | -0.0 | DEAD (support a02) |
| Interest | rare | COIN | today | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | +6 | -0.3 | no measurable effect (run/shop perk?) |
| Slush Fund | common | COIN | today | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | -38 | -0.4 | no measurable effect (run/shop perk?) |
| Horseshoe | rare | LUCK+LIFE | today | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | +5 | -0.1 | no measurable effect (run/shop perk?) |
| Last Stand | common | LIFE+AIM | a02 | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | +3 | +0.1 | DEAD (support a02) |
| Widow's Wager | cursed | CURSE+COIN | today | 0.332 | 66.8% | 0.0% | 62.5% | -5.0pp | -0.5 | -9 | -0.4 | no measurable effect (run/shop perk?) |
| Bounty Hunter | rare | COIN | today | 0.332 | 66.8% | 0.0% | 60.0% | -7.5pp | -0.7 | +421 | -0.0 |  |
| Lucky Charm | common | LUCK | today | 0.332 | 66.8% | 0.0% | 60.0% | -7.5pp | -0.7 | +17 | -0.3 |  |
| Black Cat | common | LUCK | today | 0.332 | 66.8% | 0.0% | 60.0% | -7.5pp | -0.7 | +17 | -0.3 |  |
| Gambler's Fallacy | rare | COIN+CURSE | today | 0.332 | 66.8% | 0.0% | 52.5% | -15.0pp | -1.4 | -102 | -0.0 |  |
| Hex | cursed | CURSE | today | 0.332 | 66.8% | 0.0% | 50.0% | -17.5pp | -1.6 | -124 | +0.8 |  |
| Glass Cannon | cursed | CURSE+LIFE | today | 0.083 | 91.8% | 0.0% | 42.5% | -25.0pp | -2.2 | -138 | -3.2 | HARMFUL |
| Mad Dog's Collar | cursed | CURSE+AIM | a02 | 0.550 | 72.5% | 0.0% | 5.0% | -62.5pp | -5.8 | -474 | -1.6 | HARMFUL |


## Perk pick policies

Perk-pick policies, stress scenario: lives 2, difficulty +0.3, average skill.

| policy | run win | clear R1 | perks owned | hits taken | coins earned |
| --- | --- | --- | --- | --- | --- |
| random | 68% | 80% | 15.9 | 4.7 | 604.3 |
| smart | 70% | 83% | 16.1 | 4.8 | 692.2 |
| tag:DRAW | 55% | 78% | 14.7 | 4.7 | 535.3 |
| tag:AIM | 57% | 80% | 15.0 | 4.3 | 505.0 |
| tag:LIFE | 70% | 80% | 16.2 | 4.2 | 528.9 |
| tag:DODGE | 60% | 80% | 15.3 | 4.7 | 486.8 |
| tag:COIN | 63% | 78% | 15.6 | 4.8 | 645.2 |


## Perk what-ifs

stress scenario: lives 2, difficulty +0.3, average skill, one start perk, N=40.

| change | run win before | run win after |
| --- | --- | --- |
| Tin Star only works against elites and bosses | 100.0% | 60.0% |
| Bullet Belt: coin loss 1 -> 4 per duel | 92.5% | 92.5% |
| Mad Dog's Collar: damage taken x2 -> x1.5 | 5.0% | 62.5% |
| Revive Flask unchanged (control) | 77.5% | 77.5% |


## Economy pacing

#### Unlock pacing with simulated run outcomes (median over meta seeds; run index at which each tier is complete)

| learner | first unlock | tier 1 | tier 2 | tier 3 | tier 4 | Canyon bought | Railroad bought | in-run coins earned (first 20 runs) | banked per run (first 20) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| slow learner (t=0.3+0.012i) | 1 | 3 | 21 | 25 | 31 | 8 | 15 | 377.9 | 217.8 |
| typical learner (t=0.5+0.025i) | 1 | 3 | 16 | 25 | 27 | 5 | 13 | 418.5 | 238.2 |
| fast learner (t=0.8+0.04i) | 1 | 3 | 16 | 25 | 26 | 5 | 13 | 456.3 | 252.7 |

A09 documented medians: first 2-3, tier 1 about 14, tier 2 about 27, tier 3 about 40, tier 4 about 52.

#### Run outcomes by skill step t (0 novice, 1 average, 2 skilled, 3 expert) and open regions

| t | regions open | run win | in-run coins earned | held at end | banked at first-capture-free settle | minutes |
| --- | --- | --- | --- | --- | --- | --- |
| 0.2 | 1 | 90% | 175.8 | 140.2 | 253.8 | 2.0 |
| 0.2 | 2 | 90% | 376.8 | 219.3 | 652.8 | 4.1 |
| 0.2 | 3 | 80% | 559.8 | 305.2 | 678.1 | 5.5 |
| 1 | 1 | 100% | 201.8 | 157.6 | 296.6 | 2.1 |
| 1 | 2 | 90% | 383.9 | 225.9 | 656.2 | 4.0 |
| 1 | 3 | 90% | 568.8 | 303.0 | 728.0 | 5.7 |
| 1.8 | 1 | 100% | 205.7 | 159.5 | 297.5 | 2.1 |
| 1.8 | 2 | 100% | 410.4 | 248.8 | 704.6 | 4.1 |
| 1.8 | 3 | 100% | 668.1 | 363.6 | 822.2 | 6.1 |
| 2.6 | 1 | 100% | 214.5 | 167.9 | 301.8 | 2.0 |
| 2.6 | 2 | 100% | 422.6 | 257.5 | 709.1 | 4.0 |
| 2.6 | 3 | 100% | 686.1 | 385.2 | 833.1 | 6.1 |


## One change at a time

Cell = P(clear Dust Creek incl. boss) / P(win all three regions).

| scenario | novice | average | skilled | expert | avg min in region 1 | avg hits taken |
| --- | --- | --- | --- | --- | --- | --- |
| baseline (current data) | 98% / 90% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.1 |
| no perks taken at all | 98% / 73% | 98% / 95% | 100% / 100% | 100% / 100% | 2.1 | 6.3 |
| lives 3 -> 2 (damage.heroHp) | 70% / 43% | 83% / 68% | 95% / 93% | 100% / 100% | 2.1 | 4.1 |
| lives 3 -> 4 | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.1 |
| boss heal 1 -> 0 (RUN_TUNING.bossHeal) | 98% / 73% | 100% / 90% | 100% / 100% | 100% / 100% | 2.0 | 4.1 |
| shop heal 20 -> 40 (RUN_TUNING.healPrice) | 95% / 88% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.2 |
| boss hits for 2 (design doc) | 85% / 70% | 98% / 88% | 98% / 98% | 100% / 100% | 2.1 | 5.0 |
| boss + elite hit for 2 (design doc) | 83% / 65% | 95% / 88% | 98% / 98% | 100% / 100% | 2.1 | 5.2 |
| enemy hit tolerance 24 -> 32 px | 93% / 80% | 100% / 98% | 100% / 100% | 100% / 100% | 2.1 | 4.7 |
| draw animation 120 -> 180 ms | 95% / 83% | 100% / 95% | 100% / 100% | 100% / 100% | 2.1 | 4.5 |
| aim slow-mo 0.35 -> 0.5 | 98% / 88% | 100% / 100% | 100% / 100% | 100% / 100% | 2.1 | 4.6 |
| aim slow-mo 0.35 -> 1.0 (none; limit case) | 95% / 73% | 98% / 90% | 98% / 98% | 100% / 100% | 2.0 | 5.7 |
| enemy reload 1500 -> 700 ms | 98% / 90% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.1 |
| enemy tell lead x0.85 (floor 450) | 95% / 85% | 100% / 98% | 100% / 100% | 100% / 100% | 2.1 | 4.8 |
| enemy hp +1 on tier 2+ | 98% / 85% | 100% / 95% | 100% / 100% | 100% / 100% | 2.1 | 5.0 |
| depth difficulty +0.2 | 95% / 85% | 100% / 95% | 100% / 100% | 100% / 100% | 2.1 | 4.7 |


## Candidate packages vs targets

Cell = P(clear Dust Creek incl. boss) / P(win all three regions).

| scenario | novice | average | skilled | expert | avg min in region 1 | avg hits taken |
| --- | --- | --- | --- | --- | --- | --- |
| baseline (current data) | 98% / 90% | 100% / 100% | 100% / 100% | 100% / 100% | 2.0 | 4.1 |
| A: lives 2 | 70% / 43% | 83% / 68% | 95% / 93% | 100% / 100% | 2.1 | 4.1 |
| B: lives 2 + boss hits for 2 | 43% / 20% | 68% / 45% | 95% / 88% | 100% / 98% | 2.1 | 4.5 |
| C: lives 2 + boss and elite hit for 2 | 30% / 15% | 53% / 33% | 75% / 65% | 85% / 83% | 2.1 | 4.3 |
| D: lives 3 + boss and elite hit for 2 | 83% / 65% | 95% / 88% | 98% / 98% | 100% / 100% | 2.1 | 5.2 |
| E: C + boss heal 0 + shop heal 40 | 30% / 15% | 48% / 25% | 68% / 60% | 85% / 80% | 2.1 | 4.1 |
| F: C + tell lead x0.9 + hit tolerance 28 | 28% / 8% | 50% / 33% | 73% / 63% | 80% / 73% | 2.1 | 4.3 |
| G: lives 2, lead x0.8, tolerance 30, draw 160, boss heal 0, shop heal 40 (no 2-damage hits) | 38% / 5% | 60% / 23% | 68% / 50% | 95% / 93% | 2.1 | 4.3 |
