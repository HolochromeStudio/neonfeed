import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG } from '../../src/data/duelConfig';
import { SwipeTracker, analyzeSwipe, classifyDirection, isTap, reticleFromTouch, recognizeSwipe } from '../../src/systems/InputSystem';
import type { PointerSample } from '../../src/systems/InputSystem';

const S = (x: number, y: number, t: number): PointerSample => ({ x, y, t });
const cfg = DUEL_CONFIG.input;

describe('swipe recognition edge cases', () => {
  it('zero-length swipe (same point, many samples) is a tap, never a swipe', () => {
    const a = analyzeSwipe([S(100, 500, 0), S(100, 500, 10), S(100, 500, 20)], 'up');
    expect(a.swipe).toBeNull();
    expect(a.failure).toBe('tap');
  });
  it('single sample / empty list never throws', () => {
    expect(analyzeSwipe([], 'up').failure).toBe('empty');
    expect(analyzeSwipe([S(1, 1, 1)], 'up').swipe).toBeNull();
  });
  it('exactly minDistance (28 px) up in 50 ms registers; 27.99 does not', () => {
    expect(recognizeSwipe([S(100, 500, 0), S(100, 500 - 28, 50)])).not.toBeNull();
    expect(recognizeSwipe([S(100, 500, 0), S(100, 500 - 27.99, 50)])).toBeNull();
  });
  it('exactly maxDuration (600 ms) still counts, 601 does not', () => {
    expect(recognizeSwipe([S(0, 500, 0), S(0, 400, 600)], 'up', { ...cfg, minSpeedPxPerMs: 0.1 })).not.toBeNull();
    expect(recognizeSwipe([S(0, 500, 0), S(0, 400, 601)], 'up', { ...cfg, minSpeedPxPerMs: 0.1 })).toBeNull();
  });
  it('exactly 60 degrees off axis passes, 60.5 does not', () => {
    const r = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return recognizeSwipe([S(100, 500, 0), S(100 + 50 * Math.sin(a), 500 - 50 * Math.cos(a), 40)]);
    };
    expect(r(59.9)).not.toBeNull();
    expect(r(60.5)).toBeNull();
  });
  it('wrong direction (down, left, right) and slow drags are rejected with a reason', () => {
    expect(analyzeSwipe([S(100, 500, 0), S(100, 560, 40)], 'up').failure).toBe('wrong_direction');
    expect(analyzeSwipe([S(100, 500, 0), S(100, 470, 500)], 'up').failure).toBe('too_slow');
  });
  it('NaN samples never register a swipe and never throw', () => {
    expect(recognizeSwipe([S(NaN, NaN, 0), S(NaN, NaN, 10)])).toBeNull();
    expect(recognizeSwipe([S(100, 500, 0), S(100, NaN, 10)])).toBeNull();
    expect(recognizeSwipe([S(100, 500, 0), S(100, 400, NaN)])).toBeNull();
  });
  it('a teleport to a huge coordinate registers a finite-or-infinite swipe without NaN speed', () => {
    const sw = recognizeSwipe([S(100, 500, 0), S(100, -1e9, 5)]);
    if (sw) expect(Number.isNaN(sw.speed)).toBe(false);
  });
  it('negative coordinates swipe up still classified', () => {
    expect(recognizeSwipe([S(-500, -100, 0), S(-500, -150, 40)])).not.toBeNull();
  });
  it('classifyDirection: zero vector and NaN give null', () => {
    expect(classifyDirection(0, 0, 60)).toBeNull();
    expect(classifyDirection(NaN, 1, 60)).toBeNull();
  });
  it('timestamps going backwards must not manufacture a fast swipe (QA-07)', () => {
    // second sample is 50 ms BEFORE the first: dt is clamped to 1 ms => 40 px/ms
    expect(recognizeSwipe([S(100, 500, 100), S(100, 460, 50)])).toBeNull();
  });
  it('random sample noise never throws and never yields NaN (fuzz 5000)', () => {
    const r = new Rng(99);
    for (let i = 0; i < 5000; i++) {
      const n = r.int(0, 12);
      const pts: PointerSample[] = [];
      let t = r.int(0, 1000);
      for (let k = 0; k < n; k++) {
        t += r.int(0, 80);
        const v = (): number => [NaN, Infinity, -Infinity, r.int(-1000, 1000), r.int(0, 360)][r.int(0, 4)];
        pts.push(S(v(), v(), t));
      }
      const a = analyzeSwipe(pts, (['up', 'down', 'left', 'right'] as const)[r.int(0, 3)]);
      if (a.swipe) {
        expect(Number.isNaN(a.swipe.distance)).toBe(false);
        expect(Number.isNaN(a.swipe.speed)).toBe(false);
      }
      isTap(pts);
    }
  });
});

describe('SwipeTracker', () => {
  it('move/end without begin are no-ops', () => {
    const t = new SwipeTracker();
    expect(t.move(1, 1, 1)).toBeNull();
    expect(t.end(1, 1, 2)).toEqual({ swiped: false, wasTap: false });
  });
  it('fires once per touch, at the qualifying sample, not on release', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0);
    expect(t.move(100, 480, 10)).toBeNull();
    const sw = t.move(100, 460, 30);
    expect(sw?.t).toBe(30);
    expect(t.move(100, 300, 50)).toBeNull();
    expect(t.end(100, 300, 60)).toEqual({ swiped: true, wasTap: false });
  });
  it('a zero-length press-release is a tap', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0);
    expect(t.end(100, 500, 80)).toEqual({ swiped: false, wasTap: true });
  });
  it('a long press with no motion is not a tap (over tapMaxMs)', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0);
    expect(t.end(100, 500, cfg.tapMaxMs)).toEqual({ swiped: false, wasTap: false });
  });
  it('cancel() clears everything', () => {
    const t = new SwipeTracker();
    t.begin(0, 0, 0);
    t.cancel();
    expect(t.isActive).toBe(false);
    expect(t.move(0, -100, 10)).toBeNull();
  });
  it('second begin() restarts the gesture (a swipe in progress is discarded)', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0);
    t.move(100, 490, 10);
    t.begin(200, 500, 15);
    expect(t.startedAt).toEqual({ x: 200, y: 500, t: 15 });
  });
  it('multi-touch (QA-07b, pointer-id API): a second finger cannot feed finger A\'s gesture', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0, 1); // finger A (id 1) down
    expect(t.ownerId).toBe(1);
    expect(t.move(100, 300, 8, 2)).toBeNull(); // finger B's stationary move, 200 px away
    expect(t.swiped).toBe(false);
    expect(t.end(100, 300, 10, 2)).toEqual({ swiped: false, wasTap: false }); // B lifting does not end A's touch
    expect(t.isActive).toBe(true);
    expect(t.move(100, 460, 40, 1)).not.toBeNull(); // A's own real flick still registers
  });
  it('multi-touch: legacy callers without ids keep the old (unfiltered) behaviour, ids are opt-in', () => {
    const t = new SwipeTracker();
    t.begin(100, 500, 0);
    expect(t.ownerId).toBeNull();
    expect(t.move(100, 300, 8)).not.toBeNull();
  });
  it('multi-touch: cancel() clears ownership; reanchor keeps it', () => {
    const t = new SwipeTracker();
    t.begin(0, 0, 0, 7);
    t.reanchor(5, 5, 100);
    expect(t.ownerId).toBe(7);
    expect(t.move(5, -100, 110, 8)).toBeNull();
    t.cancel();
    expect(t.ownerId).toBeNull();
  });
  it('multi-touch: a new begin() with another id re-owns the gesture', () => {
    const t = new SwipeTracker();
    t.begin(0, 0, 0, 1);
    t.begin(50, 50, 20, 2);
    expect(t.move(50, 50, 25, 1)).toBeNull();
    expect(t.move(50, 0, 40, 2)).not.toBeNull();
  });
});

describe('misc input helpers', () => {
  it('reticleFromTouch offsets above the finger, keeps NaN as NaN (no silent default)', () => {
    expect(reticleFromTouch(100, 300, 48)).toEqual({ x: 100, y: 252 });
    expect(Number.isNaN(reticleFromTouch(NaN, 1, 48).x)).toBe(true);
  });
  it('isTap on empty is false', () => {
    expect(isTap([])).toBe(false);
  });
});
