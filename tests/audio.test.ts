import { describe, it, expect } from 'vitest';
import { TRACKS, NON_LOOPING } from '../src/audio/tracks';

const steps = (p: string) => p.trim().split(/\s+/).reduce((s, t) => s + (t.includes(':') ? parseInt(t.split(':')[1]) : 1), 0);
const NOTE = /^([A-G][#b]?\d|-|[khs.])(:\d+)?$/;

describe('chiptune tracks', () => {
  it('every token is valid and channels stay in loop sync', () => {
    for (const [name, tr] of Object.entries(TRACKS)) {
      const lens = tr.ch.map((c) => steps(c.p));
      for (const c of tr.ch) for (const t of c.p.trim().split(/\s+/)) expect(NOTE.test(t), `${name}: bad token "${t}"`).toBe(true);
      const max = Math.max(...lens);
      if (NON_LOOPING.has(name)) continue;
      for (const l of lens) expect(max % l, `${name}: channel length ${l} does not divide ${max} (loop drift)`).toBe(0);
      expect(max, name).toBeGreaterThanOrEqual(16);
    }
  });
  it('jingles are marked non-looping and are short', () => {
    for (const j of NON_LOOPING) { const tr = TRACKS[j]; expect(tr).toBeTruthy(); const secs = (Math.max(...tr.ch.map((c) => steps(c.p))) * 60) / tr.bpm / 4; expect(secs, j).toBeLessThan(8); }
  });
});
