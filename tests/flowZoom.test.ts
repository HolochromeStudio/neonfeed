import { describe, it, expect } from 'vitest';
import { fitZoom } from '../src/core/zoom';

describe('fitZoom (D2 integer zoom, letterboxed)', () => {
  it('picks the largest integer zoom that fits both axes', () => {
    expect(fitZoom(360, 640)).toBe(1);
    expect(fitZoom(390, 844)).toBe(1); // 1.08 wide: 1x with letterbox bars
    expect(fitZoom(720, 1280)).toBe(2);
    expect(fitZoom(1080, 1920)).toBe(3);
    expect(fitZoom(1920, 1080)).toBe(1); // landscape desktop: height limits
    expect(fitZoom(1920, 1400)).toBe(2);
    expect(fitZoom(1000, 2000)).toBe(2); // width limits: 2.77 -> 2
  });

  it('the zoomed canvas always fits inside the viewport when zoom >= 1', () => {
    for (let w = 360; w <= 1500; w += 37) {
      for (let h = 640; h <= 2200; h += 53) {
        const z = fitZoom(w, h);
        expect(Number.isInteger(z)).toBe(true);
        expect(360 * z).toBeLessThanOrEqual(w);
        expect(640 * z).toBeLessThanOrEqual(h);
        // maximal: one more would not fit
        expect(360 * (z + 1) > w || 640 * (z + 1) > h).toBe(true);
      }
    }
  });

  it('a viewport smaller than the logical size gets the exact fractional fit (no cropping)', () => {
    const z = fitZoom(320, 568);
    expect(z).toBeLessThan(1);
    expect(360 * z).toBeLessThanOrEqual(320 + 1e-9);
    expect(640 * z).toBeLessThanOrEqual(568 + 1e-9);
  });

  it('bad sizes fall back to 1', () => {
    expect(fitZoom(NaN, 100)).toBe(1);
    expect(fitZoom(0, 0)).toBe(1);
    expect(fitZoom(-5, 900)).toBe(1);
  });
});
