import { describe, it, expect } from 'vitest';
import { logicalInsets, parseInsetOverride, readCssInsets } from '../src/ui/safeArea';
import { MIN_INSETS } from '../src/ui/layout';

const L = { w: 360, h: 640 };
const full = { left: 0, top: 0, width: 360, height: 640 };
const css = (top: number, right: number, bottom: number, left: number) => ({ top, right, bottom, left });

describe('logicalInsets', () => {
  it('no device insets -> the 24/12 floors', () => {
    expect(logicalInsets({ css: css(0, 0, 0, 0), viewport: { w: 360, h: 640 }, canvas: full, logical: L })).toEqual(MIN_INSETS);
  });
  it('notch overlapping the canvas at 1:1 maps straight through (above the floor)', () => {
    const i = logicalInsets({ css: css(44, 0, 34, 0), viewport: { w: 360, h: 640 }, canvas: full, logical: L });
    expect(i).toEqual({ top: 44, right: 12, bottom: 34, left: 12 });
  });
  it('converts CSS px to logical px by the canvas scale', () => {
    // canvas drawn at 2x: 44 css px = 22 logical px -> floor of 24 wins; 60 css -> 30 logical
    const canvas = { left: 0, top: 0, width: 720, height: 1280 };
    const i = logicalInsets({ css: css(44, 0, 60, 0), viewport: { w: 720, h: 1280 }, canvas, logical: L });
    expect(i.top).toBe(24);
    expect(i.bottom).toBe(30);
  });
  it('letterbox bars absorb the inset (only the overlap counts)', () => {
    // 390x844 viewport, canvas 390x693 centred: 75.5px bars top and bottom swallow 47/34 insets
    const canvas = { left: 0, top: 75.5, width: 390, height: 693 };
    const i = logicalInsets({ css: css(47, 0, 34, 0), viewport: { w: 390, h: 844 }, canvas, logical: L });
    expect(i).toEqual(MIN_INSETS);
  });
  it('partial overlap: bar smaller than the inset', () => {
    const canvas = { left: 0, top: 10, width: 360, height: 640 };
    const i = logicalInsets({ css: css(44, 0, 0, 0), viewport: { w: 360, h: 660 }, canvas, logical: L });
    expect(i.top).toBe(34);
  });
  it('landscape side insets apply to left/right', () => {
    const i = logicalInsets({ css: css(0, 47, 0, 47), viewport: { w: 360, h: 640 }, canvas: full, logical: L });
    expect(i.left).toBe(47);
    expect(i.right).toBe(47);
  });
  it('rounds up fractional logical px', () => {
    const canvas = { left: 0, top: 0, width: 540, height: 960 }; // 1.5x
    const i = logicalInsets({ css: css(50, 0, 0, 0), viewport: { w: 540, h: 960 }, canvas, logical: L });
    expect(i.top).toBe(34); // 50/1.5 = 33.33 -> 34
  });
  it('is robust to bad input', () => {
    expect(logicalInsets({ css: css(Number.NaN, -5, Number.POSITIVE_INFINITY, 0), viewport: { w: 360, h: 640 }, canvas: full, logical: L }).left).toBe(12);
    expect(logicalInsets({ css: css(50, 0, 0, 0), viewport: { w: 0, h: 0 }, canvas: { left: 0, top: 0, width: 0, height: 0 }, logical: L })).toEqual(MIN_INSETS);
  });
  it('honours custom minimums', () => {
    const i = logicalInsets({ css: css(0, 0, 0, 0), viewport: { w: 360, h: 640 }, canvas: full, logical: L, min: { top: 30, right: 0, bottom: 0, left: 0 } });
    expect(i).toEqual({ top: 30, right: 0, bottom: 0, left: 0 });
  });
});

describe('parseInsetOverride', () => {
  it('parses t,r,b,l and rejects junk', () => {
    expect(parseInsetOverride('44,0,34,0')).toEqual({ top: 44, right: 0, bottom: 34, left: 0 });
    expect(parseInsetOverride('1,2,3')).toBeNull();
    expect(parseInsetOverride('a,b,c,d')).toBeNull();
    expect(parseInsetOverride('-1,0,0,0')).toBeNull();
    expect(parseInsetOverride(null)).toBeNull();
  });
});

describe('readCssInsets', () => {
  it('returns zeros without a DOM', () => {
    expect(readCssInsets(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
