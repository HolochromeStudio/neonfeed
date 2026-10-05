import { audioBus } from './audioEvents';
import type {
  AmbienceLayer, AudioEvent, AudioEventBus, AudioEventType, AudioSettings, MusicState,
} from './audioEvents';

/**
 * AudioManager: event-driven WebAudio audio with procedurally generated
 * PLACEHOLDER sounds (no asset files). Independent of Phaser audio, safe
 * without AudioContext (all methods become no-ops), and unlocks on the first
 * user gesture for mobile autoplay policy.
 *
 * To replace a placeholder later: swap the entry in SFX_SYNTH / MUSIC_PATTERNS /
 * ambience builders with sample playback; PLACEHOLDER_SOUNDS lists them all.
 */

export interface PlaceholderSound {
  id: string;
  kind: 'sfx' | 'music' | 'ambience';
  note: string;
}

/** Every sound below is a PLACEHOLDER synth; replace with real assets. */
export const PLACEHOLDER_SOUNDS: readonly PlaceholderSound[] = [
  { id: 'draw_cue', kind: 'sfx', note: 'PLACEHOLDER rising two-tone beep' },
  { id: 'gunshot', kind: 'sfx', note: 'PLACEHOLDER noise burst + low thump' },
  { id: 'hit_flesh', kind: 'sfx', note: 'PLACEHOLDER low thud' },
  { id: 'hit_prop', kind: 'sfx', note: 'PLACEHOLDER wood-ish clack' },
  { id: 'dodge', kind: 'sfx', note: 'PLACEHOLDER filtered whoosh' },
  { id: 'perfect_draw', kind: 'sfx', note: 'PLACEHOLDER bright chime arpeggio' },
  { id: 'miss', kind: 'sfx', note: 'PLACEHOLDER falling blip' },
  { id: 'ui_click', kind: 'sfx', note: 'PLACEHOLDER short tick' },
  { id: 'ui_confirm', kind: 'sfx', note: 'PLACEHOLDER two-note confirm' },
  { id: 'coin', kind: 'sfx', note: 'PLACEHOLDER coin ping' },
  { id: 'boss_sting', kind: 'sfx', note: 'PLACEHOLDER ominous detuned saw' },
  { id: 'death', kind: 'sfx', note: 'PLACEHOLDER descending tone + noise' },
  { id: 'music:menu', kind: 'music', note: 'PLACEHOLDER synth loop' },
  { id: 'music:saloon', kind: 'music', note: 'PLACEHOLDER synth loop' },
  { id: 'music:duel_tension', kind: 'music', note: 'PLACEHOLDER synth loop' },
  { id: 'music:duel_resolve', kind: 'music', note: 'PLACEHOLDER synth loop' },
  { id: 'music:boss', kind: 'music', note: 'PLACEHOLDER synth loop' },
  { id: 'ambience:wind', kind: 'ambience', note: 'PLACEHOLDER filtered noise' },
  { id: 'ambience:saloon_chatter', kind: 'ambience', note: 'PLACEHOLDER modulated noise murmur' },
];

type CtxFactory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  try {
    const g = globalThis as unknown as {
      AudioContext?: new () => AudioContext;
      webkitAudioContext?: new () => AudioContext;
    };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

// ---- synth helpers (PLACEHOLDER building blocks) ----------------------------

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  dur: number;
  gain?: number;
  delay?: number;
}

function tone(ctx: AudioContext, out: AudioNode, o: ToneOpts): void {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + o.dur);
  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic LCG (no Math.random in game-adjacent code, see D4).
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  return buf;
}

function noise(
  ctx: AudioContext, out: AudioNode,
  o: { dur: number; gain?: number; delay?: number; filter?: BiquadFilterType; freq?: number; freqEnd?: number },
): void {
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, o.dur);
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 2000, t0);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.freqEnd), t0 + o.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

type Synth = (ctx: AudioContext, out: AudioNode) => void;

/** PLACEHOLDER synth recipes, one per AudioEvent type. */
const SFX_SYNTH: Record<AudioEventType, Synth> = {
  draw_cue: (c, o) => {
    tone(c, o, { type: 'square', freq: 660, dur: 0.09, gain: 0.25 });
    tone(c, o, { type: 'square', freq: 990, dur: 0.14, gain: 0.25, delay: 0.1 });
  },
  gunshot: (c, o) => {
    noise(c, o, { dur: 0.35, gain: 0.7, filter: 'lowpass', freq: 5000, freqEnd: 300 });
    tone(c, o, { type: 'sine', freq: 140, freqEnd: 40, dur: 0.25, gain: 0.6 });
  },
  hit_flesh: (c, o) => {
    tone(c, o, { type: 'sine', freq: 110, freqEnd: 50, dur: 0.18, gain: 0.5 });
    noise(c, o, { dur: 0.1, gain: 0.25, freq: 800 });
  },
  hit_prop: (c, o) => {
    tone(c, o, { type: 'triangle', freq: 420, freqEnd: 260, dur: 0.07, gain: 0.35 });
    noise(c, o, { dur: 0.05, gain: 0.3, filter: 'highpass', freq: 1500 });
  },
  dodge: (c, o) => {
    noise(c, o, { dur: 0.25, gain: 0.3, filter: 'bandpass', freq: 400, freqEnd: 2500 });
  },
  perfect_draw: (c, o) => {
    [880, 1109, 1319, 1760].forEach((f, i) =>
      tone(c, o, { type: 'triangle', freq: f, dur: 0.18, gain: 0.25, delay: i * 0.06 }));
  },
  miss: (c, o) => {
    tone(c, o, { type: 'sawtooth', freq: 400, freqEnd: 120, dur: 0.25, gain: 0.2 });
  },
  ui_click: (c, o) => {
    tone(c, o, { type: 'square', freq: 1200, dur: 0.03, gain: 0.15 });
  },
  ui_confirm: (c, o) => {
    tone(c, o, { type: 'square', freq: 700, dur: 0.07, gain: 0.2 });
    tone(c, o, { type: 'square', freq: 1050, dur: 0.1, gain: 0.2, delay: 0.07 });
  },
  coin: (c, o) => {
    tone(c, o, { type: 'square', freq: 1319, dur: 0.07, gain: 0.2 });
    tone(c, o, { type: 'square', freq: 1760, dur: 0.22, gain: 0.2, delay: 0.07 });
  },
  boss_sting: (c, o) => {
    tone(c, o, { type: 'sawtooth', freq: 98, dur: 1.2, gain: 0.35 });
    tone(c, o, { type: 'sawtooth', freq: 103, dur: 1.2, gain: 0.35 });
    tone(c, o, { type: 'sawtooth', freq: 147, dur: 1.0, gain: 0.2, delay: 0.2 });
  },
  death: (c, o) => {
    tone(c, o, { type: 'sawtooth', freq: 330, freqEnd: 45, dur: 1.0, gain: 0.35 });
    noise(c, o, { dur: 0.8, gain: 0.25, freq: 1200, freqEnd: 100 });
  },
};

interface MusicPattern {
  bpm: number;
  root: number; // Hz
  wave: OscillatorType;
  gain: number;
  /** semitone offsets from root, null = rest; one entry per beat-eighth */
  steps: (number | null)[];
}

/** PLACEHOLDER music loops. */
const MUSIC_PATTERNS: Record<MusicState, MusicPattern> = {
  menu: { bpm: 80, root: 110, wave: 'triangle', gain: 0.18, steps: [0, null, 7, null, 3, null, 7, null, 5, null, 3, null, 2, null, null, null] },
  saloon: { bpm: 120, root: 130.8, wave: 'square', gain: 0.1, steps: [0, 4, 7, 4, 0, 4, 7, 12, 5, 9, 12, 9, 5, 9, 7, 4] },
  duel_tension: { bpm: 70, root: 82.4, wave: 'sawtooth', gain: 0.1, steps: [0, null, null, null, 1, null, null, null, 0, null, null, null, 6, null, 1, null] },
  duel_resolve: { bpm: 100, root: 110, wave: 'triangle', gain: 0.2, steps: [0, 4, 7, 12, null, null, 7, null, 12, null, null, null, null, null, null, null] },
  boss: { bpm: 140, root: 73.4, wave: 'sawtooth', gain: 0.12, steps: [0, 0, 3, 0, 5, 0, 3, 0, 0, 0, 3, 0, 7, 6, 5, 3] },
};

// ---- manager ----------------------------------------------------------------

interface AmbienceHandle {
  stop: () => void;
}

export class AudioManager {
  private factory: CtxFactory;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambGain: GainNode | null = null;

  private musicVol = 0.6;
  private sfxVol = 0.8;
  private muted = false;
  private unlocked = false;

  private music: MusicState | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private musicNextTime = 0;

  private wantedAmbience = new Set<AmbienceLayer>();
  private ambience = new Map<AmbienceLayer, AmbienceHandle>();

  private unsubBus: (() => void) | null = null;
  private gestureCleanup: (() => void) | null = null;

  constructor(factory: CtxFactory = defaultFactory) {
    this.factory = factory;
  }

  // -- setup --

  /** True if a WebAudio context can exist in this environment. */
  isAvailable(): boolean {
    return this.ctx !== null || this.factory() !== null;
  }

  /** Take settings from outside (SaveManager owner calls this). */
  setSettings(s: AudioSettings): void {
    this.musicVol = clamp01(s.musicVol);
    this.sfxVol = clamp01(s.sfxVol);
    this.applyVolumes();
  }

  getSettings(): AudioSettings {
    return { musicVol: this.musicVol, sfxVol: this.sfxVol };
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
    if (m) this.stopMusicTimer();
    else if (this.music && this.unlocked) this.startMusicTimer();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Subscribe to an event bus (defaults to the shared bus). */
  connect(bus: AudioEventBus = audioBus): void {
    this.unsubBus?.();
    this.unsubBus = bus.subscribe((e) => this.play(e));
  }

  /**
   * Listen for the first user gesture and unlock/resume audio.
   * Safe to call without a DOM (no-op).
   */
  installGestureUnlock(target?: EventTarget | null): void {
    this.gestureCleanup?.();
    const t = target ?? ((globalThis as { document?: EventTarget }).document ?? null);
    if (!t || typeof t.addEventListener !== 'function') return;
    const evs = ['pointerdown', 'touchend', 'mousedown', 'keydown'];
    const handler = () => {
      this.unlock();
      this.gestureCleanup?.();
    };
    evs.forEach((e) => t.addEventListener(e, handler, { passive: true } as AddEventListenerOptions));
    this.gestureCleanup = () => {
      evs.forEach((e) => t.removeEventListener(e, handler));
      this.gestureCleanup = null;
    };
  }

  /** Create/resume the context. Call from a user gesture. Never throws. */
  unlock(): boolean {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') void ctx.resume?.()?.catch?.(() => undefined);
      this.unlocked = true;
      this.startAmbienceLayers();
      if (this.music && !this.muted) this.startMusicTimer();
      return true;
    } catch {
      return false;
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  // -- playback --

  /** Play an event's sound. Returns true if a sound was actually triggered. */
  play(e: AudioEvent): boolean {
    if (this.muted || !this.unlocked) return false;
    try {
      const ctx = this.ctx;
      const out = this.sfxGain;
      const synth = SFX_SYNTH[e.type];
      if (!ctx || !out || !synth) return false;
      synth(ctx, out);
      return true;
    } catch {
      return false;
    }
  }

  setMusicState(state: MusicState | null): void {
    if (state === this.music) return;
    this.stopMusicTimer();
    this.music = state;
    this.musicStep = 0;
    if (state && this.unlocked && !this.muted) this.startMusicTimer();
  }

  getMusicState(): MusicState | null {
    return this.music;
  }

  setAmbience(layer: AmbienceLayer, on: boolean): void {
    if (on) this.wantedAmbience.add(layer);
    else this.wantedAmbience.delete(layer);
    if (this.unlocked) this.startAmbienceLayers();
  }

  getAmbience(): AmbienceLayer[] {
    return [...this.wantedAmbience];
  }

  dispose(): void {
    this.stopMusicTimer();
    this.unsubBus?.();
    this.unsubBus = null;
    this.gestureCleanup?.();
    this.ambience.forEach((h) => h.stop());
    this.ambience.clear();
    try {
      void this.ctx?.close?.()?.catch?.(() => undefined);
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = this.musicGain = this.sfxGain = this.ambGain = null;
    this.unlocked = false;
  }

  // -- internals --

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const ctx = this.factory();
    if (!ctx) return null;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.ambGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambGain.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();
    return ctx;
  }

  private applyVolumes(): void {
    if (!this.master || !this.musicGain || !this.sfxGain || !this.ambGain) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.musicGain.gain.value = this.musicVol;
    this.sfxGain.gain.value = this.sfxVol;
    this.ambGain.gain.value = this.sfxVol * 0.5;
  }

  private startMusicTimer(): void {
    this.stopMusicTimer();
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    this.musicNextTime = ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 100);
    this.scheduleMusic();
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out || !this.music) return;
    try {
      const p = MUSIC_PATTERNS[this.music];
      const stepDur = 60 / p.bpm / 2;
      while (this.musicNextTime < ctx.currentTime + 0.3) {
        const semis = p.steps[this.musicStep % p.steps.length];
        if (semis !== null && semis !== undefined) {
          const t0 = this.musicNextTime;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = p.wave;
          osc.frequency.setValueAtTime(p.root * Math.pow(2, semis / 12), t0);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(p.gain, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 1.8);
          osc.connect(g);
          g.connect(out);
          osc.start(t0);
          osc.stop(t0 + stepDur * 1.9);
        }
        this.musicStep++;
        this.musicNextTime += stepDur;
      }
    } catch {
      /* never break the game over audio */
    }
  }

  private startAmbienceLayers(): void {
    const ctx = this.ctx;
    const out = this.ambGain;
    if (!ctx || !out) return;
    for (const layer of this.wantedAmbience) {
      if (!this.ambience.has(layer)) {
        try {
          this.ambience.set(layer, buildAmbience(ctx, out, layer));
        } catch {
          /* ignore */
        }
      }
    }
    for (const [layer, h] of [...this.ambience]) {
      if (!this.wantedAmbience.has(layer)) {
        h.stop();
        this.ambience.delete(layer);
      }
    }
  }
}

/** PLACEHOLDER ambience: looping filtered noise. */
function buildAmbience(ctx: AudioContext, out: AudioNode, layer: AmbienceLayer): AmbienceHandle {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 2);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  if (layer === 'wind') {
    f.type = 'bandpass';
    f.frequency.value = 500;
    g.gain.value = 0.25;
    lfo.frequency.value = 0.2;
    lfoGain.gain.value = 0.15; // slow gust modulation
  } else {
    f.type = 'bandpass';
    f.frequency.value = 900;
    g.gain.value = 0.12;
    lfo.frequency.value = 3;
    lfoGain.gain.value = 0.08; // murmur flutter
  }
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start();
  lfo.start();
  return {
    stop: () => {
      try {
        src.stop();
        lfo.stop();
        g.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}

export const audio = new AudioManager();
