import { describe, it, expect } from 'vitest';
import { defaultMeta, validateMeta } from '../src/core/SaveManager';
import { leverValue, normalizeSettings, quantizeVolume, volumeFromX, withLever, withVolume } from '../src/ui/settingsLogic';
import type { GameSettings } from '../src/ui/types';

describe('settings logic', () => {
  it('quantizes volumes to 5% steps inside 0..1 and repairs junk', () => {
    expect(quantizeVolume(0.731)).toBe(0.75);
    expect(quantizeVolume(-3)).toBe(0);
    expect(quantizeVolume(9)).toBe(1);
    expect(quantizeVolume(Number.NaN)).toBe(0);
  });
  it('maps pointer x on the track to a volume, clamped at both ends', () => {
    expect(volumeFromX(100, 100, 200)).toBe(0);
    expect(volumeFromX(200, 100, 200)).toBe(0.5);
    expect(volumeFromX(900, 100, 200)).toBe(1);
    expect(volumeFromX(-50, 100, 200)).toBe(0);
  });
  it('levers update immutably; left-handed maps to handedness', () => {
    const s: GameSettings = defaultMeta().settings;
    const a = withLever(s, 'left', true);
    expect(a.handedness).toBe('left');
    expect(s.handedness).toBe('right');
    expect(leverValue(a, 'left')).toBe(true);
    expect(withLever(a, 'haptics', false).haptics).toBe(false);
    expect(withVolume(s, 'musicVol', 0.5).musicVol).toBe(0.5);
  });
  it('onChange payload keeps the MetaSave.settings shape (extra flags only add)', () => {
    const base = defaultMeta().settings;
    const out = normalizeSettings({ ...base, tellAssist: true });
    for (const k of Object.keys(base) as Array<keyof typeof base>) expect(out[k]).toBeDefined();
    expect(out.captions).toBe(false);
    // the save validator still accepts a MetaSave carrying the normalised settings
    expect(validateMeta({ ...defaultMeta(), settings: out })).not.toBeNull();
  });
});
