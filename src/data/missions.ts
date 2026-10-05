/** Mission definitions (A09). Dependency-free typed data. Rewards are coins. */

export type MissionEventType =
  | 'duel_won' | 'perfect_draw' | 'headshot' | 'no_damage_duel'
  | 'boss_defeated' | 'wanted_defeated' | 'region_clear' | 'run_played' | 'run_won';

export type Cadence = 'daily' | 'weekly' | 'achievement';

export interface MissionDef {
  id: string;
  title: string;
  desc: string;
  cadence: Cadence;
  event: MissionEventType;
  target: number;
  reward: number;
  /** True: progress is the best single-run count (max). False: cumulative across runs. */
  perRun?: boolean;
  /** Only events with this id count (enemy/boss/region id). */
  filterId?: string;
}

const d = (id: string, title: string, event: MissionEventType, target: number, reward: number, extra: Partial<MissionDef> = {}): MissionDef =>
  ({ id, title, desc: title, cadence: 'daily', event, target, reward, ...extra });
const w = (id: string, title: string, event: MissionEventType, target: number, reward: number, extra: Partial<MissionDef> = {}): MissionDef =>
  ({ id, title, desc: title, cadence: 'weekly', event, target, reward, ...extra });
const a = (id: string, title: string, event: MissionEventType, target: number, reward: number, extra: Partial<MissionDef> = {}): MissionDef =>
  ({ id, title, desc: title, cadence: 'achievement', event, target, reward, ...extra });

export const DAILY_POOL: MissionDef[] = [
  d('d_duels_5', 'Win 5 duels', 'duel_won', 5, 15),
  d('d_perfect_3', 'Land 3 Perfect Draws', 'perfect_draw', 3, 20),
  d('d_perfect_run_2', 'Land 2 Perfect Draws in one run', 'perfect_draw', 2, 15, { perRun: true }),
  d('d_head_3', 'Land 3 headshots', 'headshot', 3, 20),
  d('d_nodmg_2', 'Win 2 duels without taking a hit', 'no_damage_duel', 2, 25),
  d('d_wanted_3', 'Bring in 3 wanted outlaws', 'wanted_defeated', 3, 20),
  d('d_run_1', 'Play a run', 'run_played', 1, 10),
  d('d_clear_1', 'Clear a region', 'region_clear', 1, 30),
  d('d_boss_1', 'Defeat a boss', 'boss_defeated', 1, 35),
];

export const WEEKLY_POOL: MissionDef[] = [
  w('w_duels_30', 'Win 30 duels', 'duel_won', 30, 90),
  w('w_perfect_20', 'Land 20 Perfect Draws', 'perfect_draw', 20, 110),
  w('w_head_20', 'Land 20 headshots', 'headshot', 20, 100),
  w('w_nodmg_10', 'Win 10 duels without a hit', 'no_damage_duel', 10, 120),
  w('w_boss_3', 'Defeat 3 bosses', 'boss_defeated', 3, 140),
  w('w_wanted_15', 'Bring in 15 wanted outlaws', 'wanted_defeated', 15, 100),
  w('w_runs_7', 'Play 7 runs', 'run_played', 7, 80),
  w('w_win_1', 'Win a full run', 'run_won', 1, 150),
];

/** One-off goals. Never expire, never repeat. */
export const ACHIEVEMENTS: MissionDef[] = [
  a('a_first_blood', 'Win your first duel', 'duel_won', 1, 10),
  a('a_perfect_50', 'Land 50 Perfect Draws', 'perfect_draw', 50, 150),
  a('a_head_100', 'Land 100 headshots', 'headshot', 100, 150),
  a('a_nodmg_25', 'Win 25 duels without a hit', 'no_damage_duel', 25, 200),
  a('a_mad_dog', 'Defeat Mad Dog McGraw', 'boss_defeated', 1, 100, { filterId: 'mad_dog_mcgraw' }),
  a('a_undertaker', 'Defeat The Undertaker', 'boss_defeated', 1, 200, { filterId: 'the_undertaker' }),
  a('a_collector', 'Bring in The Collector', 'wanted_defeated', 1, 120, { filterId: 'bounty_hunter' }),
  a('a_clear_dust', 'Clear Dust Creek', 'region_clear', 1, 60, { filterId: 'dust_creek' }),
  a('a_clear_canyon', 'Clear the Canyon', 'region_clear', 1, 120, { filterId: 'canyon' }),
  a('a_clear_rail', 'Clear the Railroad', 'region_clear', 1, 200, { filterId: 'railroad' }),
  a('a_run_win', 'Win a full run', 'run_won', 1, 250),
];

export const ALL_MISSIONS: MissionDef[] = [...DAILY_POOL, ...WEEKLY_POOL, ...ACHIEVEMENTS];
const BY_ID: Record<string, MissionDef> = Object.fromEntries(ALL_MISSIONS.map((m) => [m.id, m]));
export const getMissionDef = (id: string): MissionDef | undefined => BY_ID[id];

// --- Daily bounty board (wanted-poster contracts) ---
/** One easy, one mid, one hard contract each day, drawn from these pools. */
export const BOARD_POOLS = {
  easy: ['rookie', 'bandit', 'coward', 'drunk'],
  mid: ['gunslinger', 'sheriff', 'dual_wielder', 'sniper', 'knife_thrower', 'train_guard', 'horse_rider'],
  hard: ['bounty_hunter', 'mad_dog_mcgraw', 'the_undertaker'],
} as const;

export const BOARD_RULES = {
  dailyMissions: 3,
  weeklyMissions: 2,
  /** Contract pays this fraction of the wanted-poster reward, rounded to 5, capped. */
  contractRate: 0.2,
  contractCap: 150,
  contractMin: 5,
} as const;
