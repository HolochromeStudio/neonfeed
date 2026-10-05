import { describe, it, expect } from 'vitest';
import atlasJson from '../assets/generated/town_atlas.json';
import { SPRITE_ANCHORS } from '../src/data/animations';
import {
  ARENAS, DUST_CREEK, DUST_CREEK_NIGHT, SALOON_INTERIOR, atlasFramesFromJson, getArena, validateArena, propRect,
} from '../src/data/arenas';

const frames = atlasFramesFromJson(atlasJson as never);

describe('arena definitions', () => {
  it('real atlas has frames', () => {
    expect(Object.keys(frames).length).toBeGreaterThan(100);
  });
  for (const def of Object.values(ARENAS)) {
    it(`${def.id} validates against the real atlas`, () => {
      expect(validateArena(def, frames)).toEqual([]);
    });
  }
  it('registry resolves ids and falls back to Dust Creek', () => {
    expect(getArena('saloon_interior')).toBe(SALOON_INTERIOR);
    expect(getArena('nope')).toBe(DUST_CREEK);
  });
  it('night variant keeps day geometry (zones and targets)', () => {
    expect(DUST_CREEK_NIGHT.targetZones).toEqual(DUST_CREEK.targetZones);
    expect(DUST_CREEK_NIGHT.heroZone).toEqual(DUST_CREEK.heroZone);
  });
  it('every prop frame has a sprite anchor', () => {
    for (const d of Object.values(ARENAS)) for (const p of d.props) expect(SPRITE_ANCHORS[p.frame]).toBeDefined();
  });
});

describe('validateArena catches bad data', () => {
  const clone = () => structuredClone(DUST_CREEK);
  const has = (errs: string[], s: string) => expect(errs.some((e) => e.includes(s)), errs.join('\n')).toBe(true);

  it('unknown frame', () => {
    const d = clone();
    d.props.push({ frame: 'nope', x: 10, y: 400, depth: -20 });
    has(validateArena(d, frames), "unknown frame 'nope'");
  });
  it('out of bounds', () => {
    const d = clone();
    d.props.push({ frame: 'barrel_a', x: 2, y: 400, depth: -20 });
    has(validateArena(d, frames), 'out of bounds');
  });
  it('prop on the enemy', () => {
    const d = clone();
    d.props.push({ frame: 'barrel_a', x: 250, y: 400, depth: -20 });
    has(validateArena(d, frames), 'overlaps enemy zone');
  });
  it('prop on the hero', () => {
    const d = clone();
    d.props.push({ frame: 'crate_small', x: 80, y: 470, depth: -20 });
    has(validateArena(d, frames), 'overlaps hero zone');
  });
  it('prop blocking the lane', () => {
    const d = clone();
    d.props.push({ frame: 'barrel_a', x: 165, y: 380, depth: -20 });
    has(validateArena(d, frames), 'blocks the central duel lane');
  });
  it('bad depth (on the character plane)', () => {
    const d = clone();
    d.props.push({ frame: 'barrel_a', x: 330, y: 500, depth: 0 });
    has(validateArena(d, frames), 'depth');
  });
  it('target outside its prop / missing prop', () => {
    const d = clone();
    d.targetZones[0]!.rect = { x: 0, y: 0, w: 30, h: 30 };
    has(validateArena(d, frames), 'outside its prop sprite');
    const e = clone();
    e.targetZones[0]!.propId = 'ghost';
    has(validateArena(e, frames), "missing prop 'ghost'");
  });
  it('layer order', () => {
    const d = clone();
    d.layers.find((l) => l.kind === 'mid')!.depth = -95;
    has(validateArena(d, frames), 'drawn behind');
  });
  it('non-integer positions', () => {
    const d = clone();
    d.props[0]!.x = 10.5;
    has(validateArena(d, frames), 'non-integer');
  });
});

describe('propRect', () => {
  it('uses bottom-centre anchor for buildings', () => {
    const r = propRect({ frame: 'saloon_front', x: 108, y: 306, depth: -50 }, frames)!;
    expect(r).toMatchObject({ w: 207, h: 223, y: 83 });
    expect(r.x).toBeCloseTo(4.5);
  });
});
