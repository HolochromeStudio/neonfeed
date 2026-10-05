import { Rng } from '../core/rng';
import { audioBus } from '../core/audioEvents';
import type { AudioEvent } from '../core/audioEvents';
import { DUEL_CONFIG, MODIFIER_TUNING } from '../data/duelConfig';
import type { DrawTier, DuelConfig, ZoneId } from '../data/duelConfig';
import { neutralDuelModifiers } from '../data/perks';
import type { DuelModifiers } from '../data/perks';
import { applyDamage, isDead, makeHealth, shotDamage } from './DamageSystem';
import type { Health } from './DamageSystem';
import { effectiveReaction, gradeDraw, perfectGrade } from './DrawSystem';
import type { Rect } from './InputSystem';
import { buildZones, hitTest } from './TargetSystem';
import type { Zone } from './TargetSystem';

/**
 * Duel state machine (pure logic, no Phaser). Deterministic given the seed and
 * the timed input log. Time is injected: call `input(ev)` (which first advances
 * the clock to `ev.t`) and `advanceTo(t)` from a frame loop.
 *
 * Phases: WAIT -> CUE -> DRAW -> AIM -> SHOT -> (AIM ...) -> RESOLVE -> RETRY.
 *
 * Two clocks: real time `now` (inputs, reaction, aim budget) and the opponent
 * clock, which runs at `aim.slowMoScale` while the player aims (RULE F7).
 *
 * Tie rules (documented, tested): a player input at the same ms as an enemy
 * shot lands first (enemy events need time strictly < input time); real phase
 * transitions at time t are visible to an input at t.
 *
 * Hostile input policy (QA-01..08): non-finite times never reach the clocks (NaN and -Infinity are
 * ignored, +Infinity is clamped to `MAX_ADVANCE_MS` past now); hp <= 0 starts are normalised (enemy hp is
 * clamped to a minimum of 1, a hero with 0 hp is already lost and the duel resolves LOSE at the first
 * enemy shot, hit or miss); non-finite aim/fire coordinates are ignored and `onShot` never carries NaN;
 * `onPhase` reports WAIT (lazily at the first advance/input of an attempt, and on every retry).
 *
 * Perk hooks (`params.modifiers`, docs/RUN_DESIGN.md section 6): the duel reads DuelModifiers FIELDS, never perk ids.
 * Supported here: perfectStaggers, headStagger, propShotsHitEnemy (stagger), alwaysCrit, flinchDisablesCrit,
 * flinchNoTimeCost, goodAsPerfectPerDuel, afterHitAutoPerfect (a hero who starts wounded), ignoreFirstHits,
 * reviveCharges, lastStandBudgetMult, aimBudgetStillBonus. Boss `aimBudgetScale` (a property of the opponent) shrinks the
 * aim budget (>= 0.7). Every stagger only ADDS time to the pending enemy shot (RULE F1 untouched).
 */

/** `advanceTo(Infinity)` is clamped to this many ms past the current clock. */
export const MAX_ADVANCE_MS = 60_000;

export type DuelPhase = 'WAIT' | 'CUE' | 'DRAW' | 'AIM' | 'SHOT' | 'RESOLVE' | 'RETRY';
export type DuelOutcome = 'WIN' | 'LOSE';
/** RULE F4: every loss names its cause. */
export type LoseCause = 'too_slow' | 'shot_while_drawing' | 'shot_while_aiming' | 'outgunned';

/** What the enemy AI (A06) must decide. DuelSystem owns the rng; implementations must only use it. */
export interface OpponentController {
  readonly id: string;
  /** Length of the WAIT before the cue (tell time). */
  waitMs(rng: Rng): number;
  /** Cue-relative time until the enemy's gun is out. */
  drawMs(rng: Rng): number;
  /** Delay to shot `shotIndex`: from the cue for index 0, from the previous shot afterwards. */
  shotDelayMs(rng: Rng, shotIndex: number): number;
  /** Aim error in px of shot `shotIndex`; the shot hits when within `fairness.enemyHitTolerancePx`. */
  aimErrorPx(rng: Rng, shotIndex: number): number;
}

/** Trivial default for tests and the standalone scene. Not the real enemy AI. */
export class BasicOpponent implements OpponentController {
  readonly id = 'basic';
  constructor(
    private readonly opts: { waitMin?: number; waitMax?: number; shotMs?: number; shotJitter?: number; maxAimError?: number } = {},
  ) {}
  waitMs(rng: Rng): number {
    return rng.int(this.opts.waitMin ?? DUEL_CONFIG.wait.minMs, this.opts.waitMax ?? DUEL_CONFIG.wait.maxMs);
  }
  drawMs(rng: Rng): number {
    return rng.int(350, 500);
  }
  shotDelayMs(rng: Rng, shotIndex: number): number {
    const base = shotIndex === 0 ? (this.opts.shotMs ?? 850) : 650;
    const j = this.opts.shotJitter ?? 100;
    return base + rng.int(-j, j);
  }
  aimErrorPx(rng: Rng): number {
    return rng.next() * (this.opts.maxAimError ?? 18);
  }
}

export type DuelInput =
  | { type: 'hold'; t: number }
  | { type: 'lift'; t: number }
  | { type: 'draw'; t: number }
  | { type: 'aim'; t: number; x: number; y: number }
  | { type: 'fire'; t: number; x?: number; y?: number }
  | { type: 'retry'; t: number };

export interface DuelParams {
  seed: number;
  opponent?: OpponentController;
  config?: DuelConfig;
  heroHp?: number;
  enemyHp?: number;
  /** Enemy bounding rect (top-left origin), default from config. */
  enemyRect?: Rect;
  /** Start of the duel on the injected clock. */
  startT?: number;
  /** Audio sink; defaults to the shared audioBus. */
  audio?: { emit(e: AudioEvent): void };
  /** Max lives for the HUD/clamping when the hero starts wounded (`heroHp` is then the current lives). Default `heroHp`. */
  heroMaxHp?: number;
  /** Perk modifiers (composePerks().duel). Missing fields are neutral. */
  modifiers?: Partial<DuelModifiers>;
}

export interface DuelResult {
  outcome: DuelOutcome;
  cause: LoseCause | null;
  flinched: boolean;
  /** Raw ms from cue to the draw registering, or null if the hero never drew. */
  rawReactionMs: number | null;
  /** Raw plus flinch penalty (what is graded). */
  reactionMs: number | null;
  tier: DrawTier | null;
  /** Cue-relative ms of the enemy's first shot (the readout "ENEMY 380 ms"). */
  enemyShotMs: number;
  shotsFired: number;
  hits: number;
  heroHp: number;
  enemyHp: number;
  durationMs: number;
  attempt: number;
  /** Headshots that landed on the enemy this attempt. */
  headshots: number;
  /** Enemy hits ignored by `ignoreFirstHits` (Tin Star). */
  hitsIgnored: number;
  /** Lethal hits prevented by `reviveCharges` (Revive Flask); the caller reports them as consumed once-per-run perks. */
  revivesUsed: number;
  /** Times the enemy was staggered (perk, prop or boss environment). */
  staggers: number;
}

export interface DuelHitInfo {
  target: 'enemy' | 'hero' | 'prop';
  zone: ZoneId | null;
  propId?: string;
  damage: number;
  crit: boolean;
  killed: boolean;
  assisted: boolean;
  x: number;
  y: number;
  /** Hit on the hero ignored by `ignoreFirstHits` (damage is 0). */
  ignored?: boolean;
  /** Lethal hit on the hero prevented by `reviveCharges` (the hero keeps 1 life). */
  revived?: boolean;
}

export interface DuelEvents {
  onPhase: { phase: DuelPhase; prev: DuelPhase; t: number };
  onWait: { t: number; attempt: number };
  onFlinch: { t: number; penaltyMs: number };
  onCue: { t: number };
  onDraw: { t: number; rawMs: number; reactionMs: number; tier: DrawTier; perfect: boolean; flinched: boolean };
  onPerfectDraw: { t: number; reactionMs: number };
  onAimStart: { t: number; budgetMs: number; followUp: boolean };
  onShot: { t: number; shooter: 'player' | 'enemy'; x: number; y: number; crit: boolean };
  onHit: { t: number } & DuelHitInfo;
  onMiss: { t: number; shooter: 'player' | 'enemy' };
  onResolve: { t: number; result: DuelResult };
  onRetry: { t: number; attempt: number };
  /** The enemy's pending shot was pushed back `ms` ms of enemy clock. */
  onStagger: { t: number; ms: number; source: StaggerSource };
}

export type StaggerSource = 'perfect_draw' | 'headshot' | 'prop' | 'external';

export const DUEL_EVENT_NAMES: readonly (keyof DuelEvents)[] = [
  'onPhase', 'onWait', 'onFlinch', 'onCue', 'onDraw', 'onPerfectDraw', 'onAimStart', 'onShot', 'onHit', 'onMiss', 'onResolve', 'onRetry', 'onStagger',
];

type Listener<T> = (payload: T) => void;

/** Small typed emitter so A03 Game Feel can attach juice. A throwing listener never breaks gameplay. */
export class TypedEmitter<E extends object> {
  private map = new Map<keyof E, Set<Listener<never>>>();
  on<K extends keyof E>(name: K, fn: Listener<E[K]>): () => void {
    let s = this.map.get(name);
    if (!s) this.map.set(name, (s = new Set()));
    s.add(fn as Listener<never>);
    return () => this.off(name, fn);
  }
  off<K extends keyof E>(name: K, fn: Listener<E[K]>): void {
    this.map.get(name)?.delete(fn as Listener<never>);
  }
  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const s = this.map.get(name);
    if (!s) return;
    for (const fn of [...s]) {
      try {
        (fn as Listener<E[K]>)(payload);
      } catch {
        // juice must never break the duel
      }
    }
  }
  clear(): void {
    this.map.clear();
  }
}

type DeadlineKind = 'cue' | 'drawEnd' | 'autoFire' | 'recoilEnd' | 'resolveEnd';

export interface DuelSnapshot {
  phase: DuelPhase;
  outcome: DuelOutcome | null;
  cause: LoseCause | null;
  now: number;
  timeScale: number;
  heroHp: number;
  heroMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  flinched: boolean;
  cueAt: number | null;
  rawReactionMs: number | null;
  reactionMs: number | null;
  tier: DrawTier | null;
  attempt: number;
  reticle: { x: number; y: number } | null;
  /** Real ms left in the aim budget (AIM only). */
  aimRemainingMs: number | null;
  ignoredInputs: number;
  /** Index of the enemy's next shot (0 = the cue shot). Lets the scene telegraph follow-up shots. */
  enemyShotIndex: number;
  /** Real ms until the enemy's next shot at the current clock speed, or null when it is not running. */
  enemyShotEtaMs: number | null;
}

export class DuelSystem {
  readonly events = new TypedEmitter<DuelEvents>();
  readonly zones: Zone[];
  /** Every input accepted, with its (clamped) timestamp. Feed to `replayDuel` for determinism. */
  readonly inputLog: DuelInput[] = [];

  private readonly cfg: DuelConfig;
  private readonly opponent: OpponentController;
  private readonly audio: { emit(e: AudioEvent): void };
  private readonly seed: number;
  private readonly heroMax: number;
  private readonly heroCap: number;
  private readonly enemyMax: number;
  private readonly mods: DuelModifiers;

  private rng!: Rng;
  private hero!: Health;
  private enemy!: Health;
  private phase: DuelPhase = 'WAIT';
  private prevPhase: DuelPhase = 'WAIT';
  private outcome: DuelOutcome | null = null;
  private cause: LoseCause | null = null;
  private now = 0;
  private startedAt = 0;
  private enemyT = 0;
  private deadline: { at: number; kind: DeadlineKind } | null = null;
  private cueAt: number | null = null;
  private flinched = false;
  private rawReaction: number | null = null;
  private reaction: number | null = null;
  private tier: DrawTier | null = null;
  private critReady = false;
  private aimBudgetMult = 1;
  private reticle: { x: number; y: number } | null = null;
  private queuedFire: { x?: number; y?: number } | null = null;
  private attempt = 1;
  private ignored = 0;
  private shotsFired = 0;
  private hits = 0;
  private result: DuelResult | null = null;
  private disarms = 0;
  // perk hooks (all reset per attempt)
  private goodPromos = 0;
  private autoPerfect = false;
  private ignoredHits = 0;
  private revivesLeft = 0;
  private revivesUsed = 0;
  private headshots = 0;
  private staggers = 0;
  private stillExtra = 0;
  private lastAimMoveAt = 0;
  /** True once `onPhase` has announced WAIT for the current attempt. */
  private waitAnnounced = false;

  // enemy plan, lazily extended in index order so rng use never depends on the player
  private waitMs = 0;
  private enemyDrawMs = 0;
  private shotDelays: number[] = [];
  private aimErrors: number[] = [];
  private enemyShotIndex = 0;
  private enemyNext: number | null = null;

  constructor(params: DuelParams) {
    this.cfg = params.config ?? DUEL_CONFIG;
    this.opponent = params.opponent ?? new BasicOpponent();
    this.audio = params.audio ?? audioBus;
    this.seed = params.seed;
    const hh = params.heroHp ?? this.cfg.damage.heroHp;
    const eh = params.enemyHp ?? this.cfg.damage.enemyHp;
    // QA-03: a hero with 0 hp is lost from the start (resolves at the first enemy shot); an enemy with
    // no hp would be invulnerable, so it gets 1.
    this.heroMax = Number.isFinite(hh) ? Math.max(0, hh) : this.cfg.damage.heroHp;
    this.enemyMax = Number.isFinite(eh) && eh > 0 ? eh : 1;
    this.heroCap = Number.isFinite(params.heroMaxHp) ? Math.max(this.heroMax, params.heroMaxHp as number) : this.heroMax;
    this.mods = { ...neutralDuelModifiers(), ...(params.modifiers ?? {}) };
    const e = this.cfg.arena.enemy;
    const rect = params.enemyRect ?? { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
    this.zones = buildZones(rect, this.cfg.arena.props, this.cfg);
    this.begin(params.startT ?? 0);
  }

  // ---- public API --------------------------------------------------------

  get currentPhase(): DuelPhase {
    return this.phase;
  }
  get modifiers(): Readonly<DuelModifiers> {
    return this.mods;
  }
  get lastResult(): DuelResult | null {
    return this.result;
  }
  get isOver(): boolean {
    return this.phase === 'RESOLVE' || this.phase === 'RETRY';
  }
  /** Enemy plan for the current attempt (stable across retries, RULE F5). */
  get plan(): { waitMs: number; drawMs: number; firstShotMs: number } {
    return { waitMs: this.waitMs, drawMs: this.enemyDrawMs, firstShotMs: this.shotDelays[0] };
  }

  snapshot(): DuelSnapshot {
    return {
      phase: this.phase,
      outcome: this.outcome,
      cause: this.cause,
      now: this.now,
      timeScale: this.timeScale(),
      heroHp: this.hero.hp,
      heroMaxHp: this.hero.max,
      enemyHp: this.enemy.hp,
      enemyMaxHp: this.enemy.max,
      flinched: this.flinched,
      cueAt: this.cueAt,
      rawReactionMs: this.rawReaction,
      reactionMs: this.reaction,
      tier: this.tier,
      attempt: this.attempt,
      reticle: this.reticle ? { ...this.reticle } : null,
      aimRemainingMs: this.phase === 'AIM' && this.deadline ? Math.max(0, this.deadline.at - this.now) : null,
      ignoredInputs: this.ignored,
      enemyShotIndex: this.enemyShotIndex,
      enemyShotEtaMs: this.enemyRealTime() === null ? null : Math.max(0, (this.enemyRealTime() as number) - this.now),
    };
  }

  /** Advances the clocks to `t`, firing every due transition and enemy shot in order. */
  advanceTo(t: number): void {
    if (Number.isNaN(t) || t === -Infinity) return; // QA-01: never poison the clocks
    if (t === Infinity) t = this.now + MAX_ADVANCE_MS; // QA-01b
    if (t < this.now) t = this.now;
    this.announceWait();
    for (let guard = 0; guard < 10000; guard++) {
      const dl = this.deadline;
      const dlDue = dl !== null && dl.at <= t;
      const enemyAt = this.enemyRealTime();
      const enDue = enemyAt !== null && enemyAt < t;
      if (!dlDue && !enDue) break;
      if (dlDue && (!enDue || dl!.at <= enemyAt!)) {
        this.step(dl!.at);
        this.deadline = null;
        this.onDeadline(dl!.kind);
      } else {
        this.step(enemyAt!);
        this.enemyT = this.enemyNext!;
        this.onEnemyShot();
      }
    }
    this.step(t);
  }

  /** Applies a player input at `ev.t` (advancing time first). */
  input(ev: DuelInput): void {
    // non-finite stamps count as "now" (QA-01); stamps in the past are clamped to now
    const stamp = Number.isFinite(ev.t) ? ev.t : this.now;
    this.advanceTo(stamp);
    const e = { ...ev, t: Math.max(stamp, this.now) } as DuelInput;
    this.inputLog.push(e);
    switch (e.type) {
      case 'hold':
        break;
      case 'lift':
        if (this.phase === 'WAIT') this.flinch();
        break;
      case 'draw':
        this.onDrawInput();
        break;
      case 'aim':
        if (Number.isFinite(e.x) && Number.isFinite(e.y)) {
          const moved = !this.reticle || Math.hypot(e.x - this.reticle.x, e.y - this.reticle.y) >= MODIFIER_TUNING.stillMovePx;
          if (moved) this.lastAimMoveAt = this.now;
          this.reticle = { x: e.x, y: e.y };
        }
        break;
      case 'fire':
        this.onFireInput(e.x, e.y);
        break;
      case 'retry':
        if (this.phase === 'RETRY') this.retry();
        break;
    }
  }

  /** Restarts the same duel. Same seed => identical enemy timings (RULE F5). */
  retry(): void {
    if (this.phase !== 'RETRY' && this.phase !== 'RESOLVE') return;
    this.attempt++;
    this.begin(this.now);
    this.announceWait();
    this.events.emit('onRetry', { t: this.now, attempt: this.attempt });
    this.events.emit('onWait', { t: this.now, attempt: this.attempt });
  }

  /**
   * Pushes the enemy's pending shot back by `ms` ms of enemy clock (adds time only, so RULE F1 holds).
   * No-op before the cue, after the duel is over, or for a non-positive/non-finite `ms`.
   * Perks call it internally; the scene calls it for boss environment payoffs (BossSystem `onEnvironment`).
   */
  staggerEnemy(ms: number, source: StaggerSource = 'external'): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (!this.enemyRunning() || this.enemyNext === null) return;
    this.enemyNext += ms;
    this.staggers++;
    this.events.emit('onStagger', { t: this.now, ms, source });
  }

  // ---- internals ---------------------------------------------------------

  /** QA-06: tell `onPhase` listeners about WAIT once per attempt (the constructor cannot, nobody listens yet). */
  private announceWait(): void {
    if (this.waitAnnounced || this.phase !== 'WAIT') return;
    this.waitAnnounced = true;
    this.events.emit('onPhase', { phase: 'WAIT', prev: this.prevPhase, t: this.now });
  }

  private begin(t: number): void {
    this.prevPhase = this.phase;
    this.waitAnnounced = false;
    this.disarms = 0;
    this.goodPromos = 0;
    this.ignoredHits = 0;
    this.revivesLeft = Math.max(0, Math.floor(this.mods.reviveCharges));
    this.revivesUsed = 0;
    this.headshots = 0;
    this.staggers = 0;
    this.stillExtra = 0;
    this.lastAimMoveAt = t;
    // Second Wind: a hero who starts wounded (was hit earlier in the run) draws Perfect
    this.autoPerfect = this.mods.afterHitAutoPerfect && this.heroMax < this.heroCap;
    this.rng = new Rng(this.seed);
    this.hero = { hp: this.heroMax, max: this.heroCap };
    this.enemy = makeHealth(this.enemyMax);
    this.phase = 'WAIT';
    this.outcome = null;
    this.cause = null;
    this.now = t;
    this.startedAt = t;
    this.enemyT = 0;
    this.cueAt = null;
    this.flinched = false;
    this.rawReaction = null;
    this.reaction = null;
    this.tier = null;
    this.critReady = false;
    this.aimBudgetMult = 1;
    this.reticle = null;
    this.queuedFire = null;
    this.ignored = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.result = null;
    this.shotDelays = [];
    this.aimErrors = [];
    this.enemyShotIndex = 0;
    this.enemyNext = null;
    // fixed rng order: wait, draw, then per-shot (delay, error) lazily by index
    this.waitMs = Math.max(0, this.opponent.waitMs(this.rng));
    this.enemyDrawMs = Math.max(0, this.opponent.drawMs(this.rng));
    this.planShot(0);
    this.deadline = { at: t + this.waitMs, kind: 'cue' };
  }

  private planShot(i: number): void {
    while (this.shotDelays.length <= i) {
      const k = this.shotDelays.length;
      this.shotDelays.push(this.opponent.shotDelayMs(this.rng, k));
      this.aimErrors.push(this.opponent.aimErrorPx(this.rng, k));
    }
    if (i === 0) {
      // RULE F1: tell-to-lethal-shot never below minLethalMs; the gun must also be out.
      this.shotDelays[0] = Math.max(this.shotDelays[0], this.enemyDrawMs, this.cfg.fairness.minLethalMs);
    } else {
      this.shotDelays[i] = Math.max(this.shotDelays[i], this.cfg.fairness.minShotGapMs);
    }
  }

  private timeScale(): number {
    return this.phase === 'AIM' ? this.cfg.aim.slowMoScale : 1;
  }

  private enemyRunning(): boolean {
    return this.cueAt !== null && !this.isOver;
  }

  private enemyRealTime(): number | null {
    if (!this.enemyRunning() || this.enemyNext === null) return null;
    return this.now + (this.enemyNext - this.enemyT) / this.timeScale();
  }

  private step(t: number): void {
    if (t <= this.now) return;
    if (this.enemyRunning()) this.enemyT += (t - this.now) * this.timeScale();
    this.now = t;
  }

  private setPhase(p: DuelPhase): void {
    const prev = this.phase;
    if (prev === p) return;
    this.phase = p;
    this.events.emit('onPhase', { phase: p, prev, t: this.now });
  }

  private sfx(e: AudioEvent): void {
    this.audio.emit(e);
  }

  private onDeadline(kind: DeadlineKind): void {
    switch (kind) {
      case 'cue':
        this.cueAt = this.now;
        this.enemyT = 0;
        this.planShot(0);
        this.enemyShotIndex = 0;
        this.enemyNext = this.shotDelays[0];
        this.setPhase('CUE');
        this.events.emit('onCue', { t: this.now });
        this.sfx({ type: 'draw_cue' });
        break;
      case 'drawEnd':
        this.startAim(false);
        break;
      case 'autoFire':
        if (this.phase === 'AIM' && !this.stillBonus()) this.fire();
        break;
      case 'recoilEnd':
        if (this.phase === 'SHOT') this.startAim(true);
        break;
      case 'resolveEnd':
        this.setPhase('RETRY');
        break;
    }
  }

  private flinch(): void {
    if (this.flinched) {
      this.ignored++;
      return;
    }
    this.flinched = true;
    this.events.emit('onFlinch', { t: this.now, penaltyMs: this.cfg.draw.flinchPenaltyMs });
  }

  private onDrawInput(): void {
    if (this.phase === 'WAIT') {
      this.flinch();
      return;
    }
    if (this.phase !== 'CUE' || this.cueAt === null) {
      this.ignored++; // double tap / swipe outside the draw window
      return;
    }
    const raw = this.now - this.cueAt;
    const penalty = this.mods.flinchNoTimeCost ? 0 : this.cfg.draw.flinchPenaltyMs;
    const reaction = effectiveReaction(raw, this.flinched, penalty);
    let grade = gradeDraw(reaction, this.cfg.draw, this.cfg.aim.perfectBudgetBonus);
    if (!grade.perfect) {
      // tier promotion: Second Wind (wounded start) first, then Spit and Polish (one Good draw per duel)
      if (this.autoPerfect) {
        this.autoPerfect = false;
        grade = perfectGrade(this.cfg.aim.perfectBudgetBonus);
      } else if (grade.tier === 'good' && this.goodPromos < this.mods.goodAsPerfectPerDuel) {
        this.goodPromos++;
        grade = perfectGrade(this.cfg.aim.perfectBudgetBonus);
      }
    }
    this.rawReaction = raw;
    this.reaction = reaction;
    this.tier = grade.tier;
    this.critReady = grade.crit && !(this.mods.flinchDisablesCrit && this.flinched);
    this.aimBudgetMult = grade.aimBudgetMultiplier;
    this.setPhase('DRAW');
    const drawTime = this.cfg.draw.drawAnimMs + (this.flinched ? penalty : 0);
    this.deadline = { at: this.now + drawTime, kind: 'drawEnd' };
    this.events.emit('onDraw', { t: this.now, rawMs: raw, reactionMs: reaction, tier: grade.tier, perfect: grade.perfect, flinched: this.flinched });
    if (grade.perfect) {
      this.events.emit('onPerfectDraw', { t: this.now, reactionMs: reaction });
      this.sfx({ type: 'perfect_draw' });
      if (this.mods.perfectStaggers) this.staggerEnemy(MODIFIER_TUNING.perfectStaggerMs, 'perfect_draw');
    }
  }

  private startAim(followUp: boolean): void {
    let budget = followUp ? this.cfg.aim.followUpBudgetMs : this.cfg.aim.budgetMs * this.aimBudgetMult;
    budget *= this.opponentAimScale();
    if (this.hero.hp > 0 && this.hero.hp <= 1) budget *= this.mods.lastStandBudgetMult;
    this.stillExtra = 0;
    this.lastAimMoveAt = this.now;
    this.setPhase('AIM');
    this.deadline = { at: this.now + budget, kind: 'autoFire' };
    this.events.emit('onAimStart', { t: this.now, budgetMs: budget, followUp });
    if (this.queuedFire) {
      const q = this.queuedFire;
      this.queuedFire = null;
      this.fire(q.x, q.y);
    }
  }

  /** Boss/enemy `aimBudgetScale` (docs/BOSSES.md): clamped to [0.7, 1], slow-mo is never touched. */
  private opponentAimScale(): number {
    const s = (this.opponent as { aimBudgetScale?: unknown }).aimBudgetScale;
    if (typeof s !== 'number' || !Number.isFinite(s)) return 1;
    return Math.min(1, Math.max(MODIFIER_TUNING.bossAimScaleMin, s));
  }

  /** Steady Breath: a still reticle at the end of the budget earns a short extension (bounded). True when extended. */
  private stillBonus(): boolean {
    if (!this.mods.aimBudgetStillBonus) return false;
    const T = MODIFIER_TUNING;
    if (this.stillExtra >= T.stillBonusMaxMs || this.now - this.lastAimMoveAt < T.stillGapMs) return false;
    const chunk = Math.min(T.stillBonusMs, T.stillBonusMaxMs - this.stillExtra);
    this.stillExtra += chunk;
    this.deadline = { at: this.now + chunk, kind: 'autoFire' };
    return true;
  }

  private onFireInput(x?: number, y?: number): void {
    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) this.reticle = { x, y };
    if (this.phase === 'AIM') this.fire(x, y);
    else if (this.phase === 'DRAW') this.queuedFire = { x, y }; // released while the gun comes out
    else this.ignored++;
  }

  private fire(x?: number, y?: number): void {
    // non-finite coordinates are dropped (the stored reticle is used); `this.reticle` is always finite
    const own = x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y);
    const p = own ? { x: x as number, y: y as number } : this.reticle;
    this.deadline = null;
    const crit = this.mods.alwaysCrit || (this.critReady && this.shotsFired === 0);
    this.shotsFired++;
    if (!p) {
      // QA-08: no aim point: shoot straight ahead of the hero (always a miss) instead of leaking NaN
      const fwd = this.unaimedPoint();
      this.events.emit('onShot', { t: this.now, shooter: 'player', x: fwd.x, y: fwd.y, crit });
      this.sfx({ type: 'gunshot', shooter: 'player' });
      this.events.emit('onMiss', { t: this.now, shooter: 'player' });
      this.sfx({ type: 'miss' });
      this.afterPlayerShot(null);
      return;
    }
    this.events.emit('onShot', { t: this.now, shooter: 'player', x: p.x, y: p.y, crit });
    this.sfx({ type: 'gunshot', shooter: 'player' });
    const hit = hitTest(this.zones, p, this.cfg.aim.assistRadiusPx);
    const zone = hit.zone;
    if (!zone) {
      this.events.emit('onMiss', { t: this.now, shooter: 'player' });
      this.sfx({ type: 'miss' });
      this.afterPlayerShot(null);
      return;
    }
    if (zone.id === 'prop') {
      this.events.emit('onHit', { t: this.now, target: 'prop', zone: 'prop', propId: zone.propId, damage: 0, crit: false, killed: false, assisted: hit.assisted, x: p.x, y: p.y });
      this.sfx({ type: 'hit_prop' });
      if (this.mods.propShotsHitEnemy) this.staggerEnemy(MODIFIER_TUNING.propStaggerMs, 'prop');
      this.afterPlayerShot(null);
      return;
    }
    const dmg = shotDamage(zone, crit, this.cfg);
    const res = applyDamage(this.enemy, dmg);
    this.hits++;
    if (zone.id === 'head') this.headshots++;
    this.events.emit('onHit', { t: this.now, target: 'enemy', zone: zone.id, damage: res.dealt, crit, killed: res.killed, assisted: hit.assisted, x: p.x, y: p.y });
    this.sfx({ type: 'hit_flesh' });
    if (res.killed) {
      this.sfx({ type: 'death' });
      this.resolve('WIN', null);
      return;
    }
    if (zone.id === 'head' && this.mods.headStagger) this.staggerEnemy(MODIFIER_TUNING.headStaggerMs, 'headshot');
    this.afterPlayerShot(zone);
  }

  private unaimedPoint(): { x: number; y: number } {
    const h = this.cfg.arena.hero;
    return { x: h.x + 60, y: h.y - 40 };
  }

  private afterPlayerShot(zone: Zone | null): void {
    if (zone?.id === 'limb' && this.enemyNext !== null && this.disarms < this.cfg.fairness.maxDisarms) {
      // gun-arm hit disarms: the pending enemy shot is cancelled, the next one is planned.
      // At most `fairness.maxDisarms` per attempt (QA-09 re-arm rule).
      this.disarms++;
      this.enemyShotIndex++;
      this.planShot(this.enemyShotIndex);
      this.enemyNext = this.enemyT + this.shotDelays[this.enemyShotIndex];
    }
    this.setPhase('SHOT');
    this.deadline = { at: this.now + this.cfg.aim.recoilMs, kind: 'recoilEnd' };
  }

  private onEnemyShot(): void {
    const i = this.enemyShotIndex;
    const err = this.aimErrors[i];
    const phaseAtShot = this.phase;
    this.events.emit('onShot', { t: this.now, shooter: 'enemy', x: this.cfg.arena.hero.x, y: this.cfg.arena.hero.y, crit: false });
    this.sfx({ type: 'gunshot', shooter: 'enemy' });
    if (err <= this.cfg.fairness.enemyHitTolerancePx) {
      const at = { x: this.cfg.arena.hero.x, y: this.cfg.arena.hero.y };
      if (this.ignoredHits < this.mods.ignoreFirstHits && this.hero.hp > 0) {
        // Tin Star: the first hits of each duel are ignored
        this.ignoredHits++;
        this.events.emit('onHit', { t: this.now, target: 'hero', zone: null, damage: 0, crit: false, killed: false, assisted: false, ignored: true, ...at });
        this.sfx({ type: 'miss' });
      } else {
        const res = applyDamage(this.hero, this.cfg.damage.enemyDamage);
        let revived = false;
        if (res.killed && this.revivesLeft > 0) {
          // Revive Flask: the lethal hit is survived at 1 life
          this.revivesLeft--;
          this.revivesUsed++;
          this.hero.hp = 1;
          revived = true;
        }
        this.events.emit('onHit', { t: this.now, target: 'hero', zone: null, damage: res.dealt, crit: false, killed: res.killed && !revived, assisted: false, revived, ...at });
        this.sfx({ type: 'hit_flesh' });
        if (isDead(this.hero)) {
          this.sfx({ type: 'death' });
          this.resolve('LOSE', this.causeFor(phaseAtShot, i));
          return;
        }
      }
    } else {
      this.events.emit('onMiss', { t: this.now, shooter: 'enemy' });
      this.sfx({ type: 'miss' });
      if (isDead(this.hero)) {
        // QA-03: a hero that started with 0 hp is lost at the first enemy shot even if it misses
        this.resolve('LOSE', this.causeFor(phaseAtShot, i));
        return;
      }
    }
    this.enemyShotIndex = i + 1;
    this.planShot(i + 1);
    this.enemyNext = this.enemyT + this.shotDelays[i + 1];
  }

  private causeFor(phase: DuelPhase, shotIndex: number): LoseCause {
    if (phase === 'CUE') return 'too_slow';
    if (phase === 'DRAW') return 'shot_while_drawing';
    if (shotIndex > 0 && this.hero.max > 1) return 'outgunned';
    return 'shot_while_aiming';
  }

  private resolve(outcome: DuelOutcome, cause: LoseCause | null): void {
    this.outcome = outcome;
    this.cause = cause;
    this.enemyNext = null;
    this.deadline = { at: this.now + this.cfg.resolve.holdMs, kind: 'resolveEnd' };
    this.result = {
      outcome,
      cause,
      flinched: this.flinched,
      rawReactionMs: this.rawReaction,
      reactionMs: this.reaction,
      tier: this.tier,
      enemyShotMs: this.shotDelays[0],
      shotsFired: this.shotsFired,
      hits: this.hits,
      heroHp: this.hero.hp,
      enemyHp: this.enemy.hp,
      durationMs: this.now - this.startedAt,
      attempt: this.attempt,
      headshots: this.headshots,
      hitsIgnored: this.ignoredHits,
      revivesUsed: this.revivesUsed,
      staggers: this.staggers,
    };
    this.setPhase('RESOLVE');
    this.events.emit('onResolve', { t: this.now, result: this.result });
  }
}

/** RULE F4 text for the death screen. */
export function describeLoss(r: DuelResult): string {
  switch (r.cause) {
    case 'too_slow':
      return r.flinched ? 'Flinched, then shot before you drew' : `Too slow: enemy fired at ${Math.round(r.enemyShotMs)} ms`;
    case 'shot_while_drawing':
      return r.reactionMs !== null ? `Slow draw ${Math.round(r.reactionMs)} ms` : 'Shot while drawing';
    case 'shot_while_aiming':
      return 'Shot while aiming';
    case 'outgunned':
      return 'Outgunned in a long fight';
    default:
      return '';
  }
}

/** Replays a recorded input log against a fresh system. Same seed + log => identical outcome. */
export function replayDuel(params: DuelParams, inputs: readonly DuelInput[], endT: number): DuelSystem {
  const d = new DuelSystem(params);
  for (const ev of inputs) d.input(ev);
  d.advanceTo(endT);
  return d;
}
