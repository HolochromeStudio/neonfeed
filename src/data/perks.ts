/**
 * Perk catalogue + modifier contract (A08). Pure data, no Phaser, no randomness.
 *
 * Contract for other systems:
 *  - `DuelModifiers` and `RunRules` are plain JSON-able data produced by PerkSystem.composePerks().
 *  - Neutral values (the `neutral*()` factories) mean "no perk". Consumers must treat unknown/extra fields as neutral.
 *  - Composition: numeric field ending in `Mult` multiplies, other numbers add, booleans OR,
 *    `heroHpOverride` takes the minimum non-null. Perks never read or write DuelSystem state.
 * GAME_DESIGN section 5: no stat-padding; every perk changes a rule, a decision, an interaction or a risk.
 */

export type PerkTag = 'DRAW' | 'AIM' | 'DODGE' | 'COIN' | 'LUCK' | 'LIFE' | 'CURSE';
export const PERK_TAGS: readonly PerkTag[] = ['DRAW', 'AIM', 'DODGE', 'COIN', 'LUCK', 'LIFE', 'CURSE'];

export type Rarity = 'common' | 'rare' | 'legend' | 'cursed';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'legend', 'cursed'];

/**
 * Who owns the engine work for the perk (design history; `support` is the runtime truth).
 *  today = reachable with DuelConfig fields, DuelParams.heroHp, or RunSystem itself.
 *  a02   = needs DuelSystem / InputSystem / DamageSystem support.
 *  a06   = needs EnemyAISystem support (fake tells, feints, enemy beats).
 */
export type PerkOwner = 'today' | 'a02' | 'a06';

/**
 * D16: does the engine consume this perk's modifier keys today?
 *  ready   = every key in duel/duel2/run/run2 (except those listed in `unwired`) is read by code in src/.
 *            tests/perk.test.ts fails when a `ready` perk names a key nothing consumes.
 *  pending = at least one core key has no consumer; the perk is NOT offered (rollPerkChoices) unless `includePending`.
 * Flip `pending` -> `ready` in the same change that lands the hook.
 */
export type PerkSupport = 'ready' | 'pending';

/** Everything the duel layer reads. Neutral values leave the duel unchanged. */
export interface DuelModifiers {
  // --- draw ---
  /** Multiplies DUEL_CONFIG.draw.perfectMs. */
  perfectWindowMult: number;
  /** Multiplies DUEL_CONFIG.draw.flinchPenaltyMs (0 = no penalty). */
  flinchPenaltyMult: number;
  /** Flinch costs no time at all (steady hands). */
  flinchNoTimeCost: boolean;
  /** After a flinch the next draw cannot crit. */
  flinchDisablesCrit: boolean;
  /** This many Good-tier draws per duel count as Perfect. */
  goodAsPerfectPerDuel: number;
  /** Perfect draw staggers the enemy for one beat. */
  perfectStaggers: boolean;
  /** Draw may start from either screen half. */
  drawFromEitherSide: boolean;
  /** Extra ms of advance on-screen cue before the lethal shot. Never reduces the F1 floor (visual only). */
  tellCueLeadMs: number;
  /** Deliberate flinch makes the enemy fire first and miss. */
  bluffFeint: boolean;
  /** After the hero is hit the next draw is auto-Perfect. */
  afterHitAutoPerfect: boolean;
  /** Perfect-draw streak length that grants one free life (0 = off). */
  perfectStreakLifeAt: number;
  /** Quickdraw Scar tier 2: the aim penalty does not apply after a Perfect draw. */
  aimPenaltyIgnoredOnPerfect: boolean;
  /** Fake tell in every duel (devil's deal). */
  fakeTellEveryDuel: boolean;
  // --- aim ---
  /** Multiplies DUEL_CONFIG.aim.budgetMs. */
  aimBudgetMult: number;
  /** Applied on top of aimBudgetMult while hero has exactly 1 hp. */
  lastStandBudgetMult: number;
  /** Aim budget extends while the reticle is still. */
  aimBudgetStillBonus: boolean;
  /** The first shot fires on release even if the budget is not spent. */
  fireOnRelease: boolean;
  headStagger: boolean;
  ricochet: boolean;
  /** Added to DUEL_CONFIG.fairness.maxDisarms. */
  maxDisarmsDelta: number;
  /** A disarmed enemy must spend a beat picking the gun up. */
  disarmDropsGun: boolean;
  calledShot: boolean;
  /** A one-shot kill refunds the aim budget (for the next duel segment / follow-up). */
  oneShotRefundsBudget: boolean;
  buckshot: boolean;
  /** Reticle may leave the hit zone and snap back. */
  reticleSnapBack: boolean;
  /** Body hit grants a follow-up shot with a chosen target. */
  rapidFollowUp: boolean;
  /** Weak points glow for this many ms (0 = not shown). */
  weakPointGlowMs: number;
  /** Shooting a prop triggers its effect on the enemy. */
  propShotsHitEnemy: boolean;
  /** Every shot crits. */
  alwaysCrit: boolean;
  /** Multiplies DUEL_CONFIG.damage.critMultiplier (Mad Dog's Collar: crits are lethal, not decorative). */
  critDamageMult: number;
  /** One hit kills any enemy (config: baseDamage 99). */
  oneHitKill: boolean;
  // --- dodge ---
  /** Multiplies the enemy dodge window. */
  dodgeWindowMult: number;
  dodgeGuaranteesCrit: boolean;
  dodgeCloudBlocksShot: boolean;
  dodgeWhileAiming: boolean;
  /** Fraction of the aim budget a tumble costs. */
  tumbleBudgetCost: number;
  /** Standing still makes the enemy fire early. */
  baitEnabled: boolean;
  phantomStep: boolean;
  // --- life ---
  /** Added to DUEL_CONFIG.damage.heroHp. */
  heroHpDelta: number;
  /** Hard hp cap (min of all overrides); null = none. */
  heroHpOverride: number | null;
  /** First N hits of each duel are ignored. */
  ignoreFirstHits: number;
  /** Lethal hits ignored (once per run, consumed by RunSystem). */
  reviveCharges: number;
  /** Multiplies damage the hero takes (config.damage.enemyDamage). */
  enemyDamageMult: number;
  // --- coins (read by RunSystem when paying the duel reward) ---
  coinMultDuel: number;
  coinMultElite: number;
  /** Boss pay multiplier (D-A18 #15: bosses no longer ride on `coinMultElite`). */
  coinMultBoss: number;
  coinPerDodge: number;
  pickpocketPerPerfect: number;
  coinLossPerDuel: number;
  wagerEnabled: boolean;
}

/** Node-level rules read by RunSystem (shop, rest, map, events). */
export interface RunRules {
  shopPriceMult: number;
  /** Fraction off every shop price (0.3 = 30%). */
  shopDiscount: number;
  shopExtraItems: number;
  /** One random shop item is a curse. */
  shopCurseSlot: boolean;
  curseVisible: boolean;
  rerollFreeFirstPerNode: boolean;
  pawnShop: boolean;
  retryCostMult: number;
  retryNoReward: boolean;
  /** Extra coin fraction paid on unspent coins when a boss falls. */
  bossInterestPct: number;
  restHealFull: boolean;
  restNoUpgrade: boolean;
  /** Extra rest uses per rest node. */
  restUsesDelta: number;
  restFreeItem: boolean;
  /** Extra map steps whose node type is revealed. */
  mapLookaheadDelta: number;
  posterCharges: number;
  eventPreviewPerRegion: number;
  whiskeyEventRerolls: number;
  /** Blocks hp loss from the first N events per run... per event: first N hp lost is negated. */
  eventHpLossBlock: number;
}

export const neutralDuelModifiers = (): DuelModifiers => ({
  perfectWindowMult: 1, flinchPenaltyMult: 1, flinchNoTimeCost: false, flinchDisablesCrit: false,
  goodAsPerfectPerDuel: 0, perfectStaggers: false, drawFromEitherSide: false, tellCueLeadMs: 0,
  bluffFeint: false, afterHitAutoPerfect: false, perfectStreakLifeAt: 0, aimPenaltyIgnoredOnPerfect: false,
  fakeTellEveryDuel: false,
  aimBudgetMult: 1, lastStandBudgetMult: 1, aimBudgetStillBonus: false, fireOnRelease: false, headStagger: false,
  ricochet: false, maxDisarmsDelta: 0, disarmDropsGun: false, calledShot: false, oneShotRefundsBudget: false,
  buckshot: false, reticleSnapBack: false, rapidFollowUp: false, weakPointGlowMs: 0, propShotsHitEnemy: false,
  alwaysCrit: false, critDamageMult: 1, oneHitKill: false,
  dodgeWindowMult: 1, dodgeGuaranteesCrit: false, dodgeCloudBlocksShot: false, dodgeWhileAiming: false,
  tumbleBudgetCost: 0, baitEnabled: false, phantomStep: false,
  heroHpDelta: 0, heroHpOverride: null, ignoreFirstHits: 0, reviveCharges: 0, enemyDamageMult: 1,
  coinMultDuel: 1, coinMultElite: 1, coinMultBoss: 1, coinPerDodge: 0, pickpocketPerPerfect: 0, coinLossPerDuel: 0, wagerEnabled: false,
});

export const neutralRunRules = (): RunRules => ({
  shopPriceMult: 1, shopDiscount: 0, shopExtraItems: 0, shopCurseSlot: false, curseVisible: false,
  rerollFreeFirstPerNode: false, pawnShop: false, retryCostMult: 1, retryNoReward: false, bossInterestPct: 0,
  restHealFull: false, restNoUpgrade: false, restUsesDelta: 0, restFreeItem: false, mapLookaheadDelta: 0,
  posterCharges: 0, eventPreviewPerRegion: 0, whiskeyEventRerolls: 0, eventHpLossBlock: 0,
});

/** Context a perk's `when` condition can see. Everything optional so global composition works. */
export interface ComposeCtx {
  enemyId?: string;
  elite?: boolean;
  boss?: boolean;
  /** First standard duel of the current region. */
  firstDuelOfRegion?: boolean;
  /** Perk ids already consumed this run (once-per-run perks). */
  consumed?: readonly string[];
  /** Region-scoped shield (Tin Star) still unspent. Undefined = treat as unspent (global composition). */
  regionShield?: boolean;
  /** Active temporary buffs (BUFF_DEFS keys). */
  buffs?: Readonly<Record<string, number>>;
}

export interface PerkDef {
  id: string;
  name: string;
  rarity: Rarity;
  tags: readonly PerkTag[];
  /** Interaction groups: perks sharing a synergy tag are designed to combo. */
  synergy: readonly string[];
  /** What it does (rule-first, with its condition). */
  description: string;
  /** Tier 2 adds a SECOND effect (rest-site upgrade). Absent = no tier 2. */
  upgrade?: string;
  /** Duel-side patch applied at tier 1 (and tier 2 on top). */
  duel?: Partial<DuelModifiers>;
  duel2?: Partial<DuelModifiers>;
  run?: Partial<RunRules>;
  run2?: Partial<RunRules>;
  /** Restrict the duel patch to matching duels. */
  when?: (ctx: ComposeCtx, tier: 1 | 2) => boolean;
  /** Mutually exclusive perk ids (symmetric). */
  excludes?: readonly string[];
  /** Consumed after one use per run (RunSystem tracks it). */
  oncePerRun?: boolean;
  /** Engine work owner (see PerkOwner). */
  owner: PerkOwner;
  /** D16 truth: see PerkSupport. */
  support: PerkSupport;
  /** What is missing when support is pending, or for a ready perk's secondary effect. */
  needs?: string;
  /** `pending` perks whose keys ARE read somewhere but not reachable in play yet (caller wiring); names who must wire it. */
  blockedBy?: string;
  /** `ready` perks only: keys in the data that are known to have no consumer yet (a tier-2 or secondary half). */
  unwired?: readonly (keyof DuelModifiers | keyof RunRules)[];
}

const KNIFE_HORSE = ['knife_thrower', 'horse_rider'];

export const PERKS: readonly PerkDef[] = [
  // ---------------- DRAW ----------------
  { id: 'hair_trigger', name: 'Hair Trigger', rarity: 'common', tags: ['DRAW', 'AIM'], synergy: ['precision'],
    description: 'Your first shot of a duel fires the instant you release, even before the aim budget ends.',
    upgrade: 'Follow-up shots also fire on release.', duel: { fireOnRelease: true }, owner: 'a02', support: 'pending', needs: 'InputSystem: release-fire rule' },
  { id: 'quickdraw_scar', name: 'Quickdraw Scar', rarity: 'rare', tags: ['DRAW'], synergy: ['perfect_chain', 'risk'],
    description: 'Perfect Draw window doubles, but your aim budget is 25% shorter.',
    upgrade: 'A Perfect Draw ignores the aim penalty.', duel: { perfectWindowMult: 2, aimBudgetMult: 0.75 }, duel2: { aimPenaltyIgnoredOnPerfect: true },
    excludes: ['devils_deal'], owner: 'today', support: 'ready', unwired: ['aimPenaltyIgnoredOnPerfect'], needs: 'Tier 2 flag aimPenaltyIgnoredOnPerfect has no consumer yet (a02); tier 1 uses DuelConfig' },
  { id: 'ambidextrous', name: 'Ambidextrous', rarity: 'common', tags: ['DRAW'], synergy: ['feint'],
    description: 'Start your draw from either screen half; the side you pick changes recoil direction (Dual Wielder tell).',
    upgrade: 'Drawing from the side opposite the enemy tell shows its second glint 60 ms early.', duel: { drawFromEitherSide: true },
    owner: 'a02', support: 'pending', needs: 'InputSystem: dual holster zones' },
  { id: 'cold_open', name: 'Cold Open', rarity: 'rare', tags: ['DRAW'], synergy: ['perfect_chain', 'stagger'],
    description: 'A Perfect Draw staggers the enemy for one beat.', upgrade: 'The staggered enemy cannot dodge or evade.',
    duel: { perfectStaggers: true }, owner: 'a02', support: 'ready' },
  { id: 'reflex_tonic', name: 'Reflex Tonic', rarity: 'common', tags: ['DRAW'], synergy: ['feint'],
    description: 'Flinching costs you no draw time.', upgrade: 'Your first flinch each duel keeps your crit.',
    duel: { flinchPenaltyMult: 0 }, excludes: ['steady_hands'], owner: 'today', support: 'ready', needs: 'Tier 2 needs DuelSystem (a02)' },
  { id: 'steady_hands', name: 'Steady Hands', rarity: 'common', tags: ['DRAW'], synergy: ['feint'],
    description: 'Flinching does not cost time, but the next draw has no crit.', upgrade: 'The no-crit rule only lasts the first shot.',
    duel: { flinchNoTimeCost: true, flinchPenaltyMult: 0, flinchDisablesCrit: true }, excludes: ['reflex_tonic'], owner: 'a02', support: 'ready' },
  { id: 'spit_and_polish', name: 'Spit and Polish', rarity: 'rare', tags: ['DRAW'], synergy: ['perfect_chain'],
    description: 'Once per duel a Good-tier draw counts as Perfect.', upgrade: 'It also triggers on an OK draw once per region.',
    duel: { goodAsPerfectPerDuel: 1 }, owner: 'a02', support: 'ready' },
  { id: 'tell_reader', name: 'Tell Reader', rarity: 'common', tags: ['DRAW', 'LUCK'], synergy: ['info'],
    description: 'Tells show a faint on-screen cue 80 ms earlier, in the first duel of each region.', upgrade: 'Also on every elite.',
    duel: { tellCueLeadMs: 80 }, when: (c, t) => !!c.firstDuelOfRegion || (t === 2 && !!c.elite), owner: 'a02', support: 'ready' },
  { id: 'bluff', name: 'Bluff', rarity: 'rare', tags: ['DRAW', 'DODGE'], synergy: ['feint', 'dodge_counter'],
    description: 'A deliberate flinch makes the enemy shoot first and miss. Risky: they only miss once.', upgrade: 'After a bluffed miss your draw is auto-Good.',
    duel: { bluffFeint: true }, owner: 'a06', support: 'pending', blockedBy: 'DuelScene must pass opponentOptionsFromModifiers(mods) to createOpponent (A06 hook exists)', needs: 'EnemyAI: react to flinch; DuelSystem: guaranteed miss beat' },
  { id: 'second_wind', name: 'Second Wind', rarity: 'rare', tags: ['DRAW', 'LIFE'], synergy: ['perfect_chain', 'comeback'],
    description: 'After you take a hit, your next draw is automatically Perfect.', upgrade: 'It carries into the next duel if you were hit last shot.',
    duel: { afterHitAutoPerfect: true }, owner: 'a02', support: 'ready' },
  { id: 'showman', name: 'Showman', rarity: 'legend', tags: ['DRAW', 'LIFE'], synergy: ['perfect_chain'],
    description: 'A streak of 3 Perfect Draws grants a free life, once per run.', duel: { perfectStreakLifeAt: 3 }, oncePerRun: true,
    owner: 'a02', support: 'ready' },

  // ---------------- AIM ----------------
  { id: 'steady_breath', name: 'Steady Breath', rarity: 'common', tags: ['AIM'], synergy: ['precision'],
    description: 'Slow-mo aim extends while your reticle stands still.', upgrade: 'Standing still also shrinks the enemy hit-zone penalty.',
    duel: { aimBudgetStillBonus: true }, owner: 'a02', support: 'ready' },
  { id: 'dead_eye', name: 'Dead Eye', rarity: 'rare', tags: ['AIM'], synergy: ['stagger', 'crit'],
    description: 'Head hits always stagger the enemy.', upgrade: 'A headshot stagger also cancels the enemy pending shot.',
    duel: { headStagger: true }, excludes: ['buckshot_rounds'], owner: 'a02', support: 'ready' },
  { id: 'ricochet', name: 'Ricochet', rarity: 'rare', tags: ['AIM'], synergy: ['multi_shot'],
    description: 'A missed shot bounces once toward the nearest enemy (shines in multi-enemy duels).', upgrade: 'The bounce can hit props.',
    duel: { ricochet: true }, owner: 'a02', support: 'pending', needs: 'DuelSystem: multi-target + bounce' },
  { id: 'disarmer', name: 'Disarmer', rarity: 'common', tags: ['AIM'], synergy: ['stagger'],
    description: 'Gun-arm hits make the enemy drop the gun, costing them a beat to pick it up, and you may disarm one more time per attempt.',
    upgrade: 'A dropped gun cannot be picked up on bosses faster than 2 beats.', duel: { maxDisarmsDelta: 1, disarmDropsGun: true },
    owner: 'today', support: 'ready', unwired: ['disarmDropsGun'], needs: 'maxDisarms works today; drop-beat (disarmDropsGun) needs EnemyAI (a06)' },
  { id: 'called_shot', name: 'Called Shot', rarity: 'legend', tags: ['AIM'], synergy: ['precision', 'crit'],
    description: 'Tap a zone before aiming to lock its multiplier up and the others down.', duel: { calledShot: true }, excludes: ['buckshot_rounds'],
    owner: 'a02', support: 'pending', needs: 'InputSystem: zone-tap pre-select; DamageSystem: multiplier lock' },
  { id: 'marksman_pact', name: 'Marksman Pact', rarity: 'common', tags: ['AIM'], synergy: ['precision'],
    description: 'One-shot kills heal nothing but refund your aim budget on the next shot.', upgrade: 'Refund is carried into the next duel.',
    duel: { oneShotRefundsBudget: true }, owner: 'a02', support: 'pending', needs: 'DuelSystem: budget refund' },
  { id: 'buckshot_rounds', name: 'Buckshot Rounds', rarity: 'rare', tags: ['AIM'], synergy: ['multi_shot'],
    description: 'Wide cone makes misses rare, but you can never score a headshot.', upgrade: 'Cone hits on the gun arm always disarm.',
    duel: { buckshot: true }, excludes: ['dead_eye', 'called_shot', 'weak_spotter', 'long_barrel'], owner: 'a02', support: 'pending', needs: 'TargetSystem: cone hit test' },
  { id: 'long_barrel', name: 'Long Barrel', rarity: 'rare', tags: ['AIM'], synergy: ['precision'],
    description: 'Your reticle can leave the hit zone and snap back to it.', duel: { reticleSnapBack: true },
    excludes: ['buckshot_rounds'], owner: 'a02', support: 'pending', needs: 'TargetSystem: snap-back assist' },
  { id: 'rapid_fire', name: 'Rapid Fire', rarity: 'legend', tags: ['AIM'], synergy: ['multi_shot', 'crit'],
    description: 'A body hit grants a bonus follow-up shot, and you choose the second target.', duel: { rapidFollowUp: true },
    owner: 'a02', support: 'pending', needs: 'DuelSystem: bonus follow-up shot state' },
  { id: 'weak_spotter', name: 'Weak Spotter', rarity: 'common', tags: ['AIM'], synergy: ['info', 'precision'],
    description: 'Enemy weak points glow, but only for 400 ms.', upgrade: 'The glow lasts 700 ms on armoured enemies.',
    duel: { weakPointGlowMs: 400 }, excludes: ['buckshot_rounds'], owner: 'a02', support: 'ready' },
  { id: 'trick_shot', name: 'Trick Shot', rarity: 'rare', tags: ['AIM', 'LUCK'], synergy: ['info'],
    description: 'Shooting an arena prop (lantern, barrel) triggers its effect on the enemy.', upgrade: 'Props respawn once per duel.',
    duel: { propShotsHitEnemy: true }, owner: 'a02', support: 'ready' },

  // ---------------- DODGE ----------------
  { id: 'counter_roll', name: 'Counter Roll', rarity: 'rare', tags: ['DODGE'], synergy: ['dodge_counter', 'crit'],
    description: 'A successful dodge guarantees your next shot is a crit.', upgrade: 'Also grants a free Perfect-tier counter draw.',
    duel: { dodgeGuaranteesCrit: true }, owner: 'a02', support: 'ready' },
  { id: 'dust_kick', name: 'Dust Kick', rarity: 'common', tags: ['DODGE'], synergy: ['dodge_counter'],
    description: 'Your dodge leaves a dust cloud that blocks the next enemy shot.', upgrade: 'The cloud also blocks the enemy tell for the next beat.',
    duel: { dodgeCloudBlocksShot: true }, owner: 'a02', support: 'ready' },
  { id: 'matador', name: 'Matador', rarity: 'common', tags: ['DODGE'], synergy: ['dodge_counter', 'specialist'],
    description: 'Your dodge window doubles against Knife Throwers and Horse Riders only.', upgrade: 'A dodged Knife Thrower throws only one knife.',
    duel: { dodgeWindowMult: 2 }, when: (c) => !!c.enemyId && KNIFE_HORSE.includes(c.enemyId), owner: 'a02', support: 'ready' },
  { id: 'slip_away', name: 'Slip Away', rarity: 'common', tags: ['DODGE', 'COIN'], synergy: ['dodge_counter', 'economy'],
    description: 'Each successful dodge pays 3 coins.', upgrade: 'A dodged shot from an elite pays 10.', duel: { coinPerDodge: 3 },
    owner: 'a02', support: 'pending', blockedBy: 'GameFlow must pass DuelResult.dodges into RunDuelResult.dodges', needs: 'DuelResult.dodges count (RunSystem already pays it when reported)' },
  { id: 'tumble', name: 'Tumble', rarity: 'rare', tags: ['DODGE', 'AIM'], synergy: ['dodge_counter', 'risk'],
    description: 'You may dodge while aiming, at the cost of 40% of your aim budget.', upgrade: 'The tumble costs 25% instead.',
    duel: { dodgeWhileAiming: true, tumbleBudgetCost: 0.4 }, owner: 'a02', support: 'ready' },
  { id: 'bait', name: 'Bait', rarity: 'rare', tags: ['DODGE'], synergy: ['info', 'feint'],
    description: 'Standing still on purpose makes the enemy fire early, breaking Coward fake tells.', upgrade: 'Bait also works on Drunks.',
    duel: { baitEnabled: true }, owner: 'a06', support: 'pending', blockedBy: 'DuelScene must pass opponentOptionsFromModifiers(mods) to createOpponent (A06 hook exists)', needs: 'EnemyAI: react to a held input' },
  { id: 'body_shield', name: 'Body Shield', rarity: 'common', tags: ['DODGE', 'LIFE'], synergy: ['events'],
    description: 'Dodge into a prop or bystander to take the hit instead; on the trail, the first hp you would lose in each event is negated.',
    upgrade: 'Negates the first two.', run: { eventHpLossBlock: 1 }, run2: { eventHpLossBlock: 1 }, owner: 'today', support: 'ready', needs: 'Event half works today; prop-dodge half needs DuelSystem (a02)' },
  { id: 'phantom_step', name: 'Phantom Step', rarity: 'legend', tags: ['DODGE'], synergy: ['dodge_counter'],
    description: 'After an enemy misses you, dodge through the rest of their shot window.', duel: { phantomStep: true },
    owner: 'a02', support: 'ready' },

  // ---------------- COIN ----------------
  { id: 'bounty_hunter_creed', name: 'Bounty Hunter', rarity: 'rare', tags: ['COIN'], synergy: ['economy', 'risk'],
    description: 'Elites pay double coins; regular duels pay half. Walk toward the skulls.', duel: { coinMultElite: 2, coinMultDuel: 0.5 },
    owner: 'today', support: 'ready' },
  { id: 'pawn_shop', name: 'Pawn Shop', rarity: 'common', tags: ['COIN'], synergy: ['economy', 'rebuild'],
    description: 'Sell a perk at any shop for coins; your next purchase that visit is 25% cheaper.', upgrade: 'Selling a cursed perk pays double.',
    run: { pawnShop: true }, owner: 'today', support: 'ready' },
  { id: 'loaded_dice', name: 'Loaded Dice', rarity: 'common', tags: ['COIN', 'LUCK'], synergy: ['economy', 'rebuild'],
    description: 'The first reroll of any offer per node is free.', upgrade: 'Free rerolls also apply to the duel reward screen.',
    run: { rerollFreeFirstPerNode: true }, owner: 'today', support: 'ready' },
  { id: 'tip_jar', name: 'Tip Jar', rarity: 'common', tags: ['COIN', 'LIFE'], synergy: ['economy', 'rest'],
    description: 'The bartender at rest sites slides you a free tonic.', upgrade: 'A second free item when you rest with full lives.',
    run: { restFreeItem: true }, owner: 'today', support: 'ready' },
  { id: 'interest', name: 'Interest', rarity: 'rare', tags: ['COIN'], synergy: ['economy'],
    description: 'Unspent coins pay +10% when a boss falls. Hoarding is a real choice.', upgrade: 'Also pays 5% at the start of each region.',
    run: { bossInterestPct: 0.1 }, owner: 'today', support: 'ready' },
  { id: 'gamblers_fallacy', name: "Gambler's Fallacy", rarity: 'rare', tags: ['COIN', 'CURSE'], synergy: ['economy', 'risk', 'curse_shop'],
    description: 'Every shop item is 30% off, but one random item is a curse.', run: { shopDiscount: 0.3, shopCurseSlot: true },
    excludes: ['blood_money'], owner: 'today', support: 'ready' },
  { id: 'slush_fund', name: 'Slush Fund', rarity: 'common', tags: ['COIN'], synergy: ['economy', 'risk'],
    description: 'Retries cost half, but the reward from that duel is zero.', upgrade: 'The first retry per region still pays coins.',
    run: { retryCostMult: 0.5, retryNoReward: true }, owner: 'today', support: 'ready' },
  { id: 'pickpocket', name: 'Pickpocket', rarity: 'rare', tags: ['COIN', 'DRAW'], synergy: ['economy', 'perfect_chain'],
    description: 'A no-damage win with a Perfect Draw takes 6 coins from the enemy belt.', upgrade: 'Headshot kills also take 3.',
    duel: { pickpocketPerPerfect: 6 }, owner: 'today', support: 'ready' },

  // ---------------- LUCK / EVENT ----------------
  { id: 'lucky_charm', name: 'Lucky Charm', rarity: 'common', tags: ['LUCK'], synergy: ['info', 'events'],
    description: 'Once per region, preview the exact outcome of an event choice before you commit.', upgrade: 'Twice per region.',
    run: { eventPreviewPerRegion: 1 }, run2: { eventPreviewPerRegion: 1 }, owner: 'today', support: 'ready' },
  { id: 'black_cat', name: 'Black Cat', rarity: 'common', tags: ['LUCK'], synergy: ['info', 'curse_shop'],
    description: 'Curses are visible in the shop before you buy.', upgrade: 'Curses in the shop also show their price cut.',
    run: { curseVisible: true }, owner: 'today', support: 'ready' },
  { id: 'horseshoe', name: 'Horseshoe', rarity: 'rare', tags: ['LUCK', 'LIFE'], synergy: ['rest'],
    description: 'Rest nodes can be used twice.', run: { restUsesDelta: 1 }, owner: 'today', support: 'ready' },
  { id: 'traders_eye', name: "Trader's Eye", rarity: 'common', tags: ['LUCK', 'COIN'], synergy: ['economy', 'rebuild'],
    description: 'Shops show an extra perk.', upgrade: 'The extra perk is at least Rare.', run: { shopExtraItems: 1 }, owner: 'today', support: 'ready' },
  { id: 'pathfinder', name: 'Pathfinder', rarity: 'rare', tags: ['LUCK'], synergy: ['info'],
    description: 'The map shows node types two steps ahead instead of one.', upgrade: 'Three steps ahead.',
    run: { mapLookaheadDelta: 1 }, run2: { mapLookaheadDelta: 1 }, owner: 'today', support: 'ready' },
  { id: 'wanted_poster', name: 'Wanted Poster', rarity: 'rare', tags: ['LUCK', 'DRAW'], synergy: ['info', 'specialist'],
    description: 'Twice per run, choose which regional enemy you fight at a standard duel.', upgrade: 'Three times per run.',
    run: { posterCharges: 2 }, run2: { posterCharges: 1 }, owner: 'today', support: 'ready' },
  { id: 'whiskey_luck', name: 'Whiskey Luck', rarity: 'common', tags: ['LUCK', 'CURSE'], synergy: ['events', 'risk'],
    description: 'Drink at an event to reroll its outcome; your aim budget is 20% shorter for the next duel.', upgrade: 'Two drinks per run.',
    run: { whiskeyEventRerolls: 1 }, run2: { whiskeyEventRerolls: 1 }, owner: 'today', support: 'ready', needs: 'Blurry aim penalty uses aimBudgetMult (config today)' },

  // ---------------- LIFE ----------------
  { id: 'tin_star', name: 'Tin Star', rarity: 'rare', tags: ['LIFE'], synergy: ['comeback'],
    description: 'The badge turns the first hit an elite or boss lands on you in each region. One shield per region: whichever heavy hitter comes first spends it.',
    upgrade: 'Every boss fight gets its own shield, even after the region\'s badge is spent.',
    duel: { ignoreFirstHits: 1 }, when: (c, t) => (c.regionShield !== false && (!!c.elite || !!c.boss)) || (t === 2 && !!c.boss),
    excludes: ['glass_cannon'], owner: 'a02', support: 'ready',
    needs: 'D15: once per region, tracked by RunSystem (consumed key tin_star@<region>); GameFlow should pass DuelResult.hitsIgnored in RunDuelResult' },
  { id: 'bullet_belt', name: 'Bullet Belt', rarity: 'legend', tags: ['LIFE', 'AIM'], synergy: ['risk', 'comeback'],
    description: 'Carry one extra life, but the weight slows you: Perfect window -25%, aim budget -10%. Cannot be combined with Revive Flask.',
    upgrade: 'Cinched tighter: the Perfect window penalty drops to -10% and the aim budget penalty is gone.',
    duel: { heroHpDelta: 1, perfectWindowMult: 0.75, aimBudgetMult: 0.9 }, duel2: { perfectWindowMult: 1.2, aimBudgetMult: 1 / 0.9 },
    excludes: ['glass_cannon', 'revive_flask'], owner: 'today', support: 'ready' },
  { id: 'revive_flask', name: 'Revive Flask', rarity: 'legend', tags: ['LIFE'], synergy: ['comeback'],
    description: 'Once a run, ignore a lethal hit.', duel: { reviveCharges: 1 }, oncePerRun: true, excludes: ['glass_cannon', 'bullet_belt'],
    owner: 'a02', support: 'ready' },
  { id: 'iron_skin', name: 'Iron Skin', rarity: 'common', tags: ['LIFE'], synergy: ['specialist'],
    description: 'Hits from Knife Throwers do no damage.', upgrade: 'Also immune to Sniper body shots.',
    duel: { enemyDamageMult: 0 }, when: (c, t) => c.enemyId === 'knife_thrower' || (t === 2 && c.enemyId === 'sniper'), owner: 'today', support: 'ready' },
  { id: 'healers_touch', name: "Healer's Touch", rarity: 'common', tags: ['LIFE'], synergy: ['rest'],
    description: 'Rest nodes heal you fully, but you can no longer choose to upgrade or sell there.', run: { restHealFull: true, restNoUpgrade: true },
    owner: 'today', support: 'ready' },
  { id: 'last_stand', name: 'Last Stand', rarity: 'common', tags: ['LIFE', 'AIM'], synergy: ['comeback', 'risk'],
    description: 'At 1 life, your aim budget doubles.', upgrade: 'At 1 life you also draw with +30% Perfect window.',
    duel: { lastStandBudgetMult: 2 }, excludes: ['glass_cannon'], owner: 'a02', support: 'ready' },

  // ---------------- CURSE ----------------
  { id: 'devils_deal', name: "Devil's Deal", rarity: 'cursed', tags: ['CURSE', 'DRAW'], synergy: ['risk', 'perfect_chain', 'info'],
    description: 'Perfect window triples, but every enemy gets a fake tell in every duel.', duel: { perfectWindowMult: 3, fakeTellEveryDuel: true },
    excludes: ['quickdraw_scar'], owner: 'a06', support: 'pending', blockedBy: 'DuelScene must pass opponentOptionsFromModifiers(mods) to createOpponent (A06 hook exists)', needs: 'EnemyAI: force fake tell (window part works today)' },
  { id: 'mad_dogs_collar', name: "Mad Dog's Collar", rarity: 'cursed', tags: ['CURSE', 'AIM'], synergy: ['risk', 'crit'],
    description: 'All your shots crit and crits hit four times as hard: anything drops in one shot. You take double damage, so every hit costs two lives.',
    duel: { alwaysCrit: true, critDamageMult: 4, enemyDamageMult: 2 }, owner: 'a02', support: 'ready' },
  { id: 'blood_money', name: 'Blood Money', rarity: 'cursed', tags: ['CURSE', 'COIN'], synergy: ['economy', 'risk'],
    description: 'Coins from duels, elites and bosses are doubled; shops charge double.', duel: { coinMultDuel: 2, coinMultElite: 2, coinMultBoss: 2 }, run: { shopPriceMult: 2 },
    excludes: ['gamblers_fallacy'], owner: 'today', support: 'ready' },
  { id: 'hex', name: 'Hex', rarity: 'cursed', tags: ['CURSE'], synergy: ['risk'],
    description: 'Perks of your most-held tag are doubled; every perk of any other tag is disabled. The witch gives shop prices a 25% hex-discount.',
    run: { shopDiscount: 0.25 }, owner: 'today', support: 'ready', needs: 'Tag doubling/disabling is resolved in PerkSystem.composePerks' },
  { id: 'glass_cannon', name: 'Glass Cannon', rarity: 'cursed', tags: ['CURSE', 'LIFE'], synergy: ['risk'],
    description: 'You kill anything in one hit, but you have only 1 life. Bounties pay 50% more: you are walking on a wire.',
    duel: { oneHitKill: true, heroHpOverride: 1, coinMultDuel: 1.5, coinMultElite: 1.5, coinMultBoss: 1.5 },
    excludes: ['bullet_belt', 'tin_star', 'revive_flask', 'last_stand'], owner: 'today', support: 'ready' },
  { id: 'widows_wager', name: "Widow's Wager", rarity: 'cursed', tags: ['CURSE', 'COIN'], synergy: ['risk', 'economy'],
    description: 'Before a duel, bet coins: win to double the bet, lose it all.', duel: { wagerEnabled: true }, owner: 'today', support: 'ready' },
];

/** Temporary run buffs (events, consumables). Value = duels remaining. */
export const BUFF_DEFS: Record<string, { description: string; duel: Partial<DuelModifiers>; luck?: number }> = {
  focus: { description: 'Next duel: Perfect window +30%.', duel: { perfectWindowMult: 1.3 } },
  awareness: { description: 'Next duel: tells cue 80 ms early.', duel: { tellCueLeadMs: 80 } },
  blurry: { description: 'Next duel: aim budget -20%.', duel: { aimBudgetMult: 0.8 } },
  lucky: { description: 'Better perk offers until the end of the region.', duel: {}, luck: 0.25 },
  unlucky: { description: 'Worse perk offers until the end of the region.', duel: {}, luck: -0.25 },
};

/** Rarity roll weights for normal offers (cursed only when a source explicitly allows it). */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 60, rare: 30, legend: 4, cursed: 6 };
/** Shop price by rarity (coins), before rules. Sell value is 40% of it. */
export const RARITY_PRICE: Record<Rarity, number> = { common: 30, rare: 55, legend: 100, cursed: 20 };
export const SELL_FRACTION = 0.4;

export const PERK_BY_ID: Readonly<Record<string, PerkDef>> = Object.fromEntries(PERKS.map((p) => [p.id, p]));
