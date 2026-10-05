import type { AudioEvent } from '../../src/core/audioEvents';
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import type { DuelConfig } from '../../src/data/duelConfig';
import { BasicOpponent, DuelSystem } from '../../src/systems/DuelSystem';
import type { DuelInput, DuelParams, DuelPhase, OpponentController } from '../../src/systems/DuelSystem';

export class Fixed implements OpponentController {
  readonly id = 'fixed';
  constructor(
    private wait = 1000,
    private draw = 300,
    private shot = 900,
    private err = 0,
    private gap = 650,
  ) {}
  waitMs() { return this.wait; }
  drawMs() { return this.draw; }
  shotDelayMs(_r: Rng, i: number) { return i === 0 ? this.shot : this.gap; }
  aimErrorPx() { return this.err; }
}

export const quietAudio = { emit: (_e: AudioEvent) => {} };
export const CUE = 1000;
// default enemy rect x 218..282, y 304..400
export const HEAD = { x: 250, y: 316 };
export const BODY = { x: 250, y: 350 };
export const LIMB = { x: 224, y: 352 };

export function cfgWith(patch: { [K in keyof DuelConfig]?: Partial<DuelConfig[K]> }): DuelConfig {
  const out = { ...DUEL_CONFIG } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) out[k] = { ...(DUEL_CONFIG as unknown as Record<string, object>)[k], ...(v as object) };
  return out as unknown as DuelConfig;
}

export function mk(p: Partial<DuelParams> & { opp?: OpponentController } = {}): DuelSystem {
  return new DuelSystem({ seed: 1, opponent: p.opp ?? new Fixed(), audio: quietAudio, ...p });
}

export const VALID_PHASES: readonly DuelPhase[] = ['WAIT', 'CUE', 'DRAW', 'AIM', 'SHOT', 'RESOLVE', 'RETRY'];

export interface Recorder {
  resolves: number[]; // per attempt count
  enemyShotFromCue: number[]; // first enemy shot per attempt, cue relative
  times: number[];
  phases: { phase: DuelPhase; prev: DuelPhase }[];
  plans: { waitMs: number; drawMs: number; firstShotMs: number }[];
  heroHits: number;
}

export function record(d: DuelSystem): Recorder {
  const r: Recorder = { resolves: [0], enemyShotFromCue: [], times: [], phases: [], plans: [d.plan], heroHits: 0 };
  let firstSeen = false;
  d.events.on('onPhase', (e) => { r.times.push(e.t); r.phases.push({ phase: e.phase, prev: e.prev }); });
  d.events.on('onResolve', (e) => { r.times.push(e.t); r.resolves[r.resolves.length - 1]++; });
  d.events.on('onRetry', () => { r.resolves.push(0); firstSeen = false; r.plans.push(d.plan); });
  d.events.on('onShot', (e) => {
    r.times.push(e.t);
    if (e.shooter === 'enemy' && !firstSeen) {
      firstSeen = true;
      const cue = d.snapshot().cueAt;
      r.enemyShotFromCue.push(cue === null ? NaN : e.t - cue);
    }
  });
  d.events.on('onHit', (e) => { r.times.push(e.t); if (e.target === 'hero') r.heroHits++; });
  return r;
}

/** Legal phase edges (retry() restarts without an onPhase event, see QA_REPORT QA-06). */
export const LEGAL: Record<DuelPhase, DuelPhase[]> = {
  WAIT: ['CUE'],
  CUE: ['DRAW', 'RESOLVE'],
  DRAW: ['AIM', 'RESOLVE'],
  AIM: ['SHOT', 'RESOLVE'],
  SHOT: ['AIM', 'RESOLVE'],
  RESOLVE: ['RETRY'],
  RETRY: [],
};

const TYPES = ['hold', 'lift', 'draw', 'aim', 'fire', 'retry'] as const;

export function randomCoord(r: Rng): number {
  const k = r.int(0, 11);
  if (k === 0) return NaN;
  if (k === 1) return -r.int(0, 1e6);
  if (k === 2) return r.int(0, 1e9);
  if (k === 3) return Infinity * (r.next() < 0.5 ? 1 : -1);
  if (k < 8) return r.int(200, 300); // around the enemy
  return r.int(0, 360);
}

/** Random timed input log. `wild` adds NaN-free but ugly timing: zero gaps, 5 s jumps, backwards steps. */
export function randomLog(r: Rng, opts: { n?: number; wild?: boolean; hostileCoords?: boolean } = {}): DuelInput[] {
  const n = opts.n ?? r.int(0, 40);
  const out: DuelInput[] = [];
  let t = r.int(0, 1500);
  for (let i = 0; i < n; i++) {
    const g = r.int(0, 9);
    if (g < 3) t += 0;
    else if (g < 7) t += r.int(1, 120);
    else if (g < 9) t += r.int(100, 800);
    else t += opts.wild ? 5000 : r.int(800, 1500);
    let tt = t;
    if (opts.wild && r.next() < 0.08) tt = t - r.int(1, 3000); // backwards
    const type = TYPES[r.int(0, TYPES.length - 1)];
    const cx = () => (opts.hostileCoords ? randomCoord(r) : r.int(150, 330));
    const cy = () => (opts.hostileCoords ? randomCoord(r) : r.int(280, 420));
    switch (type) {
      case 'aim': out.push({ type, t: tt, x: cx(), y: cy() }); break;
      case 'fire': out.push(r.next() < 0.5 ? { type, t: tt } : { type, t: tt, x: cx(), y: cy() }); break;
      default: out.push({ type, t: tt });
    }
  }
  return out;
}

export function randomOpponent(r: Rng): OpponentController {
  const extreme = r.next() < 0.3;
  return new BasicOpponent({
    waitMin: extreme ? r.int(0, 5) : r.int(0, 1500),
    waitMax: extreme ? r.int(0, 50) : r.int(0, 3000),
    shotMs: extreme ? r.int(-500, 100) : r.int(0, 1500),
    shotJitter: extreme ? r.int(0, 2000) : r.int(0, 300),
    maxAimError: r.int(0, 40),
  });
}
