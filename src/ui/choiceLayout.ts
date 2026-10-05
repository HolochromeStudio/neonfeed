// Pure layout for the two choice screens (Reward, Shop). The scenes draw exactly these rects and
// wrapped lines, and tests/uiChoiceFit.test.ts runs every real perk / catalogue entry through the
// same functions at the minimum safe area, so "nothing is cut off" is checked, not hoped for.
//
// Rule: a perk name or description is NEVER truncated where a choice is made. Names wrap (the box
// grows), descriptions are shown in full in a detail parchment after a first tap, and a separate
// TAKE / BUY tap commits (a clear second step).
import { fitText } from './fit';
import { fillStack, formatCoins, stackFromBottom } from './layout';
import type { Rect } from './layout';

export const CHOICE_W = 336;
export const BODY_SCALE = 2;
export const REWARD_MAX_CARDS = 3;

// ---------------------------------------------------------------------------------------------
// Reward: 1-3 perk cards, detail parchment, TAKE plank, optional REROLL/SKIP row.
// ---------------------------------------------------------------------------------------------
export const REWARD_CARD = { plate: 48, plateX: 14, textX: 72, textRight: 14, padTop: 8, padBottom: 8, gap: 8, maxH: 96, rarityRow: 16, nameToRarity: 6 } as const;
export const REWARD_DETAIL = { padX: 14, padY: 12 } as const;
export const REWARD_TOP_OFFSET = 104; // below the hanging sign and the coin row (safe.y + 104)
export const TAKE_H = 56;
export const ROW_H = 48;

export interface PerkText { name: string; description: string }

export interface RewardLayout {
  cards: Rect[];
  /** Wrapped name lines per card (full, never clipped). */
  nameLines: string[][];
  nameW: number;
  detail: Rect;
  detailTextW: number;
  /** Wrapped description lines per card (full). */
  descLines: string[][];
  take: Rect;
  row: Rect | null;
  /** True when the cards do not fit above the detail panel at this safe area. */
  overflow: boolean;
}

export function rewardLayout(safe: Rect, perks: readonly PerkText[], hasRow: boolean): RewardLayout {
  const C = REWARD_CARD;
  const nameW = CHOICE_W - C.textX - C.textRight;
  const detailTextW = CHOICE_W - 2 * REWARD_DETAIL.padX;
  const nameLines = perks.map((p) => fitText(p.name, nameW, BODY_SCALE).lines);
  const descLines = perks.map((p) => fitText(p.description, detailTextW, BODY_SCALE).lines);
  const tallestDesc = descLines.reduce((m, l) => Math.max(m, l.length), 0);
  const detailH = Math.max(64, REWARD_DETAIL.padY * 2 + fitHeight(tallestDesc));
  const heights = hasRow ? [detailH, TAKE_H, ROW_H] : [detailH, TAKE_H];
  const tops = stackFromBottom(safe, heights, 8);
  const detailTop = tops[0]!;
  const x = safe.x + Math.round((safe.w - CHOICE_W) / 2);
  const need = perks.reduce<number>((m, _p, i) => Math.max(m, C.padTop + fitHeight(nameLines[i]!.length) + C.nameToRarity + C.rarityRow + C.padBottom), C.plate + 8);
  const top = safe.y + REWARD_TOP_OFFSET;
  const bottom = detailTop - 8;
  const st = fillStack(perks.length, top, bottom, C.gap, C.maxH, need);
  const overflow = perks.length > 0 && need * perks.length + C.gap * (perks.length - 1) > bottom - top;
  return {
    cards: st.tops.map((y) => ({ x, y, w: CHOICE_W, h: st.itemH })),
    nameLines,
    nameW,
    detail: { x, y: detailTop, w: CHOICE_W, h: detailH },
    detailTextW,
    descLines,
    take: { x: Math.round((360 - 280) / 2), y: tops[1]!, w: 280, h: TAKE_H },
    row: hasRow ? { x: safe.x, y: tops[2]!, w: safe.w, h: ROW_H } : null,
    overflow,
  };
}

/** Pixel height of n wrapped body lines. */
function fitHeight(n: number): number {
  return n <= 0 ? 0 : (n - 1) * 9 * BODY_SCALE + 7 * BODY_SCALE;
}

// ---------------------------------------------------------------------------------------------
// Shop: list of rows (name wraps, price right), tap -> full detail sheet with BUY + BACK.
// ---------------------------------------------------------------------------------------------
export const SHOP_ROW = { plate: 40, plateX: 14, textX: 60, padY: 8, gap: 8, maxH: 72, minH: 44, subRow: 16, priceRight: 10, priceGap: 6 } as const;
export const SHEET = { padX: 16, padY: 14, plate: 56, headGap: 12, rule: 10, footer: 28 } as const;
export const SHOP_LIST_TOP_OFFSET = 102; // safe.y + 102: below the sign and the coin row

export interface ShopText { name: string; description: string; price: number }

export interface ShopLayout {
  rows: Rect[];
  rowNameW: number;
  rowNameLines: string[][];
  priceW: number;
  /** Sheet geometry for the tallest item (the sheet is sized per item by `sheetLayout`). */
  listBottom: number;
  buy: Rect;
  back: Rect;
  rowBar: Rect;
  overflow: boolean;
}

export const priceLabel = (price: number): string => `$${formatCoins(price)}`;
const priceChars = (price: number): number => priceLabel(price).length;

export function shopLayout(safe: Rect, items: readonly ShopText[]): ShopLayout {
  const R = SHOP_ROW;
  const priceW = items.reduce<number>((m, it) => Math.max(m, priceChars(it.price) * 12 - 2), 0);
  const rowNameW = CHOICE_W - R.textX - R.priceRight - R.priceGap - priceW;
  const rowNameLines = items.map((it) => fitText(it.name, rowNameW, BODY_SCALE).lines);
  const need = items.reduce<number>((m, _it, i) => Math.max(m, R.padY * 2 + fitHeight(rowNameLines[i]!.length)), R.minH);
  const [buyTop, barTop] = stackFromBottom(safe, [TAKE_H, ROW_H], 8) as [number, number];
  const listTop = safe.y + SHOP_LIST_TOP_OFFSET;
  const listBottom = barTop - 8;
  const x = safe.x + Math.round((safe.w - CHOICE_W) / 2);
  const st = fillStack(items.length, listTop, listBottom, R.gap, R.maxH, need);
  const overflow = items.length > 0 && need * items.length + R.gap * (items.length - 1) > listBottom - listTop;
  return {
    rows: st.tops.map((y) => ({ x, y, w: CHOICE_W, h: st.itemH })),
    rowNameW,
    rowNameLines,
    priceW,
    listBottom,
    buy: { x: Math.round((360 - 280) / 2), y: buyTop, w: 280, h: TAKE_H },
    back: { x: Math.round((360 - 200) / 2), y: barTop, w: 200, h: ROW_H },
    rowBar: { x: safe.x, y: barTop, w: safe.w, h: ROW_H },
    overflow,
  };
}

export interface SheetLayout {
  rect: Rect;
  nameW: number;
  nameLines: string[];
  subY: number;
  ruleY: number;
  descX: number;
  descY: number;
  descW: number;
  descLines: string[];
  footerY: number;
  /** True if the sheet would be taller than the room above the BUY plank. */
  overflow: boolean;
}

/** Detail sheet for one item: sits bottom-anchored right above the BUY plank. */
export function sheetLayout(safe: Rect, item: ShopText, buyTop: number): SheetLayout {
  const S = SHEET;
  const x = safe.x + Math.round((safe.w - CHOICE_W) / 2);
  const nameW = CHOICE_W - S.padX - S.plate - S.headGap - S.padX;
  const nameLines = fitText(item.name, nameW, BODY_SCALE).lines;
  const descW = CHOICE_W - 2 * S.padX;
  const descLines = fitText(item.description, descW, BODY_SCALE).lines;
  // header block: name lines + 6 gap + sub label row; at least as tall as the icon plate
  const headH = Math.max(S.plate, fitHeight(nameLines.length) + 6 + 16);
  const descY = S.padY + headH + S.rule;
  const h = descY + fitHeight(descLines.length) + 14 + S.footer + S.padY;
  const room = buyTop - 8 - (safe.y + SHOP_LIST_TOP_OFFSET);
  const y = buyTop - 8 - h;
  return {
    rect: { x, y, w: CHOICE_W, h },
    nameW,
    nameLines,
    subY: S.padY + fitHeight(nameLines.length) + 6,
    ruleY: S.padY + headH + 3,
    descX: S.padX,
    descY,
    descW,
    descLines,
    footerY: descY + fitHeight(descLines.length) + 14,
    overflow: h > room,
  };
}

// ---------------------------------------------------------------------------------------------
// Results: text boxes shared with the scene and tests (real wanted names, regions, mission titles).
// ---------------------------------------------------------------------------------------------
export const RESULTS_FIT = { causeW: CHOICE_W, regionW: CHOICE_W - 28 - 72 - 12, bountyW: CHOICE_W - 4 - 4 - 60 - 8 } as const;
export const POSTER_W = { normal: 208, wide: 272 } as const;

/** Poster width for a name: the normal poster unless the name would need 3 lines, then the wide one. */
export function posterWidthFor(name: string): number {
  return fitText(name, POSTER_W.normal - 20, BODY_SCALE).lines.length > 2 ? POSTER_W.wide : POSTER_W.normal;
}
