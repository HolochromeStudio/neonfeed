/**
 * Game-feel tunables (A03). Every number the FeelSystem uses lives here.
 * Times are real-time milliseconds, distances logical px (360x640).
 *
 * HARD RULES (enforced by `caps` + clamp helpers in FeelSystem.ts, asserted in tests/feel.test.ts):
 *  - Juice is visual only. It never touches the DuelSystem clock, input handlers or phase changes.
 *  - Hit-stop and slow-mo scale tweens/animations only (never scene.time), measured in real time.
 *  - All effects are cancelled on onRetry/onWait and scene shutdown.
 */

import type { HapticProfile } from '../core/audioEvents';
import type { DrawTier, ZoneId } from './duelConfig';

export type ImpactKind = 'head' | 'body' | 'limb' | 'prop' | 'hero';

export interface ImpactTuning {
  hitStopMs: number;
  shakePx: number;
  shakeMs: number;
  particles: number;
  flashAlpha: number;
  /** Horizontal shove of the struck character. */
  knockbackPx: number;
}

export interface DodgeTuning {
  shakePx: number;
  shakeMs: number;
  flashAlpha: number;
  flashMs: number;
  flashColour: number;
  /** Camera punch zoom (removed by reducedShake). */
  punchZoom: number;
  slowMoScale: number;
  /** 0 = no slow-mo. */
  slowMoMs: number;
  /** Dust puff size at the hero's feet. */
  particles: number;
}

export interface FeelConfig {
  /** Absolute ceilings. Every plan is clamped to these no matter what the tables below say. */
  caps: {
    hitStopMs: number;
    slowMoMs: number;
    /** Slow-mo never goes below this time scale. */
    slowMoMinScale: number;
    shakePx: number;
    shakeMs: number;
    flashAlpha: number;
    flashMs: number;
    punchZoom: number;
    /** Live feel particles on screen at once. */
    maxLiveParticles: number;
    maxParticlesPerBurst: number;
    /** Live muzzle flash sprites at once. */
    maxLiveMuzzle: number;
    /** Nothing the layer spawns may live longer than this. */
    maxEffectLifeMs: number;
  };
  /** Setting "Screen shake: Reduced" (UX_FLOW 4.x). Shake scaled, zoom punch removed; hit-stop and flash stay. */
  reducedShake: { shakeScale: number; punchZoom: number };

  perfectDraw: {
    punchZoom: number;
    punchInMs: number;
    punchOutMs: number;
    flashAlpha: number;
    flashMs: number;
    flashColour: number;
    slowMoScale: number;
    slowMoMs: number;
  };
  flinch: { twitchPx: number; twitchMs: number };
  /** Dodge feedback (A02's onDodge / onMiss.evaded). All values are clamped by `caps` in planDodge. */
  dodge: {
    perfect: DodgeTuning;
    ok: DodgeTuning;
    /** Early / late failure: a small negative cue. */
    fail: DodgeTuning;
    /** Enemy shot dodged (onMiss evaded 'dodge'): the bullet whistles past. */
    pastShot: DodgeTuning;
    /** Dust Kick cloud: visual hint only (dust puff), never a flash or slow-mo. */
    cloudParticles: number;
    dustColour: number;
  };

  recoil: {
    kickPx: number;
    kickMs: number;
    /** kick + settle is clamped to the duel's aim.recoilMs so the hand is home before the next AIM. */
    settleMs: number;
  };
  muzzle: {
    anim: string;
    atlas: string;
    /** Delay after the shot event. 0 = same frame, which is what makes a shot feel instant. */
    delayMs: number;
    heroOffset: { x: number; y: number };
    enemyOffset: { x: number; y: number };
    scale: number;
    /** Safety net if the animation never completes. */
    maxLifeMs: number;
    fallbackMs: number;
    fallbackColour: number;
  };
  /** Bullet tracer speed A02's Projectile must match (player tracer duration ~= distance / this). */
  tracer: { pxPerMs: number; maxDelayMs: number };
  /** Impact is delayed to bullet arrival so the hit never lands before the bullet does. */
  impact: Record<ImpactKind, ImpactTuning>;
  crit: { hitStopAddMs: number; shakeMul: number };
  kill: { hitStopMs: number; slowMoScale: number; slowMoMs: number; shakeMul: number };
  /** Optional slow-mo on the lethal shot. The hero's death gets a shorter one so defeat is never dragged out. */
  heroKill: { slowMoScale: number; slowMoMs: number };
  particle: {
    sizePx: number;
    speedPx: number;
    lifeMs: number;
    colours: Record<ImpactKind, number>;
    gravityPx: number;
  };
  impactFlash: { radiusPx: number; ms: number; colour: number };

  /**
   * Haptics. Most events already vibrate through audioBus -> HapticsManager (HAPTIC_FOR_EVENT:
   * gunshot heavy, hit_flesh hit, death, perfect_draw, draw_cue medium). The feel layer only adds
   * what the audio bus does not, to avoid double buzzing. null = covered elsewhere / none.
   */
  haptics: {
    flinch: HapticProfile | null;
    critHit: HapticProfile | null;
    perfectDraw: HapticProfile | null;
    playerHit: HapticProfile | null;
    kill: HapticProfile | null;
    /** The audio bus already plays 'light' for dodge/miss; perfect replaces it with a distinct pattern, ok/fail add nothing. */
    dodgePerfect: HapticProfile | null;
    dodgeOk: HapticProfile | null;
    dodgeFail: HapticProfile | null;
  };

  /** Reaction-time number that pops in at the draw. */
  reactionPop: {
    x: number;
    y: number;
    delayMs: number;
    startScale: number;
    peakScale: number;
    popInMs: number;
    settleMs: number;
    holdMs: number;
    fadeMs: number;
    fontPx: number;
    labels: Record<DrawTier, string>;
    colours: Record<DrawTier, string>;
    flinchedColour: string;
  };
  /** Overlay depth for feel-owned objects (above A02's HUD at 40). */
  depth: number;
}

export const FEEL: FeelConfig = {
  caps: {
    hitStopMs: 60,
    slowMoMs: 200,
    slowMoMinScale: 0.3,
    shakePx: 4,
    shakeMs: 140,
    flashAlpha: 0.35,
    flashMs: 120,
    punchZoom: 0.03,
    maxLiveParticles: 24,
    maxParticlesPerBurst: 10,
    maxLiveMuzzle: 3,
    maxEffectLifeMs: 900,
  },
  reducedShake: { shakeScale: 0.25, punchZoom: 0 },

  perfectDraw: {
    punchZoom: 0.02,
    punchInMs: 45,
    punchOutMs: 90,
    flashAlpha: 0.18,
    flashMs: 70,
    flashColour: 0xfff3c4,
    slowMoScale: 0.5,
    slowMoMs: 110,
  },
  flinch: { twitchPx: 3, twitchMs: 50 },
  dodge: {
    perfect: { shakePx: 1.5, shakeMs: 70, flashAlpha: 0.1, flashMs: 60, flashColour: 0xc9f3ff, punchZoom: 0.01, slowMoScale: 0.6, slowMoMs: 90, particles: 4 },
    ok: { shakePx: 1, shakeMs: 50, flashAlpha: 0.05, flashMs: 50, flashColour: 0xc9f3ff, punchZoom: 0, slowMoScale: 1, slowMoMs: 0, particles: 3 },
    fail: { shakePx: 1.5, shakeMs: 60, flashAlpha: 0.1, flashMs: 60, flashColour: 0xd24a3a, punchZoom: 0, slowMoScale: 1, slowMoMs: 0, particles: 0 },
    pastShot: { shakePx: 1, shakeMs: 50, flashAlpha: 0, flashMs: 0, flashColour: 0xffffff, punchZoom: 0, slowMoScale: 1, slowMoMs: 0, particles: 2 },
    cloudParticles: 5,
    dustColour: 0xb98a4e,
  },

  recoil: { kickPx: 5, kickMs: 45, settleMs: 90 },
  muzzle: {
    anim: 'fx_muzzle_flash',
    atlas: 'placeholder',
    delayMs: 0,
    heroOffset: { x: 24, y: -40 },
    enemyOffset: { x: -24, y: -40 },
    scale: 1,
    maxLifeMs: 160,
    fallbackMs: 70,
    fallbackColour: 0xfff0a0,
  },
  tracer: { pxPerMs: 4, maxDelayMs: 60 },
  impact: {
    head: { hitStopMs: 45, shakePx: 3, shakeMs: 100, particles: 8, flashAlpha: 0.14, knockbackPx: 5 },
    body: { hitStopMs: 30, shakePx: 2, shakeMs: 80, particles: 6, flashAlpha: 0.08, knockbackPx: 3 },
    limb: { hitStopMs: 20, shakePx: 1.5, shakeMs: 60, particles: 4, flashAlpha: 0.05, knockbackPx: 2 },
    prop: { hitStopMs: 0, shakePx: 1, shakeMs: 50, particles: 6, flashAlpha: 0, knockbackPx: 0 },
    hero: { hitStopMs: 40, shakePx: 3.5, shakeMs: 120, particles: 5, flashAlpha: 0.2, knockbackPx: 4 },
  },
  crit: { hitStopAddMs: 10, shakeMul: 1.3 },
  kill: { hitStopMs: 60, slowMoScale: 0.35, slowMoMs: 160, shakeMul: 1.25 },
  heroKill: { slowMoScale: 0.5, slowMoMs: 90 },
  particle: {
    sizePx: 3,
    speedPx: 70,
    lifeMs: 260,
    gravityPx: 160,
    colours: { head: 0xd24a3a, body: 0xd24a3a, limb: 0xd24a3a, prop: 0xb98a4e, hero: 0xff6a5a },
  },
  impactFlash: { radiusPx: 14, ms: 70, colour: 0xfff3c4 },

  haptics: { flinch: 'light', critHit: 'medium', perfectDraw: null, playerHit: null, kill: null, dodgePerfect: 'perfect_draw', dodgeOk: null, dodgeFail: null },

  reactionPop: {
    x: 180,
    y: 190,
    delayMs: 0,
    startScale: 0.6,
    peakScale: 1.25,
    popInMs: 80,
    settleMs: 70,
    holdMs: 600,
    fadeMs: 150,
    fontPx: 40,
    labels: { perfect: 'PERFECT', good: 'GOOD', ok: 'OK', slow: 'SLOW' },
    colours: { perfect: '#ffe08a', good: '#fff3c4', ok: '#d8c8a8', slow: '#d24a3a' },
    flinchedColour: '#d24a3a',
  },
  depth: 60,
};

/** Zone -> impact table row. */
export function impactKindFor(target: 'enemy' | 'hero' | 'prop', zone: ZoneId | null): ImpactKind {
  if (target === 'hero') return 'hero';
  if (target === 'prop' || zone === 'prop') return 'prop';
  if (zone === 'head' || zone === 'limb') return zone;
  return 'body';
}
