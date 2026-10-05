import { describe, it, expect } from 'vitest';
import { FrameClock, eventTime } from '../src/core/FrameClock';

describe('FrameClock', () => {
  it('tracks real time for normal frames', () => {
    const c = new FrameClock(100, 1000);
    expect(c.now(1000)).toBe(0);
    expect(c.now(1016)).toBe(16);
    expect(c.now(1050)).toBe(50);
  });

  it('compresses a gap longer than maxFrameMs to exactly maxFrameMs', () => {
    const c = new FrameClock(100, 0);
    expect(c.now(50)).toBe(50);
    expect(c.now(5050)).toBe(150); // 5000 ms gap counts as 100
    expect(c.skewMs).toBe(4900);
    expect(c.now(5066)).toBe(166); // normal frames continue from there
  });

  it('a gap of exactly maxFrameMs is not compressed', () => {
    const c = new FrameClock(100, 0);
    c.now(0);
    expect(c.now(100)).toBe(100);
    expect(c.skewMs).toBe(0);
  });

  it('is monotonic for monotonic input and ignores backwards or non-finite reads', () => {
    const c = new FrameClock(100, 0);
    let prev = -1;
    for (const t of [0, 10, 10, 30, 900, 905, 2000, 2001]) {
      const v = c.now(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    const last = c.now(2001);
    expect(c.now(1500)).toBe(last); // backwards read
    expect(c.now(NaN)).toBe(last);
    expect(c.now(Infinity)).toBe(last);
    expect(c.now(2011)).toBe(last + 10);
  });

  it('a hidden tab adds no time on resume', () => {
    const c = new FrameClock(100, 0);
    expect(c.now(40)).toBe(40);
    c.pause();
    expect(c.now(9000)).toBe(40); // frozen while hidden
    c.resume(60_000);
    expect(c.now(60_000)).toBe(40);
    expect(c.now(60_016)).toBe(56);
  });

  it('pause and resume are idempotent', () => {
    const c = new FrameClock(100, 0);
    c.now(10);
    c.resume(500); // not paused: no-op
    expect(c.now(20)).toBe(20);
    c.pause();
    c.pause();
    c.resume(1000);
    c.resume(2000);
    expect(c.now(1010)).toBe(30);
  });

  it('reset zeroes skew and restarts the timeline', () => {
    const c = new FrameClock(100, 0);
    c.now(10_000);
    expect(c.skewMs).toBeGreaterThan(0);
    c.reset(20_000);
    expect(c.skewMs).toBe(0);
    expect(c.now(20_000)).toBe(0);
    expect(c.now(20_030)).toBe(30);
    expect(c.origin).toBe(20_000);
  });

  it('reset also clears a pause', () => {
    const c = new FrameClock(100, 0);
    c.pause();
    c.reset(100);
    expect(c.isPaused).toBe(false);
    expect(c.now(150)).toBe(50);
  });
});

describe('eventTime', () => {
  it('uses now when the timestamp is missing or not finite', () => {
    expect(eventTime(500, undefined, 0, 0)).toBe(500);
    expect(eventTime(500, null, 0, 0)).toBe(500);
    expect(eventTime(500, NaN, 0, 0)).toBe(500);
    expect(eventTime(500, Infinity, 0, 0)).toBe(500);
    expect(eventTime(500, -Infinity, 0, 0)).toBe(500);
    expect(eventTime(500, '480', 0, 0)).toBe(500);
  });

  it('converts a DOM timestamp into duel time (origin and skew removed)', () => {
    expect(eventTime(900, 1480, 1000, 100)).toBe(380);
  });

  it('never lands later than now', () => {
    expect(eventTime(300, 9000, 0, 0)).toBe(300);
  });

  it('may land earlier than now (the input happened before this frame)', () => {
    expect(eventTime(300, 280, 0, 0)).toBe(280);
  });

  it('FrameClock.eventTime applies its own origin and skew', () => {
    const c = new FrameClock(100, 1000);
    c.now(1000);
    const now = c.now(6000); // 5000 gap -> skew 4900
    expect(now).toBe(100);
    expect(c.eventTime(now, 6000 - 20)).toBe(80);
  });
});
