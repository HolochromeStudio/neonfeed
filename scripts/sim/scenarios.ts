/**
 * What-if helper (A18). Applies in-memory patches to the live data objects, runs a function, restores them.
 * Used to evidence recommended number changes without editing any game file.
 */
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { ENEMIES } from '../../src/data/enemies';
import { BOSSES } from '../../src/data/bosses';
import { RUN_TUNING } from '../../src/systems/RunSystem';
import { PERK_BY_ID, RARITY_WEIGHTS, type PerkDef } from '../../src/data/perks';
import { REGION_LIST } from '../../src/data/regions';
import { RUN_END, SHOP_BASE, CATALOG } from '../../src/data/economy';

export interface Patch {
  duel?: (c: typeof DUEL_CONFIG) => void;
  enemies?: (e: typeof ENEMIES) => void;
  bosses?: (b: typeof BOSSES) => void;
  run?: (r: Record<string, unknown>) => void;
  rarity?: (w: Record<string, number>) => void;
  regions?: (r: typeof REGION_LIST) => void;
  /** Edits to economy.ts RUN_END (settlement rates) and item prices. */
  economy?: (e: { runEnd: Record<string, number>; shop: Record<string, number>; catalog: typeof CATALOG }) => void;
  /** Per-perk edits, applied to the live PerkDef objects (functions such as `when` are preserved). */
  perks?: Record<string, (p: PerkDef) => void>;
}

/** Runs `fn` with the patch applied; everything is restored afterwards, even on throw. */
export function withPatch<T>(patch: Patch, fn: () => T): T {
  const snap = {
    duel: structuredClone(DUEL_CONFIG),
    enemies: structuredClone(ENEMIES),
    bosses: structuredClone(BOSSES),
    run: { ...(RUN_TUNING as unknown as Record<string, unknown>) },
    rarity: { ...RARITY_WEIGHTS } as Record<string, number>,
    runEnd: { ...(RUN_END as unknown as Record<string, number>) },
    shop: { ...(SHOP_BASE as unknown as Record<string, number>) },
    catalog: structuredClone(CATALOG),
    regions: structuredClone(REGION_LIST),
  };
  const perkSnap = Object.keys(patch.perks ?? {}).map((id) => {
    const p = PERK_BY_ID[id];
    return { p, copy: { ...p, duel: p.duel && { ...p.duel }, duel2: p.duel2 && { ...p.duel2 }, run: p.run && { ...p.run }, run2: p.run2 && { ...p.run2 } } as PerkDef };
  });
  try {
    for (const [id, f] of Object.entries(patch.perks ?? {})) f(PERK_BY_ID[id]);
    patch.duel?.(DUEL_CONFIG);
    patch.enemies?.(ENEMIES);
    patch.bosses?.(BOSSES);
    patch.run?.(RUN_TUNING as unknown as Record<string, unknown>);
    patch.rarity?.(RARITY_WEIGHTS as unknown as Record<string, number>);
    patch.regions?.(REGION_LIST as unknown as typeof REGION_LIST);
    patch.economy?.({ runEnd: RUN_END as unknown as Record<string, number>, shop: SHOP_BASE as unknown as Record<string, number>, catalog: CATALOG });
    return fn();
  } finally {
    for (const { p, copy } of perkSnap) {
      for (const k of Object.keys(p)) delete (p as unknown as Record<string, unknown>)[k];
      Object.assign(p, copy);
    }
    restore(DUEL_CONFIG, snap.duel);
    restore(ENEMIES, snap.enemies);
    restore(BOSSES, snap.bosses);
    restore(RUN_TUNING, snap.run);
    restore(RARITY_WEIGHTS, snap.rarity);
    restore(REGION_LIST, snap.regions);
    restore(RUN_END, snap.runEnd);
    restore(SHOP_BASE, snap.shop);
    restore(CATALOG, snap.catalog);
  }
}

/** Restores `target` to `snapshot` IN PLACE, recursively, so every module holding a reference sees the original again. */
function restore(target: unknown, snapshot: unknown): void {
  if (typeof target !== 'object' || target === null || typeof snapshot !== 'object' || snapshot === null) return;
  const t = target as Record<string, unknown>;
  const s = snapshot as Record<string, unknown>;
  if (Array.isArray(target) && Array.isArray(snapshot) && target.length === snapshot.length) {
    snapshot.forEach((x, i) => restore(target[i], x));
    return;
  }
  for (const k of Object.keys(t)) if (!(k in s)) delete t[k];
  for (const k of Object.keys(s)) {
    const sv = s[k];
    const tv = t[k];
    if (Array.isArray(sv) && Array.isArray(tv) && sv.length === tv.length && sv.every((x) => typeof x === 'object' && x !== null)) {
      // arrays of objects keep their element identity (REGIONS_BY_ID and friends hold references)
      sv.forEach((x, i) => restore(tv[i], x));
    } else if (Array.isArray(sv)) {
      // arrays of primitives are replaced by a fresh copy: a patch may have assigned an array it still owns (tuples like aimErrorPx)
      t[k] = structuredClone(sv);
    } else if (typeof sv === 'object' && sv !== null && !Array.isArray(sv) && typeof tv === 'object' && tv !== null && !Array.isArray(tv)) {
      restore(tv, sv);
    } else t[k] = typeof sv === 'object' && sv !== null ? structuredClone(sv) : sv;
  }
}
