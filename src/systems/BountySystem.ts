/**
 * BountySystem (A09): daily/weekly bounty board, missions, wanted-poster contracts.
 * Pure over MetaSave. Rotation is seeded by a date-key string ("YYYY-MM-DD") supplied by the caller;
 * nothing here reads the clock. Progress lives in meta.missions (existing shape).
 * Ethics: no streaks, no expiry of earned rewards (completed missions stay claimable), no penalties.
 */
import { Rng } from '../core/rng';
import type { MetaSave } from '../core/SaveManager';
import { getWanted } from '../data/wanted';
import {
  ACHIEVEMENTS, BOARD_POOLS, BOARD_RULES, DAILY_POOL, WEEKLY_POOL, getMissionDef,
  type MissionDef, type MissionEventType,
} from '../data/missions';
import { settleRun, type RunSummary } from './EconomySystem';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export interface MissionView {
  /** Key in meta.missions: `${defId}@${period}` or the def id for achievements. */
  instanceId: string;
  defId: string;
  title: string;
  cadence: MissionDef['cadence'] | 'contract';
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
}

export interface Board {
  dayKey: string;
  weekKey: string;
  daily: MissionView[];
  weekly: MissionView[];
  contracts: MissionView[];
  achievements: MissionView[];
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isDayKey = (s: string): boolean => KEY_RE.test(s);
const pad = (n: number): string => String(n).padStart(2, '0');

/** Monday of the week containing dayKey, as a day key. Pure date arithmetic on the string. */
export function weekKeyOf(dayKey: string): string {
  const m = KEY_RE.exec(dayKey);
  if (!m) return dayKey;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  const d = new Date(t - dow * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Pick n defs with distinct events when possible, deterministic for (pool, seed key). */
function pickDistinct(pool: MissionDef[], n: number, key: string): MissionDef[] {
  const rng = new Rng(hashString(key));
  const shuffled = rng.shuffle(pool);
  const out: MissionDef[] = [];
  const events = new Set<string>();
  for (const m of shuffled) {
    if (out.length >= n) break;
    if (!events.has(m.event + (m.filterId ?? ''))) { out.push(m); events.add(m.event + (m.filterId ?? '')); }
  }
  for (const m of shuffled) { if (out.length >= n) break; if (!out.includes(m)) out.push(m); }
  return out;
}

export interface Contract { enemyId: string; reward: number; tier: 'easy' | 'mid' | 'hard' }

export function contractReward(enemyId: string): number {
  const base = getWanted(enemyId)?.reward ?? 0;
  const r = Math.round((base * BOARD_RULES.contractRate) / 5) * 5;
  return Math.min(BOARD_RULES.contractCap, Math.max(BOARD_RULES.contractMin, r));
}

/** Today's three wanted-poster contracts: one easy, one mid, one hard. Deterministic per dayKey. */
export function contractsFor(dayKey: string): Contract[] {
  const rng = new Rng(hashString(`contracts:${dayKey}`));
  return (['easy', 'mid', 'hard'] as const).map((tier) => {
    const enemyId = rng.pick(BOARD_POOLS[tier]);
    return { enemyId, reward: contractReward(enemyId), tier };
  });
}

export const dailyDefsFor = (dayKey: string): MissionDef[] => pickDistinct(DAILY_POOL, BOARD_RULES.dailyMissions, `daily:${dayKey}`);
export const weeklyDefsFor = (dayKey: string): MissionDef[] =>
  pickDistinct(WEEKLY_POOL, BOARD_RULES.weeklyMissions, `weekly:${weekKeyOf(dayKey)}`);

const contractInstance = (dayKey: string, enemyId: string): string => `bounty_${enemyId}@${dayKey}`;

interface Resolved { def: MissionDef; instanceId: string; contract: boolean }

/** Resolve any instance id (including past days) to a definition. Null when unknown. */
export function resolveMission(instanceId: string): Resolved | null {
  const at = instanceId.indexOf('@');
  const defId = at < 0 ? instanceId : instanceId.slice(0, at);
  const period = at < 0 ? '' : instanceId.slice(at + 1);
  if (defId.startsWith('bounty_')) {
    const enemyId = defId.slice('bounty_'.length);
    const w = getWanted(enemyId);
    if (!w || !isDayKey(period)) return null;
    const def: MissionDef = {
      id: defId, title: `Bring in ${w.name}`, desc: w.crime, cadence: 'daily',
      event: 'wanted_defeated', target: 1, reward: contractReward(enemyId), perRun: true, filterId: enemyId,
    };
    return { def, instanceId, contract: true };
  }
  const def = getMissionDef(defId);
  if (!def) return null;
  if (def.cadence === 'achievement') return at < 0 ? { def, instanceId, contract: false } : null;
  return isDayKey(period) ? { def, instanceId, contract: false } : null;
}

function view(meta: MetaSave, r: Resolved): MissionView {
  const rec = meta.missions[r.instanceId];
  const progress = Math.min(r.def.target, Math.max(0, rec?.progress ?? 0));
  const claimed = rec?.claimed === true;
  return {
    instanceId: r.instanceId, defId: r.def.id, title: r.def.title,
    cadence: r.contract ? 'contract' : r.def.cadence,
    target: r.def.target, reward: r.def.reward, progress, claimed,
    claimable: !claimed && progress >= r.def.target,
  };
}

export function getBoard(meta: MetaSave, dayKey: string): Board {
  const weekKey = weekKeyOf(dayKey);
  const mk = (def: MissionDef, period: string): MissionView => view(meta, { def, instanceId: `${def.id}@${period}`, contract: false });
  return {
    dayKey, weekKey,
    daily: dailyDefsFor(dayKey).map((d) => mk(d, dayKey)),
    weekly: weeklyDefsFor(dayKey).map((d) => mk(d, weekKey)),
    contracts: contractsFor(dayKey).map((c) => {
      const r = resolveMission(contractInstance(dayKey, c.enemyId)) as Resolved;
      return view(meta, r);
    }),
    achievements: ACHIEVEMENTS.map((d) => view(meta, { def: d, instanceId: d.id, contract: false })),
  };
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

export interface MissionEvent { type: MissionEventType; id?: string; count?: number }

/** Convert a finished run into mission events (one batch per run). */
export function eventsFromRun(s: RunSummary): MissionEvent[] {
  if (s.mode === 'practice') return [];
  const ev: MissionEvent[] = [{ type: 'run_played' }];
  if (s.victory) ev.push({ type: 'run_won' });
  const cnt = (n: number): number => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  if (s.defeated.length) ev.push({ type: 'duel_won', count: s.defeated.length });
  if (cnt(s.perfectDraws)) ev.push({ type: 'perfect_draw', count: cnt(s.perfectDraws) });
  if (cnt(s.headshots)) ev.push({ type: 'headshot', count: cnt(s.headshots) });
  if (cnt(s.noDamageDuels)) ev.push({ type: 'no_damage_duel', count: cnt(s.noDamageDuels) });
  for (const id of s.defeated) {
    if (!getWanted(id)) continue;
    ev.push({ type: 'wanted_defeated', id });
    if (getWanted(id)?.kind === 'boss') ev.push({ type: 'boss_defeated', id });
  }
  for (const r of new Set(s.regionsCleared)) ev.push({ type: 'region_clear', id: r });
  return ev;
}

function batchCount(def: MissionDef, events: MissionEvent[]): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== def.event) continue;
    if (def.filterId && e.id !== def.filterId) continue;
    n += Math.max(0, Math.floor(e.count ?? 1));
  }
  return n;
}

/**
 * Apply one batch of events (normally one whole run) to every tracked mission: today's board plus achievements.
 * perRun missions take max(old, batch); others add. Progress never decreases and is capped at target.
 * Feeding single-duel batches is fine for cumulative missions, but perRun ones should get the whole run.
 */
export function applyMissionEvents(meta: MetaSave, events: MissionEvent[], dayKey: string): MetaSave {
  const next = clone(meta);
  if (events.length === 0) return next;
  const tracked: Resolved[] = [];
  for (const d of dailyDefsFor(dayKey)) tracked.push({ def: d, instanceId: `${d.id}@${dayKey}`, contract: false });
  for (const d of weeklyDefsFor(dayKey)) tracked.push({ def: d, instanceId: `${d.id}@${weekKeyOf(dayKey)}`, contract: false });
  for (const c of contractsFor(dayKey)) tracked.push(resolveMission(contractInstance(dayKey, c.enemyId)) as Resolved);
  for (const d of ACHIEVEMENTS) tracked.push({ def: d, instanceId: d.id, contract: false });
  for (const t of tracked) {
    const n = batchCount(t.def, events);
    if (n <= 0) continue;
    const old = next.missions[t.instanceId] ?? { progress: 0, claimed: false };
    if (old.claimed) continue;
    const raw = t.def.perRun ? Math.max(old.progress, n) : old.progress + n;
    next.missions[t.instanceId] = { progress: Math.min(t.def.target, Math.max(old.progress, raw)), claimed: false };
  }
  return next;
}

/** Full run-end pipeline: bank coins and stats (EconomySystem) and advance missions. */
export function settleRunWithBounties(meta: MetaSave, summary: RunSummary, dayKey: string): MetaSave {
  return applyMissionEvents(settleRun(meta, summary), eventsFromRun(summary), dayKey);
}

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

export type ClaimFailure = 'unknown_mission' | 'not_complete' | 'already_claimed';
export interface ClaimResult { ok: boolean; reason?: ClaimFailure; reward: number; meta: MetaSave }

/** Claim a completed mission. Idempotent: a second claim pays nothing. Completed missions never expire. */
export function claimMission(meta: MetaSave, instanceId: string): ClaimResult {
  const next = clone(meta);
  const r = resolveMission(instanceId);
  if (!r) return { ok: false, reason: 'unknown_mission', reward: 0, meta: next };
  const rec = next.missions[instanceId];
  if (rec?.claimed) return { ok: false, reason: 'already_claimed', reward: 0, meta: next };
  if (!rec || rec.progress < r.def.target) return { ok: false, reason: 'not_complete', reward: 0, meta: next };
  next.missions[instanceId] = { progress: r.def.target, claimed: true };
  next.coins = Math.max(0, Math.floor(next.coins)) + r.def.reward;
  next.stats.coins_lifetime = (next.stats.coins_lifetime ?? 0) + r.def.reward;
  return { ok: true, reward: r.def.reward, meta: next };
}

export function claimAll(meta: MetaSave, dayKey: string): { meta: MetaSave; total: number } {
  const b = getBoard(meta, dayKey);
  let cur = meta;
  let total = 0;
  for (const v of [...b.daily, ...b.weekly, ...b.contracts, ...b.achievements]) {
    if (!v.claimable) continue;
    const res = claimMission(cur, v.instanceId);
    cur = res.meta; total += res.reward;
  }
  return { meta: cur === meta ? clone(meta) : cur, total };
}

/**
 * Housekeeping: drop INCOMPLETE entries from past periods so the save does not grow. Completed or claimed
 * entries are kept until claimed (never silently expire earned rewards), and claimed ones are dropped once old.
 */
export function pruneMissions(meta: MetaSave, dayKey: string): MetaSave {
  const next = clone(meta);
  const weekKey = weekKeyOf(dayKey);
  for (const [id, rec] of Object.entries(next.missions)) {
    const at = id.indexOf('@');
    if (at < 0) continue;
    const period = id.slice(at + 1);
    if (period === dayKey || period === weekKey) continue;
    const r = resolveMission(id);
    if (!r || rec.claimed || rec.progress < r.def.target) delete next.missions[id];
  }
  return next;
}
