// 8x8 pixel pictograms as strings (pure data). '.' = transparent; other chars index a palette.
import type { IconKind, Rarity } from './types';

export type Bitmap = readonly string[];
const b = (s: string): Bitmap => s.split('/');

export const ICON_BITMAPS: Record<IconKind, Bitmap> = {
  draw: b('......../.#######/.#######/.###..../.###..../.##...../......../........'),
  dodge: b('#..#..../.#..#.../..#..#../...#..#./..#..#../.#..#.../#..#..../........'),
  life: b('.##..##./#######./#######./#######./.#####../..###.../...#..../........'),
  coin: b('..####../.######./########/########/########/########/.######./..####..'),
  luck: b('.#....#./##....##/##....##/##....##/###..###/.######./..####../........'),
  aim: b('...##.../...##.../..#..#../###..###/###..###/..#..#../...##.../...##...'),
  star: b('...##.../...##.../########/.######./..####../.##..##./.#....#./........'),
  lock: b('..####../.#....#./.#....#./########/##....##/##.##.##/##.##.##/########'),
};

export const HEART_FULL: Bitmap = b('.rr..rr./rhrrrrrR/rrrrrrrR/rrrrrrrR/.rrrrrR./..rrrR../...rR.../........');
export const HEART_EMPTY: Bitmap = b('.kk..kk./k..kk..k/k......k/k......k/.k....k./..k..k../...kk.../........');
export const COIN_BITMAP: Bitmap = b('..dddd../.dyyyyd./dyyYyyyd/dyyYyyyd/dyyyyyyd/dyyyyyyd/.dyyyyd./..dddd..');

export const RARITY_SHAPES: Record<Rarity, Bitmap> = {
  common: b('..####../.######./########/########/########/########/.######./..####..'),
  rare: b('...##.../..####../.######./########/########/.######./..####../...##...'),
  legendary: ICON_BITMAPS.star,
};

export const GEAR_BITMAP: Bitmap = b('...##.../.######./.##..##./##....##/##....##/.##..##./.######./...##...');

export interface BitmapPixel { x: number; y: number; ch: string }

export function bitmapPixels(rows: Bitmap): BitmapPixel[] {
  const out: BitmapPixel[] = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] !== '.') out.push({ x, y, ch: r[x]! });
  });
  return out;
}

export const bitmapSize = (rows: Bitmap) => ({ w: rows.reduce((m, r) => Math.max(m, r.length), 0), h: rows.length });
