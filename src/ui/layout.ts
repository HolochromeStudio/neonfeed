// Pure layout math for the UI (no Phaser). Everything is in 360x640 logical px.

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
export const MIN_TARGET = 44;
export const RECOMMENDED_TARGET = 56;
export const MIN_GAP = 8;
export const PRICE_CONFIRM_ABOVE = 50;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Insets { top: number; right: number; bottom: number; left: number }

/** UX_FLOW 2: never place interactive UI inside these margins of the canvas. */
export const MIN_INSETS: Readonly<Insets> = { top: 24, right: 12, bottom: 24, left: 12 };

export const ZONES = {
  deadTop: { y0: 0, y1: 24 },
  top: { y0: 24, y1: 96 },
  stretch: { y0: 96, y1: 288 },
  reach: { y0: 288, y1: 432 },
  easy: { y0: 432, y1: 616 },
  deadBottom: { y0: 616, y1: 640 },
} as const;
export type ZoneName = keyof typeof ZONES;

export function zoneOfY(y: number): ZoneName {
  for (const [name, z] of Object.entries(ZONES) as Array<[ZoneName, { y0: number; y1: number }]>) {
    if (y >= z.y0 && y < z.y1) return name;
  }
  return y < 0 ? 'deadTop' : 'deadBottom';
}

export const centerY = (r: Rect) => r.y + r.h / 2;
export const rectRight = (r: Rect) => r.x + r.w;
export const rectBottom = (r: Rect) => r.y + r.h;

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && rectRight(inner) <= rectRight(outer) && rectBottom(inner) <= rectBottom(outer);
}

/** Smallest gap between two rects (0 if touching or overlapping; negative = overlap depth). */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - rectRight(a), a.x - rectRight(b));
  const dy = Math.max(b.y - rectBottom(a), a.y - rectBottom(b));
  if (dx < 0 && dy < 0) return Math.max(dx, dy);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

/** Extend a visual rect to a hit rect of at least `min` x `min`, keeping its centre. */
export function inflateToMin(r: Rect, min = MIN_TARGET): Rect {
  const w = Math.max(r.w, min);
  const h = Math.max(r.h, min);
  return { x: Math.round(r.x - (w - r.w) / 2), y: Math.round(r.y - (h - r.h) / 2), w, h };
}

export function safeRect(insets: Insets = MIN_INSETS): Rect {
  return { x: insets.left, y: insets.top, w: LOGICAL_W - insets.left - insets.right, h: LOGICAL_H - insets.top - insets.bottom };
}

/** Mirror a rect horizontally inside the logical canvas (left-hand mode for side-anchored buttons). */
export function mirrorRect(r: Rect, leftHanded: boolean): Rect {
  return leftHanded ? { ...r, x: LOGICAL_W - r.x - r.w } : r;
}

/**
 * Stack items of the given heights bottom-up inside `safe`, `gap` apart.
 * Returns the top y of each item, in the same order as `heights` (first = highest on screen).
 */
export function stackFromBottom(safe: Rect, heights: readonly number[], gap: number): number[] {
  const tops = new Array<number>(heights.length);
  let y = rectBottom(safe);
  for (let i = heights.length - 1; i >= 0; i--) {
    y -= heights[i]!;
    tops[i] = y;
    y -= gap;
  }
  return tops;
}

/** Two side-by-side buttons filling `width`, left-hand mode swaps their order. */
export function pairSlots(x: number, width: number, gap: number, leftHanded = false): [Rect, Rect] {
  const w = Math.floor((width - gap) / 2);
  const a = { x, y: 0, w, h: 0 };
  const b = { x: x + w + gap, y: 0, w: width - gap - w, h: 0 };
  return leftHanded ? [b, a] : [a, b];
}

export interface FilledStack {
  itemH: number;
  gap: number;
  tops: number[];
}

/** Fill [y0,y1) with `count` equal items, each at most maxH (and at least minH when possible). */
export function fillStack(count: number, y0: number, y1: number, gap: number, maxH: number, minH = 0): FilledStack {
  if (count <= 0) return { itemH: 0, gap, tops: [] };
  const avail = y1 - y0 - gap * (count - 1);
  const itemH = Math.max(minH, Math.min(maxH, Math.floor(avail / count)));
  const used = itemH * count + gap * (count - 1);
  const start = y0 + Math.max(0, Math.floor((y1 - y0 - used) / 2));
  return { itemH, gap, tops: Array.from({ length: count }, (_, i) => start + i * (itemH + gap)) };
}

export interface HitInfo {
  label: string;
  rect: Rect;
  /** Items sharing a group may touch/overlap (e.g. inflated hit rects of one control). */
  group?: string;
}

/** UI test checklist (UX_FLOW 5): hit >=44, inside safe rect, >=8px gap between distinct targets. */
export function auditHits(hits: readonly HitInfo[], safe: Rect = safeRect(), minTarget = MIN_TARGET, minGap = MIN_GAP): string[] {
  const problems: string[] = [];
  for (const h of hits) {
    if (h.rect.w < minTarget || h.rect.h < minTarget) problems.push(`${h.label}: ${h.rect.w}x${h.rect.h} smaller than ${minTarget}`);
    if (!rectContains(safe, h.rect)) problems.push(`${h.label}: outside safe rect`);
  }
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const a = hits[i]!;
      const b = hits[j]!;
      if (a.group !== undefined && a.group === b.group) continue;
      if (rectGap(a.rect, b.rect) < minGap) problems.push(`${a.label} / ${b.label}: gap < ${minGap}`);
    }
  }
  return problems;
}

/** Truncate a name with a trailing ".." so it fits `maxChars`. */
export function clipChars(s: string, maxChars: number): string {
  const a = [...s];
  return a.length <= maxChars ? s : a.slice(0, Math.max(0, maxChars - 2)).join('').trimEnd() + '..';
}

/** Thousands separators without Intl (stable in every runtime). */
export function formatCoins(n: number): string {
  const v = Math.trunc(Number.isFinite(n) ? n : 0);
  const s = String(Math.abs(v));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (v < 0 ? '-' : '') + out;
}
