// Wanted-poster copy for every enemy and boss. Dependency-free typed data.

export type WantedKind = 'enemy' | 'boss';

export interface WantedEntry {
  id: string;
  kind: WantedKind;
  name: string;
  alias?: string;
  crime: string;
  /** Bounty in coins. */
  reward: number;
  tagline: string;
}

export const WANTED: WantedEntry[] = [
  { id: 'rookie', kind: 'enemy', name: 'Billy "Fresh Boots" Hayes', crime: 'Drawing on a man before learning to aim', reward: 25, tagline: 'More hat than hand.' },
  { id: 'bandit', kind: 'enemy', name: 'Santos "Quickpurse" Vega', crime: 'Stagecoach robbery and general pocket-lightening', reward: 60, tagline: 'Wants your gold. Settles for your boots.' },
  { id: 'gunslinger', kind: 'enemy', name: 'Cole "Two-Notch" Danner', crime: 'Eleven duels, eleven graves', reward: 150, tagline: 'Notches on the grip. Room for one more.' },
  { id: 'coward', kind: 'enemy', name: 'Lemuel "Yellow" Pruitt', crime: 'Shooting a man in the back, then running from the sheriff', reward: 40, tagline: 'Fast on his feet. Slow on his word.' },
  { id: 'drunk', kind: 'enemy', name: 'Old Hollis Tibbs', crime: 'Disturbing the peace and shooting the saloon chandelier', reward: 30, tagline: 'Aims at two of you. Hits neither. Usually.' },
  { id: 'sheriff', kind: 'enemy', name: 'Sheriff Amos Kane', crime: 'Selling the law to the highest bidder', reward: 200, tagline: 'The star is tin. The bullets are not.' },
  { id: 'dual_wielder', kind: 'enemy', name: 'The Gemini Brothers (as one man)', alias: 'Double Trouble', crime: 'Twice the shots, twice the funerals', reward: 280, tagline: 'Two guns. One bad idea.' },
  { id: 'sniper', kind: 'enemy', name: 'Ezekiel "Longview" Marsh', crime: 'Murder at six hundred paces', reward: 320, tagline: 'You will not hear it. You will not see him.' },
  { id: 'knife_thrower', kind: 'enemy', name: 'Rosalind "Stitch" Okafor', crime: 'Carnival cutlery used with ill intent', reward: 240, tagline: 'Quiet steel. Loud regrets.' },
  { id: 'train_guard', kind: 'enemy', name: 'Dutch Ballard', crime: 'Guarding stolen Pacific Line gold with deadly force', reward: 350, tagline: 'Paid by the mile, armed by the ton.' },
  { id: 'horse_rider', kind: 'enemy', name: 'Wild Tomas Reyes', crime: 'Trampling the Dust Creek parade', reward: 380, tagline: 'Rides like thunder. Falls like it too.' },
  { id: 'bounty_hunter', kind: 'enemy', name: 'Silas Crowe', alias: 'The Collector', crime: 'Bringing in targets with the wrong end of the paperwork', reward: 600, tagline: 'He hunts hunters. You are now on the list.' },
  { id: 'mad_dog_mcgraw', kind: 'boss', name: 'Mad Dog McGraw', crime: 'Burning three towns and howling at the ashes', reward: 1000, tagline: 'Wanted alive. Nobody has managed it.' },
  { id: 'the_undertaker', kind: 'boss', name: 'The Undertaker', alias: 'Mr. Graves', crime: 'Digging graves before the fight is even booked', reward: 2000, tagline: 'He measures you on the way in.' },
  { id: 'lady_luck', kind: 'boss', name: 'Lady Luck', alias: 'Delphine Rourke', crime: 'Cheating death, cards, and the Goldspire bank', reward: 3500, tagline: 'The house always wins. She is the house.' },
  { id: 'el_diablo', kind: 'boss', name: 'El Diablo', alias: 'The Devil of Blackwater', crime: 'Every crime in the territory, signed in red', reward: 7500, tagline: 'Dead or alive. Preferably neither.' },
];

const WANTED_BY_ID: Record<string, WantedEntry> = Object.fromEntries(WANTED.map((w) => [w.id, w]));

export function getWanted(id: string): WantedEntry | undefined {
  return WANTED_BY_ID[id];
}

export function getWantedByKind(kind: WantedKind): WantedEntry[] {
  return WANTED.filter((w) => w.kind === kind);
}

export function formatReward(coins: number): string {
  return `$${coins} REWARD`;
}
