import { DUEL_CONFIG } from '../data/duelConfig';
import type { Zone } from './TargetSystem';

export interface Health {
  hp: number;
  max: number;
}

export interface DamageResult {
  dealt: number;
  hpBefore: number;
  hpAfter: number;
  killed: boolean;
}

export function makeHealth(max: number): Health {
  return { hp: max, max };
}

export function isDead(h: Health): boolean {
  return h.hp <= 0;
}

/** Applies damage (clamped at 0). Damage on an already dead target does nothing. */
export function applyDamage(h: Health, amount: number): DamageResult {
  const hpBefore = h.hp;
  // `!(amount > 0)` also rejects NaN (QA-04)
  if (hpBefore <= 0 || !(amount > 0)) return { dealt: 0, hpBefore, hpAfter: hpBefore, killed: false };
  h.hp = Math.max(0, hpBefore - amount);
  return { dealt: hpBefore - h.hp, hpBefore, hpAfter: h.hp, killed: h.hp <= 0 };
}

/** Damage of a player shot on a zone. Prop zones deal no damage to the enemy. */
export function shotDamage(zone: Zone | null, crit: boolean, cfg = DUEL_CONFIG): number {
  if (!zone) return 0;
  return cfg.damage.baseDamage * zone.multiplier * (crit ? cfg.damage.critMultiplier : 1);
}
