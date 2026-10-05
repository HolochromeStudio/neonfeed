// Safe-area math: CSS env(safe-area-inset-*) in CSS px -> logical (360x640) insets.
// The math is pure and tested; only readCssInsets() touches the DOM.

import { MIN_INSETS } from './layout';
import type { Insets } from './layout';

export interface CanvasBox { left: number; top: number; width: number; height: number }

export interface InsetInput {
  /** Raw env(safe-area-inset-*) in CSS px. */
  css: Insets;
  /** Window inner size in CSS px. */
  viewport: { w: number; h: number };
  /** Canvas bounding box in CSS px (after FIT/letterboxing). */
  canvas: CanvasBox;
  logical: { w: number; h: number };
  /** Floors (UX_FLOW: 24 top/bottom, 12 sides). */
  min?: Insets;
}

export const ZERO_INSETS: Readonly<Insets> = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Only the part of each device inset that actually overlaps the canvas matters (letterbox bars absorb
 * the rest). Converted to logical px (ceil) and floored by the minimum margins.
 */
export function logicalInsets(inp: InsetInput): Insets {
  const min = inp.min ?? MIN_INSETS;
  const scale = inp.logical.w > 0 ? inp.canvas.width / inp.logical.w : 0;
  if (!(scale > 0)) return { ...min };
  const c = inp.css;
  const cv = inp.canvas;
  const over = (inset: number, gap: number) => Math.max(0, (Number.isFinite(inset) ? inset : 0) - Math.max(0, gap));
  const top = over(c.top, cv.top);
  const left = over(c.left, cv.left);
  const bottom = over(c.bottom, inp.viewport.h - (cv.top + cv.height));
  const right = over(c.right, inp.viewport.w - (cv.left + cv.width));
  const toLogical = (v: number) => Math.ceil(v / scale);
  return {
    top: Math.max(min.top, toLogical(top)),
    right: Math.max(min.right, toLogical(right)),
    bottom: Math.max(min.bottom, toLogical(bottom)),
    left: Math.max(min.left, toLogical(left)),
  };
}

/** Parse "t,r,b,l" (CSS px) override, e.g. for previews and tests. */
export function parseInsetOverride(s: string | null | undefined): Insets | null {
  if (!s) return null;
  const p = s.split(',').map((v) => Number(v.trim()));
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return { top: p[0]!, right: p[1]!, bottom: p[2]!, left: p[3]! };
}

/** Read env(safe-area-inset-*) through a probe element. Returns zeros without a DOM. */
export function readCssInsets(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): Insets {
  if (!doc || !doc.body) return { ...ZERO_INSETS };
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  doc.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const out = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  return out;
}
