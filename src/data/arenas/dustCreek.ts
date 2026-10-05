import type { ArenaDef, ArenaLayer, ArenaProp } from './types';
import { ARENA_DEPTH as D } from './types';

/**
 * Dust Creek (region 1): compact duel street. Backdrop is the saloon front on
 * the left; the right is open dust so the bandit's silhouette reads against a
 * plain band. Hero side gets barrels + hay. Hanging sign on the right is the
 * shootable environment target.
 *
 * PLACEHOLDER parts (until the desert terrain sheet, blocker B1): sky bands,
 * sun, far/mid ridges, ground fill + speckle. See docs/MISSING_ASSETS.md.
 */

export const DUST_CREEK_GROUND_Y = 300;

export interface ArenaPalette {
  skyBands: readonly number[];
  sun: number;
  farRidge: number;
  midRidge: number;
  ground: number;
  groundHorizon: number;
  groundLane: number;
  speckle: number;
  speckleLight: number;
}

export const DUST_CREEK_PALETTE: ArenaPalette = {
  skyBands: [0xd2884a, 0xdc9a58, 0xe5ad68, 0xedc17b, 0xf2d08f],
  sun: 0xffe9a8,
  farRidge: 0xc48b62,
  midRidge: 0xad7650,
  ground: 0xc79a5c,
  groundHorizon: 0xa57a44,
  groundLane: 0xd0a766,
  speckle: 0xa57a44,
  speckleLight: 0xe0be84,
};

export function dustCreekLayers(P: ArenaPalette): ArenaLayer[] {
  const g = DUST_CREEK_GROUND_Y;
  return [
    {
      id: 'sky', kind: 'sky', parallax: 1, depth: D.sky, placeholder: true,
      items: [
        { type: 'bands', y: 0, h: g, colors: [...P.skyBands] },
        { type: 'disc', x: 296, y: 92, r: 26, color: P.sun },
      ],
    },
    {
      id: 'far-ridge', kind: 'far', parallax: 0.3, depth: D.far, placeholder: true,
      items: [{ type: 'ridge', y: g, h: 78, color: P.farRidge, seed: 7, step: 6 }],
    },
    {
      id: 'mid-ridge', kind: 'mid', parallax: 0.6, depth: D.mid, placeholder: true,
      items: [{ type: 'ridge', y: g, h: 40, color: P.midRidge, seed: 19, step: 8 }],
    },
    {
      id: 'ground', kind: 'ground', parallax: 1, depth: D.ground, placeholder: true,
      items: [
        { type: 'rect', y: g, h: 640 - g, color: P.ground },
        { type: 'rect', y: g, h: 6, color: P.groundHorizon },
        // duel lane: slightly lighter flat band under the enemy so the silhouette pops
        { type: 'rect', y: 330, h: 110, color: P.groundLane },
        { type: 'speckle', y: g + 8, h: 640 - g - 8, color: P.speckle, seed: 3, count: 140 },
        { type: 'speckle', y: g + 8, h: 640 - g - 8, color: P.speckleLight, seed: 11, count: 90 },
      ],
    },
  ];
}

/** Props shared by the day/night variants. */
export function dustCreekProps(): ArenaProp[] {
  return [
    // backdrop: saloon front, left. Base slightly below the horizon so it sits on the ground.
    { id: 'saloon', frame: 'saloon_front', x: 108, y: 306, depth: -50, backdrop: true },
    // enemy side: hanging sign pole + barrel, nothing else behind the bandit
    { id: 'sign_post', frame: 'trim_post_tall_b', x: 338, y: 306, depth: -40 },
    { id: 'sign', frame: 'sign_saloon', x: 304, y: 236, anchor: { x: 0.5, y: 0.5 }, depth: -39 },
    { id: 'barrel_target', frame: 'barrel_b', x: 332, y: 404, depth: -30 },
    // hero side cover
    { id: 'hero_barrel', frame: 'barrel_a', x: 23, y: 456, depth: -30 },
    { id: 'hero_crate', frame: 'crate_small', x: 24, y: 400, depth: -31 },
    { id: 'hero_hay', frame: 'hay_bale', x: 142, y: 486, depth: -28 },
  ];
}

export const DUST_CREEK: ArenaDef = {
  id: 'dust_creek',
  region: 'dust_creek',
  layers: dustCreekLayers(DUST_CREEK_PALETTE),
  props: dustCreekProps(),
  heroZone: { x: 80, y: 470 },
  enemyZone: { x: 250, y: 400 },
  targetZones: [
    { id: 'sign', propId: 'sign', rect: { x: 270, y: 222, w: 68, h: 40 }, effect: 'sign_swing' },
    { id: 'barrel', propId: 'barrel_target', rect: { x: 312, y: 352, w: 41, h: 52 }, effect: 'barrel_burst' },
  ],
  groundY: DUST_CREEK_GROUND_Y,
};
