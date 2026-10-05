import { describe, it, expect } from 'vitest';
import {
  ADVANCE, GLYPH_CHARS, GLYPH_H, GLYPH_W, LINE_H, glyphRows, lineWidth, litPixels, maxCharsForWidth, measureText, normalizeText, wrapText,
} from '../src/ui/pixelFont';
import { ICON_BITMAPS, RARITY_SHAPES, bitmapPixels, bitmapSize } from '../src/ui/bitmaps';
import { C, RARITY, contrast } from '../src/ui/UiTheme';
import { WANTED } from '../src/data/wanted';
import { ENEMY_DIALOGUE } from '../src/data/dialogue';
import { S } from '../src/ui/strings';

describe('pixel font data', () => {
  it('every glyph is 5x7', () => {
    for (const c of GLYPH_CHARS) {
      const rows = glyphRows(c);
      expect(rows.length, c).toBe(GLYPH_H);
      for (const r of rows) expect(r.length, c).toBe(GLYPH_W);
    }
  });
  it('covers A-Z, 0-9 and the punctuation the UI uses', () => {
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:-+$%/()"\'<>&*# ') expect(GLYPH_CHARS).toContain(c);
  });
  it('every game string (wanted + dialogue + UI) renders without ? substitutions', () => {
    const texts: string[] = [];
    for (const w of WANTED) texts.push(w.name, w.crime, w.tagline, `$${w.reward} REWARD`);
    for (const d of ENEMY_DIALOGUE) texts.push(...d.intro, ...d.defeat, ...d.victory);
    const walk = (o: unknown): void => { if (typeof o === 'string') texts.push(o); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(S);
    const bad = texts.filter((t) => normalizeText(t).includes('?') && !t.includes('?'));
    expect(bad).toEqual([]);
  });
  it('glyphs are distinct (no copy-paste duplicates among letters/digits)', () => {
    const seen = new Map<string, string>();
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const key = glyphRows(c).join('/');
      expect(seen.get(key), `${c} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, c);
    }
  });
});

describe('text math', () => {
  it('folds lowercase and typographic chars, replaces unknown', () => {
    expect(normalizeText('hi “you” — ok')).toBe('HI "YOU" - OK');
    expect(normalizeText('é')).toBe('?');
  });
  it('width = (6n - 1) * scale', () => {
    expect(lineWidth('', 2)).toBe(0);
    expect(lineWidth('A', 1)).toBe(5);
    expect(lineWidth('AB', 2)).toBe((2 * ADVANCE - 1) * 2);
  });
  it('maxCharsForWidth is the inverse of lineWidth', () => {
    for (const scale of [1, 2, 3, 4]) {
      for (const width of [100, 188, 250, 336]) {
        const n = maxCharsForWidth(width, scale);
        expect(lineWidth('X'.repeat(n), scale)).toBeLessThanOrEqual(width);
        expect(lineWidth('X'.repeat(n + 1), scale)).toBeGreaterThan(width);
      }
    }
  });
  it('wraps on words, hard-splits long words, honours newlines', () => {
    expect(wrapText('HAIR TRIGGER RULES', { maxChars: 12 })).toEqual(['HAIR TRIGGER', 'RULES']);
    expect(wrapText('ABCDEFGHIJ', { maxChars: 4 })).toEqual(['ABCD', 'EFGH', 'IJ']);
    expect(wrapText('A\nB', { maxChars: 10 })).toEqual(['A', 'B']);
  });
  it('maxLines truncates with an ellipsis that fits', () => {
    const lines = wrapText('ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT', { maxChars: 10, maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('...')).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(10);
  });
  it('wanted names fit a 208px poster in at most 2 lines at scale 2 (or are cleanly truncated)', () => {
    for (const w of WANTED) {
      const m = measureText(w.name, 2, 188, 2);
      expect(m.lines.length).toBeLessThanOrEqual(2);
      for (const l of m.lines) expect(lineWidth(l, 2)).toBeLessThanOrEqual(188);
    }
  });
  it('measureText height follows line pitch', () => {
    const m = measureText('A\nB\nC', 2);
    expect(m.height).toBe(2 * LINE_H * 2 + GLYPH_H * 2);
  });
  it('litPixels aligns lines and stays inside the measured box', () => {
    const px = litPixels(['AAAA', 'A'], 'center');
    const w = lineWidth('AAAA', 1);
    for (const [x, y] of px) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(w);
      expect(y).toBeLessThan(LINE_H + GLYPH_H);
    }
    const right = litPixels(['AAAA', 'A'], 'right').filter(([, y]) => y >= LINE_H);
    expect(Math.min(...right.map(([x]) => x))).toBe(w - 5);
    expect(litPixels([''], 'left')).toEqual([]);
  });
});

describe('bitmaps', () => {
  it('every icon is 8x8', () => {
    for (const [k, rows] of Object.entries(ICON_BITMAPS)) expect(bitmapSize(rows), k).toEqual({ w: 8, h: 8 });
  });
  it('rarity shapes are distinct silhouettes (colour-blind cue)', () => {
    const sig = (k: keyof typeof RARITY_SHAPES) => bitmapPixels(RARITY_SHAPES[k]).map((p) => `${p.x},${p.y}`).join(';');
    expect(new Set([sig('common'), sig('rare'), sig('legendary')]).size).toBe(3);
    expect(new Set(Object.values(RARITY).map((r) => r.shape)).size).toBe(3);
    expect(new Set(Object.values(RARITY).map((r) => r.label)).size).toBe(3);
  });
});

describe('palette contrast (UX_FLOW: text >= 4.5:1)', () => {
  const pairs: Array<[string, number, number]> = [
    ['ink on parchment', C.ink, C.parchment],
    ['ink on parchmentLight', C.ink, C.parchmentLight],
    ['ink on parchmentDark', C.ink, C.parchmentDark],
    ['redDark on parchment', C.redDark, C.parchment],
    ['wood label on parchment', C.wood, C.parchment],
    ['midnight label on parchment', C.midnight, C.parchment],
    ['cream on ink badge', C.cream, C.ink],
    ['cream on plank (light board)', C.cream, C.woodLight],
    ['cream on plank (mid board)', C.cream, C.woodMid],
    ['cream on plank (dark board)', C.cream, C.wood],
    ['chalk on slate', C.chalk, C.slate],
    ['chalkDim on slate', C.chalkDim, C.slate],
    ['brassLight on slate', C.brassLight, C.slate],
    ['redText on slate', C.redText, C.slate],
    ['brassLight on woodDeep (coin plaque)', C.brassLight, C.woodDeep],
    ['chalk on woodDark (wall)', C.chalk, C.woodDark],
    ['disabled text on disabled plank', C.disabledText, C.disabledFill],
  ];
  for (const [name, fg, bg] of pairs) {
    it(name, () => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5));
  }
  it('large text (24px+) on wall >= 3:1', () => {
    expect(contrast(C.red, C.woodDark)).toBeGreaterThanOrEqual(3);
    expect(contrast(C.brassLight, C.woodMid)).toBeGreaterThanOrEqual(3);
  });
});
