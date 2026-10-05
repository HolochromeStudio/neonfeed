/**
 * All duel tuning numbers (A02). Starting values from docs/GAME_DESIGN.md;
 * A18 Balance tunes them. Times are milliseconds, distances logical px (360x640).
 */

export type DrawTier = 'perfect' | 'good' | 'ok' | 'slow';
export type ZoneId = 'head' | 'body' | 'limb' | 'prop';

export interface DuelConfig {
  wait: { minMs: number; maxMs: number };
  /** Reaction tiers: reaction < perfectMs is PERFECT, < goodMs GOOD, < okMs OK, else SLOW. */
  draw: {
    perfectMs: number;
    goodMs: number;
    okMs: number;
    /** Time the hero draw animation takes between a registered draw and AIM. */
    drawAnimMs: number;
    /** Added to reaction and draw time after a flinch (GAME_DESIGN "Flinch"). */
    flinchPenaltyMs: number;
  };
  aim: {
    budgetMs: number;
    perfectBudgetBonus: number;
    followUpBudgetMs: number;
    /** Opponent clock speed while aiming (RULE F7: slow-mo is guaranteed). */
    slowMoScale: number;
    /** Recoil lock between a shot and the follow-up AIM. */
    recoilMs: number;
    /** Radius that snaps a reticle to the nearest zone. */
    assistRadiusPx: number;
    /** Reticle sits this far above the touch point so the thumb does not cover it. */
    reticleOffsetY: number;
  };
  damage: {
    baseDamage: number;
    critMultiplier: number;
    heroHp: number;
    enemyHp: number;
    enemyDamage: number;
    /** D14: damage of an elite's hit on the hero (before perk `enemyDamageMult`). Set to `enemyDamage` to revert. */
    eliteDamage: number;
    /** D14: damage of a boss's hit on the hero (before perk `enemyDamageMult`). Package B = boss only: eliteDamage 1, bossDamage 2. */
    bossDamage: number;
  };
  zones: Record<ZoneId, { multiplier: number }>;
  /** Zone rects as fractions of the enemy rect {x,y,w,h in 0..1}. */
  zoneLayout: Record<Exclude<ZoneId, 'prop'>, { x: number; y: number; w: number; h: number }>;
  fairness: {
    /** RULE F1: tell-to-lethal-shot is never below this. */
    minLethalMs: number;
    /** Minimum gap between consecutive enemy shots. */
    minShotGapMs: number;
    /** Enemy shot hits the hero when its aim error is at most this. */
    enemyHitTolerancePx: number;
    /**
     * QA-09 re-arm rule: a gun-arm (limb) hit cancels the pending enemy shot at most this many times per
     * attempt. Later limb hits still deal damage but no longer disarm, so parking the reticle on the limb
     * cannot hold a high-hp enemy off forever. Infinity restores the old behaviour. A18: tune per enemy tier.
     */
    maxDisarms: number;
  };
  resolve: { holdMs: number };
  /** Dodge action (D18, docs/GAME_DESIGN.md "Dodge"). All times are REAL ms so touch latency is never scaled by slow-mo. */
  dodge: {
    /** Default window before an enemy shot in which a dodge succeeds (an opponent's `dodgeWindowMs` replaces it). */
    windowMs: number;
    /** Fairness clamp on the effective window (opponent value times perk multiplier): never narrower than ~9 frames plus touch latency. */
    minWindowMs: number;
    maxWindowMs: number;
    /** A dodge in the first `perfectFrac` of the window (a fast reaction to the muzzle raise) is PERFECT, later OK. */
    perfectFrac: number;
    /** Cost of an early or late dodge (the hero stumbles): the next draw is delayed by whatever is left of it, like a flinch. */
    failPenaltyMs: number;
    /** A dodge this soon after an enemy shot that was not dodged is reported LATE rather than EARLY. */
    lateGraceMs: number;
    /** A PERFECT dodge's counter draw gets this much extra aim budget (same bonus as a Perfect Draw, but no crit, no tier). */
    perfectBudgetBonus: number;
    /** Tumble (dodge while aiming) never leaves less than this much aim budget (F7: touch precision stays fair). */
    tumbleMinLeftMs: number;
    /** Horizontal flick recognition: faster and longer than the draw flick so a reticle drag is not a dodge. */
    input: SwipeConfig;
  };
  /** Draw swipe + holster hold. */
  input: SwipeConfig;
  arena: {
    width: number;
    height: number;
    hero: { x: number; y: number };
    enemy: { x: number; y: number; w: number; h: number };
    /** Holster hold zone (UX_FLOW 4.6: y=520..616, 280x96). */
    holster: { x: number; y: number; w: number; h: number };
    props: { id: string; x: number; y: number; w: number; h: number }[];
  };
}

export interface SwipeConfig {
  /** Net travel before a swipe can register (UX_FLOW: 10 px dead zone, 28 px for a deliberate flick). */
  minDistancePx: number;
  /** Minimum speed over the recent window, px/ms. */
  minSpeedPxPerMs: number;
  /** Window used to measure speed so a slow start does not veto a flick. */
  speedWindowMs: number;
  /** Swipe must register within this long after touch start. */
  maxDurationMs: number;
  /** Allowed angle off the axis, degrees (wide: thumbs arc). */
  angleToleranceDeg: number;
  /** Travel below this and shorter than tapMaxMs is a tap. */
  tapMaxTravelPx: number;
  tapMaxMs: number;
}

export const DUEL_CONFIG: DuelConfig = {
  wait: { minMs: 1000, maxMs: 3000 },
  draw: { perfectMs: 220, goodMs: 350, okMs: 550, drawAnimMs: 120, flinchPenaltyMs: 300 },
  aim: {
    budgetMs: 600,
    perfectBudgetBonus: 0.3,
    followUpBudgetMs: 450,
    slowMoScale: 0.35,
    recoilMs: 150,
    assistRadiusPx: 14,
    reticleOffsetY: 48,
  },
  /** D14 (package C): 2 lives, elites and bosses hit for 2. Revert: heroHp 3, eliteDamage 1, bossDamage 1. */
  damage: { baseDamage: 1, critMultiplier: 1.5, heroHp: 2, enemyHp: 2, enemyDamage: 1, eliteDamage: 2, bossDamage: 2 },
  zones: {
    head: { multiplier: 2 },
    body: { multiplier: 1 },
    limb: { multiplier: 0.75 },
    prop: { multiplier: 0 },
  },
  zoneLayout: {
    head: { x: 0.25, y: 0.0, w: 0.5, h: 0.26 },
    body: { x: 0.15, y: 0.26, w: 0.7, h: 0.46 },
    limb: { x: 0.0, y: 0.3, w: 0.2, h: 0.4 },
  },
  fairness: { minLethalMs: 450, minShotGapMs: 250, enemyHitTolerancePx: 24, maxDisarms: 2 },
  /** 300 ms: retry is reachable almost at once (FEEL_REVIEW item 2) and still guards a mashing thumb. */
  resolve: { holdMs: 300 },
  dodge: {
    windowMs: 250,
    minWindowMs: 150,
    maxWindowMs: 600,
    perfectFrac: 0.35,
    failPenaltyMs: 300,
    lateGraceMs: 200,
    perfectBudgetBonus: 0.3,
    tumbleMinLeftMs: 100,
    input: {
      minDistancePx: 40,
      minSpeedPxPerMs: 0.3,
      speedWindowMs: 100,
      maxDurationMs: 500,
      angleToleranceDeg: 35,
      tapMaxTravelPx: 10,
      tapMaxMs: 300,
    },
  },
  input: {
    minDistancePx: 28,
    minSpeedPxPerMs: 0.12,
    speedWindowMs: 120,
    maxDurationMs: 600,
    angleToleranceDeg: 60,
    tapMaxTravelPx: 10,
    tapMaxMs: 300,
  },
  arena: {
    width: 360,
    height: 640,
    hero: { x: 80, y: 470 },
    enemy: { x: 250, y: 400, w: 64, h: 96 },
    holster: { x: 40, y: 520, w: 280, h: 96 },
    props: [{ id: 'barrel', x: 150, y: 430, w: 28, h: 36 }],
  },
};

/**
 * Numbers for the duel-side perk/boss hooks (DuelModifiers, see docs/RUN_DESIGN.md section 6). All of them only
 * ever ADD time to the enemy or take it from the player's aim; none can shorten an enemy tell (RULE F1).
 */
export const MODIFIER_TUNING = {
  /** Cold Open: a Perfect Draw pushes the enemy's pending shot back by this many ms of enemy clock. */
  perfectStaggerMs: 350,
  /** Dead Eye: every headshot that does not kill does the same. */
  headStaggerMs: 400,
  /** Trick Shot: shooting an arena prop staggers the enemy. */
  propStaggerMs: 450,
  /** Steady Breath: at the end of the aim budget, a reticle that has been still this long (ms)... */
  stillGapMs: 120,
  /** ...and moved less than this (px) since the last aim sample extends the budget by... */
  stillMovePx: 3,
  /** ...this many ms per extension, at most this many ms in total per aim period. */
  stillBonusMs: 150,
  stillBonusMaxMs: 450,
  /** Boss `aimBudgetScale` is clamped to [min, 1] (docs/BOSSES.md: never below 0.7, slow-mo stays). */
  bossAimScaleMin: 0.7,
} as const;

/** Scene-level (not duel-logic) tuning. */
export const SCENE_TUNING = {
  /** Largest real time one scene update may feed the duel clock; a backgrounded tab cannot replay a duel. */
  maxFrameMs: 100,
  /** Player tracer flight time = clamp(distance / pxPerMs, min, max) ms (FEEL_REVIEW item 4). */
  tracer: { pxPerMs: 4, minMs: 20, maxMs: 60, enemyMs: 45 },
  /** How long a hit/miss zone label stays up. Flinch keeps the long one: it is a lesson. */
  flashZoneMs: 450,
  flashFlinchMs: 700,
  /** Retry plank, inside the holster zone where the thumb already is. */
  retry: { cx: 180, cy: 568, w: 280, h: 72 },
} as const;
