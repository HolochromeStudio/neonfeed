/**
 * Duel simulator (A18): drives the REAL DuelSystem with a timed input log produced by a skill model,
 * against the REAL createOpponent / createBossOpponent controllers. Nothing in src/ is modified.
 *
 * DuelSystem does not implement a few enemy rules that the data declares (armour, coward evasion, moving
 * targets, dodge). With `emulate: true` (default) the DRIVER reproduces their intended effect on the player's
 * shot point so the numbers are closer to the finished game; set it false to measure the code exactly as it is.
 */
import { Rng } from '../../src/core/rng';
import { DUEL_CONFIG, type DuelConfig } from '../../src/data/duelConfig';
import { enemyHpFor, getEnemyDef, type EnemyDef } from '../../src/data/enemies';
import { bossHpFor, getBossDef, isBossId } from '../../src/data/bosses';
import { DuelSystem, type DuelParams, type OpponentController } from '../../src/systems/DuelSystem';
import type { DuelModifiers } from '../../src/data/perks';
import { createOpponent } from '../../src/systems/EnemyAISystem';
import { createBossEncounter } from '../../src/systems/BossSystem';
import { hitTest } from '../../src/systems/TargetSystem';
import type { DrawTier } from '../../src/data/duelConfig';
import { gauss, lognormal, sampleReaction, type SkillModel } from './skills';

export type Strategy = 'normal' | 'limbCamp';

export interface DuelSimOptions {
  /** Enemy difficulty 0..1 passed to createOpponent. */
  difficulty: number;
  /** Duel seed (enemy timeline). */
  seed: number;
  enemyHp?: number;
  heroHp?: number;
  config?: DuelConfig;
  /** Extra ms between the scheduled cue and the player seeing it (display + audio lag). Default 25 (FEEL_REVIEW 6). */
  lagMs?: number;
  /** Emulate armour / evasion / motion / dodge in the driver. Default true. */
  emulate?: boolean;
  /** Emulate a dodge for enemies that declare dodgeWindowMs. Default false (the game has no dodge action). */
  dodge?: boolean;
  /** Hero max lives (Second Wind: a wounded hero has heroHp < heroMaxHp). */
  heroMaxHp?: number;
  /** Perk modifiers (composePerks().duel). Passed to DuelSystem when it supports them (A02 perk hooks). */
  modifiers?: Partial<DuelModifiers>;
  /** Emulate Tin Star in the driver when DuelSystem has no modifiers support. Ignored when it has. */
  ignoreFirstHits?: number;
  /** Boss id; when it is a built boss the boss controller + phases are used. */
  bossId?: string | null;
  strategy?: Strategy;
  /** What-if: ms between the enemy's last shot of a sequence and its reload shot (EnemyAISystem RELOAD_MS is 1500). */
  reloadMs?: number;
  /** Cap on duel length in ms before it is called a stall. */
  maxMs?: number;
}

/** True when this checkout's DuelSystem reads DuelParams.modifiers (A02 perk hooks). */
export const DUEL_HAS_MODIFIERS = 'modifiers' in DuelSystem.prototype;

export interface DuelSimResult {
  win: boolean;
  /** Boss behaviour phase (1..3) reached by the end of the duel, null for non-boss duels. */
  bossPhase: number | null;
  /** Lethal hits prevented by Revive Flask (consumedPerks). */
  revives: number;
  stalled: boolean;
  cause: string | null;
  durationMs: number;
  heroHpStart: number;
  heroHpEnd: number;
  damage: number;
  tier: DrawTier | null;
  reactionMs: number | null;
  flinched: boolean;
  headshots: number;
  shots: number;
  hits: number;
  /** Cue-relative ms of the enemy's first shot. */
  enemyShotMs: number;
  waitMs: number;
}

const QUIET = { emit(): void {} };
const MISS_POINT = { x: 4, y: 4 };

/** Wraps a controller to apply driver-side emulations on enemy shots without disturbing its rng stream. */
class WrappedOpponent implements OpponentController {
  readonly id: string;
  private ignoreLeft: number;
  constructor(
    private readonly inner: OpponentController,
    private readonly tol: number,
    ignoreFirstHits: number,
    private readonly dodgeRate: number,
    private readonly dodgeRng: Rng,
    private readonly reloadMs: number | null,
  ) {
    this.id = inner.id;
    this.ignoreLeft = ignoreFirstHits;
  }
  waitMs(rng: Rng): number { return this.inner.waitMs(rng); }
  drawMs(rng: Rng): number { return this.inner.drawMs(rng); }
  shotDelayMs(rng: Rng, i: number): number {
    const v = this.inner.shotDelayMs(rng, i);
    const shots = (this.inner as unknown as { shots?: number }).shots;
    // the real AI adds 1500 ms of reload to every shot after the sequence; a what-if swaps that constant
    if (this.reloadMs !== null && typeof shots === 'number' && i >= shots && i > 0) return Math.max(250, v - 1500 + this.reloadMs);
    return v;
  }
  aimErrorPx(rng: Rng, i: number): number {
    const e = this.inner.aimErrorPx(rng, i);
    if (e > this.tol) return e;
    if (this.dodgeRate > 0 && this.dodgeRng.next() < this.dodgeRate) return 999;
    if (this.ignoreLeft > 0) { this.ignoreLeft--; return 999; }
    return e;
  }
}

export function simulateDuel(enemyId: string, skill: SkillModel, prng: Rng, o: DuelSimOptions): DuelSimResult {
  const cfg = o.config ?? DUEL_CONFIG;
  const lag = o.lagMs ?? 25;
  const emulate = o.emulate ?? true;
  const strategy: Strategy = o.strategy ?? 'normal';
  const d = o.difficulty;
  const useBoss = !!o.bossId && isBossId(o.bossId);

  let inner: OpponentController;
  let enemyHp: number;
  let def: EnemyDef | null = null;
  let bossSys: ReturnType<typeof createBossEncounter>['boss'] | null = null;
  if (useBoss) {
    const enc = createBossEncounter(o.bossId as string, new Rng(o.seed), d);
    inner = enc.opponent;
    bossSys = enc.boss;
    enemyHp = o.enemyHp ?? bossHpFor(getBossDef(o.bossId as string), d);
  } else {
    def = getEnemyDef(enemyId);
    inner = createOpponent(enemyId, new Rng(o.seed), d);
    enemyHp = o.enemyHp ?? enemyHpFor(def, d);
  }
  const dodgeable = !!o.dodge && !!def && def.dodgeWindowMs !== undefined;
  const opp = new WrappedOpponent(
    inner, cfg.fairness.enemyHitTolerancePx, DUEL_HAS_MODIFIERS ? 0 : (o.ignoreFirstHits ?? 0), dodgeable ? skill.dodgeRate : 0, new Rng((o.seed ^ 0x5bd1e995) >>> 0),
    o.reloadMs ?? null,
  );
  const heroHp = o.heroHp ?? cfg.damage.heroHp;
  const params: DuelParams & Record<string, unknown> = { seed: o.seed, opponent: opp, config: cfg, heroHp, enemyHp, audio: QUIET };
  if (DUEL_HAS_MODIFIERS) {
    if (o.modifiers) params.modifiers = o.modifiers;
    if (o.heroMaxHp !== undefined) params.heroMaxHp = o.heroMaxHp;
  }
  const duel = new DuelSystem(params);
  if (bossSys) bossSys.attachDuel(duel);

  let headshots = 0;
  let armorBroken = false;
  duel.events.on('onHit', (h) => {
    if (h.target !== 'enemy') return;
    if (h.zone === 'head') headshots++;
    if (h.zone === 'head' || h.zone === 'limb') armorBroken = true;
  });

  const zoneC = (id: 'head' | 'body' | 'limb'): { x: number; y: number } => {
    const z = duel.zones.find((q) => q.id === id) as { rect: { x: number; y: number; w: number; h: number } };
    return { x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 };
  };

  const cue = duel.plan.waitMs;
  const fake = (inner as unknown as { fakeTell?: { startMs: number } | null }).fakeTell ?? null;

  // flinch: bite a fake tell, or lift out of impatience
  let flinchAt: number | null = null;
  if (fake && prng.next() < skill.fakeBite) {
    const t = fake.startMs + 0.8 * lognormal(prng, skill.reactMedianMs, skill.reactSigma);
    if (t < cue - 40) flinchAt = t;
  }
  if (flinchAt === null && prng.next() < skill.impatientFlinch) flinchAt = prng.int(Math.floor(cue * 0.3), Math.max(1, cue - 60));
  if (flinchAt !== null) duel.input({ type: 'lift', t: flinchAt });

  const td = cue + sampleReaction(prng, skill, lag);
  duel.input({ type: 'draw', t: td });

  let aimBegin = td + cfg.draw.drawAnimMs + (duel.snapshot().flinched ? cfg.draw.flinchPenaltyMs : 0);
  const maxMs = o.maxMs ?? 90_000;
  let shots = 0;
  const motion = emulate ? def?.motion : undefined;
  const motionPhase = prng.next() * Math.PI * 2;
  const evade = emulate && def?.evadeChance ? def.evadeChance * (0.5 + 0.5 * d) : 0;

  while (!duel.isOver && shots < 40 && aimBegin < maxMs) {
    duel.advanceTo(aimBegin);
    if (duel.isOver) break;
    const snap = duel.snapshot();
    if (snap.phase !== 'AIM') break;
    const budget = snap.aimRemainingMs ?? cfg.aim.budgetMs;
    const fd = strategy === 'limbCamp' ? Infinity : Math.max(40, lognormal(prng, skill.fireMedianMs, 0.3));
    const fires = fd < budget;
    const tf = aimBegin + (fires ? fd : budget);

    // choose the zone to aim at
    let zone: 'head' | 'body' | 'limb';
    if (strategy === 'limbCamp') zone = 'limb';
    else if (def?.armor?.blocksBody && !armorBroken) zone = prng.next() < skill.armorAware ? (prng.next() < 0.6 ? 'head' : 'limb') : 'body';
    else if (snap.enemyHp <= 1) zone = prng.next() < 0.8 ? 'body' : prng.next() < skill.headPref ? 'head' : 'body';
    else zone = prng.next() < skill.headPref ? 'head' : 'body';

    const c = zoneC(zone);
    const sigma = strategy === 'limbCamp' ? 0 : skill.aimSigmaPx;
    let p = { x: c.x + gauss(prng) * sigma, y: c.y + gauss(prng) * sigma };
    if (motion) {
      const dx = motion.amplitudePx * Math.sin((2 * Math.PI * (tf - cue)) / motion.periodMs + motionPhase);
      p = { x: p.x + dx * (1 - skill.trackLead), y: p.y + (motion.kind === 'circle' ? 0.5 * dx * (1 - skill.trackLead) : 0) };
    }
    if (emulate) {
      const z = hitTest(duel.zones, p, cfg.aim.assistRadiusPx).zone;
      if (z && z.id !== 'prop') {
        if (def?.armor?.blocksBody && !armorBroken && z.id === 'body') p = MISS_POINT;
        else if (evade > 0 && prng.next() < evade) p = MISS_POINT;
      }
    }
    duel.input({ type: 'aim', t: aimBegin, x: p.x, y: p.y });
    if (fires) {
      duel.input({ type: 'fire', t: tf, x: p.x, y: p.y });
    } else {
      duel.advanceTo(tf);
    }
    shots++;
    aimBegin = tf + cfg.aim.recoilMs;
  }

  const res = duel.lastResult;
  if (!res) {
    // stall: nobody resolved within the cap
    const s = duel.snapshot();
    return {
      win: false, bossPhase: bossSys ? bossSys.phase : null, revives: 0, stalled: true, cause: 'stall', durationMs: s.now, heroHpStart: heroHp, heroHpEnd: s.heroHp, damage: heroHp - s.heroHp,
      tier: s.tier, reactionMs: s.reactionMs, flinched: s.flinched, headshots, shots, hits: 0, enemyShotMs: duel.plan.firstShotMs, waitMs: cue,
    };
  }
  return {
    win: res.outcome === 'WIN', bossPhase: bossSys ? bossSys.phase : null, revives: (res as { revivesUsed?: number }).revivesUsed ?? 0, stalled: false, cause: res.cause, durationMs: res.durationMs, heroHpStart: heroHp, heroHpEnd: res.heroHp,
    damage: heroHp - res.heroHp, tier: res.tier, reactionMs: res.reactionMs, flinched: res.flinched, headshots, shots: res.shotsFired,
    hits: res.hits, enemyShotMs: res.enemyShotMs, waitMs: cue,
  };
}

export interface DuelAgg {
  n: number;
  winRate: number;
  wins: number;
  /** Mean duel length in seconds (cue wait + fight, to resolve). */
  meanSec: number;
  meanDamage: number;
  /** Mean damage taken in duels that were won. */
  meanDamageWon: number;
  perfectRate: number;
  flinchRate: number;
  stallRate: number;
  /** Loss causes. */
  causes: Record<string, number>;
  /** Share of wins taken with zero damage. */
  flawlessRate: number;
  meanShots: number;
}

export function aggregateDuels(rs: readonly DuelSimResult[]): DuelAgg {
  const n = rs.length || 1;
  const wins = rs.filter((r) => r.win);
  const causes: Record<string, number> = {};
  for (const r of rs) if (!r.win) causes[r.cause ?? 'none'] = (causes[r.cause ?? 'none'] ?? 0) + 1;
  const sum = (f: (r: DuelSimResult) => number, a: readonly DuelSimResult[] = rs): number => a.reduce((s, r) => s + f(r), 0);
  return {
    n: rs.length, wins: wins.length, winRate: wins.length / n, meanSec: sum((r) => r.durationMs) / n / 1000,
    meanDamage: sum((r) => r.damage) / n, meanDamageWon: wins.length ? sum((r) => r.damage, wins) / wins.length : 0,
    perfectRate: rs.filter((r) => r.tier === 'perfect').length / n, flinchRate: rs.filter((r) => r.flinched).length / n,
    stallRate: rs.filter((r) => r.stalled).length / n, causes, flawlessRate: wins.length ? wins.filter((r) => r.damage === 0).length / wins.length : 0,
    meanShots: sum((r) => r.shots) / n,
  };
}

/** Runs `n` seeded duels (common random numbers: duel seed i is the same for every skill/option set). Raw results. */
export function batchDuelsRaw(enemyId: string, skill: SkillModel, n: number, base: Omit<DuelSimOptions, 'seed'>, seedBase = 1000): DuelSimResult[] {
  const rs: DuelSimResult[] = [];
  for (let i = 0; i < n; i++) {
    const seed = seedBase + i * 7919;
    const prng = new Rng((seed * 2654435761) >>> 0);
    rs.push(simulateDuel(enemyId, skill, prng, { ...base, seed }));
  }
  return rs;
}

export function batchDuels(enemyId: string, skill: SkillModel, n: number, base: Omit<DuelSimOptions, 'seed'>, seedBase = 1000): DuelAgg {
  return aggregateDuels(batchDuelsRaw(enemyId, skill, n, base, seedBase));
}

/**
 * Clean-win rate: P(win with no hit taken) == P(win of a 1-life duel), because the player model's random stream
 * does not depend on hp. This is the pure "duel difficulty" metric; with 3 lives almost every duel is a win.
 */
export const cleanRate = (rs: readonly DuelSimResult[]): number => rs.filter((r) => r.win && r.damage === 0).length / (rs.length || 1);
