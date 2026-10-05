import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager, PLACEHOLDER_SOUNDS } from '../src/core/AudioManager';
import { HapticsManager, HAPTIC_PATTERNS } from '../src/core/HapticsManager';
import { AUDIO_EVENT_TYPES, AudioEventBus, HAPTIC_PROFILES, MUSIC_STATES } from '../src/core/audioEvents';

function fakeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}
function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: fakeParam(), frequency: fakeParam(), type: '', buffer: null as unknown, loop: false };
}
function makeFakeCtx() {
  const oscillators: ReturnType<typeof fakeNode>[] = [];
  const sources: ReturnType<typeof fakeNode>[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    close: vi.fn(async () => undefined),
    createGain: () => fakeNode(),
    createBiquadFilter: () => fakeNode(),
    createOscillator: () => { const n = fakeNode(); oscillators.push(n); return n; },
    createBufferSource: () => { const n = fakeNode(); sources.push(n); return n; },
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, oscillators, sources };
}
function makeManager() {
  const f = makeFakeCtx();
  const am = new AudioManager(() => f.ctx as unknown as AudioContext);
  return { am, ...f };
}

const managers: AudioManager[] = [];
afterEach(() => { managers.splice(0).forEach((m) => m.dispose()); vi.useRealTimers(); });

describe('AudioManager', () => {
  it('does not play before unlock, resumes ctx on unlock', () => {
    const { am, ctx, oscillators } = makeManager();
    managers.push(am);
    expect(am.play({ type: 'coin' })).toBe(false);
    expect(oscillators.length).toBe(0);
    expect(am.unlock()).toBe(true);
    expect(ctx.resume).toHaveBeenCalled();
    expect(am.play({ type: 'coin' })).toBe(true);
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('every event type produces sound once unlocked', () => {
    const { am, oscillators, sources } = makeManager();
    managers.push(am);
    am.unlock();
    for (const t of AUDIO_EVENT_TYPES) {
      const before = oscillators.length + sources.length;
      expect(am.play({ type: t } as never)).toBe(true);
      expect(oscillators.length + sources.length).toBeGreaterThan(before);
    }
  });

  it('routes bus events and unsubscribes on dispose', () => {
    const { am, oscillators } = makeManager();
    const bus = new AudioEventBus();
    am.unlock();
    am.connect(bus);
    bus.emit({ type: 'gunshot' });
    const n = oscillators.length;
    expect(n).toBeGreaterThan(0);
    am.dispose();
    bus.emit({ type: 'gunshot' });
    expect(oscillators.length).toBe(n);
  });

  it('mute suppresses sfx', () => {
    const { am, oscillators } = makeManager();
    managers.push(am);
    am.unlock();
    am.setMuted(true);
    expect(am.play({ type: 'ui_click' })).toBe(false);
    expect(oscillators.length).toBe(0);
    am.setMuted(false);
    expect(am.play({ type: 'ui_click' })).toBe(true);
  });

  it('clamps volume settings', () => {
    const { am } = makeManager();
    am.setSettings({ musicVol: 5, sfxVol: -1 });
    expect(am.getSettings()).toEqual({ musicVol: 1, sfxVol: 0 });
  });

  it('music states schedule notes and stop when muted', () => {
    vi.useFakeTimers();
    const { am, oscillators } = makeManager();
    managers.push(am);
    am.unlock();
    for (const s of MUSIC_STATES) {
      am.setMusicState(s);
      expect(am.getMusicState()).toBe(s);
    }
    expect(oscillators.length).toBeGreaterThan(0);
    am.setMuted(true);
    const n = oscillators.length;
    vi.advanceTimersByTime(500);
    expect(oscillators.length).toBe(n);
  });

  it('ambience layers start after unlock', () => {
    const { am, sources } = makeManager();
    managers.push(am);
    am.setAmbience('wind', true);
    am.setAmbience('saloon_chatter', true);
    expect(sources.length).toBe(0);
    am.unlock();
    expect(sources.filter((s) => s.loop).length).toBe(2);
  });

  it('never throws without AudioContext', () => {
    const am = new AudioManager(() => null);
    expect(am.isAvailable()).toBe(false);
    expect(() => {
      am.installGestureUnlock(null);
      am.setSettings({ musicVol: 0.5, sfxVol: 0.5 });
      expect(am.unlock()).toBe(false);
      expect(am.play({ type: 'death' })).toBe(false);
      am.setMusicState('boss');
      am.setAmbience('wind', true);
      am.setMuted(true);
      am.dispose();
    }).not.toThrow();
  });

  it('lists a PLACEHOLDER entry for every event and music state', () => {
    const ids = PLACEHOLDER_SOUNDS.map((p) => p.id);
    AUDIO_EVENT_TYPES.forEach((t) => expect(ids).toContain(t));
    MUSIC_STATES.forEach((s) => expect(ids).toContain(`music:${s}`));
    PLACEHOLDER_SOUNDS.forEach((p) => expect(p.note).toContain('PLACEHOLDER'));
  });
});

describe('HapticsManager', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('vibrates with mapped pattern and respects toggle', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const h = new HapticsManager();
    const bus = new AudioEventBus();
    h.connect(bus);
    bus.emit({ type: 'perfect_draw' });
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.perfect_draw);
    vibrate.mockClear();
    bus.emit({ type: 'coin' }); // no haptic mapped
    expect(vibrate).not.toHaveBeenCalled();
    h.setSettings({ enabled: false });
    bus.emit({ type: 'death' });
    expect(vibrate).not.toHaveBeenCalled();
    h.setSettings({ enabled: true });
    bus.emit({ type: 'death' });
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.death);
  });

  it('has a pattern for every profile', () => {
    HAPTIC_PROFILES.forEach((p) => expect(HAPTIC_PATTERNS[p].length).toBeGreaterThan(0));
  });

  it('no-ops without navigator.vibrate', () => {
    vi.stubGlobal('navigator', {});
    const h = new HapticsManager();
    expect(h.isSupported()).toBe(false);
    expect(h.play('heavy')).toBe(false);
  });

  it('uses a custom adapter (Capacitor hook)', () => {
    const play = vi.fn();
    const h = new HapticsManager();
    h.setAdapter({ isSupported: () => true, play });
    expect(h.play('light')).toBe(true);
    expect(play).toHaveBeenCalledWith('light', HAPTIC_PATTERNS.light);
  });
});
