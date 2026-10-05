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
  damage: { baseDamage: 1, critMultiplier: 1.5, heroHp: 3, enemyHp: 2, enemyDamage: 1 },
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
