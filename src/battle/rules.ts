import { TYPE_CHART } from '../data';
import type { TypeId, BattleStat, StatusId } from '../types';

export function typeMult(atk: TypeId, defTypes: TypeId[]): number {
  let m = 1;
  const row = TYPE_CHART[atk];
  for (const d of defTypes) { if (row.super.includes(d)) m *= 2; else if (row.resist.includes(d)) m *= 0.5; }
  return m;
}
export function stageMult(n: number): number { return n >= 0 ? (2 + n) / 2 : 2 / (2 - n); }
export const STATUS_IMMUNE_TYPE: Record<StatusId, TypeId | null> = {
  CORRUPTED: 'VIRAL', OVERLOADED: 'STATIC', FROZEN: 'NULL', DESYNCED: 'SIGNAL', LOOPED: 'LOOP', MUTED: null, CACHED: 'CACHE', FRAGMENTED: 'ARCHIVE',
};
export const PERSISTENT_STATUS: StatusId[] = ['CORRUPTED', 'OVERLOADED', 'FRAGMENTED'];
export const STAT_NAMES: Record<BattleStat, string> = { atk: 'ATK', def: 'DEF', sys: 'SYS', spd: 'SPD' };

/** Soft level cap by Root Keys held. */
export const LEVEL_CAPS = [16, 21, 29, 35, 41, 47, 53, 59, 66];
export function levelCap(keys: number) { return LEVEL_CAPS[Math.min(keys, LEVEL_CAPS.length - 1)]; }
export function expMultiplier(level: number, cap: number) {
  if (level < cap) return 1;
  if (level < cap + 4) return 0.5;
  return 0.2;
}
