/**
 * Audio/haptic event vocabulary and a tiny dependency-free event bus.
 * Game code emits `AudioEvent`s via `audioBus.emit(...)`; AudioManager and
 * HapticsManager subscribe. Neither depends on SaveManager: settings are
 * pushed in through plain setters using the interfaces below.
 */

export type AudioEvent =
  | { type: 'draw_cue' }
  | { type: 'gunshot'; shooter?: 'player' | 'enemy' }
  | { type: 'hit_flesh' }
  | { type: 'hit_prop' }
  | { type: 'dodge' }
  | { type: 'dodge_perfect' }
  | { type: 'dodge_fail' }
  | { type: 'perfect_draw' }
  | { type: 'miss' }
  | { type: 'ui_click' }
  | { type: 'ui_confirm' }
  | { type: 'coin' }
  | { type: 'boss_sting' }
  | { type: 'death' };

export type AudioEventType = AudioEvent['type'];

export const AUDIO_EVENT_TYPES: readonly AudioEventType[] = [
  'draw_cue', 'gunshot', 'hit_flesh', 'hit_prop', 'dodge', 'dodge_perfect', 'dodge_fail', 'perfect_draw',
  'miss', 'ui_click', 'ui_confirm', 'coin', 'boss_sting', 'death',
];

export type MusicState = 'menu' | 'saloon' | 'duel_tension' | 'duel_resolve' | 'boss';
export const MUSIC_STATES: readonly MusicState[] = ['menu', 'saloon', 'duel_tension', 'duel_resolve', 'boss'];

export type AmbienceLayer = 'wind' | 'saloon_chatter';
export const AMBIENCE_LAYERS: readonly AmbienceLayer[] = ['wind', 'saloon_chatter'];

export type HapticProfile = 'light' | 'medium' | 'heavy' | 'perfect_draw' | 'hit' | 'death';
export const HAPTIC_PROFILES: readonly HapticProfile[] = ['light', 'medium', 'heavy', 'perfect_draw', 'hit', 'death'];

/** Plain settings objects (no SaveManager import). Volumes are 0..1. */
export interface AudioSettings {
  musicVol: number;
  sfxVol: number;
}
export interface HapticsSettings {
  enabled: boolean;
}

/** Which haptic profile (if any) accompanies each audio event. */
export const HAPTIC_FOR_EVENT: Partial<Record<AudioEventType, HapticProfile>> = {
  draw_cue: 'medium',
  gunshot: 'heavy',
  hit_flesh: 'hit',
  hit_prop: 'light',
  dodge: 'light',
  perfect_draw: 'perfect_draw',
  miss: 'light',
  ui_confirm: 'light',
  boss_sting: 'heavy',
  death: 'death',
};

type Listener = (e: AudioEvent) => void;

export class AudioEventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(e: AudioEvent): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(e);
      } catch {
        // a faulty audio listener must never break gameplay
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Shared default bus. */
export const audioBus = new AudioEventBus();
