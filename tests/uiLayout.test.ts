import { describe, it, expect } from 'vitest';
import {
  LOGICAL_H, LOGICAL_W, MIN_GAP, MIN_INSETS, MIN_TARGET, ZONES, auditHits, clipChars, fillStack, formatCoins, inflateToMin,
  mirrorRect, pairSlots, pointInRect, rectGap, safeRect, stackFromBottom, zoneOfY,
} from '../src/ui/layout';
import type { Rect } from '../src/ui/layout';
import { initialButton, needsConfirm, purchaseTap, initialConfirm, reduceButton, canAfford, CONFIRM_WINDOW_MS } from '../src/ui/buttonLogic';
import { buyButtonState, SHOP_MAX_ITEMS } from '../src/ui/shopLogic';

describe('zones and safe rect', () => {
  it('zones tile the canvas without gaps', () => {
    const z = Object.values(ZONES);
    expect(z[0]!.y0).toBe(0);
    for (let i = 1; i < z.length; i++) expect(z[i]!.y0).toBe(z[i - 1]!.y1);
    expect(z[z.length - 1]!.y1).toBe(LOGICAL_H);
  });
  it('classifies y into the UX_FLOW thumb zones', () => {
    expect(zoneOfY(10)).toBe('deadTop');
    expect(zoneOfY(200)).toBe('stretch');
    expect(zoneOfY(300)).toBe('reach');
    expect(zoneOfY(500)).toBe('easy');
    expect(zoneOfY(630)).toBe('deadBottom');
  });
  it('default safe rect honours the 24/12 margins', () => {
    expect(safeRect()).toEqual({ x: 12, y: 24, w: 336, h: 592 });
  });
});

describe('hit rects', () => {
  it('inflates small visuals to 44x44 around their centre', () => {
    const r = inflateToMin({ x: 100, y: 100, w: 20, h: 20 });
    expect(r).toEqual({ x: 88, y: 88, w: 44, h: 44 });
    const big = { x: 0, y: 0, w: 100, h: 60 };
    expect(inflateToMin(big)).toEqual(big);
  });
  it('pointInRect is half-open', () => {
    const r = { x: 10, y: 10, w: 10, h: 10 };
    expect(pointInRect(10, 10, r)).toBe(true);
    expect(pointInRect(20, 20, r)).toBe(false);
  });
  it('rectGap measures separation and overlap', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectGap(a, { x: 18, y: 0, w: 10, h: 10 })).toBe(8);
    expect(rectGap(a, { x: 5, y: 5, w: 10, h: 10 })).toBeLessThan(0);
    expect(rectGap(a, { x: 13, y: 14, w: 10, h: 10 })).toBe(5);
  });
  it('audit flags small, out-of-safe and crowded targets', () => {
    const safe = safeRect();
    const ok: Rect = { x: 40, y: 500, w: 100, h: 48 };
    expect(auditHits([{ label: 'a', rect: ok }], safe)).toEqual([]);
    expect(auditHits([{ label: 'tiny', rect: { x: 40, y: 400, w: 30, h: 30 } }], safe).length).toBeGreaterThan(0);
    expect(auditHits([{ label: 'edge', rect: { x: 0, y: 500, w: 100, h: 48 } }], safe).join()).toContain('outside safe');
    expect(auditHits([{ label: 'low', rect: { x: 40, y: 600, w: 100, h: 48 } }], safe).join()).toContain('outside safe');
    const close = auditHits([{ label: 'a', rect: ok }, { label: 'b', rect: { x: 145, y: 500, w: 100, h: 48 } }], safe);
    expect(close.join()).toContain('gap');
    const grouped = auditHits([{ label: 'a', rect: ok, group: 'g' }, { label: 'b', rect: { x: 145, y: 500, w: 100, h: 48 }, group: 'g' }], safe);
    expect(grouped).toEqual([]);
  });
});

describe('stacking', () => {
  it('stackFromBottom anchors to the safe bottom with gaps', () => {
    const tops = stackFromBottom(safeRect(), [56, 48, 48], 8);
    expect(tops).toEqual([448, 512, 568]);
    expect(tops[2]! + 48).toBe(616);
  });
  it('primary action of the menu stack sits in the thumb zone with default insets', () => {
    const [primary] = stackFromBottom(safeRect(), [56, 48, 48], 8);
    expect(primary).toBeGreaterThanOrEqual(ZONES.easy.y0);
  });
  it('bigger bottom insets move the stack up and stay inside safe', () => {
    const safe = safeRect({ ...MIN_INSETS, bottom: 40 });
    const tops = stackFromBottom(safe, [56, 48, 48], 8);
    expect(tops[2]! + 48).toBe(600);
  });
  it('pairSlots fills the width, gap apart, and mirrors in left-hand mode', () => {
    const [a, b] = pairSlots(12, 336, 8);
    expect(a.w + b.w + 8).toBe(336);
    expect(b.x - (a.x + a.w)).toBe(8);
    const [la, lb] = pairSlots(12, 336, 8, true);
    expect(la.x).toBe(b.x);
    expect(lb.x).toBe(a.x);
  });
  it('mirrorRect flips inside the canvas', () => {
    expect(mirrorRect({ x: 12, y: 0, w: 100, h: 48 }, true)).toEqual({ x: 248, y: 0, w: 100, h: 48 });
    expect(mirrorRect({ x: 12, y: 0, w: 100, h: 48 }, false).x).toBe(12);
    const r = { x: 30, y: 5, w: 80, h: 44 };
    expect(mirrorRect(mirrorRect(r, true), true)).toEqual(r);
  });
  it('fillStack: equal items, capped height, centred, never overflowing', () => {
    const s = fillStack(3, 100, 500, 8, 124, 96);
    expect(s.itemH).toBe(124);
    const end = s.tops[2]! + s.itemH;
    expect(s.tops[0]!).toBeGreaterThanOrEqual(100);
    expect(end).toBeLessThanOrEqual(500);
    const tight = fillStack(5, 0, 308, 8, 64, 44);
    expect(tight.itemH).toBe(55);
    expect(tight.tops[4]! + tight.itemH).toBeLessThanOrEqual(308);
    expect(fillStack(0, 0, 100, 8, 50).tops).toEqual([]);
  });
  it('shop rows at the maximum count still make 44px targets 8px apart', () => {
    const s = fillStack(SHOP_MAX_ITEMS, 0, 308, MIN_GAP, 64, MIN_TARGET);
    expect(s.itemH).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(s.tops[SHOP_MAX_ITEMS - 1]! + s.itemH).toBeLessThanOrEqual(308);
  });
});

describe('formatting', () => {
  it('formatCoins groups thousands', () => {
    expect(formatCoins(0)).toBe('0');
    expect(formatCoins(999)).toBe('999');
    expect(formatCoins(1240)).toBe('1,240');
    expect(formatCoins(1234567)).toBe('1,234,567');
    expect(formatCoins(-5000)).toBe('-5,000');
    expect(formatCoins(Number.NaN)).toBe('0');
  });
  it('clipChars truncates with ..', () => {
    expect(clipChars('Hair Trigger', 20)).toBe('Hair Trigger');
    expect(clipChars('Tin Star of the Territory', 20)).toBe('Tin Star of the Te..');
  });
});

describe('button state machine', () => {
  it('fires on up with the same pointer only', () => {
    let s = initialButton();
    let r = reduceButton(s, { type: 'down', id: 1 });
    expect(r.feedback).toBe('click');
    s = r.state;
    expect(s.phase).toBe('pressed');
    expect(reduceButton(s, { type: 'up', id: 2 }).fire).toBe(false);
    r = reduceButton(s, { type: 'up', id: 1 });
    expect(r.fire).toBe(true);
    expect(r.state.phase).toBe('idle');
  });
  it('cancels when the pointer leaves', () => {
    const s = reduceButton(initialButton(), { type: 'down', id: 1 }).state;
    const left = reduceButton(s, { type: 'leave', id: 1 });
    expect(left.state.phase).toBe('idle');
    expect(reduceButton(left.state, { type: 'up', id: 1 }).fire).toBe(false);
  });
  it('disabled buttons never fire and report denied', () => {
    const s = initialButton(false);
    const d = reduceButton(s, { type: 'down', id: 1 });
    expect(d.feedback).toBe('denied');
    expect(reduceButton(d.state, { type: 'up', id: 1 }).fire).toBe(false);
    expect(reduceButton(s, { type: 'enable' }).state.phase).toBe('idle');
    expect(reduceButton(initialButton(), { type: 'disable' }).state.phase).toBe('disabled');
  });
  it('ignores a second finger while pressed', () => {
    const s = reduceButton(initialButton(), { type: 'down', id: 1 }).state;
    const r = reduceButton(s, { type: 'down', id: 2 });
    expect(r.state.pointerId).toBe(1);
    expect(r.feedback).toBeNull();
  });
});

describe('purchase confirmation', () => {
  it('needs a second tap above 50 coins only', () => {
    expect(needsConfirm(50)).toBe(false);
    expect(needsConfirm(51)).toBe(true);
    expect(purchaseTap(initialConfirm(), 'a', 30, 0).action).toBe('buy');
    const first = purchaseTap(initialConfirm(), 'a', 60, 1000);
    expect(first.action).toBe('arm');
    expect(purchaseTap(first.state, 'a', 60, 1500).action).toBe('buy');
  });
  it('re-arms on another item or after the window', () => {
    const first = purchaseTap(initialConfirm(), 'a', 60, 1000);
    expect(purchaseTap(first.state, 'b', 60, 1200).action).toBe('arm');
    expect(purchaseTap(first.state, 'a', 60, 1000 + CONFIRM_WINDOW_MS + 1).action).toBe('arm');
  });
  it('canAfford handles edge values', () => {
    expect(canAfford(45, 45)).toBe(true);
    expect(canAfford(44, 45)).toBe(false);
    expect(canAfford(Number.NaN, 1)).toBe(false);
  });
});

describe('buy button state', () => {
  const item = { id: 'a', name: 'A', description: '', kind: 'perk' as const, price: 60 };
  it('covers none / sold / poor / ready / confirm', () => {
    expect(buyButtonState(undefined, 100, null).enabled).toBe(false);
    expect(buyButtonState({ ...item, sold: true }, 100, null).label).toBe('SOLD OUT');
    const poor = buyButtonState(item, 42, null);
    expect(poor.enabled).toBe(false);
    expect(poor.label).toBe('NEED $18 MORE');
    expect(buyButtonState(item, 100, null)).toMatchObject({ enabled: true, reason: 'ready', label: 'BUY $60' });
    expect(buyButtonState(item, 100, 'a')).toMatchObject({ enabled: true, reason: 'confirm' });
    expect(buyButtonState({ ...item, price: 30 }, 100, '30')).toMatchObject({ reason: 'ready' });
  });
});

describe('canvas constants', () => {
  it('logical size is 360x640 and min target 44', () => {
    expect(LOGICAL_W).toBe(360);
    expect(LOGICAL_H).toBe(640);
    expect(MIN_TARGET).toBe(44);
  });
});
