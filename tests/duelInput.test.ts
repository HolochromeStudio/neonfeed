import { describe, it, expect } from 'vitest';
import { analyzeSwipe, classifyDirection, isTap, recognizeSwipe, reticleFromTouch, SwipeTracker } from '../src/systems/InputSystem';
import type { PointerSample } from '../src/systems/InputSystem';

const line = (n: number, dx: number, dy: number, dtMs: number): PointerSample[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: 100 + (dx * i) / n, y: 500 + (dy * i) / n, t: 1000 + (dtMs * i) / n }));

describe('swipe recognition', () => {
  it('recognises a fast upward flick and reports the qualifying instant, not the release', () => {
    const s = line(10, 0, -100, 100);
    const sw = recognizeSwipe(s, 'up');
    expect(sw).not.toBeNull();
    expect(sw!.dir).toBe('up');
    expect(sw!.t).toBeLessThan(s[s.length - 1].t);
    expect(sw!.distance).toBeGreaterThanOrEqual(28);
  });
  it('tolerates a thumb arc (45 degrees off vertical) but not a sideways swipe', () => {
    expect(recognizeSwipe(line(10, 60, -60, 100), 'up')).not.toBeNull();
    const r = analyzeSwipe(line(10, 100, 0, 100), 'up');
    expect(r.swipe).toBeNull();
    expect(r.failure).toBe('wrong_direction');
  });
  it('rejects a swipe that is too short', () => {
    const r = analyzeSwipe(line(5, 0, -20, 60), 'up');
    expect(r.swipe).toBeNull();
    expect(r.failure).toBe('too_short');
  });
  it('rejects a swipe that is too slow', () => {
    const r = analyzeSwipe(line(20, 0, -100, 1500), 'up');
    expect(r.swipe).toBeNull();
    expect(r.failure).toBe('too_slow');
  });
  it('a slow start does not veto a later flick', () => {
    const s: PointerSample[] = [
      { x: 100, y: 500, t: 0 },
      { x: 100, y: 498, t: 200 },
      { x: 100, y: 495, t: 300 },
      { x: 100, y: 470, t: 330 },
      { x: 100, y: 440, t: 360 },
    ];
    const sw = recognizeSwipe(s, 'up');
    expect(sw).not.toBeNull();
    expect(sw!.t).toBe(330);
  });
  it('classifies taps and empty input', () => {
    expect(isTap([{ x: 1, y: 1, t: 0 }, { x: 2, y: 2, t: 80 }])).toBe(true);
    expect(isTap([{ x: 1, y: 1, t: 0 }, { x: 2, y: 2, t: 400 }])).toBe(false);
    expect(analyzeSwipe([], 'up').failure).toBe('empty');
    expect(analyzeSwipe([{ x: 1, y: 1, t: 0 }, { x: 2, y: 1, t: 50 }], 'up').failure).toBe('tap');
  });
  it('classifyDirection snaps to axes within tolerance', () => {
    expect(classifyDirection(0, -10, 60)).toBe('up');
    expect(classifyDirection(10, 0, 60)).toBe('right');
    expect(classifyDirection(-10, 1, 60)).toBe('left');
    expect(classifyDirection(0, 0, 60)).toBeNull();
  });
  it('reticle sits above the finger', () => {
    expect(reticleFromTouch(100, 300, 48)).toEqual({ x: 100, y: 252 });
  });
});

describe('SwipeTracker', () => {
  it('reports the swipe once while dragging, then the end summary', () => {
    const tr = new SwipeTracker('up');
    tr.begin(100, 500, 0);
    expect(tr.move(100, 495, 20)).toBeNull();
    const sw = tr.move(100, 440, 60);
    expect(sw).not.toBeNull();
    expect(tr.move(100, 420, 80)).toBeNull();
    expect(tr.end(100, 420, 90)).toEqual({ swiped: true, wasTap: false });
  });
  it('a quick press-release is a tap, not a swipe', () => {
    const tr = new SwipeTracker('up');
    tr.begin(100, 500, 0);
    expect(tr.end(101, 500, 90)).toEqual({ swiped: false, wasTap: true });
  });
  it('ignores moves without a begin', () => {
    expect(new SwipeTracker('up').move(1, 1, 1)).toBeNull();
  });
});
