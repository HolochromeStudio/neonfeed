// UiTheme: single source of truth for palette, text scales and rarity cues (UX_FLOW 1 and 5).
// Pure data (no Phaser). ~24 colours, western: dusty browns, parchment, brass, blood red, midnight blue.
import type { Rarity } from './types';
import { MIN_GAP, MIN_TARGET, RECOMMENDED_TARGET } from './layout';

export const C = {
  ink: 0x1a0f08,
  woodDeep: 0x24150c,
  woodDark: 0x33200f,
  wood: 0x4a2e1a,
  woodMid: 0x66401f,
  woodLight: 0x86582c,
  woodHi: 0xa77842,
  parchment: 0xe9d3a0,
  parchmentLight: 0xf6e7bd,
  parchmentDark: 0xcaa96a,
  parchmentBurn: 0x8c6a3a,
  cream: 0xfff3c4,
  brass: 0xe0b040,
  brassLight: 0xf7d674,
  brassDark: 0x9a6f1c,
  red: 0xd24a3a,
  redDark: 0x862a20,
  redText: 0xff8a76,
  midnight: 0x1b2a4a,
  midnightLight: 0x4a6cb0,
  slate: 0x232a29,
  slateLight: 0x34403d,
  chalk: 0xeae6d4,
  chalkDim: 0xa8a592,
  sand: 0xc89860,
  sandDark: 0xa87840,
  sandLight: 0xdcb27a,
  cactus: 0x4f7a3c,
  disabledFill: 0x3a2e26,
  disabledText: 0xb2a692,
} as const;

export const SKY_BANDS = [0x2a1f3e, 0x4a2c4c, 0x7e3a48, 0xb8553f, 0xe0803c, 0xf2b05a] as const;

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Text scale = font px / 8. Integer only (UX_FLOW: 8, 16, 24, 32). */
export const TEXT = { caption: 1, body: 2, heading: 3, title: 4 } as const;

export const LAYOUT = {
  MIN_TARGET,
  RECOMMENDED_TARGET,
  MIN_GAP,
  /** Primary plank 280x56, secondary 48 high (UX_FLOW 4.2). */
  PRIMARY_W: 280,
  PRIMARY_H: 56,
  SECONDARY_H: 48,
  SIDE: 12,
} as const;

export interface RarityStyle {
  label: string;
  border: number;
  borderThickness: number;
  fill: number;
  /** Shape cue (colour-blind safe): common = disc, rare = diamond, legendary = star. */
  shape: Rarity;
  doubleBorder: boolean;
}

export const RARITY: Record<Rarity, RarityStyle> = {
  common: { label: 'COMMON', border: C.parchmentBurn, borderThickness: 2, fill: C.parchment, shape: 'common', doubleBorder: false },
  rare: { label: 'RARE', border: C.midnightLight, borderThickness: 3, fill: C.parchment, shape: 'rare', doubleBorder: false },
  legendary: { label: 'LEGEND', border: C.brass, borderThickness: 3, fill: C.parchmentLight, shape: 'legendary', doubleBorder: true },
};

/** WCAG relative luminance contrast, used by tests to guard the palette. */
export function contrast(a: number, b: number): number {
  const lum = (c: number) => {
    const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Pixel-plank letterbox for the page behind the canvas (apply to <body>). */
export const LETTERBOX_CSS =
  `background-color:${hex(C.woodDark)};` +
  `background-image:repeating-linear-gradient(0deg,${hex(C.woodDark)} 0,${hex(C.woodDark)} 30px,${hex(C.ink)} 30px,${hex(C.ink)} 32px,${hex(C.wood)} 32px,${hex(C.wood)} 62px,${hex(C.ink)} 62px,${hex(C.ink)} 64px);` +
  'image-rendering:pixelated;';
