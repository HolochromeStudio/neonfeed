import { HAPTIC_FOR_EVENT, audioBus } from './audioEvents';
import type { AudioEvent, AudioEventBus, HapticProfile, HapticsSettings } from './audioEvents';

/** Vibration patterns in ms (on, off, on, ...). Tune freely. */
export const HAPTIC_PATTERNS: Record<HapticProfile, number[]> = {
  light: [10],
  medium: [25],
  heavy: [50],
  perfect_draw: [15, 40, 15, 40, 40],
  hit: [35, 25, 20],
  death: [80, 60, 120, 60, 250],
};

/**
 * Adapter hook. Implement this to route haptics through a native plugin.
 *
 * CAPACITOR HOOK (not wired yet): when Capacitor is added, create an adapter
 * using `@capacitor/haptics` (Haptics.impact({style}) / Haptics.vibrate({duration}))
 * and call `haptics.setAdapter(capacitorAdapter)` at boot. Until then the
 * default adapter uses navigator.vibrate when present.
 */
export interface HapticsAdapter {
  isSupported(): boolean;
  play(profile: HapticProfile, pattern: number[]): void;
}

export const navigatorVibrateAdapter: HapticsAdapter = {
  isSupported: () => typeof navigator !== 'undefined' && typeof (navigator as Navigator).vibrate === 'function',
  play: (_profile, pattern) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  },
};

export class HapticsManager {
  private enabled = true;
  private adapter: HapticsAdapter = navigatorVibrateAdapter;
  private unsub: (() => void) | null = null;

  setSettings(s: HapticsSettings): void {
    this.enabled = !!s.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Replace the vibration backend (e.g. Capacitor Haptics). */
  setAdapter(a: HapticsAdapter): void {
    this.adapter = a;
  }

  isSupported(): boolean {
    try {
      return this.adapter.isSupported();
    } catch {
      return false;
    }
  }

  /** Returns true if a vibration was requested. Never throws. */
  play(profile: HapticProfile): boolean {
    if (!this.enabled || !this.isSupported()) return false;
    try {
      this.adapter.play(profile, HAPTIC_PATTERNS[profile]);
      return true;
    } catch {
      return false;
    }
  }

  handleEvent(e: AudioEvent): void {
    const p = HAPTIC_FOR_EVENT[e.type];
    if (p) this.play(p);
  }

  /** Subscribe to an event bus (defaults to the shared one). */
  connect(bus: AudioEventBus = audioBus): void {
    this.disconnect();
    this.unsub = bus.subscribe((e) => this.handleEvent(e));
  }

  disconnect(): void {
    this.unsub?.();
    this.unsub = null;
  }
}

export const haptics = new HapticsManager();
