// Pure text-fitting helpers (no Phaser): wrap WITHOUT ever truncating, measure the block, and
// report whether a string wraps cleanly. Choice screens (reward, shop) must never cut off a perk
// name or description, so they size their boxes from these numbers and tests check real data.
import { GLYPH_H, LINE_H, maxCharsForWidth, normalizeText, wrapText } from './pixelFont';

/** Wrap to `widthPx` at an integer scale. No line limit, so nothing is dropped or ellipsised. */
export function wrapFull(text: string, widthPx: number, scale: number): string[] {
  return wrapText(text, { maxChars: maxCharsForWidth(widthPx, scale) });
}

/** Height in px of `lines` lines at `scale` (glyph box of the last line, no trailing leading). */
export function blockHeight(lines: number, scale: number): number {
  return lines <= 0 ? 0 : ((lines - 1) * LINE_H + GLYPH_H) * scale;
}

/** True when no single word is wider than the line (so no word is hard-split mid-way). */
export function wrapsCleanly(text: string, widthPx: number, scale: number): boolean {
  const max = maxCharsForWidth(widthPx, scale);
  return normalizeText(text).split(/[\s]+/).every((w) => [...w].length <= max);
}

export interface Fit { lines: string[]; height: number; clean: boolean }

export function fitText(text: string, widthPx: number, scale: number): Fit {
  const lines = wrapFull(text, widthPx, scale);
  return { lines, height: blockHeight(lines.length, scale), clean: wrapsCleanly(text, widthPx, scale) };
}
