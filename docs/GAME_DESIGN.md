# Game Design

Owner: A10 (Mobile UX/UI). Consumers: A02 duel, A06 enemies, A07 bosses, A08 run/perks, A09 economy, A18 balance.
Numbers here are starting values for A18 to tune. Rules marked **RULE** are not tunable.

## 1. Pillars
1. One thumb, portrait, sessions of 5-8 minutes per run segment.
2. Every duel is a readable 3-second skill moment. The player must always be able to say why they lost.
3. Build variety comes from perks that change how you play, not how big your numbers are.
4. One currency, coins. Nothing else to count.

## 2. Core loop (single duel)
`WAIT -> DRAW -> SWIPE -> BANG -> (win | hit/death -> retry or results)`

| Phase | What happens | Player input | Feedback |
|---|---|---|---|
| WAIT | Standoff. Camera holds, wind, tension audio. Duration is seeded random (1.2-3.5 s, enemy-dependent). | Hold thumb on the holster zone. Lifting early = **flinch** (see below). | Subtle tell-free idle. Tumbleweed, bell. |
| DRAW | Enemy "tell" fires (exact tell depends on enemy, always an audio + visual + optional haptic triple cue). Reaction clock starts at the tell frame. | Thumb flick up from holster zone as fast as possible. | Hero draw anim. |
| SWIPE | Hero gun is out. Player drags to place the aim reticle on the enemy hit zone (head/body/gun-arm/weak point). Aim assist radius shrinks with difficulty. | Drag, release to fire. | Reticle with slow-mo window (0.35x) lasting up to the aim budget (default 600 ms). |
| BANG | Shot resolves. Enemy shot resolves simultaneously from its own timeline. | None (optional dodge, see below). | Muzzle flash, hit-stop, reaction-time readout. |

### Perfect draw
- Reaction time (ms from tell to draw-flick registered) under the **perfect window** (default 220 ms, perk-adjustable) = PERFECT DRAW.
- Perfect draw grants: aim budget +30%, first shot crit, +coins bonus, and "PERFECT" stamp on screen.
- Good (<350 ms), OK (<550 ms), Slow (otherwise). Thresholds shown in the results screen legend.

### Reaction time display
- After BANG the player always sees: `YOU 214 ms` vs `ENEMY 380 ms`, tier word, and a thin timeline bar with the tell marker. Large pixel digits, brass-on-dark, colour-independent (shape and word, not just colour).
- Best reaction time of the run and of all time is kept in save (bounty board stat).

### Aim
- Hit zones: head (x2, can stagger), body (x1), gun-arm (x0.75 but disarms: cancels the enemy's next shot), weak point (enemy-specific, x2.5).
- Aim budget is a time limit in slow-mo, not a skill-less timer: moving the reticle costs nothing, but the budget ends and the shot auto-fires at the reticle position.

### Dodge
Implemented (D18, `DuelSystem` + `DuelScene`; numbers in `DUEL_CONFIG.dodge`, enemy windows in `src/data/enemies.ts`).
- **Dodge** = a fast horizontal flick (>= 40 px at >= 0.3 px/ms, in the first 500 ms of the touch) of the thumb that is already down. It is a sidestep that makes exactly ONE pending enemy shot miss.
- **When:** during the CUE (instead of drawing) and during recoil after your own shot (SHOT). Never in WAIT or while the gun is coming out (DRAW). While aiming only with Tumble, or with Phantom Step right after an enemy miss. The hint "DODGE NOW" shows when the window opens; "DODGED!" on success.
- **Window:** the last W ms before the pending enemy shot (the muzzle-raise telegraph). W is per enemy: Rookie 420, Bandit 380, Gunslinger 300, Coward 380, Drunk 420, Sheriff 300, Dual Wielder 280, Sniper 320, Knife Thrower 360, Train Guard 320, Horse Rider 340, Bounty Hunter 280; default 250 (`dodge.windowMs`); perks multiply it and it is clamped to 150..600 ms. A multi-shot enemy has one window per shot. The window never opens while you are still answering the cue (>= 250 ms after it).
- **Result:** the first 35% of the window is PERFECT (counter draw gets +30% aim budget), the rest OK; both succeed. A dodge before the window (EARLY) or up to 200 ms after an undodged shot (LATE) fails: you stumble and your next draw starts 300 ms late, like a flinch, and further dodges are ignored meanwhile.
- **Counter:** a successful dodge in the CUE ends in a free counter draw at the dodged shot (no reaction tier, so Perfect-streak perks cannot be farmed). Dodging does not change the enemy plan: the first shot stays >= 450 ms after the cue (F1), and a limb hit voids a pending dodge at no cost.
- Dodging is a choice: trade your current aim for safety. Some enemies punish it (Sniper tracks, Knife Thrower throws two).
- Dodge perks: Counter Roll, Dust Kick, Matador, Slip Away (coins per dodge), Tumble, Phantom Step are live. Body Shield's prop-dodge half is not.

### Flinch
- Lifting thumb before the tell = flinch: hero wastes the draw (+300 ms penalty to draw start), enemy gets a free beat. Never an instant loss. Coward and Drunk make flinching more tempting (fake tells).

### Damage and retry
- Hero has 2 **Lives** (D14; hearts: draw as brass hearts/bullets) per run. An enemy hit costs 1 life; **elite and boss hits cost 2** (`damage.heroHp 2`, `eliteDamage 2`, `bossDamage 2`; perks such as Iron Skin and Mad Dog's Collar multiply it). Tin Star, Revive Flask and Bullet Belt are the ways to soak more.
- Limb (gun-arm) disarms are capped per attempt: 2 for enemies up to hp 3, 1 for hp >= 4 and for bosses (D19); Disarmer adds 1.
- Duel ends when enemy hp is 0, or hero hp is 0.
- **Retry:** on death the player may (a) retry the *same duel* from the start of the standoff once per node by spending coins (cost scales with depth), or (b) end the run to results. Retry never changes the seed of enemy behaviour, so learning is real. No ads required (rewarded ad is an optional service per D7, never mandatory).
- A loss in a normal duel that still leaves lives: fight again immediately (no map return).

## 3. Fairness rules
**RULE F1 - Difficulty must not come only from shorter reaction windows.** Floor on the player's required reaction: tell-to-lethal-shot never below 450 ms on any enemy at any depth. Beyond that, difficulty scales through the other axes:

| Axis | Examples |
|---|---|
| Information | Fake tells (Coward, Drunk), delayed tells (Sniper glint), multiple possible tells (Dual Wielder) |
| Decision | Choose which gun, which target zone, dodge or shoot (Knife Thrower) |
| Precision | Smaller hit zones, moving targets (Horse Rider), cover |
| Sequence | Two or three shots needed, armour, phases, adds |
| Rhythm | Variable WAIT lengths, double-beat shots |
| Resource | Fewer lives, cost of retry, shop prices |

**RULE F2** Every lethal action has a tell that is visible, audible and (if haptics on) felt. All three are always present together so no sense is required (accessibility).
**RULE F3** No unavoidable damage. Every enemy attack can be answered by a faster draw, a correct dodge, or a gun-arm disarm.
**RULE F4** A death screen must name the cause ("Shot while aiming", "Fell for fake tell", "Slow draw 612 ms").
**RULE F5** Run seed fixes enemy timings; retries do not re-roll them.
**RULE F6** Perfect draw is always available as the optimal play: no enemy punishes a fast correct draw (fake tells are distinguishable by shape/audio pitch, not by luck).
**RULE F7** Time-pressure never stacks with touch precision: slow-mo during aim is guaranteed.

## 4. Run structure
A run is 7 nodes per region on a branching map (2-3 paths, 3 lanes wide), ending in a boss. 7 regions at full scope, 3 regions for first release (Dust Creek, Canyon, Railroad).

### Node types
| Node | Frequency (per region) | What it does |
|---|---|---|
| Duel | 3-4 | One standard enemy. Reward: coins + 1 of 3 perks (or coins only, if skipped). |
| Elite | 0-1 (optional branch) | Harder enemy (Elite Bounty Hunter or region elite). Guaranteed rare perk + more coins. |
| Shop | 1 | Spend coins on 3 perks, 1 consumable, heal, reroll, remove a curse. |
| Event | 1 | Text-card encounter with 2-3 choices (gamble, fight, bargain). Seeded outcomes. |
| Rest | 1 | Saloon rest: heal 1 life OR upgrade one perk to a +1 tier OR drop a perk for coins. |
| Treasure | 0-1 | Free coins or a free perk, sometimes trapped (event-style choice). |
| Boss | 1 (final) | Boss duel, multi-phase. Reward: perk of choice among 3 rare, region unlock. |

Map rules: first node always a Duel; never two Shops adjacent; a Rest guaranteed within 2 nodes before the boss; Elite shown as skull marker so the player opts in knowingly.

### Currency: coins
- Only currency. Earned from duels (base + perfect/headshot/no-damage bonuses), elites, events, treasure, selling perks.
- Spent on: shop, retry, event bargains, rest upgrades.
- Persistent meta: **Bounty** (cross-run) pays coins out into a persistent *Saloon* account, which funds unlocks in the hub (new starting loadouts, new perk unlocks into the pool). Meta progress unlocks *options*, never raw power.

## 5. Perk philosophy
- **Target: 50+ perks at first full content, none that are pure stat bumps.** A perk must do at least one of: change a rule, create a new decision, add an interaction between systems, or change risk/reward.
- **Banned:** "+5% damage", "+10 max hp", "+1% crit". If a number matters it must come with a condition ("headshot on a Slow-tier enemy refunds the draw").
- Each perk has a tag set (DRAW, AIM, DODGE, COIN, LUCK, LIFE, CURSE) and synergies are designed in pairs and triples.
- Rarities: Common (small rule twist), Rare (build-defining), Legend (boss reward, run-defining), Cursed (power with a real cost).
- Offers: 3 choices, no duplicates, weighted to tags you already hold (30%) to encourage builds, always one off-tag wildcard. Reroll costs coins.
- Perks have 1 or 2 tiers (rest upgrade). Tier 2 adds a second effect, not a bigger number.

### Starter perk list (ids and one-liners, A08 to implement; A12 to name)
**DRAW (11)**
1. Hair Trigger: first shot of a duel fires on release even before aim budget ends.
2. Quickdraw Scar: Perfect Draw window doubles, but your aim budget is 25% shorter.
3. Ambidextrous: your draw can start from either screen half; left/right changes recoil direction (used by Dual Wielder).
4. Cold Open: Perfect Draws stagger the enemy for one beat.
5. Reflex Tonic: flinch penalty removed.
6. Steady Hands: flinching does not cost time, but the next draw has no crit.
7. Spit and Polish: Good-tier draws also count as Perfect once per duel.
8. Tell Reader: tells show a faint on-screen cue 80 ms earlier for the *first* duel of each region.
9. Bluff: a deliberate flinch makes the enemy shoot first and miss (risky feint).
10. Second Wind: after taking a hit, your next draw is automatically Perfect.
11. Showman: Perfect Draw streak of 3 grants a free life once.

**AIM (11)**
12. Steady Breath: slow-mo aim extends while standing still.
13. Dead Eye: head hits always stagger.
14. Ricochet: missed shot bounces once toward the nearest enemy (matters in multi-enemy duels).
15. Disarmer: gun-arm hits drop the enemy's gun; they must pick it up (costs them a beat).
16. Called Shot: tap a zone before aiming to lock its multiplier up and the others down.
17. Marksman Pact: one-shot kills heal nothing, but refund the aim budget.
18. Buckshot Rounds: wide cone, no headshots.
19. Long Barrel: Sniper-style: aim reticle can leave the hit zone and snap back.
20. Rapid Fire: bonus follow-up shot if the first lands in the body (you choose the second target).
21. Weak Spotter: weak points glow, but only for 400 ms.
22. Trick Shot: shooting an environment prop (lantern, barrel) triggers its effect on the enemy.

**DODGE (8)**
23. Counter Roll: successful dodge guarantees next shot is a crit.
24. Dust Kick: dodge leaves a cloud that blocks the next enemy shot.
25. Matador: dodge window doubles against Knife Thrower and Horse Rider only (specialist perk).
26. Slip Away: successful dodges grant coins.
27. Tumble: dodge can be performed while aiming, with a cost of your aim budget.
28. Bait: stand still on purpose to make the enemy fire early (breaks Coward fake tells).
29. Body Shield: dodge into a hostage/prop to take the hit with it (event-specific).
30. Phantom Step: dodge through an enemy's shot window after a miss.

**COIN (8)**
31. Bounty Hunter: coins from elites doubled, regular duels paid half.
32. Pawn Shop: sell a perk at any shop for coins, buy a different one cheaper.
33. Loaded Dice: reroll offers cost nothing the first time per node.
34. Tip Jar: bartender at rest sites gives a free item.
35. Interest: unspent coins at a boss pay +10%.
36. Gambler's Fallacy: every Shop item is 30% off, but one random item is a curse.
37. Slush Fund: retries cost half, but your reward from that duel is zero.
38. Pickpocket: no-damage wins take one coin from the enemy's belt per Perfect.

**LUCK / EVENT (7)**
39. Lucky Charm: once per region an event choice is shown with its outcome.
40. Black Cat: curses are visible in shop before you buy.
41. Horseshoe: rest nodes can be used twice.
42. Trader's Eye: shop shows an extra item.
43. Pathfinder: map shows node types two steps ahead.
44. Wanted Poster: choose which enemy type you fight at the next duel (limited).
45. Whiskey Luck: drink at events to reroll an outcome, at the cost of one aim budget.

**LIFE / SURVIVAL (6)**
46. Tin Star: first hit of each duel is ignored.
47. Bullet Belt: carry one extra life, but lose 1 coin per duel.
48. Revive Flask: once a run, ignore a lethal hit.
49. Iron Skin: hits from the Knife Thrower do no damage.
50. Healer's Touch: rest nodes heal fully, but you can't choose upgrade.
51. Last Stand: at 1 life, aim budget doubles.

**CURSE (6, power with price)**
52. Devil's Deal: perfect window triples, enemies get a fake tell in every duel.
53. Mad Dog's Collar: all your shots crit, you take double damage.
54. Blood Money: coins from kills doubled, shops charge 2x.
55. Hex: perks that boost one tag are doubled, all other tags are disabled.
56. Glass Cannon: one-hit kills on anything, hero has 1 life.
57. Widow's Wager: bet coins at the start of a duel; win to double, lose to lose them.

(57 total. A08 is free to cut weak ones but must stay above 50 and keep the no-stat-padding rule.)

## 6. Regions
| # | Region | Look | Gimmick | Elite | Boss |
|---|---|---|---|---|---|
| 1 | Dust Creek | Frontier town, dirt road, false-front buildings, water tower | Tutorial pacing; wind drifts bullets slightly on aim | Elite Bounty Hunter | Mad Dog McGraw |
| 2 | Canyon | Red cliffs, ledges, mine entrances | Enemies on ledges: aim has vertical component; echo delays enemy tell audio by 150 ms (visual still on time) | Sniper | The Undertaker |
| 3 | Railroad | Train and track, water towers, boxcars | Moving train: platform sway shifts aim; enemy moves between cars | Train Guard Captain | (Boss: The Undertaker's Conductor, optional) |
| 4 | Saloon Interior | Wood floors, chandeliers, poker tables | Cover: tables to dodge behind; bottles to shoot; patrons as hazards | Drunk Champion | Lady Luck |
| 5 | Goldspire | Boomtown, banks, mines, ostentatious | Coin-heavy: bigger rewards, bigger risks, shop-heavy map | Elite Bounty Hunter (gold) | (Mid-boss: Banker) |
| 6 | Widow's Peak | Cold mountain graveyard, fog, gallows | Fog hides enemy until the tell; sound-guided aim | Knife Thrower | El Diablo (phase 1) |
| 7 | Blackwater Bay | Docks, ships, lanterns at night | Night: low light, silhouettes, lantern shots; reflective water | Dual Wielder Captain | El Diablo (final) |

First release: regions 1-3. Regions 4-7 are staged content.

## 7. Enemy roster
HP = shots to kill at base body damage. "Tell" is the cue. "Counter" is the intended answer.

| Enemy | HP | Core mechanic | Tell | Counter / fairness note |
|---|---|---|---|---|
| Rookie | 1 | Tutorial. Draws slowly. | Hand twitch + spur chime | Perfect Draw is easy; teaches aim |
| Bandit | 2 | Standard duellist, small variance in WAIT | Hand to holster + glove snap | The baseline |
| Gunslinger | 2 | Fast draw, shoots after a half-beat feint | Eye flash + hat tip | Don't flinch on the first flash |
| Coward | 1 | Fake tells: twitches then backs off; real shot if you draw early on fake | Fake: shoulder shake. Real: whistle + hat rim | Hold until audio pitch rises; fake has a different silhouette |
| Drunk | 2 | Erratic timing, sway; shots miss randomly | Hiccup + bottle drop | Wait it out. Safe to flinch: weak enemy that taxes patience |
| Sheriff | 3 | Armour (badge) blocks body shots until disarmed or head-hit | Badge flash + whistle | Gun-arm or head hit required; encourages zone play |
| Dual Wielder | 2+2 | Two guns, two shots, two tells (left then right) | Left glint then right glint | Disarm one gun halves threat; dodge the second |
| Sniper | 2 | Fires from distance after a glint; long WAIT | Lens glint (audio ping) | Dodge the first, shoot after; or Perfect Draw |
| Knife Thrower | 2 | Thrown knife is slower but dodgeable; throws two on a failed dodge | Wrist flick + whoosh | Dodge window is mandatory; aim penalty if you ignore it |
| Train Guard | 3 | On moving train: platform sway; hides behind boxcar | Whistle blast + shoulder step | Time shots to sway peak; uses cover rhythm |
| Horse Rider | 2 | Circles the arena; target moves fast | Hoofbeat accelerates then rider rises in stirrups | Lead the shot; gun-arm hit stops the horse |
| Elite Bounty Hunter | 4 | Chooses between Gunslinger feint, Sniper glint, or Dual shot per duel; reads your last move | Varies, announced on wanted poster | Poster shows the tell (information fairness); no pure speed check |

### Scaling by depth (never only faster)
Depth adds: +1 hp tier, extra fake-tell chance, smaller hit zones, an extra phase, cover usage. Reaction windows are fixed at the F1 floor.

## 8. Bosses
Each boss has 3 phases, a unique tell language, introduces one new mechanic, and can be beaten by Perfect Draw *or* the mechanic, never by raw speed alone.

| Boss | Region | Phases | Mechanic |
|---|---|---|---|
| Mad Dog McGraw | Dust Creek | 1. Straight duel, 3 hp. 2. Rage: fires twice, second shot is delayed (bait). 3. Charges: closes distance, lowers aim budget; disarm him to win. | Teaches phases and disarm. Tell: dog growl + eye flash. |
| The Undertaker | Canyon | 1. Long coffin cover; shoots from behind. 2. Opens coffin, reveals dynamite; shoot the dynamite for a big hit. 3. Summons rookies as adds (kill the weakest first). | Cover plus trick shot. Tell: bell toll counts down. |
| Lady Luck | Saloon | 1. Card game: pick one of three cards, each card = a different duel rule. 2. Dice: random rule for one beat, visible before it starts. 3. Roulette: bet on a zone, shoot that zone to cheat the wheel. | Information and decision. Luck is shown, never hidden. Tell: card flick. |
| El Diablo | Blackwater Bay | 1. Silhouette in fog. 2. Mirror image; one is real (watch the tell shape). 3. Final: all previous tells appear in sequence, you must read each one correctly. | Exam boss of everything you learned. Tell: matches phase. |

## 9. Meta loop
- Start: pick a **loadout** (Gunslinger kit = starting perk + sidearm + hat; unlock more through Bounty).
- During run: collect coins and perks.
- On death or victory: **Results** with reaction stats; coins banked into the saloon account; Bounty Board missions progress.
- Between runs: Saloon hub (spend banked coins on unlocks), Bounty Board (daily/weekly missions), Mode select (Run, Daily Duel, Practice).
- Practice and Daily Duel use fixed seeds (D4).

## 10. Modes
| Mode | Description |
|---|---|
| Run | Full roguelite |
| Daily Duel | Seeded run, one attempt, local leaderboard (service interface only, D7) |
| Practice | Pick enemy and tell, infinite retries, no rewards; also the onboarding sandbox |

## 11. Open questions for A18 / A01
1. Starting lives: 2 today (D14, was 3). Playtest whether 2 or 3 feels right; the constants stay in `duelConfig.ts`.
2. Retry-once-per-node cost curve.
3. Whether 7 regions needs a 2nd boss per region at launch (no).
