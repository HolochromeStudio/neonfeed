/**
 * Player skill models (A18). Each model is a bundle of human-performance parameters that
 * `duelSim.ts` turns into timed DuelSystem inputs. The reaction medians follow the brief
 * (380 / 300 / 250 / 210 ms); everything else is a documented assumption (docs/BALANCING.md).
 */
import type { Rng } from '../../src/core/rng';

export interface SkillModel {
  id: 'novice' | 'average' | 'skilled' | 'expert' | string;
  /** Median human reaction from the visible cue to the flick registering (before display lag), ms. */
  reactMedianMs: number;
  /** Lognormal sigma of the reaction. */
  reactSigma: number;
  /** Absolute floor, ms (nobody reacts faster). */
  reactFloorMs: number;
  /** Probability per duel of an impatient early lift (flinch) with no fake tell involved. */
  impatientFlinch: number;
  /** Probability of biting a fake tell (lifting on it) when the duel has one. */
  fakeBite: number;
  /** Std dev of the reticle error in px (2D gaussian). */
  aimSigmaPx: number;
  /** Probability of aiming at the head when the target is not already one hit from dead. */
  headPref: number;
  /** Median time spent in AIM before releasing the shot, ms (lognormal sigma 0.3). */
  fireMedianMs: number;
  /** 0..1 share of a moving target's lateral offset that the player compensates. */
  trackLead: number;
  /** Probability of aiming at head/limb (not body) vs an armoured enemy. */
  armorAware: number;
  /** Success rate of a dodge when dodge emulation is on (the duel has no dodge action yet). */
  dodgeRate: number;
}

export const NOVICE: SkillModel = {
  id: 'novice', reactMedianMs: 380, reactSigma: 0.22, reactFloorMs: 150, impatientFlinch: 0.1, fakeBite: 0.6,
  aimSigmaPx: 20, headPref: 0.1, fireMedianMs: 300, trackLead: 0.2, armorAware: 0.4, dodgeRate: 0.2,
};
export const AVERAGE: SkillModel = {
  id: 'average', reactMedianMs: 300, reactSigma: 0.18, reactFloorMs: 140, impatientFlinch: 0.05, fakeBite: 0.35,
  aimSigmaPx: 13, headPref: 0.35, fireMedianMs: 230, trackLead: 0.45, armorAware: 0.8, dodgeRate: 0.45,
};
export const SKILLED: SkillModel = {
  id: 'skilled', reactMedianMs: 250, reactSigma: 0.15, reactFloorMs: 130, impatientFlinch: 0.02, fakeBite: 0.15,
  aimSigmaPx: 8.5, headPref: 0.55, fireMedianMs: 185, trackLead: 0.7, armorAware: 1, dodgeRate: 0.65,
};
export const EXPERT: SkillModel = {
  id: 'expert', reactMedianMs: 210, reactSigma: 0.12, reactFloorMs: 120, impatientFlinch: 0.005, fakeBite: 0.05,
  aimSigmaPx: 5, headPref: 0.75, fireMedianMs: 150, trackLead: 0.9, armorAware: 1, dodgeRate: 0.85,
};

export const SKILLS: readonly SkillModel[] = [NOVICE, AVERAGE, SKILLED, EXPERT];
export const skillById = (id: string): SkillModel => {
  const s = SKILLS.find((k) => k.id === id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Continuous skill: t = 0 novice, 1 average, 2 skilled, 3 expert, linear interpolation of every parameter
 * (used by the economy sim to model a player who improves run by run).
 */
export function skillAt(t: number): SkillModel {
  const c = Math.max(0, Math.min(3, t));
  const i = Math.min(2, Math.floor(c));
  const f = c - i;
  const a = SKILLS[i], b = SKILLS[i + 1];
  const out: Record<string, number | string> = { id: `t${c.toFixed(2)}` };
  for (const k of Object.keys(a) as (keyof SkillModel)[]) {
    if (k === 'id') continue;
    out[k] = lerp(a[k] as number, b[k] as number, f);
  }
  return out as unknown as SkillModel;
}

/** Standard normal via Box-Muller on the seeded Rng. */
export function gauss(rng: Rng): number {
  const u = Math.max(1e-12, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const lognormal = (rng: Rng, median: number, sigma: number): number => median * Math.exp(sigma * gauss(rng));

/** Raw reaction in ms measured from the scheduled cue: human reaction plus display/audio lag. */
export function sampleReaction(rng: Rng, s: SkillModel, lagMs: number): number {
  return Math.max(s.reactFloorMs, lognormal(rng, s.reactMedianMs, s.reactSigma)) + lagMs;
}
