import type { ArenaDef } from './types';
import { DUST_CREEK } from './dustCreek';
import { DUST_CREEK_NIGHT } from './dustCreekNight';
import { SALOON_INTERIOR } from './saloonInterior';

export * from './types';
export { validateArena, propRect, characterRect, rectsOverlap } from './validate';
export { DUST_CREEK, DUST_CREEK_NIGHT, SALOON_INTERIOR };

export const ARENAS: Readonly<Record<string, ArenaDef>> = {
  [DUST_CREEK.id]: DUST_CREEK,
  [DUST_CREEK_NIGHT.id]: DUST_CREEK_NIGHT,
  [SALOON_INTERIOR.id]: SALOON_INTERIOR,
};

export function getArena(id: string): ArenaDef {
  return ARENAS[id] ?? DUST_CREEK;
}
