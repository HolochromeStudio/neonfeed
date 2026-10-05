# UX Flow

Owner: A10 (Mobile UX/UI). Reviewer: A01. Companion: GAME_DESIGN.md.
Logical canvas **360x640**, portrait, integer-scaled, letterboxed (D2). All coordinates below are logical px. Wireframes are drawn at **1 char = 8 px wide, 1 row = 16 px tall** (45 cols x 40 rows = 360x640).

## 1. Visual language: western pixel-art UI
Everything on screen is a physical object in the Old West: nailed, printed, painted, scratched.

| Element | Use |
|---|---|
| Wood planks | Panel backgrounds, buttons, menu frame. Visible nail heads at corners. 2-3 plank shades, no gradients. |
| Parchment | Reward cards, event text, wanted posters, results. Torn/burnt edges drawn as pixel steps. |
| Brass | Borders, rivets, coin icons, selected state, key numbers. |
| Wanted posters | Enemy intro, bounty board entries, boss cards, run-end "poster" of your hero. |
| Chalkboard / slate | Shop price lists, saloon menus. |
| Ink and stamp | Result words ("PERFECT", "DEAD", "SOLD") as rubber-stamp text, slightly rotated 2-4 degrees. |

Rules:
- Pixel font only (bitmap, integer sizes: 8, 16, 24, 32 px). No anti-aliased vector fonts. Pixel-snap all UI positions to integers.
- Palette is limited: dusty browns, parchment cream, brass gold, blood red, midnight blue accents. Max ~24 colours for UI (shares game palette).
- Buttons are plank signs: default plank, pressed = plank shifted 2 px down with shadow removed, disabled = faded + padlock/chain.
- **Explicitly NO**: glassmorphism, blur, frosted panels, rounded white cards, drop-shadow soft blurs, SaaS gradients, thin sans-serif UI text, pill buttons, flat material-design FABs, toggle switches in iOS style.
- Corners are square or notched (stepped pixel corners), never smooth radii.
- Transitions: cut, shutter wipe, tumbleweed pass, door swing. No fades longer than 150 ms, no slide-ease springs.

## 2. Layout system

### Zones (portrait 360x640)
```
y=0   +--------------------------------+
      | SAFE TOP INSET (24)  status    |
y=24  |--------------------------------|
      | TOP BAND  (24..96)             |  hud info, titles. Read only.
y=96  |--------------------------------|
      | STRETCH ZONE (96..288)         |  hard to reach: display only, no primary actions
y=288 |--------------------------------|
      | REACH ZONE (288..432)          |  secondary actions, scroll lists, card choices
y=432 |--------------------------------|
      | THUMB ZONE (432..616)          |  primary actions, aim/draw input, main buttons
y=616 |--------------------------------|
      | SAFE BOTTOM INSET (24)         |  home indicator, nothing tappable
y=640 +--------------------------------+
```
Right-handed bias default; **Left-hand mode** setting mirrors the thumb zone horizontally (swaps side-anchored buttons only; centre content unchanged).

### Thumb-zone map
| Zone | y range | Allowed |
|---|---|---|
| Easy | 432-616 | Primary buttons (Duel, Buy, Choose, Retry), draw/aim/dodge input |
| Reach | 288-432 | Secondary buttons (Back, Reroll), cards, lists |
| Stretch | 96-288 | Info only, large non-critical taps (pause allowed top-right at 44x44) |
| Dead | 0-24, 616-640 | Notches/home bar: no UI |

### Safe-area rules
1. Never place interactive UI within 24 px of top/bottom or 12 px of left/right of the 360x640 canvas (after letterboxing, use Phaser scale + `env(safe-area-inset-*)` mapped via Capacitor, whichever is larger).
2. Backgrounds extend full-bleed; UI stays inside safe area.
3. Never rely on edge swipes (system back / home gesture). Back is always an on-screen plank button.
4. Letterbox bars are painted with a wood-plank texture so non-9:16 devices still look intentional.
5. Pause lives top-right 44x44, but the duel never requires reaching it; a 2-finger long press also pauses (accessibility).

### Touch targets
- **Minimum 44x44 logical px** for every interactive element; recommended 56x56 for primary actions. Min 8 px gap between targets.
- Visual art may be smaller than hit area: the hit rect is extended invisibly.
- Hold targets (WAIT holster zone) are 160x120 minimum.
- Text buttons: min height 48, min width 96.
- Drag thresholds: 10 px dead zone before a swipe begins; tap if travel < 10 px and < 300 ms.
- Debounce: buttons trigger on pointer-up inside target, cancel if pointer leaves. Purchase buttons require a confirm tap (hold 400 ms or second tap) for anything over 50 coins.

## 3. Accessibility
| Feature | Behaviour |
|---|---|
| **Reduced shake** | Setting "Screen shake": Full / Reduced (25%) / Off. Hit-stop and flash remain, shake and zoom punch removed. Honours OS reduce-motion on first launch. |
| **Haptic toggle** | Haptics: On / Light / Off. Duel never *requires* haptics: tell has visual and audio always (RULE F2). |
| **Colour-blind-safe tells** | Tells never rely on colour alone. Each tell has a distinct *shape* (exclamation mark, ring, crosshair) + *sound* + position. Palette tested for deuteranopia/protanopia/tritanopia: red/green pairs not used for states. Fake vs real tell: different icon shapes. Optional high-contrast outline on enemy during tell. |
| Text size | Normal / Large (min body 16 px, large 24 px). |
| Audio | Master / SFX / Music / Voice sliders (planks with a sliding brass knob). Captions toggle for audio cues ("*bell*"). |
| One-hand | Left-hand mode; every flow reachable with one thumb. |
| Timing assist | "Tell assist": slow-mo aim window x1.5 and wider dodge window. Flagged in results, no achievements blocked. |
| Motion | Reduce motion removes parallax, tumbleweed, screen wipes (cut instead). |
| Contrast | Text vs bg >= 4.5:1; large text >= 3:1; verified against parchment and plank palette. |
| Input | No multi-finger gestures required. |

## 4. Screen flow
```
Boot -> Main Menu -+-> Mode Select -> Loadout -> Run Map -+-> Duel -> Reward -> Run Map
        |          |                                      +-> Elite (Duel) -> Reward
        |          |                                      +-> Shop -> Run Map
        |          |                                      +-> Event -> Run Map
        |          |                                      +-> Rest -> Run Map
        |          |                                      +-> Treasure -> Run Map
        |          |                                      +-> Boss -> Reward -> Next Region Map
        |          |                                      +-> (death) -> Results
        |          +-> Saloon Hub -> Bounty Board
        |          +-> Settings
        +-> Onboarding (first launch only, ends in Practice duel)
Results -> Main Menu | Loadout (new run) | Saloon Hub
```
Pause overlay (from Duel and Map): Resume / Settings / Abandon Run.

Screens are numbered below with wireframe, primary action, thumb-zone note.

### 4.1 Boot
Static logo on wood; progress bar as a rope/gun-belt that fills with bullets. Loads atlas, save, audio. < 3 s target. If save is corrupt, offer "Restore backup".
```
+----------------------------------------------+ 0
|                                              |
|                                              |
|                                              |
|              .  ~ LOGO ~  .                 |
|            NEON FEED (working title)          |
|        a pixel gunfight game                  |
|                                              |
|                                              |
|                                              |
|                                              |
|                                              |
|       [ o o o o o o . . . . . ]              |  bullet-belt loader
|           Loading...  62%                    |
|                                              |
+----------------------------------------------+ 640
```

### 4.2 Main Menu (MainMenuScene)
Town backdrop (Dust Creek street) with idle hero. Planks stacked as signs in the thumb zone.
```
+----------------------------------------------+ 0
|////////////// safe top 24 ////////////////////|
|  [coin 1,240]                    [gear]     |  coins top-left, settings 44x44 top-right
|                                              |
|            *** DUST & DRAW ***               |  title plank
|                                              |
|       (scene: street, hero idle, wind)       |
|            wanted poster flutters           |
|                                              |
|                                              |
|                                              |
|    +--------------------------------+        |  y~420
|    |        >>  DUEL  <<            |        |  primary plank 280x56
|    +--------------------------------+        |
|    +----------------+ +-------------+        |
|    |     SALOON     | |   BOUNTIES  |        |  secondary 136x48
|    +----------------+ +-------------+        |
|    +----------------+ +-------------+        |
|    |    PRACTICE    | |   SETTINGS  |        |
|    +----------------+ +-------------+        |
|//////////////// safe bottom 24 ///////////////|
+----------------------------------------------+ 640
```
Primary: DUEL goes to Mode Select. If a run is in progress, the primary becomes CONTINUE RUN and DUEL becomes NEW RUN (confirm abandon).

### 4.3 Mode Select
Three posters nailed to a board; swipe horizontally or tap.
```
+----------------------------------------------+
|  [<back]            SELECT MODE              |
|                                              |
|      +--------+  +--------+  +--------+      |
|      | RUN    |  | DAILY  |  |PRACTICE|      |
|      |  [o]   |  | [cal]  |  | [tgt]  |      |  poster cards 96x184
|      | Full   |  | 1 try  |  | No     |      |
|      | roguel.|  | seeded |  | reward |      |
|      +--------+  +--------+  +--------+      |
|                                              |
|   best: Dust Creek cleared  | streak 3       |
|                                              |
|    +--------------------------------+        |
|    |             START              |        |
|    +--------------------------------+        |
+----------------------------------------------+
```

### 4.4 Loadout
Choose hero kit (sidearm + hat + starting perk), view locked ones with bounty cost.
```
+----------------------------------------------+
|  [<back]           LOADOUT                   |
|                                              |
|        +------------------------+            |
|        |   hero portrait 96x96  |            |
|        +------------------------+            |
|          THE DRIFTER                         |
|     Perk: Hair Trigger (draw)                |
|                                              |
|   < [Colt] [Peacemaker] [Derringer] >        |  gun swipe/choose
|                                              |
|   Lives: 3   Coins: 20                       |
|   Challenge: [ ] Iron Man  [ ] No Dodge      |
|                                              |
|    +--------------------------------+        |
|    |        RIDE OUT (start)        |        |
|    +--------------------------------+        |
+----------------------------------------------+
```

### 4.5 Run Map
Vertical scroll: start at the bottom, boss at the top. Parchment map with ink nodes. Player is a bottom-anchored piece; scroll with vertical drag. Node tap = select, big **GO** plank confirms.
```
+----------------------------------------------+
|  [<]   DUST CREEK 3/7        <3<3<3  $120    |  top band
|                                              |
|                   (BOSS: MCGRAW)             |
|                       |                      |
|             (REST)---+---(ELITE skull)       |
|               |             |                |
|            (SHOP)--------(DUEL)              |
|               \           /                  |
|                \(EVENT)--/                   |
|                  |                           |
|               (DUEL)  <- you are here        |
|                  |                           |
|               (START)                        |
|                                              |
|   [Perks 4]                    [Pause]      |  reach zone
|    +--------------------------------+        |
|    |    GO: DUEL - the Bandit       |        |  primary plank
|    +--------------------------------+        |
+----------------------------------------------+
```
Node icons: duel = crossed pistols, elite = skull, shop = coin sack, event = "?", rest = bed/hat, treasure = chest, boss = star badge. Shape is unique per type (colour-blind safe). Perks button opens a parchment list (name + one-line text).

### 4.6 Duel HUD (HUD class, over DuelScene)
Combat uses almost the whole screen. HUD is minimal, non-interactive except pause.
```
+----------------------------------------------+ 0
|//////////////////////////////////////////////|
| <3<3<3                 [II] pause (44x44)    |  y=24..68
| Dust Creek - Bandit        $12               |
|                                              |
|              ENEMY (top 40% of screen)       |
|              [hp pips o o]                   |
|                                              |
|                  !  (tell icon)              |  tell shape appears centre
|                                              |
|                                              |
|       (arena floor, hero silhouette)         |
|                                              |
| ~~~~~~~~~~~~~ AIM / DODGE ZONE ~~~~~~~~~~~~  |  y=288..520: swipe anywhere
|                                              |
|                                              |
|     +----------------------------------+     |
|     |   HOLD HERE (holster zone)       |     |  y=520..616, 280x96: WAIT hold, DRAW flick
|     +----------------------------------+     |
|///////////////////////////////////////////// |
+----------------------------------------------+ 640
```
Phase UI:
| Phase | HUD change |
|---|---|
| WAIT | Holster zone glows brass pulse. Text "HOLD". Lives, enemy name. |
| DRAW | Tell icon appears big at centre (shape + sound). Zone shows "DRAW!" stamp. |
| SWIPE | World slow-mo, reticle follows thumb offset above the thumb (so the finger doesn't cover it: reticle sits 48 px above touch point). Aim budget as a shrinking brass arc around reticle. |
| BANG | Reaction readout: `YOU 214 ms` big, `ENEMY 380 ms`, tier stamp (PERFECT/GOOD/OK/SLOW). Timeline bar. |
| Dodge prompt | Second tell icon (muzzle raise) plus arrows left/right; horizontal swipe in lower half. |
| End | Win: coin pop, tap anywhere to continue (reach zone). Loss: cause line + RETRY plank (easy zone) + END RUN. |

Rules: no taps required in the top half during combat. Reticle offset prevents finger occlusion. HUD text >= 16 px.

### 4.7 Reward choice (RewardScene)
Three parchment cards, one primary pick (tap = select, second tap or GO = confirm). Skip for coins as plank.
```
+----------------------------------------------+
|             CHOOSE A PERK                    |
|   +----------+ +----------+ +----------+     |
|   | [icon]   | | [icon]   | | [icon]   |     |
|   | HAIR     | | DUST     | | TIN      |     |
|   | TRIGGER  | | KICK     | | STAR     |     |
|   | [DRAW]   | | [DODGE]  | | [LIFE]   |     |  tag badge shape+text
|   | First    | | Dodge    | | First hit|     |
|   | shot...  | | blocks...| | ignored  |     |
|   | COMMON   | |  RARE    | | COMMON   |     |
|   +----------+ +----------+ +----------+     |
|        card 104x220 each, 8 gap             |
|                                              |
|   [REROLL $15]              [SKIP +$20]      |  44+ high
|   +--------------------------------+         |
|   |         TAKE THIS PERK         |         |
|   +--------------------------------+         |
+----------------------------------------------+
```
Variants: coin reward panel (tally), boss reward (3 Legend cards with gold border), event reward.

### 4.8 Shop (ShopScene)
Wooden counter, shopkeeper at top, slate price list. Items as hanging tags.
```
+----------------------------------------------+
|  [<leave]    GENERAL STORE       $ 120       |
|        (shopkeeper sprite)                   |
|   +------------+ +------------+ +--------+   |
|   |  PERK 1    | |  PERK 2    | | ITEM   |   |
|   |  [icon]    | |  [icon]    | |[bandage|   |
|   |  name      | |  name      | | heal 1]|   |
|   |  $45       | |  $60       | |  $30   |   |
|   +------------+ +------------+ +--------+   |
|   +------------+ +------------+              |
|   | REROLL $15 | | REMOVE CURSE $40 |        |
|   +------------+ +------------+              |
|    Tap item for details                      |
|   +--------------------------------+         |
|   |             BUY (selected)     |         |
|   +--------------------------------+         |
+----------------------------------------------+
```
Unaffordable: price in red + chain overlay (also a lock icon, not colour only). SOLD stamp on purchase. Leave returns to Map.

### 4.9 Event (EventScene, subset of RewardScene styles)
Parchment letter + 2-3 choice planks, each choice stating cost/reward; seeded outcome shown on the next screen with the result stamp.
```
+----------------------------------------------+
|            A STRANGER APPROACHES             |
|     +--------------------------------+       |
|     | (pixel illustration)           |       |
|     | "Care for a game of cards?"    |       |
|     +--------------------------------+       |
|   +--------------------------------+         |
|   | Play (bet 30 coins)            |         |
|   +--------------------------------+         |
|   +--------------------------------+         |
|   | Decline                        |         |
|   +--------------------------------+         |
+----------------------------------------------+
```

### 4.10 Saloon hub
Persistent meta space between runs. Interior art from the town sheet. Interactable props, each a 56+ target: bartender (unlocks), piano (audio test and credits), notice board (to Bounty Board), door (to Main Menu), poker table (daily).
```
+----------------------------------------------+
|  [<]        THE SALOON        bank $ 1,240   |
|  +---------------+ +-----------------------+ |
|  | chandelier    | | window / sign         | |
|  +---------------+ +-----------------------+ |
|     (bartender)      [bounty board nailed]   |
|   +-------------------------------------+    |
|   |       bar counter                   |    |
|   +-------------------------------------+    |
|   (piano)        (poker table)               |
|        UNLOCKS:                              |
|   +-------+ +-------+ +-------+              |
|   |new    | |new    | |new    |              |  swipe row, planks
|   |gun $  | |hat $  | |perk $ |              |
|   +-------+ +-------+ +-------+              |
|    +--------------------------------+        |
|    |         BACK TO TOWN           |        |
|    +--------------------------------+        |
+----------------------------------------------+
```

### 4.11 Bounty Board
Wanted posters pinned in a grid, 2 columns, vertical scroll. Each poster: enemy art, task ("Win 3 duels with Perfect Draw"), reward in coins, progress pips. Claim = stamp "PAID".
```
+----------------------------------------------+
|  [<back]       BOUNTY BOARD                  |
|  [Daily] [Weekly] [Career]  (tabs, planks)   |
|   +------------+  +------------+             |
|   | WANTED     |  | WANTED     |             |
|   | (portrait) |  | (portrait) |             |
|   | Perfect x3 |  | No-hit win |             |
|   | $50  [2/3] |  | $80  [0/1] |             |
|   +------------+  +------------+             |
|   +------------+  +------------+             |
|   | ...        |  | ...        |             |
|   +------------+  +------------+             |
|   [CLAIM ALL $130]                           |
+----------------------------------------------+
```

### 4.12 Results / Death (ResultsScene)
Hero "WANTED" poster: DEAD OR ALIVE. Reaction stats. Cause of death line (F4). Run summary, perks held, coins banked.
```
+----------------------------------------------+
|        +------------------------------+      |
|        |  W A N T E D                 |      |
|        |  (hero portrait)             |      |
|        |  DEAD  [stamped]             |      |
|        |  Killed by: Sheriff          |      |
|        |  "Shot while aiming"         |      |
|        +------------------------------+      |
|   Duels won 6  Best reaction 187 ms          |
|   Perfect draws 4   Region: Canyon           |
|   Perks: [i][i][i][i][i]  (tap for details)  |
|   Coins banked  +184                         |
|   Bounties progress: Perfect x3  2/3         |
|   +--------------------------------+         |
|   |          RIDE AGAIN            |         |
|   +--------------------------------+         |
|   [SALOON]            [MAIN MENU]            |
+----------------------------------------------+
```
Victory variant: "SHERIFF OF GOLDSPIRE" poster, coin bonus.

### 4.13 Settings
Wood sign list. Opened from menu or pause. Two-column plank rows (label left, value right), with a sub-screen per category.
```
+----------------------------------------------+
|  [<back]            SETTINGS                 |
|  [Audio] [Controls] [Access] [Account]       |
|  Master      [|=====o--]  80                 |
|  Music       [|===o----]  50                 |
|  SFX         [|======o--]  90                 |
|  Screen shake   [ Full | Reduced | Off ]     |
|  Haptics        [ On | Light | Off ]         |
|  Left-hand mode [ ] OFF                      |
|  Text size      [ Normal | Large ]           |
|  Captions       [ ] OFF                      |
|  Tell assist    [ ] OFF                      |
|  Reduce motion  [ ] OFF                      |
|  [Reset tutorial] [Restore save] [Credits]   |
+----------------------------------------------+
```
Toggles are brass lever switches (not iOS style). Segmented choices are 3 adjacent planks. All rows >= 48 px tall.

### 4.14 Onboarding
First launch only. 3 steps, 90 seconds, never blocking skip after step 1. Ends in Practice vs Rookie.
```
STEP 1 HOLD          STEP 2 DRAW          STEP 3 AIM + BANG
+--------------+     +--------------+     +--------------+
| Hold your    |     | When you see |     | Drag to aim, |
| thumb here   |     |  !  DRAW!    |     | let go to    |
|              |     |              |     | shoot        |
|   [HOLD]     |     |  [flick up]  |     |  (reticle)   |
|  [Skip ->]   |     |  [Skip ->]   |     |  [Skip ->]   |
+--------------+     +--------------+     +--------------+
```
Rules: Skip button stays reachable (reach zone). One prompt per screen. Hero cannot die during onboarding. Teach dodge in the first Canyon run, perfect draw reward after first win, and reaction display in the first BANG (coach mark parchment note, dismissible, shown once each, resettable in Settings).

## 5. Scene and class list (for UI code, A10 / A02 / A08 / A09)
Scenes extend `Phaser.Scene` and live in `src/scenes/`. UI components in `src/ui/`. Scene keys are string constants in `src/core/sceneKeys.ts`.

| Class | Key | File | Purpose |
|---|---|---|---|
| BootScene | `Boot` | scenes/BootScene.ts | Load atlas, save, audio; bullet-belt loader |
| MainMenuScene | `MainMenu` | scenes/MainMenuScene.ts | 4.2 |
| ModeSelectScene | `ModeSelect` | scenes/ModeSelectScene.ts | 4.3 |
| LoadoutScene | `Loadout` | scenes/LoadoutScene.ts | 4.4 |
| RunMapScene | `RunMap` | scenes/RunMapScene.ts | 4.5, reads RunSystem state |
| DuelScene | `Duel` | scenes/DuelScene.ts (A02) | Combat; launches HUD in parallel |
| HUD | `HUD` | ui/HUD.ts (Scene run in parallel) | 4.6; subscribes to duel events via EventBus, no logic |
| RewardScene | `Reward` | scenes/RewardScene.ts | 4.7 (perk / coin / boss reward modes) |
| ShopScene | `Shop` | scenes/ShopScene.ts | 4.8 |
| EventScene | `Event` | scenes/EventScene.ts | 4.9 |
| RestScene | `Rest` | scenes/RestScene.ts | Heal / upgrade / sell perk |
| SaloonScene | `Saloon` | scenes/SaloonScene.ts | 4.10 |
| BountyBoardScene | `BountyBoard` | scenes/BountyBoardScene.ts | 4.11 |
| ResultsScene | `Results` | scenes/ResultsScene.ts | 4.12 |
| SettingsScene | `Settings` | scenes/SettingsScene.ts | 4.13, also overlay from Pause |
| OnboardingScene | `Onboarding` | scenes/OnboardingScene.ts | 4.14 |
| PauseOverlay | `Pause` | ui/PauseOverlay.ts | Resume / Settings / Abandon |

### Shared UI components (`src/ui/`)
| Component | Notes |
|---|---|
| `PlankButton` | Primary / secondary / disabled; min 44 px hit area; press-down 2 px; haptic tick; sound |
| `ParchmentPanel` | 9-slice with stepped pixel edges; title bar |
| `WantedPoster` | Portrait + title + lines; used for enemies, bounties, results |
| `PerkCard` | 104x220; tag badge; rarity border; used in Reward, Shop, Perks list |
| `CoinCounter` | Brass coin icon + pixel digits, tween on change (integer steps) |
| `LivesBar` | Brass hearts or bullets, 16 px each |
| `StampText` | Rotated 2-4 degrees stamp; "PERFECT", "SOLD", "DEAD", "PAID" |
| `ReactionReadout` | Ms numbers and tier, timeline bar (shape/word, not colour only) |
| `NodeIcon` | Run-map node, shapes per type |
| `LeverToggle`, `PlankSegmented`, `PlankSlider` | Settings controls |
| `SafeArea` | Utility: returns insets in logical px, used by all scenes |
| `ThumbZones` | Constants: EASY/REACH/STRETCH y ranges |
| `Tooltip` | Hold on item opens a parchment note; second tap closes |
| `UiTheme` (data) | Colours, fonts, spacing, `MIN_TARGET = 44`; single source of truth |

Contract with game logic: UI scenes read from `RunSystem`, `PerkSystem`, `EconomySystem`, `BountySystem`, `SaveManager`, `SettingsStore` via typed accessors and send intents (`chooseReward`, `buy`, `reroll`, `startRun`) only. No game rules in UI code (D7 spirit). All user-visible strings live in `src/data/strings.ts` for later localisation. Settings read through `SettingsStore` with keys: `shake`, `haptics`, `leftHand`, `textSize`, `captions`, `tellAssist`, `reduceMotion`, `master`, `music`, `sfx`.

### Test checklist for UI (A17)
- Every interactive object reports a hit area >= 44x44.
- No interactive object inside safe insets.
- Left-hand mode mirrors the side anchored buttons.
- Settings persist and apply at runtime.
- Screens render at 360x640, 390x844 (letterboxed), 412x915, and 768x1024 without clipping.

## 6. Handoff

TASK COMPLETE
- **Files changed:** docs/GAME_DESIGN.md (created), docs/UX_FLOW.md (created). No source code touched, nothing committed.
- **Systems affected:** Design docs only. Defines the contracts for DuelSystem (phases, perfect-draw tiers, flinch, dodge), EnemyAI (tells, fairness rules), RunSystem (nodes), PerkSystem (57 perk concepts), EconomySystem (single coin currency), and UI scenes.
- **Dependencies:** Scene class list assumes SaveManager, SettingsStore, EventBus, RunSystem, PerkSystem, EconomySystem, BountySystem exist or will be provided by A14/A08/A09; font and UI art not yet supplied (UI uses placeholder pixel font and procedurally drawn planks until assets exist, per D5/MISSING_ASSETS.md).
- **Tests performed:** None (docs only). Layout checked by hand: every wireframe fits 45 cols x 40 rows (360x640) and primary actions sit in y 432-616.
- **Known issues:**
  - Fairness floor (450 ms tell-to-lethal) and tier thresholds (220/350/550 ms) are first guesses; A18 must tune.
  - The perk list needs A08 review for balance and duplicate effects; some perks (Bluff, Wanted Poster, Trick Shot) require system support that does not exist yet.
  - Regions 3-7 boss names beyond the four given bosses are placeholders (Conductor, Banker).
  - No hero, character-sheet or UI art is on disk (blocker B1); UI will use placeholders.
  - Title "DUST & DRAW" in wireframe is a placeholder name.
  - Wireframe widths are approximate; exact pixel spec comes in code.
- **Needs review from:** A01 (Lead), A02 (draw/dodge/flinch/aim mechanics), A06 and A07 (enemy/boss feasibility), A08 and A09 (run structure, perks, economy), A18 (numbers), A12 (names and tone).
- **Recommended next task:** A10 implements `UiTheme`, `SafeArea`, `PlankButton`, `ParchmentPanel`, `MainMenuScene` and `HUD` shell with placeholder art; then A08 turns the perk list into `data/perks.ts` and A02 validates the draw/dodge spec against DuelSystem.
