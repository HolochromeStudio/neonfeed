// Built-in 5x7 bitmap font. Pure data + math (no Phaser, no DOM) so it is unit-testable and
// needs no font files. Text is rendered by PixelText.ts at integer scales (1,2,3,4 = 8,16,24,32 px
// line boxes) so glyphs stay crisp. Western signage is all caps; lowercase is folded to upper.

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const ADVANCE = 6; // glyph + 1px gap
export const LINE_H = 9; // glyph + 2px leading

const g = (s: string): readonly string[] => s.split('/');

const GLYPHS: Record<string, readonly string[]> = {
  ' ': g('...../...../...../...../...../...../.....'),
  A: g('.###./#...#/#...#/#####/#...#/#...#/#...#'),
  B: g('####./#...#/#...#/####./#...#/#...#/####.'),
  C: g('.###./#...#/#..../#..../#..../#...#/.###.'),
  D: g('###../#..#./#...#/#...#/#...#/#..#./###..'),
  E: g('#####/#..../#..../####./#..../#..../#####'),
  F: g('#####/#..../#..../####./#..../#..../#....'),
  G: g('.###./#...#/#..../#.###/#...#/#...#/.####'),
  H: g('#...#/#...#/#...#/#####/#...#/#...#/#...#'),
  I: g('.###./..#../..#../..#../..#../..#../.###.'),
  J: g('..###/...#./...#./...#./...#./#..#./.##..'),
  K: g('#...#/#..#./#.#../##.../#.#../#..#./#...#'),
  L: g('#..../#..../#..../#..../#..../#..../#####'),
  M: g('#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'),
  N: g('#...#/##..#/#.#.#/#..##/#...#/#...#/#...#'),
  O: g('.###./#...#/#...#/#...#/#...#/#...#/.###.'),
  P: g('####./#...#/#...#/####./#..../#..../#....'),
  Q: g('.###./#...#/#...#/#...#/#.#.#/#..#./.##.#'),
  R: g('####./#...#/#...#/####./#.#../#..#./#...#'),
  S: g('.####/#..../#..../.###./....#/....#/####.'),
  T: g('#####/..#../..#../..#../..#../..#../..#..'),
  U: g('#...#/#...#/#...#/#...#/#...#/#...#/.###.'),
  V: g('#...#/#...#/#...#/#...#/#...#/.#.#./..#..'),
  W: g('#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#'),
  X: g('#...#/#...#/.#.#./..#../.#.#./#...#/#...#'),
  Y: g('#...#/#...#/.#.#./..#../..#../..#../..#..'),
  Z: g('#####/....#/...#./..#../.#.../#..../#####'),
  '0': g('.###./#...#/#..##/#.#.#/##..#/#...#/.###.'),
  '1': g('..#../.##../..#../..#../..#../..#../.###.'),
  '2': g('.###./#...#/....#/...#./..#../.#.../#####'),
  '3': g('####./....#/....#/.###./....#/....#/####.'),
  '4': g('...#./..##./.#.#./#..#./#####/...#./...#.'),
  '5': g('#####/#..../####./....#/....#/#...#/.###.'),
  '6': g('..##./.#.../#..../####./#...#/#...#/.###.'),
  '7': g('#####/....#/...#./..#../.#.../.#.../.#...'),
  '8': g('.###./#...#/#...#/.###./#...#/#...#/.###.'),
  '9': g('.###./#...#/#...#/.####/....#/...#./.##..'),
  '.': g('...../...../...../...../...../.##../.##..'),
  ',': g('...../...../...../...../.##../..#../.#...'),
  '!': g('..#../..#../..#../..#../..#../...../..#..'),
  '?': g('.###./#...#/....#/...#./..#../...../..#..'),
  ':': g('...../.##../.##../...../.##../.##../.....'),
  ';': g('...../.##../.##../...../.##../..#../.#...'),
  '-': g('...../...../...../#####/...../...../.....'),
  '+': g('...../..#../..#../#####/..#../..#../.....'),
  '=': g('...../...../#####/...../#####/...../.....'),
  $: g('..#../.####/#.#../.###./..#.#/####./..#..'),
  '%': g('##..#/##..#/...#./..#../.#.../#..##/#..##'),
  '/': g('....#/....#/...#./..#../.#.../#..../#....'),
  '(': g('...#./..#../.#.../.#.../.#.../..#../...#.'),
  ')': g('.#.../..#../...#./...#./...#./..#../.#...'),
  '[': g('.###./.#.../.#.../.#.../.#.../.#.../.###.'),
  ']': g('.###./...#./...#./...#./...#./...#./.###.'),
  '"': g('.#.#./.#.#./...../...../...../...../.....'),
  "'": g('..#../..#../...../...../...../...../.....'),
  '*': g('...../#.#.#/.###./#####/.###./#.#.#/.....'),
  '<': g('...#./..#../.#.../#..../.#.../..#../...#.'),
  '>': g('.#.../..#../...#./....#/...#./..#../.#...'),
  '#': g('.#.#./#####/.#.#./.#.#./#####/.#.#./.....'),
  '&': g('.##../#..#./.##../#.#.#/#..##/#..#./.##.#'),
  _: g('...../...../...../...../...../...../#####'),
  '~': g('...../...../.#..#/#.##./...../...../.....'),
};

const FOLD: Record<string, string> = {
  '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '.',
};

/** Normalise a char to something the font can draw. */
export function normalizeChar(c: string): string {
  const f = FOLD[c] ?? c;
  const u = f.toUpperCase();
  return GLYPHS[u] ? u : '?';
}

export function normalizeText(t: string): string {
  let out = '';
  for (const ch of t) out += ch === '\n' ? '\n' : normalizeChar(ch);
  return out;
}

/** 7 rows of 5 chars, '#' = lit. */
export function glyphRows(c: string): readonly string[] {
  return GLYPHS[normalizeChar(c)] ?? GLYPHS['?']!;
}

export const GLYPH_CHARS: readonly string[] = Object.keys(GLYPHS);

/** Width in logical px of a single line at an integer scale. */
export function lineWidth(line: string, scale = 1): number {
  const n = [...line].length;
  return n === 0 ? 0 : (n * ADVANCE - 1) * scale;
}

/** Max characters of one line that fit in maxWidth px. */
export function maxCharsForWidth(maxWidth: number, scale = 1): number {
  return Math.max(1, Math.floor((maxWidth + scale) / (ADVANCE * scale)));
}

export interface WrapOptions {
  maxChars: number;
  maxLines?: number;
}

/** Greedy word wrap on normalised text; long words are hard-split; honours \n; ellipsis when truncated. */
export function wrapText(text: string, opts: WrapOptions): string[] {
  const { maxChars } = opts;
  const lines: string[] = [];
  for (const para of normalizeText(text).split('\n')) {
    let cur = '';
    for (const rawWord of para.split(' ')) {
      let word = rawWord;
      while ([...word].length > maxChars) {
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      if (word === '' && cur === '' ) continue;
      if (cur === '') cur = word;
      else if ([...cur].length + 1 + [...word].length <= maxChars) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    }
    lines.push(cur);
  }
  const max = opts.maxLines;
  if (max !== undefined && lines.length > max) {
    const kept = lines.slice(0, max);
    const last = kept[max - 1]!;
    const room = Math.max(0, maxChars - 3);
    kept[max - 1] = last.slice(0, room).replace(/\s+$/, '') + '...';
    return kept;
  }
  return lines;
}

export interface TextMetrics {
  lines: string[];
  width: number;
  height: number;
  lineHeight: number;
}

export function measureText(text: string, scale = 1, maxWidth?: number, maxLines?: number): TextMetrics {
  const lines = maxWidth === undefined
    ? normalizeText(text).split('\n')
    : wrapText(text, { maxChars: maxCharsForWidth(maxWidth, scale), maxLines });
  const width = lines.reduce((m, l) => Math.max(m, lineWidth(l, scale)), 0);
  const lineHeight = LINE_H * scale;
  return { lines, width, height: lines.length === 0 ? 0 : (lines.length - 1) * lineHeight + GLYPH_H * scale, lineHeight };
}

export type Align = 'left' | 'center' | 'right';

/** Lit pixel coordinates (scale 1 grid) for the given lines; used by the rasteriser and tests. */
export function litPixels(lines: readonly string[], align: Align = 'left'): Array<[number, number]> {
  const width = lines.reduce((m, l) => Math.max(m, lineWidth(l, 1)), 0);
  const out: Array<[number, number]> = [];
  lines.forEach((line, li) => {
    const lw = lineWidth(line, 1);
    const ox = align === 'left' ? 0 : align === 'center' ? Math.floor((width - lw) / 2) : width - lw;
    let cx = ox;
    for (const ch of line) {
      const rows = glyphRows(ch);
      for (let y = 0; y < GLYPH_H; y++) {
        const r = rows[y]!;
        for (let x = 0; x < GLYPH_W; x++) if (r[x] === '#') out.push([cx + x, li * LINE_H + y]);
      }
      cx += ADVANCE;
    }
  });
  return out;
}
