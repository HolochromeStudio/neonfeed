import type { ArenaDef, ArenaProp } from './types';
import { DUST_CREEK, dustCreekLayers, dustCreekProps, type ArenaPalette } from './dustCreek';

/**
 * Dust Creek at night: same geometry (so hit rects and zones are identical),
 * different palette (PLACEHOLDER procedural), blue multiply tint on atlas
 * sprites, and warm lantern glows (PLACEHOLDER additive discs).
 */

export const DUST_CREEK_NIGHT_PALETTE: ArenaPalette = {
  skyBands: [0x10163a, 0x182050, 0x242a63, 0x343672, 0x4a4580],
  sun: 0xe8efff, // moon
  farRidge: 0x2b2f5c,
  midRidge: 0x1f2348,
  ground: 0x5a5272,
  groundHorizon: 0x3c3654,
  groundLane: 0x655c7e,
  speckle: 0x3c3654,
  speckleLight: 0x7a7094,
};

const props: ArenaProp[] = [
  ...dustCreekProps(),
  // lit lantern on the saloon porch + one on the hero side (not tinted)
  { id: 'porch_lantern', frame: 'lantern_hanging', x: 206, y: 262, anchor: { x: 0.5, y: 0.5 }, depth: -38, bright: true, backdrop: true },
  { id: 'hero_lantern', frame: 'lantern_hanging', x: 60, y: 268, anchor: { x: 0.5, y: 0.5 }, depth: -37, bright: true },
];

export const DUST_CREEK_NIGHT: ArenaDef = {
  ...DUST_CREEK,
  id: 'dust_creek_night',
  layers: dustCreekLayers(DUST_CREEK_NIGHT_PALETTE),
  props,
  tint: 0x7f8cc8,
  lights: [
    { x: 206, y: 262, r: 46, color: 0xffb347, alpha: 0.35, depth: -36 },
    { x: 60, y: 268, r: 40, color: 0xffb347, alpha: 0.3, depth: -36 },
    { x: 110, y: 250, r: 70, color: 0xffa040, alpha: 0.18, depth: -55 },
  ],
};
