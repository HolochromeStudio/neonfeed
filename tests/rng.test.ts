import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42), b = new Rng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = new Rng(1), b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) { const x = r.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('int is inclusive and bounded', () => {
    const r = new Rng(3); const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });
  it('restores state', () => {
    const r = new Rng(99); r.next(); r.next();
    const st = r.getState();
    const expected = [r.next(), r.int(0, 100), r.next()];
    const r2 = new Rng(0); r2.setState(st);
    expect([r2.next(), r2.int(0, 100), r2.next()]).toEqual(expected);
  });
  it('shuffle is a deterministic permutation and does not mutate', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const s1 = new Rng(5).shuffle(src), s2 = new Rng(5).shuffle(src);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('pick works and throws on empty', () => {
    expect(['a', 'b']).toContain(new Rng(1).pick(['a', 'b']));
    expect(() => new Rng(1).pick([])).toThrow();
  });
});
