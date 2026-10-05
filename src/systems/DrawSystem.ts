import type { DrawTier } from '../data/duelConfig';
import { DUEL_CONFIG } from '../data/duelConfig';

export interface DrawGrade {
  tier: DrawTier;
  perfect: boolean;
  /** Multiplier applied to the aim budget (perfect draw: +30%). */
  aimBudgetMultiplier: number;
  /** Perfect draw grants a first-shot crit. */
  crit: boolean;
}

export interface DrawThresholds {
  perfectMs: number;
  goodMs: number;
  okMs: number;
}

/** Tier for a reaction time measured from the cue: <220 PERFECT, <350 GOOD, <550 OK, else SLOW. */
export function gradeDraw(
  reactionMs: number,
  thresholds: DrawThresholds = DUEL_CONFIG.draw,
  perfectBonus = DUEL_CONFIG.aim.perfectBudgetBonus,
): DrawGrade {
  let tier: DrawTier;
  if (reactionMs < thresholds.perfectMs) tier = 'perfect';
  else if (reactionMs < thresholds.goodMs) tier = 'good';
  else if (reactionMs < thresholds.okMs) tier = 'ok';
  else tier = 'slow';
  const perfect = tier === 'perfect';
  return { tier, perfect, aimBudgetMultiplier: perfect ? 1 + perfectBonus : 1, crit: perfect };
}

export const TIER_LABEL: Record<DrawTier, string> = { perfect: 'PERFECT', good: 'GOOD', ok: 'OK', slow: 'SLOW' };

/** Reaction used for grading: raw time from the cue plus any flinch penalty. */
export function effectiveReaction(rawMs: number, flinched: boolean, penaltyMs = DUEL_CONFIG.draw.flinchPenaltyMs): number {
  return rawMs + (flinched ? penaltyMs : 0);
}
