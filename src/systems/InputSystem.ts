import type { SwipeConfig } from '../data/duelConfig';
import { DUEL_CONFIG } from '../data/duelConfig';

/** Pure swipe recognition over pointer samples (no Phaser, no clock). */

export interface PointerSample {
  x: number;
  y: number;
  /** Milliseconds, any monotonic origin. */
  t: number;
}

export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export interface Swipe {
  dir: SwipeDir;
  distance: number;
  speed: number;
  /** Time of the sample at which the swipe first qualified (draw registers here, not on release). */
  t: number;
  /** Time of the first sample (touch start). */
  startT: number;
}

export type SwipeFailure = 'empty' | 'too_short' | 'too_slow' | 'wrong_direction' | 'tap';

export interface SwipeAnalysis {
  swipe: Swipe | null;
  /** Why no swipe was recognised (null when recognised). */
  failure: SwipeFailure | null;
}

const DIR_ANGLE: Record<SwipeDir, number> = { right: 0, down: 90, left: 180, up: -90 };

/** Direction of a vector snapped to an axis, or null if outside `toleranceDeg` of every axis (only the wanted one if `only`). */
export function classifyDirection(dx: number, dy: number, toleranceDeg: number, only?: SwipeDir): SwipeDir | null {
  if (dx === 0 && dy === 0) return null;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs: SwipeDir[] = only ? [only] : ['right', 'down', 'left', 'up'];
  let best: SwipeDir | null = null;
  let bestDiff = Infinity;
  for (const d of dirs) {
    let diff = Math.abs(ang - DIR_ANGLE[d]);
    if (diff > 180) diff = 360 - diff;
    if (diff <= toleranceDeg && diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * Finds the first sample at which the gesture so far is a valid swipe in `dir`:
 * net travel >= minDistance, speed over the trailing window >= minSpeed,
 * registered within maxDuration of touch start, within the angle tolerance.
 * Thumb friendly: it does not need a release, and a slow start does not veto a flick.
 */
export function analyzeSwipe(
  samples: readonly PointerSample[],
  dir: SwipeDir = 'up',
  cfg: SwipeConfig = DUEL_CONFIG.input,
): SwipeAnalysis {
  if (samples.length === 0) return { swipe: null, failure: 'empty' };
  const s0 = samples[0];
  let sawDistance = false;
  let sawDirection = false;
  let maxTravel = 0;
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i];
    const elapsed = p.t - s0.t;
    if (elapsed > cfg.maxDurationMs) break;
    const dx = p.x - s0.x;
    const dy = p.y - s0.y;
    const dist = Math.hypot(dx, dy);
    maxTravel = Math.max(maxTravel, dist);
    if (dist < cfg.minDistancePx) continue;
    sawDistance = true;
    if (classifyDirection(dx, dy, cfg.angleToleranceDeg, dir) === null) continue;
    sawDirection = true;
    // speed over the trailing window: from the oldest sample inside the window
    let j = i;
    while (j > 0 && p.t - samples[j - 1].t <= cfg.speedWindowMs) j--;
    const ref = samples[j === i ? i - 1 : j];
    const dt = Math.max(1, p.t - ref.t);
    const speed = Math.hypot(p.x - ref.x, p.y - ref.y) / dt;
    if (speed >= cfg.minSpeedPxPerMs) {
      return { swipe: { dir, distance: dist, speed, t: p.t, startT: s0.t }, failure: null };
    }
  }
  const last = samples[samples.length - 1];
  if (maxTravel < cfg.tapMaxTravelPx && last.t - s0.t < cfg.tapMaxMs) return { swipe: null, failure: 'tap' };
  if (!sawDistance) return { swipe: null, failure: 'too_short' };
  if (!sawDirection) return { swipe: null, failure: 'wrong_direction' };
  return { swipe: null, failure: 'too_slow' };
}

export function recognizeSwipe(samples: readonly PointerSample[], dir: SwipeDir = 'up', cfg: SwipeConfig = DUEL_CONFIG.input): Swipe | null {
  return analyzeSwipe(samples, dir, cfg).swipe;
}

export function isTap(samples: readonly PointerSample[], cfg: SwipeConfig = DUEL_CONFIG.input): boolean {
  if (samples.length === 0) return false;
  const a = samples[0];
  let travel = 0;
  for (const p of samples) travel = Math.max(travel, Math.hypot(p.x - a.x, p.y - a.y));
  return travel < cfg.tapMaxTravelPx && samples[samples.length - 1].t - a.t < cfg.tapMaxMs;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Reticle position for a touch point: sits above the finger so the thumb does not cover it. */
export function reticleFromTouch(x: number, y: number, offsetY: number): { x: number; y: number } {
  return { x, y: y - offsetY };
}

export type DuelPointerEvent =
  | { kind: 'down'; x: number; y: number; t: number }
  | { kind: 'move'; x: number; y: number; t: number }
  | { kind: 'up'; x: number; y: number; t: number };

/**
 * Stateful helper over pointer events for one touch: collects samples and
 * reports the instant the draw flick qualifies. Still pure (time comes in).
 */
export class SwipeTracker {
  private samples: PointerSample[] = [];
  private active = false;
  private fired = false;

  constructor(private readonly dir: SwipeDir = 'up', private readonly cfg: SwipeConfig = DUEL_CONFIG.input) {}

  get isActive(): boolean {
    return this.active;
  }
  get swiped(): boolean {
    return this.fired;
  }
  get startedAt(): PointerSample | undefined {
    return this.samples[0];
  }

  begin(x: number, y: number, t: number): void {
    this.samples = [{ x, y, t }];
    this.active = true;
    this.fired = false;
  }

  /** Returns a Swipe the first time the gesture qualifies, else null. */
  move(x: number, y: number, t: number): Swipe | null {
    if (!this.active) return null;
    this.samples.push({ x, y, t });
    if (this.fired) return null;
    const s = recognizeSwipe(this.samples, this.dir, this.cfg);
    if (s) {
      this.fired = true;
      return s;
    }
    return null;
  }

  /** Ends the touch. `wasTap` is true for a quick short press-release. */
  end(x: number, y: number, t: number): { swiped: boolean; wasTap: boolean } {
    if (!this.active) return { swiped: false, wasTap: false };
    this.samples.push({ x, y, t });
    this.active = false;
    return { swiped: this.fired, wasTap: !this.fired && isTap(this.samples, this.cfg) };
  }

  cancel(): void {
    this.active = false;
    this.samples = [];
    this.fired = false;
  }
}
