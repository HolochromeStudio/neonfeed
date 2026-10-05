/**
 * FrameClock: duel time from a real-time source (QA_REPORT Gate B, extraction 1 and 2). Pure, no Phaser/DOM.
 *
 * Duel time is real time minus the time that must never be replayed: a gap between two reads longer than
 * `maxFrameMs` (a hitch, a backgrounded tab) is compressed to that cap, and a pause/resume pair (tab hidden)
 * removes the whole hidden interval. `now()` is monotonic for monotonic input.
 */
export class FrameClock {
  private t0 = 0;
  private lastReal = 0;
  private skew = 0;
  private paused = false;
  private frozen = 0;

  /** @param maxFrameMs largest real gap one read may advance the clock by. @param t0 real-time origin (e.g. performance.now() at start). */
  constructor(private readonly maxFrameMs: number, t0 = 0) {
    this.t0 = t0;
  }

  /** Starts a new timeline at real time `t0`: duel time 0, no skew. */
  reset(t0: number): void {
    this.t0 = t0;
    this.lastReal = 0;
    this.skew = 0;
    this.paused = false;
    this.frozen = 0;
  }

  get origin(): number {
    return this.t0;
  }
  get skewMs(): number {
    return this.skew;
  }
  get isPaused(): boolean {
    return this.paused;
  }

  /** Duel time at real time `perfNow` (e.g. performance.now()). Non-finite input returns the last value. */
  now(perfNow: number): number {
    if (this.paused) return this.frozen;
    if (!Number.isFinite(perfNow)) return this.lastReal - this.skew;
    const real = perfNow - this.t0;
    if (real < this.lastReal) return this.lastReal - this.skew; // never backwards
    const gap = real - this.lastReal;
    if (gap > this.maxFrameMs) this.skew += gap - this.maxFrameMs;
    this.lastReal = real;
    return real - this.skew;
  }

  /** Freezes duel time (tab hidden). Reads return the frozen value until `resume`. */
  pause(): void {
    if (this.paused) return;
    this.frozen = this.lastReal - this.skew;
    this.paused = true;
  }

  /** Resumes at real time `perfNow`: the hidden interval never counts. */
  resume(perfNow: number): void {
    if (!this.paused) return;
    this.paused = false;
    if (!Number.isFinite(perfNow)) return;
    const real = perfNow - this.t0;
    if (real > this.lastReal) this.skew += real - this.lastReal;
    this.lastReal = Math.max(this.lastReal, real);
  }

  /** `eventTime` against this clock (the DOM timestamp of an input, `now` = duel time already read). */
  eventTime(now: number, rawTimeStamp: unknown): number {
    return eventTime(now, rawTimeStamp, this.t0, this.skew);
  }
}

/**
 * Duel time of an input event from its DOM timestamp (same origin as performance.now).
 * A missing/non-finite timestamp falls back to `now`; an event never lands later than `now`.
 */
export function eventTime(now: number, rawTimeStamp: unknown, t0: number, skew: number): number {
  if (typeof rawTimeStamp !== 'number' || !Number.isFinite(rawTimeStamp)) return now;
  return Math.min(now, rawTimeStamp - t0 - skew);
}
