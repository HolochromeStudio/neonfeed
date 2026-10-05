import { GLYPH_CHARS } from '../src/ui/pixelFont';

const SET = new Set(GLYPH_CHARS);

/** Characters of `text` the pixel font cannot draw (it folds lowercase to upper; anything else renders as '?'). */
export function glyphsSupported(text: string): string[] {
  const bad: string[] = [];
  for (const ch of text.toUpperCase()) if (ch !== '\n' && !SET.has(ch)) bad.push(ch);
  return bad;
}
