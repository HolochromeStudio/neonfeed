import { SPECIES } from '../data';
import type { StatusId } from '../types';

export interface ContainInput {
  species: string; hp: number; maxHp: number; stab: number; status: StatusId | null;
  rootKeys: number; moduleMult: number; difficulty: 'CASUAL' | 'STANDARD' | 'EXPERT';
}
export function containChance(i: ContainInput): number {
  const base = SPECIES[i.species].contain / 255;
  const hpFrac = i.maxHp ? i.hp / i.maxHp : 1;
  const hpTerm = 1.7 - 1.2 * hpFrac;
  const stabTerm = 0.55 + (1 - i.stab / 100) * 1.6;
  const st = i.status === 'FROZEN' || i.status === 'CACHED' ? 1.5 : i.status ? 1.2 : 1;
  const dbg = 1 + 0.12 * i.rootKeys;
  const diff = i.difficulty === 'CASUAL' ? 1.3 : i.difficulty === 'EXPERT' ? 0.9 : 1;
  return Math.max(0.02, Math.min(0.98, base * hpTerm * stabTerm * st * dbg * i.moduleMult * diff));
}
/** Number of wobbles before it breaks free (0-3). 3 and ok=true -> contained. */
export function rollContain(p: number, rand: () => number): { shakes: number; ok: boolean } {
  if (rand() < p) return { shakes: 3, ok: true };
  const r = rand();
  const shakes = r < 0.35 ? 0 : r < 0.7 ? 1 : 2;
  return { shakes, ok: false };
}
