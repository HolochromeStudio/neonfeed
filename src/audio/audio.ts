import { TRACKS, NON_LOOPING, type Track } from './tracks';
import { SPECIES } from '../data';

const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(n: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if (!m) return null;
  return 12 * (parseInt(m[3]) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Ev { step: number; len: number; note: number | null; drum?: string }
function parseChannel(p: string, drum: boolean): { ev: Ev[]; steps: number } {
  const ev: Ev[] = []; let step = 0;
  for (const tok of p.trim().split(/\s+/)) {
    if (!tok) continue;
    const [n, l] = tok.split(':'); const len = l ? parseInt(l) : 1;
    if (len === 0) continue;
    if (drum) { if (n !== '.' && n !== '-') ev.push({ step, len, note: null, drum: n }); }
    else if (n !== '-') { const mm = midi(n); if (mm !== null) ev.push({ step, len, note: mm }); }
    step += len;
  }
  return { ev, steps: step };
}

class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; sfxG!: GainNode;
  musicVol = 0.6; sfxVol = 0.7;
  current: string | null = null;
  private timer: number | null = null;
  private seq: { ch: { ev: Ev[]; steps: number; w: string; v: number; duty: number }[]; len: number; stepDur: number; next: number; step: number; track: Track; loop: boolean; bar: number } | null = null;
  glitch = false;
  private noiseBuf: AudioBuffer | null = null;
  private unlocked = false;

  init() {
    const unlock = () => {
      if (this.unlocked) return;
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
        this.music = this.ctx.createGain(); this.music.gain.value = this.musicVol; this.music.connect(this.master);
        this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = this.sfxVol; this.sfxG.connect(this.master);
        const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.unlocked = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.current) { const c = this.current; this.current = null; this.play(c); }
      } catch { /* audio unavailable */ }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { once: false, passive: true } as any);
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else this.ctx.resume(); });
  }
  setVolumes(music: number, sfx: number) {
    this.musicVol = music / 10 * 0.8; this.sfxVol = sfx / 10;
    if (this.ctx) { this.music.gain.value = this.musicVol; this.sfxG.gain.value = this.sfxVol; }
  }

  // ---------- music ----------
  play(name: string) {
    if (this.current === name && this.seq) return;
    this.current = name;
    if (!this.ctx) return;
    this.stopSeq();
    const tr = TRACKS[name]; if (!tr) return;
    this.start(tr, !NON_LOOPING.has(name));
  }
  stop() { this.current = null; this.stopSeq(); }
  /** Plays a jingle over silence, then resumes the previous track. */
  jingle(name: string, resume?: string) {
    if (!this.ctx) return;
    this.stopSeq(); const tr = TRACKS[name]; if (!tr) return;
    this.start(tr, false);
    const secs = this.seq ? this.seq.len * this.seq.stepDur : 2;
    this.current = resume ?? null;
    if (resume) window.setTimeout(() => { if (this.current === resume) { this.seq = null; this.play(resume); } }, secs * 1000 + 150);
  }
  private start(tr: Track, loop: boolean) {
    if (!this.ctx) return;
    const stepDur = 60 / tr.bpm / 4;
    const ch = tr.ch.map((c) => { const p = parseChannel(c.p, c.w === 'drum'); return { ...p, w: c.w, v: c.v, duty: c.duty ?? 0.5 }; });
    const len = Math.max(...ch.map((c) => c.steps));
    this.seq = { ch, len, stepDur, next: this.ctx.currentTime + 0.08, step: 0, track: tr, loop, bar: 0 };
    this.timer = window.setInterval(() => this.pump(), 30);
  }
  private stopSeq() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; this.seq = null; }
  private pump() {
    const s = this.seq; if (!s || !this.ctx) return;
    while (s.next < this.ctx.currentTime + 0.15) {
      const t = s.next;
      for (let ci = 0; ci < s.ch.length; ci++) {
        const c = s.ch[ci];
        if (this.glitch && (s.bar % 4 === 3) && ci === (s.bar >> 2) % s.ch.length) continue; // dropped channel
        const local = c.steps > 0 ? s.step % c.steps : 0;
        for (const e of c.ev) if (e.step === local) this.note(c, e, t, s.stepDur);
      }
      s.step++; s.next += s.stepDur;
      if (s.step % 16 === 0) s.bar++;
      if (s.step >= s.len) {
        if (s.loop) s.step = 0;
        else { this.stopSeq(); return; }
      }
    }
  }
  private note(c: { w: string; v: number; duty: number }, e: Ev, t: number, sd: number) {
    const ctx = this.ctx!;
    const dur = e.len * sd;
    if (c.w === 'drum') { this.drum(e.drum!, t, c.v); return; }
    let n = e.note!;
    if (this.glitch && Math.random() < 0.06) n += [1, -1, 12, -12][(Math.random() * 4) | 0];
    const o = ctx.createOscillator(); const g = ctx.createGain();
    if (c.w === 'square') { o.setPeriodicWave(this.pulse(c.duty)); } else o.type = c.w === 'tri' ? 'triangle' : 'sawtooth';
    o.frequency.value = hz(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(c.v, t + 0.006);
    g.gain.setValueAtTime(c.v * 0.85, t + Math.max(0.01, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.02);
  }
  private pulseCache: Record<number, PeriodicWave> = {};
  private pulse(duty: number): PeriodicWave {
    const k = Math.round(duty * 100);
    if (this.pulseCache[k]) return this.pulseCache[k];
    const N = 32; const re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    return (this.pulseCache[k] = this.ctx!.createPeriodicWave(re, im));
  }
  private drum(kind: string, t: number, v: number) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
      g.gain.setValueAtTime(v * 3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.14);
    } else {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; const g = ctx.createGain(); const f = ctx.createBiquadFilter();
      f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800;
      const dur = kind === 'h' ? 0.04 : 0.11;
      g.gain.setValueAtTime(v * (kind === 'h' ? 1.5 : 2.4), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.music); src.start(t, Math.random()); src.stop(t + dur + 0.02);
    }
  }

  // ---------- sfx ----------
  private blip(freq: number, dur: number, wave: OscillatorType = 'square', to?: number, vol = 0.12, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = wave;
    o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, f0: number, f1: number, vol = 0.15, delay = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; const g = this.ctx.createGain(); const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxG); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
  sfx(name: string) {
    if (!this.ctx) return;
    switch (name) {
      case 'move': this.blip(880, 0.03, 'square', undefined, 0.07); break;
      case 'select': this.blip(1320, 0.05, 'square', undefined, 0.09); this.blip(1760, 0.05, 'square', undefined, 0.07, 0.04); break;
      case 'back': this.blip(660, 0.06, 'square', 440, 0.09); break;
      case 'text': this.blip(1500, 0.015, 'square', undefined, 0.025); break;
      case 'step': this.noise(0.04, 400, 200, 0.05); break;
      case 'bump': this.blip(110, 0.07, 'square', 80, 0.1); break;
      case 'door': this.blip(520, 0.07, 'square', 260, 0.1); this.blip(260, 0.1, 'square', 130, 0.1, 0.07); break;
      case 'hit': this.noise(0.09, 2200, 400, 0.22); this.blip(180, 0.08, 'square', 70, 0.12); break;
      case 'super': this.noise(0.14, 3000, 300, 0.28); this.blip(300, 0.14, 'sawtooth', 60, 0.15); this.blip(900, 0.08, 'square', 300, 0.08, 0.05); break;
      case 'weak': this.noise(0.07, 800, 300, 0.1); this.blip(140, 0.08, 'square', 90, 0.08); break;
      case 'faint': this.blip(500, 0.5, 'square', 70, 0.13); this.noise(0.4, 1500, 100, 0.08); break;
      case 'levelup': [0, 1, 2, 3].forEach((i) => this.blip([523, 659, 784, 1047][i], 0.1, 'square', undefined, 0.09, i * 0.08)); break;
      case 'contain': this.blip(300, 0.4, 'sawtooth', 1800, 0.07); this.noise(0.4, 500, 5000, 0.1); break;
      case 'shake': this.blip(220, 0.08, 'square', 330, 0.1); this.blip(180, 0.1, 'square', 120, 0.1, 0.08); break;
      case 'contain_ok': [0, 1, 2, 3, 4].forEach((i) => this.blip([659, 784, 988, 1319, 1568][i], 0.12, 'square', undefined, 0.09, i * 0.09)); break;
      case 'contain_fail': this.blip(400, 0.3, 'square', 80, 0.12); this.noise(0.25, 2500, 200, 0.12); break;
      case 'heal': [0, 1, 2].forEach((i) => this.blip([784, 988, 1319][i], 0.12, 'triangle', undefined, 0.12, i * 0.1)); break;
      case 'item': this.blip(988, 0.07, 'square', undefined, 0.09); this.blip(1319, 0.14, 'square', undefined, 0.09, 0.07); break;
      case 'buy': this.blip(1200, 0.04, 'square', undefined, 0.08); this.blip(1600, 0.08, 'square', undefined, 0.08, 0.04); break;
      case 'error': this.blip(180, 0.12, 'square', undefined, 0.1); this.blip(140, 0.14, 'square', undefined, 0.1, 0.1); break;
      case 'glitch': for (let i = 0; i < 6; i++) this.blip(200 + Math.random() * 2000, 0.04, 'square', undefined, 0.07, i * 0.035); this.noise(0.25, 4000, 200, 0.12); break;
      case 'encounter': [0, 1, 2, 3, 4, 5].forEach((i) => this.blip(i % 2 ? 1400 : 700, 0.05, 'square', undefined, 0.09, i * 0.05)); break;
      case 'warp': this.blip(200, 0.3, 'sawtooth', 1200, 0.07); break;
      case 'pulse': this.blip(150, 0.4, 'sawtooth', 900, 0.1); this.blip(900, 0.3, 'square', 1800, 0.08, 0.2); this.noise(0.4, 600, 6000, 0.08); break;
      case 'power': this.blip(60, 0.8, 'sawtooth', 400, 0.12); this.noise(0.6, 200, 3000, 0.1); break;
      case 'power_off': this.blip(500, 0.5, 'sawtooth', 50, 0.12); this.noise(0.4, 3000, 100, 0.12); break;
      case 'scan': for (let i = 0; i < 5; i++) this.blip(600 + i * 150, 0.05, 'square', undefined, 0.07, i * 0.06); break;
      case 'alert': this.blip(1200, 0.08, 'square', undefined, 0.1); this.blip(1200, 0.08, 'square', undefined, 0.1, 0.12); break;
      case 'stat_up': this.blip(500, 0.12, 'square', 900, 0.09); break;
      case 'stat_down': this.blip(900, 0.12, 'square', 400, 0.09); break;
      case 'valve': this.noise(0.3, 300, 1200, 0.1); this.blip(120, 0.3, 'triangle', 200, 0.1); break;
      default: this.blip(800, 0.05);
    }
  }
  cry(species: string) {
    if (!this.ctx) return;
    const c = SPECIES[species]?.cry; if (!c) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = c.w === 'tri' ? 'triangle' : c.w === 'saw' ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(c.f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, c.f * c.s), t + c.d);
    if (c.v) { const l = this.ctx.createOscillator(); const lg = this.ctx.createGain(); l.frequency.value = c.v; lg.gain.value = c.f * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + c.d + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + c.d);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + c.d + 0.05);
  }
}
export const Audio = new AudioSys();
