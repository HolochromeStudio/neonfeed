export type TypeId = 'NULL' | 'SIGNAL' | 'LOOP' | 'CACHE' | 'VIRAL' | 'STATIC' | 'VECTOR' | 'CRYPT' | 'PULSE' | 'ARCHIVE' | 'GLITCH' | 'CORE';
export type StatId = 'hp' | 'atk' | 'def' | 'sys' | 'spd';
export type BattleStat = 'atk' | 'def' | 'sys' | 'spd';
export type StatusId = 'CORRUPTED' | 'DESYNCED' | 'FROZEN' | 'LOOPED' | 'MUTED' | 'OVERLOADED' | 'CACHED' | 'FRAGMENTED';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Growth = 'fast' | 'medium' | 'slow';
export type StabBehavior = 'normal' | 'frenzy' | 'calm' | 'flee' | 'regen';
export type AiArchetype = 'random' | 'basic' | 'smart';
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type Weather = 'clear' | 'rain' | 'static';

export type MoveFx =
  | { t: 'stab'; amt: number; who?: 'self' | 'foe' }
  | { t: 'stat'; stat: BattleStat; n: number; who: 'self' | 'foe' }
  | { t: 'status'; status: StatusId; chance: number; who: 'self' | 'foe' }
  | { t: 'heal'; pct: number }
  | { t: 'drain'; pct: number }
  | { t: 'recoil'; pct: number }
  | { t: 'multi'; min: number; max: number }
  | { t: 'crit' }
  | { t: 'unstable' }
  | { t: 'cure' }
  | { t: 'reboot' }
  | { t: 'copyLast' }
  | { t: 'field'; id: string; turns: number };

export interface MoveData {
  name: string; type: TypeId; cat: 'hit' | 'sys' | 'status'; power: number; acc: number; pp: number;
  pri?: number; desc: string; fx: MoveFx[];
}
export interface SpeciesData {
  name: string; dex: number; types: TypeId[];
  base: Record<StatId, number>; growth: Growth; exp: number;
  abilities: string[]; hidden: string; contain: number; stab: StabBehavior; rarity: string; ai: AiArchetype;
  learnset: [number, string][];
  evo: { to: string; lv?: number; item?: string; lowStab?: number; friendship?: number }[];
  desc: string;
  sprite: any; cry: { f: number; w: 'square' | 'tri' | 'saw'; s: number; d: number; v?: number };
}
export interface ItemData {
  name: string; cat: string; price: number; sell?: number; desc: string; use: 'field' | 'battle' | 'both' | 'contain' | 'none';
  fx: Record<string, any>;
}

export interface MoveSlot { id: string; pp: number; maxPp: number }
export interface Bytekin {
  uid: string;
  species: string;
  nick?: string;
  level: number;
  exp: number;
  hp: number;
  iv: Record<StatId, number>;
  moves: MoveSlot[];
  ability: string;
  hiddenProcess: boolean;
  status: StatusId | null;
  anomalous: boolean;
  fav: boolean;
  lowStabBattles: number;
  originMap?: string;
  caughtAt?: number;
}

export interface Settings {
  textSpeed: 1 | 2 | 3; gameSpeed: 1 | 2 | 3; difficulty: 'CASUAL' | 'STANDARD' | 'EXPERT';
  encounters: 'CLASSIC' | 'VISIBLE' | 'HYBRID'; musicVol: number; sfxVol: number; touchOpacity: number; swapPad: boolean;
  autosave: boolean; partyExp: boolean; battleAnim: boolean; crt: boolean; autoRun: boolean; hints: boolean;
}

export interface SaveData {
  version: number;
  name: string; look: { body: 'masc' | 'fem' | 'neutral'; skin: number; hair: number; jacket: number; bag: number };
  playtime: number; // seconds
  clock: number; // in-game minutes since day 0
  map: string; x: number; y: number; dir: Dir;
  flags: Record<string, boolean | number | string>;
  party: Bytekin[]; vault: Bytekin[];
  bag: Record<string, number>;
  credits: number;
  dex: Record<string, 0 | 1 | 2>; // 1 seen, 2 contained
  quests: Record<string, { state: 'active' | 'done'; progress: Record<string, number> }>;
  settings: Settings;
  stats: { battles: number; wins: number; contained: number; steps: number; faints: number };
  starter: string;
  rivalStarter: string;
  beaconSteps: number;
  lastHeal: { map: string; x: number; y: number };
  visited: string[];
  trainersBeaten: string[];
  scanned: string[];
  savedAt: number;
}
