import type { ArenaDef } from './types';
import { ARENA_DEPTH as D } from './types';

/**
 * Saloon interior: stamped wall panels and floor planks from the town sheet.
 * PLACEHOLDER: ceiling beam rect, floor shadow band, warm wall glow.
 */

const G = 298; // wall base / floor start

export const SALOON_INTERIOR: ArenaDef = {
  id: 'saloon_interior',
  region: 'dust_creek',
  layers: [
    {
      id: 'ceiling', kind: 'sky', parallax: 1, depth: D.sky, placeholder: true,
      items: [{ type: 'rect', y: 0, h: 640, color: 0x2a160c }],
    },
    {
      id: 'wall', kind: 'mid', parallax: 1, depth: D.mid,
      items: [
        // two rows of wall panels y=48..298 (visible 125px high), stamped (no repeat tiling)
        { type: 'stamp', frame: 'wall_saloon_shelf', x: 0, y: G - 125, cols: 1, rows: 1 },
        { type: 'stamp', frame: 'wall_saloon_lantern', x: 129, y: G - 125, cols: 1, rows: 1 },
        { type: 'stamp', frame: 'wall_saloon_plain', x: 222, y: G - 125, cols: 1, rows: 1 },
        { type: 'stamp', frame: 'wall_saloon_wanted_skull', x: 305, y: G - 125, cols: 1, rows: 1 },
        { type: 'stamp', frame: 'wall_saloon_plain', x: 0, y: G - 250, cols: 5, rows: 1 },
      ],
    },
    {
      id: 'floor', kind: 'ground', parallax: 1, depth: D.ground,
      items: [
        { type: 'stamp', frame: 'tile_floor_planks', x: -15, y: G, cols: 3, rows: 4 },
        { type: 'rect', y: G, h: 6, color: 0x3a1f10 },
      ],
    },
  ],
  props: [
    { id: 'piano', frame: 'piano', x: 92, y: 300, depth: -50, backdrop: true },
    { id: 'bar', frame: 'bar_counter', x: 290, y: 300, depth: -50, backdrop: true, bleed: true },
    { id: 'lantern', frame: 'lantern_hanging', x: 190, y: 120, anchor: { x: 0.5, y: 0.5 }, depth: -45, bright: true },
    { id: 'hero_barrel', frame: 'barrel_interior_a', x: 24, y: 458, depth: -30 },
    { id: 'hero_chair', frame: 'chair_wood', x: 142, y: 482, depth: -28 },
    { id: 'enemy_barrel', frame: 'barrel_interior_b', x: 334, y: 422, depth: -30 },
  ],
  heroZone: { x: 80, y: 470 },
  enemyZone: { x: 250, y: 400 },
  targetZones: [
    { id: 'lantern', propId: 'lantern', rect: { x: 172, y: 90, w: 36, h: 60 }, effect: 'lantern_smash' },
    { id: 'barrel', propId: 'enemy_barrel', rect: { x: 312, y: 366, w: 44, h: 56 }, effect: 'barrel_burst' },
  ],
  groundY: G,
  lights: [
    { x: 190, y: 120, r: 80, color: 0xffa040, alpha: 0.22, depth: -44 },
    { x: 178, y: 200, r: 60, color: 0xffa040, alpha: 0.12, depth: -75 },
  ],
};
