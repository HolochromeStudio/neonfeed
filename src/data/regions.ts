/**
 * Region table for the run map (A08). Starting values from docs/GAME_DESIGN.md section 6; A18 tunes.
 * Enemy pools are explicit per difficulty band so regions without many native enemies (Goldspire,
 * Blackwater Bay) still have variety; native affinity in data/enemies.ts is a hint, not a constraint.
 */
import type { EnemyId, RegionId } from './dialogue';

export type PoolBand = 'early' | 'mid' | 'late';

export interface RegionDef {
  id: RegionId;
  name: string;
  /** Layers on the map including the first duel, the rest layer and the boss. */
  nodeCount: number;
  /** Standard duel enemies by band (early = first layers, late = just before the rest). */
  pools: Record<PoolBand, readonly EnemyId[]>;
  /** Elite (skull) enemy. */
  elite: EnemyId;
  /** Boss id; if not in BOSS_IDS (A07 has not built it) `bossFallback` is fought instead. */
  bossId: string;
  bossFallback: EnemyId;
  /** Preferred arena id; resolve with resolveArenaId() so missing arenas fall back. */
  arenaId: string;
  /** Gimmick tag read by the duel scene (design table). */
  gimmick: string;
  /** Map generation weights: relative chance of event / treasure / elite on the branching layers. */
  mix: { event: number; treasure: number; elite: number };
  /** Coin multiplier for rewards (Goldspire: bigger rewards). */
  coinMult: number;
}

const R = (d: RegionDef): RegionDef => d;

export const REGION_LIST: readonly RegionDef[] = [
  R({ id: 'dust_creek', name: 'Dust Creek', nodeCount: 7,
    pools: { early: ['rookie', 'bandit'], mid: ['bandit', 'coward', 'drunk'], late: ['gunslinger', 'sheriff'] },
    elite: 'bounty_hunter', bossId: 'mad_dog_mcgraw', bossFallback: 'sheriff', arenaId: 'dust_creek',
    gimmick: 'wind_drift', mix: { event: 3, treasure: 1, elite: 2 }, coinMult: 1 }),
  R({ id: 'canyon', name: 'Canyon', nodeCount: 7,
    pools: { early: ['bandit', 'coward'], mid: ['gunslinger', 'horse_rider'], late: ['knife_thrower', 'sniper', 'horse_rider'] },
    elite: 'sniper', bossId: 'the_undertaker', bossFallback: 'sniper', arenaId: 'canyon',
    gimmick: 'echo_tell_audio', mix: { event: 3, treasure: 1, elite: 2 }, coinMult: 1 }),
  R({ id: 'railroad', name: 'Railroad', nodeCount: 7,
    pools: { early: ['gunslinger', 'coward'], mid: ['train_guard', 'horse_rider'], late: ['sheriff', 'train_guard', 'dual_wielder'] },
    elite: 'train_guard', bossId: 'the_conductor', bossFallback: 'train_guard', arenaId: 'railroad',
    gimmick: 'platform_sway', mix: { event: 2, treasure: 2, elite: 2 }, coinMult: 1 }),
  R({ id: 'saloon', name: 'Saloon', nodeCount: 7,
    pools: { early: ['drunk', 'bandit'], mid: ['gunslinger', 'coward', 'sheriff'], late: ['dual_wielder', 'sheriff', 'knife_thrower'] },
    elite: 'drunk', bossId: 'lady_luck', bossFallback: 'gunslinger', arenaId: 'saloon_interior',
    gimmick: 'cover_tables', mix: { event: 3, treasure: 1, elite: 2 }, coinMult: 1 }),
  R({ id: 'goldspire', name: 'Goldspire', nodeCount: 7,
    pools: { early: ['bandit', 'gunslinger'], mid: ['sheriff', 'train_guard', 'coward'], late: ['dual_wielder', 'sheriff', 'sniper'] },
    elite: 'bounty_hunter', bossId: 'the_banker', bossFallback: 'bounty_hunter', arenaId: 'goldspire',
    gimmick: 'coin_heavy', mix: { event: 2, treasure: 3, elite: 3 }, coinMult: 1.5 }),
  R({ id: 'widows_peak', name: "Widow's Peak", nodeCount: 7,
    pools: { early: ['coward', 'gunslinger'], mid: ['sniper', 'knife_thrower'], late: ['knife_thrower', 'sniper', 'sheriff'] },
    elite: 'knife_thrower', bossId: 'el_diablo_vanguard', bossFallback: 'knife_thrower', arenaId: 'widows_peak',
    gimmick: 'fog_hides_enemy', mix: { event: 3, treasure: 1, elite: 2 }, coinMult: 1 }),
  R({ id: 'blackwater_bay', name: 'Blackwater Bay', nodeCount: 7,
    pools: { early: ['gunslinger', 'knife_thrower'], mid: ['dual_wielder', 'sniper'], late: ['dual_wielder', 'horse_rider', 'sheriff'] },
    elite: 'dual_wielder', bossId: 'el_diablo', bossFallback: 'bounty_hunter', arenaId: 'dust_creek_night',
    gimmick: 'night_lanterns', mix: { event: 2, treasure: 1, elite: 3 }, coinMult: 1.25 }),
];

export const REGIONS_BY_ID: Readonly<Record<string, RegionDef>> = Object.fromEntries(REGION_LIST.map((r) => [r.id, r]));
/** Region order of a full run; first release plays the first three. */
export const REGION_ORDER: readonly RegionId[] = REGION_LIST.map((r) => r.id);
export const FIRST_RELEASE_REGIONS: readonly RegionId[] = ['dust_creek', 'canyon', 'railroad'];

export function getRegionDef(id: string): RegionDef {
  const r = REGIONS_BY_ID[id];
  if (!r) throw new Error(`Unknown region id: ${id}`);
  return r;
}

/** Arena that exists, else the fallback. `has` answers "is this arena id registered". */
export function resolveArenaId(region: RegionDef, has: (id: string) => boolean, fallback = 'dust_creek'): string {
  return has(region.arenaId) ? region.arenaId : fallback;
}

export function poolBandForLayer(layer: number, nodeCount: number): PoolBand {
  const f = layer / Math.max(1, nodeCount - 1);
  return f < 0.25 ? 'early' : f < 0.6 ? 'mid' : 'late';
}
