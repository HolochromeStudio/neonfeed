// Pure settings helpers (no Phaser): slider maths and immutable updates of the settings object.
import type { GameSettings } from './types';

export const SLIDER_STEP = 0.05;

export type SliderKey = 'musicVol' | 'sfxVol';
export type LeverKey = 'haptics' | 'reducedShake' | 'left' | 'tellAssist' | 'captions';

/** Clamp to 0..1 and snap to 5% steps (also repairs NaN / out-of-range saved values). */
export function quantizeVolume(v: number): number {
  const x = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return Math.round(Math.round(x / SLIDER_STEP) * SLIDER_STEP * 100) / 100;
}

/** Pointer x -> volume for a track spanning [x0, x0 + w]. */
export function volumeFromX(px: number, x0: number, w: number): number {
  return quantizeVolume((px - x0) / Math.max(1, w));
}

export function leverValue(s: GameSettings, k: LeverKey): boolean {
  if (k === 'left') return s.handedness === 'left';
  return s[k] === true;
}

export function withLever(s: GameSettings, k: LeverKey, on: boolean): GameSettings {
  if (k === 'left') return { ...s, handedness: on ? 'left' : 'right' };
  return { ...s, [k]: on };
}

export function withVolume(s: GameSettings, k: SliderKey, v: number): GameSettings {
  return { ...s, [k]: quantizeVolume(v) };
}

/** The shape handed to onChange: always includes the two optional flags. */
export function normalizeSettings(s: GameSettings): GameSettings {
  return { ...s, musicVol: quantizeVolume(s.musicVol), sfxVol: quantizeVolume(s.sfxVol), tellAssist: s.tellAssist === true, captions: s.captions === true };
}
