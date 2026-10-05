import type { AnimationDef } from './types';

/**
 * Frame suffixes of the real 6-frame character sheets (A04 names frames `<prefix>_<suffix>`).
 */
export const SHEET_FRAME_SUFFIXES = ['idle', 'idle2', 'aim', 'shoot', 'hit', 'dead'] as const;

export function sheetFrameNames(prefix: string): string[] {
  return SHEET_FRAME_SUFFIXES.map((s) => `${prefix}_${s}`);
}

/**
 * Builds the standard animation set for a 6-frame sheet character.
 * Keys are `<prefix>_idle|draw|aim|shoot|hit|dead`. The sheet has no draw frames,
 * so `draw` is a quick idle2 -> aim transition.
 */
export function characterAnimsFromSheet(prefix: string, atlas: string): AnimationDef[] {
  const f = (s: string): string => `${prefix}_${s}`;
  return [
    { key: f('idle'), atlas, frames: [f('idle'), f('idle2')], frameRate: 3, repeat: -1, oneShot: false },
    { key: f('draw'), atlas, frames: [f('idle2'), f('aim')], frameRate: 16, repeat: 0, oneShot: true, next: f('aim') },
    { key: f('aim'), atlas, frames: [f('aim')], frameRate: 1, repeat: 0, oneShot: false },
    { key: f('shoot'), atlas, frames: [f('shoot')], frameRate: 12, repeat: 0, oneShot: true, next: f('aim') },
    { key: f('hit'), atlas, frames: [f('hit')], frameRate: 8, repeat: 0, oneShot: true, next: f('idle') },
    { key: f('dead'), atlas, frames: [f('dead')], frameRate: 1, repeat: 0, oneShot: true },
  ];
}
