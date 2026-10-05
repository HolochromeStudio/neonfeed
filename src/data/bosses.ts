/**
 * Boss data (A07). Starting values from docs/GAME_DESIGN.md section 8; A18 tunes.
 * Times are milliseconds. "Cue" = the tell frame of the first shot of an attempt.
 *
 * Fairness (docs/GAME_DESIGN.md section 3), enforced by tests/boss*.test.ts:
 *  - F1: every lethal shot has its own tell at least FAIRNESS_FLOOR_MS (450) before it. Difficulty never shortens it.
 *  - F2: every tell kind is a triple cue (visual + audio + haptic); the scene plays all three.
 *  - F3: each phase names a counter (faster draw, dodge, disarm or environment trick shot).
 *  - F6: a fake tell has its own kind (silhouette + pitch) and the real tell comes >= 400 ms after it ends.
 *  - F7: `aimBudgetScale` never goes below 0.7 and slow-mo itself is never removed.
 *
 * Implementation status: only Mad Dog McGraw has `implemented: true` (full phase behaviour). The other three
 * bosses carry complete data, but the controller deliberately runs their phase-1 numbers in every phase until
 * their behaviours are built (TODO, see docs/BOSSES.md).
 */
import { BOSS_IDS, type BossId } from './dialogue';
import { FAIRNESS_FLOOR_MS, type Range } from './enemies';

export { BOSS_IDS };
export type { BossId };

/** Boss shots (inside a volley or between volleys) are never closer than this. Equals the F1 floor on purpose. */
export const BOSS_MIN_SHOT_GAP_MS = FAIRNESS_FLOOR_MS;
/** Longest invulnerability window any phase change may use. */
export const BOSS_MAX_INVULN_MS = 800;
/** F7: aim budget is never scaled below this. */
export const BOSS_MIN_AIM_BUDGET_SCALE = 0.7;
/** Fake tells leave at least this much quiet time before the real tell (F6). */
export const BOSS_MIN_FAKE_RECOVER_MS = 400;

export type BossPhaseNumber = 1 | 2 | 3;
export const BOSS_PHASES: readonly BossPhaseNumber[] = [1, 2, 3];

export interface BossFakeDef {
  /** Distinct tell id (own silhouette and pitch, F6). */
  kind: string;
  /** Probability a new volley starts with the fake, at difficulty 0 and 1. */
  chance: Range;
  /** Ms after the previous shot when the fake starts. */
  startMs: number;
  durationMs: number;
  /** Quiet time between the end of the fake and the real tell. >= BOSS_MIN_FAKE_RECOVER_MS. */
  recoverMs: number;
}

export interface BossPhaseDef {
  phase: BossPhaseNumber;
  name: string;
  /** Phase starts when boss hp / max hp is at or below this (1 for phase 1). */
  enterAtHpFraction: number;
  /** Short signposted window after the transition. Cosmetic until DuelSystem honours it (docs/BOSSES.md). */
  invulnerableMs: number;
  /** Extra quiet time before the first tell of the new phase (the roar). Only ever adds time. */
  windUpMs: number;
  tell: {
    /** Tell id for the lethal shots of this phase. */
    kind: string;
    /** Tell to lethal shot for a volley opener. Must be >= FAIRNESS_FLOOR_MS. */
    leadMs: number;
    /** Random extra on top of leadMs (never negative). */
    jitterMs: number;
  };
  volley: {
    /** Shots per volley. */
    shots: number;
    /** Gap between shots inside a volley (the beat). Both ends >= BOSS_MIN_SHOT_GAP_MS. One value is drawn per volley. */
    gapMs: Range;
    /** Quiet time between a volley's last shot and the next tell. */
    reloadMs: number;
  };
  /** Aim error px at difficulty 0; a shot hits when error <= enemyHitTolerancePx (24). */
  aimErrorPx: Range;
  fake?: BossFakeDef;
  /** Telegraph beats for one volley, shown by the scene (length == shots). */
  pattern: readonly string[];
  /** Scene may shorten the aim budget by this factor. >= BOSS_MIN_AIM_BUDGET_SCALE (F7). */
  aimBudgetScale: number;
  /** One-line player-facing signpost shown at the phase change. */
  signpost: string;
  /** What the player does about it (F3). */
  counter: string;
}

export interface BossEnvironmentTarget {
  id: string;
  /** Prop ids the scene/DuelSystem may report for this target (arena target zone propId or duel prop id). */
  propIds: readonly string[];
  /** Effect key the scene plays (ArenaDef.targetZones effect). */
  effect: string;
  /** Phases in which shooting it matters. */
  phases: readonly BossPhaseNumber[];
  /** Payoff: delays the boss's next tell by this much (adds time only). */
  staggerMs: number;
  hint: string;
}

export interface BossReward {
  /** Unique across bosses; the Roguelite system maps it to a legend perk. */
  id: string;
  name: string;
  kind: 'legend_perk';
  regionUnlock: string | null;
  coins: number;
}

export interface BossFailureDef {
  /** The attempt restarts at phase 1 with full boss hp; the seed (and so the plan) is unchanged (F5). */
  retryable: true;
  restartsAtPhase: 1;
  keepsSeed: true;
  /** F4: what to tell the player after losing in each phase. */
  hintByPhase: Record<BossPhaseNumber, string>;
}

export interface BossEntranceDef {
  banner: string;
  subtitle: string;
  /** Scene may skip after this long on a repeat attempt. */
  durationMs: number;
  /** Camera beat id for the scene. */
  camera: string;
  /** Show a demo of the phase-1 tell during the entrance so the first lesson is information, not luck. */
  previewTell: boolean;
}

export interface BossDef {
  id: BossId;
  name: string;
  /** Region id (see dialogue.ts RegionId). */
  region: string;
  arenaId: string;
  /** Dialogue entry in data/dialogue.ts (BOSS_DIALOGUE). Same as id. */
  dialogueId: BossId;
  /** True when phase behaviours beyond phase 1 are really built. */
  implemented: boolean;
  hp: number;
  /** Atlas prefix for the sprite (placeholder if no real sheet). */
  spritePrefix: string;
  hasRealSheet: boolean;
  /** Unique timing profile. */
  timing: { wait: Range; reactionMs: Range; drawTimeMs: Range };
  entrance: BossEntranceDef;
  /** Short identity of this boss's tell language (docs). */
  tellLanguage: string;
  mechanic: string;
  phases: readonly [BossPhaseDef, BossPhaseDef, BossPhaseDef];
  environment: readonly BossEnvironmentTarget[];
  reward: BossReward;
  failure: BossFailureDef;
}

const FAIL_BASE = { retryable: true, restartsAtPhase: 1, keepsSeed: true } as const;

export const BOSSES: Record<BossId, BossDef> = {
  // ---------------------------------------------------------------- Mad Dog McGraw (FULL)
  mad_dog_mcgraw: {
    id: 'mad_dog_mcgraw', name: 'Mad Dog McGraw', region: 'dust_creek', arenaId: 'dust_creek', dialogueId: 'mad_dog_mcgraw',
    implemented: true, hp: 3, spritePrefix: 'enemy', hasRealSheet: false,
    timing: { wait: [1500, 2900], reactionMs: [100, 170], drawTimeMs: [260, 340] },
    entrance: {
      banner: 'MAD DOG McGRAW', subtitle: 'Wanted for the burning of three towns', durationMs: 2600,
      camera: 'dog_silhouette_push_in', previewTell: true,
    },
    tellLanguage: 'Dog growl + eye flash. Fake: a whine and an ear twitch (higher pitch, no eye flash).',
    mechanic: 'Teaches phases and disarm. The bark rhythm in phase 3 is the pattern: shots land exactly on the beat.',
    phases: [
      {
        phase: 1, name: 'Straight Duel', enterAtHpFraction: 1, invulnerableMs: 0, windUpMs: 0,
        tell: { kind: 'dog_growl_eye_flash', leadMs: 720, jitterMs: 120 },
        volley: { shots: 1, gapMs: [900, 1100], reloadMs: 900 },
        aimErrorPx: [4, 44], pattern: ['growl'], aimBudgetScale: 1,
        signpost: 'Growl, flash, bang. One shot at a time.',
        counter: 'Faster draw, or a gun-arm hit to cancel the shot.',
      },
      {
        phase: 2, name: 'Rage', enterAtHpFraction: 0.67, invulnerableMs: 500, windUpMs: 500,
        tell: { kind: 'dog_growl_eye_flash', leadMs: 650, jitterMs: 100 },
        volley: { shots: 2, gapMs: [640, 760], reloadMs: 700 },
        aimErrorPx: [0, 40],
        fake: { kind: 'dog_whine_ear_twitch', chance: [0.5, 0.9], startMs: 250, durationMs: 300, recoverMs: 450 },
        pattern: ['growl', 'growl'], aimBudgetScale: 0.9,
        signpost: 'He whines and twitches first: that is a fake. Wait for the eye flash. Two shots now.',
        counter: 'Do not draw on the whine. Dodge or disarm the second shot. The sign above him can be shot to stagger him.',
      },
      {
        phase: 3, name: 'The Charge', enterAtHpFraction: 0.34, invulnerableMs: 600, windUpMs: 600,
        tell: { kind: 'dog_howl_triple_bark', leadMs: 600, jitterMs: 80 },
        volley: { shots: 3, gapMs: [470, 540], reloadMs: 600 },
        aimErrorPx: [6, 50],
        pattern: ['bark', 'bark', 'bang'], aimBudgetScale: 0.8,
        signpost: 'Bark, bark, BANG on the beat. Three shots at one tempo.',
        counter: 'Hit his gun arm to cancel a shot; the barrel by his feet also staggers him.',
      },
    ],
    environment: [
      {
        id: 'sign', propIds: ['sign'], effect: 'sign_swing', phases: [2], staggerMs: 700,
        hint: 'Shoot the saloon sign: it swings into him and he loses a beat.',
      },
      {
        id: 'barrel', propIds: ['barrel', 'barrel_target'], effect: 'barrel_burst', phases: [3], staggerMs: 900,
        hint: 'Shoot the barrel: the dust blinds him and delays his next volley.',
      },
    ],
    reward: { id: 'legend_mad_dog_fang', name: 'Mad Dog Fang', kind: 'legend_perk', regionUnlock: 'canyon', coins: 150 },
    failure: {
      ...FAIL_BASE,
      hintByPhase: {
        1: 'Wait for the eye flash, then draw. Aim for the head or the gun arm.',
        2: 'The whine is a fake. Draw only on the eye flash.',
        3: 'Count the barks. Disarm him, or shoot the barrel to break his rhythm.',
      },
    },
  },

  // ---------------------------------------------------------------- The Undertaker (TODO behaviour)
  the_undertaker: {
    id: 'the_undertaker', name: 'The Undertaker', region: 'canyon', arenaId: 'canyon', dialogueId: 'the_undertaker',
    implemented: false, hp: 4, spritePrefix: 'enemy', hasRealSheet: false,
    timing: { wait: [2000, 3400], reactionMs: [120, 200], drawTimeMs: [300, 380] },
    entrance: {
      banner: 'THE UNDERTAKER', subtitle: 'He has already measured you', durationMs: 2800,
      camera: 'coffin_rise', previewTell: true,
    },
    tellLanguage: 'Bell toll countdown: the shot lands on the third toll. Fake: a muffled toll (lower pitch).',
    mechanic: 'Cover plus trick shot. Shoot the dynamite on the coffin for a big hit.',
    phases: [
      {
        phase: 1, name: 'Behind the Coffin', enterAtHpFraction: 1, invulnerableMs: 0, windUpMs: 0,
        tell: { kind: 'bell_toll_countdown', leadMs: 900, jitterMs: 100 },
        volley: { shots: 1, gapMs: [900, 1100], reloadMs: 1000 },
        aimErrorPx: [4, 40], pattern: ['toll'], aimBudgetScale: 1,
        signpost: 'He shoots from behind the coffin on the third toll.',
        counter: 'Hit the gun arm when it peeks out, or draw on the first toll.',
      },
      {
        phase: 2, name: 'Dynamite', enterAtHpFraction: 0.67, invulnerableMs: 500, windUpMs: 500,
        tell: { kind: 'bell_toll_countdown', leadMs: 800, jitterMs: 100 },
        volley: { shots: 1, gapMs: [800, 1000], reloadMs: 800 },
        aimErrorPx: [0, 40],
        fake: { kind: 'bell_toll_muffled', chance: [0.3, 0.6], startMs: 250, durationMs: 400, recoverMs: 450 },
        pattern: ['toll'], aimBudgetScale: 0.9,
        signpost: 'The coffin opens: dynamite. Shoot it.',
        counter: 'Shoot the dynamite for a big hit instead of the body.',
      },
      {
        phase: 3, name: 'Pallbearers', enterAtHpFraction: 0.34, invulnerableMs: 600, windUpMs: 600,
        tell: { kind: 'bell_toll_countdown', leadMs: 700, jitterMs: 80 },
        volley: { shots: 2, gapMs: [600, 700], reloadMs: 700 },
        aimErrorPx: [4, 46], pattern: ['toll', 'toll'], aimBudgetScale: 0.85,
        signpost: 'Rookies carry in the coffin. Kill the weakest first.',
        counter: 'Clear the adds (TODO: needs multi-target DuelSystem support).',
      },
    ],
    environment: [
      {
        id: 'dynamite', propIds: ['dynamite'], effect: 'dynamite_blast', phases: [2], staggerMs: 1200,
        hint: 'Shoot the dynamite strapped to the coffin.',
      },
    ],
    reward: { id: 'legend_undertaker_bell', name: "Undertaker's Bell", kind: 'legend_perk', regionUnlock: 'railroad', coins: 200 },
    failure: {
      ...FAIL_BASE,
      hintByPhase: {
        1: 'Count the tolls. The shot comes on the third.',
        2: 'Shoot the dynamite, not the coffin.',
        3: 'Take out the weakest rookie first.',
      },
    },
  },

  // ---------------------------------------------------------------- Lady Luck (TODO behaviour)
  lady_luck: {
    id: 'lady_luck', name: 'Lady Luck', region: 'saloon', arenaId: 'saloon_interior', dialogueId: 'lady_luck',
    implemented: false, hp: 4, spritePrefix: 'enemy', hasRealSheet: false,
    timing: { wait: [1800, 3200], reactionMs: [80, 150], drawTimeMs: [240, 320] },
    entrance: {
      banner: 'LADY LUCK', subtitle: 'The house always wins', durationMs: 2600,
      camera: 'card_table_pan', previewTell: true,
    },
    tellLanguage: 'Card flick: the suit shown is the rule for this beat. Fake: a card shuffle (riffle sound).',
    mechanic: 'Information and decision. Luck is shown, never hidden: the active rule is on screen before each beat.',
    phases: [
      {
        phase: 1, name: 'Cards', enterAtHpFraction: 1, invulnerableMs: 0, windUpMs: 0,
        tell: { kind: 'card_flick', leadMs: 700, jitterMs: 100 },
        volley: { shots: 1, gapMs: [900, 1100], reloadMs: 900 },
        aimErrorPx: [4, 40], pattern: ['card'], aimBudgetScale: 1,
        signpost: 'Pick one of three cards. Each card is a different rule.',
        counter: 'Read the card, then draw on the flick (TODO: card-pick UI and rule hooks).',
      },
      {
        phase: 2, name: 'Dice', enterAtHpFraction: 0.67, invulnerableMs: 500, windUpMs: 500,
        tell: { kind: 'card_flick', leadMs: 650, jitterMs: 100 },
        volley: { shots: 1, gapMs: [800, 1000], reloadMs: 800 },
        aimErrorPx: [0, 40],
        fake: { kind: 'card_riffle', chance: [0.3, 0.6], startMs: 250, durationMs: 300, recoverMs: 450 },
        pattern: ['dice'], aimBudgetScale: 0.9,
        signpost: 'The dice show this beat’s rule before it starts.',
        counter: 'Adapt to the shown rule (TODO: per-beat rule modifiers).',
      },
      {
        phase: 3, name: 'Roulette', enterAtHpFraction: 0.34, invulnerableMs: 600, windUpMs: 600,
        tell: { kind: 'card_flick', leadMs: 600, jitterMs: 80 },
        volley: { shots: 2, gapMs: [600, 700], reloadMs: 700 },
        aimErrorPx: [4, 44], pattern: ['spin', 'ball'], aimBudgetScale: 0.85,
        signpost: 'Bet on a zone. Shoot that zone to cheat the wheel.',
        counter: 'Shoot the zone you bet on (TODO: bet UI, zone bonus).',
      },
    ],
    environment: [
      {
        id: 'chandelier', propIds: ['lantern'], effect: 'lantern_smash', phases: [1, 2], staggerMs: 800,
        hint: 'Shoot the lantern: light flickers and her next flick comes late.',
      },
      {
        id: 'bottle', propIds: ['barrel', 'enemy_barrel'], effect: 'barrel_burst', phases: [3], staggerMs: 800,
        hint: 'Shoot the barrel: the wheel stalls for a beat.',
      },
    ],
    reward: { id: 'legend_lady_luck_ace', name: 'Ace of Spades', kind: 'legend_perk', regionUnlock: 'goldspire', coins: 250 },
    failure: {
      ...FAIL_BASE,
      hintByPhase: {
        1: 'Check which card you picked: its rule changes the duel.',
        2: 'The dice rule is shown before the beat. Read it.',
        3: 'Shoot the zone you bet on to beat the wheel.',
      },
    },
  },

  // ---------------------------------------------------------------- El Diablo (TODO behaviour)
  el_diablo: {
    id: 'el_diablo', name: 'El Diablo', region: 'blackwater_bay', arenaId: 'dust_creek_night', dialogueId: 'el_diablo',
    implemented: false, hp: 5, spritePrefix: 'enemy', hasRealSheet: false,
    timing: { wait: [2200, 3600], reactionMs: [90, 160], drawTimeMs: [260, 340] },
    entrance: {
      banner: 'EL DIABLO', subtitle: 'The Devil does not bleed', durationMs: 3000,
      camera: 'fog_silhouette_resolve', previewTell: true,
    },
    tellLanguage: 'Tell matches the phase: fog flicker (1), mirrored flash (2), then every previous tell in sequence (3).',
    mechanic: 'Exam boss: read each tell correctly. In phase 2 only the real image has the true tell shape.',
    phases: [
      {
        phase: 1, name: 'Silhouette in Fog', enterAtHpFraction: 1, invulnerableMs: 0, windUpMs: 0,
        tell: { kind: 'fog_flicker', leadMs: 800, jitterMs: 120 },
        volley: { shots: 1, gapMs: [900, 1100], reloadMs: 1000 },
        aimErrorPx: [4, 40], pattern: ['flicker'], aimBudgetScale: 1,
        signpost: 'He is a silhouette. Watch the fog flicker.',
        counter: 'Draw on the flicker; shoot the lantern to light him up.',
      },
      {
        phase: 2, name: 'Mirror Image', enterAtHpFraction: 0.67, invulnerableMs: 500, windUpMs: 500,
        tell: { kind: 'mirror_flash', leadMs: 700, jitterMs: 100 },
        volley: { shots: 1, gapMs: [800, 1000], reloadMs: 800 },
        aimErrorPx: [0, 40],
        fake: { kind: 'mirror_shimmer', chance: [0.4, 0.7], startMs: 250, durationMs: 300, recoverMs: 450 },
        pattern: ['mirror'], aimBudgetScale: 0.9,
        signpost: 'Two of him. Only the real one flashes with the true shape.',
        counter: 'Shoot the image that shows the true tell shape (TODO: decoy targets).',
      },
      {
        phase: 3, name: 'Final Judgement', enterAtHpFraction: 0.34, invulnerableMs: 600, windUpMs: 600,
        tell: { kind: 'tell_medley', leadMs: 650, jitterMs: 80 },
        volley: { shots: 3, gapMs: [520, 620], reloadMs: 700 },
        aimErrorPx: [4, 46], pattern: ['fog_flicker', 'mirror_flash', 'bang'], aimBudgetScale: 0.85,
        signpost: 'Every tell you have learned, one after another.',
        counter: 'Answer each tell correctly (TODO: per-shot tell kinds and decoys).',
      },
    ],
    environment: [
      {
        id: 'lantern', propIds: ['lantern'], effect: 'lantern_smash', phases: [1, 3], staggerMs: 900,
        hint: 'Shoot a lantern: it lights him and shifts his next tell.',
      },
    ],
    reward: { id: 'legend_devil_horn', name: "Devil's Horn", kind: 'legend_perk', regionUnlock: null, coins: 400 },
    failure: {
      ...FAIL_BASE,
      hintByPhase: {
        1: 'Watch the fog, not the silhouette.',
        2: 'Only one image has the true tell shape.',
        3: 'Read each tell in turn; do not draw early.',
      },
    },
  },
};

export function getBossDef(id: string): BossDef {
  const d = (BOSSES as Record<string, BossDef | undefined>)[id];
  if (!d) throw new Error(`Unknown boss id: ${id}`);
  return d;
}

export function isBossId(id: string): id is BossId {
  return (BOSS_IDS as readonly string[]).includes(id);
}

/** Boss hp for a difficulty (0..1): +1 at depth difficulty >= 0.75, like enemyHpFor. */
export function bossHpFor(def: BossDef, difficulty: number): number {
  return def.hp + (difficulty >= 0.75 ? 1 : 0);
}
