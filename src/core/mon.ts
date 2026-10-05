import { SPECIES, MOVES } from '../data';
import type { Bytekin, StatId, MoveSlot, Growth, SpeciesData } from '../types';

let uidCounter = 0;
export const newUid = () => `bk${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export const MAX_LEVEL = 100;
export const PARTY_MAX = 6;

export function expForLevel(g: Growth, lv: number): number {
  const c = lv * lv * lv;
  return Math.floor(g === 'fast' ? 0.8 * c : g === 'slow' ? 1.25 * c : c);
}
export function levelFromExp(g: Growth, exp: number): number {
  let l = 1; while (l < MAX_LEVEL && expForLevel(g, l + 1) <= exp) l++; return l;
}
export function expToNext(m: Bytekin) {
  const g = SPECIES[m.species].growth;
  return m.level >= MAX_LEVEL ? 0 : expForLevel(g, m.level + 1) - m.exp;
}
export function expBar(m: Bytekin): number {
  const g = SPECIES[m.species].growth;
  if (m.level >= MAX_LEVEL) return 1;
  const lo = expForLevel(g, m.level), hi = expForLevel(g, m.level + 1);
  return Math.max(0, Math.min(1, (m.exp - lo) / (hi - lo)));
}

export function calcStat(m: Pick<Bytekin, 'species' | 'level' | 'iv'>, s: StatId): number {
  const b = SPECIES[m.species].base[s];
  const core = Math.floor(((2 * b + m.iv[s]) * m.level) / 100);
  return s === 'hp' ? Math.floor(core * 1.5) + m.level + 14 : core + 5;
}
export const maxHp = (m: Bytekin) => calcStat(m, 'hp');
export const displayName = (m: Bytekin) => m.nick || SPECIES[m.species].name;

export function learnedAt(species: string, level: number): string[] {
  const out: string[] = [];
  for (const [l, mv] of SPECIES[species].learnset) if (l <= level && !out.includes(mv)) out.push(mv);
  return out.slice(-4);
}
export function slotOf(id: string): MoveSlot { const pp = MOVES[id].pp; return { id, pp, maxPp: pp }; }

export function rollIvs(rand: () => number = Math.random): Record<StatId, number> {
  return { hp: (rand() * 16) | 0, atk: (rand() * 16) | 0, def: (rand() * 16) | 0, sys: (rand() * 16) | 0, spd: (rand() * 16) | 0 };
}

export function makeMon(species: string, level: number, opts: { rand?: () => number; anomalous?: boolean; ability?: string; hidden?: boolean; ivs?: Record<StatId, number> } = {}): Bytekin {
  const rand = opts.rand ?? Math.random;
  const sp = SPECIES[species];
  if (!sp) throw new Error(`Unknown species ${species}`);
  const hidden = opts.hidden ?? rand() < 0.04;
  const ability = opts.ability ?? (hidden ? sp.hidden : sp.abilities[(rand() * sp.abilities.length) | 0]);
  const exp = expForLevel(sp.growth, level);
  const m: Bytekin = {
    uid: newUid(), species, level, exp, hp: 1, iv: opts.ivs ?? rollIvs(rand),
    moves: learnedAt(species, level).map(slotOf), ability, hiddenProcess: hidden && ability === sp.hidden && !sp.abilities.includes(sp.hidden),
    status: null, anomalous: opts.anomalous ?? rand() < 1 / 512, fav: false, lowStabBattles: 0,
  };
  m.hp = maxHp(m);
  return m;
}

export function healFull(m: Bytekin) {
  m.hp = maxHp(m); m.status = null; m.moves.forEach((s) => (s.pp = s.maxPp));
}

export interface LevelUpResult { newLevel: number; learn: string[] }
/** Adds exp, levels up. Returns each level reached with moves learnable at that level. HP rises by the gain. */
export function addExp(m: Bytekin, amount: number): LevelUpResult[] {
  const g = SPECIES[m.species].growth;
  const out: LevelUpResult[] = [];
  m.exp += Math.max(0, Math.floor(amount));
  for (;;) {
    const target = levelFromExp(g, m.exp);
    if (target <= m.level) break;
    const oldMax = maxHp(m);
    m.level++;
    m.hp = m.hp > 0 ? m.hp + (maxHp(m) - oldMax) : 0;
    const learn = SPECIES[m.species].learnset.filter(([l, mv]) => l === m.level && !m.moves.some((s) => s.id === mv)).map(([, mv]) => mv);
    out.push({ newLevel: m.level, learn });
  }
  return out;
}

export function learnMove(m: Bytekin, move: string, replaceIndex?: number): boolean {
  if (m.moves.some((s) => s.id === move)) return false;
  if (m.moves.length < 4) { m.moves.push(slotOf(move)); return true; }
  if (replaceIndex === undefined) return false;
  m.moves[replaceIndex] = slotOf(move); return true;
}

export interface EvoContext { item?: string; flags?: Record<string, any>; time?: string; weather?: string; map?: string }
export function checkEvolution(m: Bytekin, ctx: EvoContext = {}): string | null {
  const sp: SpeciesData = SPECIES[m.species];
  // alt evolutions (instability) take priority
  const sorted = [...sp.evo].sort((a, b) => (b.lowStab ? 1 : 0) - (a.lowStab ? 1 : 0));
  for (const e of sorted) {
    if (e.item) { if (ctx.item === e.item) return e.to; continue; }
    if (e.lv && m.level < e.lv) continue;
    if (e.lowStab !== undefined && m.lowStabBattles < e.lowStab) continue;
    if (ctx.item) continue;
    if (e.lv || e.lowStab !== undefined) return e.to;
  }
  return null;
}

export function evolveMon(m: Bytekin, to: string) {
  const old = maxHp(m); const ratio = m.hp / old;
  const oldName = SPECIES[m.species].name;
  m.species = to;
  if (m.nick === oldName) m.nick = undefined;
  m.hp = Math.max(1, Math.round(maxHp(m) * ratio));
  m.lowStabBattles = 0;
  const sp = SPECIES[to];
  if (!sp.abilities.includes(m.ability) && m.ability !== sp.hidden) m.ability = sp.abilities[0];
  // learn any moves at or below this level that are new at evolution time (level 1 entries only when slots free)
  for (const [l, mv] of sp.learnset) if (l <= m.level && l > 1 && !m.moves.some((s) => s.id === mv) && m.moves.length < 4 && l >= m.level - 0) m.moves.push(slotOf(mv));
}

export function fixMon(m: Bytekin) { m.hp = Math.min(m.hp, maxHp(m)); }
