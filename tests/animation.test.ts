import { describe, it, expect } from 'vitest';
import catalogue from '../assets/generated/catalogue.json';
import { AnimationStateGraph, ALLOWED_TRANSITIONS } from '../src/animation/AnimationStateGraph';
import { characterAnimsFromSheet, sheetFrameNames } from '../src/animation/characterSheet';
import { registerAnimations } from '../src/animation/registerAnimations';
import { CHARACTER_STATES, type CharacterState } from '../src/animation/types';
import {
  ALL_ANIMATION_DEFS, PLACEHOLDER_FRAMES, SPRITE_ANCHORS, PLACEHOLDER_ATLAS,
} from '../src/data/animations';

describe('AnimationStateGraph', () => {
  it('starts idle and follows normal duel flow', () => {
    const g = new AnimationStateGraph();
    expect(g.state).toBe('idle');
    expect(g.transition('draw')).toBe(true);
    expect(g.complete()).toBe('aim');
    expect(g.transition('shoot')).toBe(true);
    expect(g.complete()).toBe('aim');
  });
  it('rejects illegal transitions', () => {
    const g = new AnimationStateGraph();
    expect(g.transition('shoot')).toBe(false);
    expect(g.transition('aim')).toBe(false);
    expect(g.state).toBe('idle');
  });
  it('hit interrupts every live state and returns to idle', () => {
    for (const s of ['idle', 'draw', 'aim', 'shoot'] as CharacterState[]) {
      const g = new AnimationStateGraph(s);
      expect(g.transition('hit')).toBe(true);
      expect(g.complete()).toBe('idle');
    }
  });
  it('dead is terminal and cannot be left or interrupted by hit', () => {
    const g = new AnimationStateGraph('aim');
    expect(g.transition('dead')).toBe(true);
    expect(g.isTerminal).toBe(true);
    for (const s of CHARACTER_STATES) expect(g.transition(s)).toBe(false);
    expect(g.complete()).toBeNull();
    expect(g.state).toBe('dead');
  });
  it('every non-dead state can reach dead; only dead has no exits', () => {
    for (const s of CHARACTER_STATES) {
      if (s === 'dead') expect(ALLOWED_TRANSITIONS.dead).toHaveLength(0);
      else expect(ALLOWED_TRANSITIONS[s]).toContain('dead');
    }
  });
});

describe('animation defs', () => {
  it('every frame exists in the placeholder contract', () => {
    const contract = new Set(PLACEHOLDER_FRAMES);
    for (const d of ALL_ANIMATION_DEFS) {
      expect(d.atlas).toBe(PLACEHOLDER_ATLAS);
      for (const f of d.frames) expect(contract.has(f), `${d.key}:${f}`).toBe(true);
    }
  });
  it('keys are unique and next targets exist', () => {
    const keys = ALL_ANIMATION_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of ALL_ANIMATION_DEFS) if (d.next) expect(keys).toContain(d.next);
  });
  it('covers each state for hero and enemy with expected timing', () => {
    const by = new Map(ALL_ANIMATION_DEFS.map((d) => [d.key, d]));
    for (const p of ['hero', 'enemy']) {
      for (const s of CHARACTER_STATES) expect(by.has(`${p}_${s}`)).toBe(true);
      expect(by.get(`${p}_idle`)).toMatchObject({ frameRate: 3, repeat: -1, oneShot: false });
      expect(by.get(`${p}_draw`)!.frameRate).toBeGreaterThanOrEqual(16);
      expect(by.get(`${p}_draw`)!.oneShot).toBe(true);
      expect(by.get(`${p}_dead`)!.next).toBeUndefined();
      expect(by.get(`${p}_dead`)!.repeat).toBe(0);
    }
  });
  it('one-shots never loop', () => {
    for (const d of ALL_ANIMATION_DEFS) if (d.oneShot) expect(d.repeat).toBe(0);
  });
});

describe('characterAnimsFromSheet', () => {
  it('builds all states from the 6 sheet frames', () => {
    const defs = characterAnimsFromSheet('bandit', 'characters_atlas');
    const valid = new Set(sheetFrameNames('bandit'));
    expect(valid.size).toBe(6);
    expect(defs.map((d) => d.key)).toEqual(CHARACTER_STATES.map((s) => `bandit_${s}`));
    for (const d of defs) for (const f of d.frames) expect(valid.has(f)).toBe(true);
    expect(defs[0].frames).toEqual(['bandit_idle', 'bandit_idle2']);
  });
});

describe('registerAnimations', () => {
  it('creates each def once and guards duplicates', () => {
    const made: string[] = [];
    const scene = {
      anims: {
        exists: (k: string) => made.includes(k),
        create: (c: { key: string }) => { made.push(c.key); return {}; },
      },
    };
    const first = registerAnimations(scene);
    expect(first).toHaveLength(ALL_ANIMATION_DEFS.length);
    expect(registerAnimations(scene)).toHaveLength(0);
    expect(made).toHaveLength(ALL_ANIMATION_DEFS.length);
  });
});

describe('SPRITE_ANCHORS', () => {
  it('covers every catalogue key and nothing else', () => {
    const cat: Record<string, unknown> = catalogue;
    expect(Object.keys(SPRITE_ANCHORS).sort()).toEqual(Object.keys(cat).sort());
  });
  it('applies the base conventions', () => {
    expect(SPRITE_ANCHORS.saloon_front).toMatchObject({ x: 0.5, y: 1 });
    expect(SPRITE_ANCHORS.barrel_a).toMatchObject({ x: 0.5, y: 1 });
    expect(SPRITE_ANCHORS.tile_floor_planks).toMatchObject({ x: 0, y: 0 });
  });
});
