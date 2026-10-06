import type Phaser from 'phaser';
import { audioBus } from '../core/audioEvents';
import type { AudioEvent, HapticProfile } from '../core/audioEvents';
import { haptics as defaultHaptics } from '../core/HapticsManager';
import { Rng } from '../core/rng';
import { DUEL_CONFIG } from '../data/duelConfig';
import type { DrawTier } from '../data/duelConfig';
import { FEEL, impactKindFor } from '../data/feel';
import type { FeelConfig, ImpactKind } from '../data/feel';
import type { DuelEvents } from './DuelSystem';
import type { TypedEmitter } from './DuelSystem';

/**
 * A03 Game Feel layer. Attach to the scene via `installFeel(scene, duelFeedback)`.
 *
 * Visual only: it never touches DuelSystem, the pointer handlers or the duel clock, so it cannot
 * delay input, a shot or a retry. Hit-stop/slow-mo scale tweens and sprite animations (never
 * scene.time) and are timed on REAL deltas, so a frozen frame still ends on schedule.
 * Everything is cancelled on onRetry/onWait and on scene shutdown.
 *
 * This file only imports Phaser types so its pure helpers run under plain Vitest.
 */

// ---------------------------------------------------------------------------
// Pure helpers (no Phaser)
// ---------------------------------------------------------------------------

export function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

export interface FeelSettings {
  reducedShake: boolean;
}

export const capHitStopMs = (ms: number, cfg: FeelConfig = FEEL): number => clamp(ms, 0, cfg.caps.hitStopMs);

export function capSlowMo(scale: number, ms: number, cfg: FeelConfig = FEEL): { scale: number; ms: number } {
  return { scale: clamp(scale, cfg.caps.slowMoMinScale, 1), ms: clamp(ms, 0, cfg.caps.slowMoMs) };
}

/** Screen shake after caps and the reduced-shake setting. `intensity` is Phaser's fraction of camera width. */
export function capShake(
  px: number,
  ms: number,
  reduced: boolean,
  cfg: FeelConfig = FEEL,
  cameraWidth: number = DUEL_CONFIG.arena.width,
): { px: number; ms: number; intensity: number } {
  const scaled = px * (reduced ? cfg.reducedShake.shakeScale : 1);
  const cpx = clamp(scaled, 0, cfg.caps.shakePx);
  const cms = cpx > 0 ? clamp(ms, 0, cfg.caps.shakeMs) : 0;
  return { px: cpx, ms: cms, intensity: cpx / cameraWidth };
}

export function capFlash(alpha: number, ms: number, cfg: FeelConfig = FEEL): { alpha: number; ms: number } {
  return { alpha: clamp(alpha, 0, cfg.caps.flashAlpha), ms: clamp(ms, 0, cfg.caps.flashMs) };
}

export function capPunchZoom(zoom: number, reduced: boolean, cfg: FeelConfig = FEEL): number {
  return clamp(reduced ? cfg.reducedShake.punchZoom : zoom, 0, cfg.caps.punchZoom);
}

/** How many particles a burst may spawn right now. */
export function particleBudget(requested: number, live: number, cfg: FeelConfig = FEEL): number {
  const room = Math.max(0, cfg.caps.maxLiveParticles - Math.max(0, live));
  return Math.max(0, Math.min(Math.floor(requested), cfg.caps.maxParticlesPerBurst, room));
}

/** Time for the bullet to arrive; the impact is delayed by this much (capped). */
export function impactDelayMs(from: { x: number; y: number }, to: { x: number; y: number }, cfg: FeelConfig = FEEL): number {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return 0;
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  return clamp(d / cfg.tracer.pxPerMs, 0, cfg.tracer.maxDelayMs);
}

/** Kick and settle times squeezed so their sum never exceeds the duel's recoil lock. */
export function recoilTimings(cfg: FeelConfig = FEEL, recoilLockMs: number = DUEL_CONFIG.aim.recoilMs): { kickMs: number; settleMs: number } {
  const total = cfg.recoil.kickMs + cfg.recoil.settleMs;
  if (total <= recoilLockMs || total <= 0) return { kickMs: cfg.recoil.kickMs, settleMs: cfg.recoil.settleMs };
  const k = recoilLockMs / total;
  return { kickMs: cfg.recoil.kickMs * k, settleMs: cfg.recoil.settleMs * k };
}

export const easeOutQuad = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 2;
export function easeOutBack(t: number, s = 1.70158): number {
  const x = clamp(t, 0, 1) - 1;
  return 1 + (s + 1) * x ** 3 + s * x ** 2;
}

/** 0 -> 1 over `inMs`, then 1 -> 0 over `outMs`. Used for the camera punch. */
export function punchCurve(elapsedMs: number, inMs: number, outMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < inMs) return easeOutQuad(elapsedMs / inMs);
  const o = elapsedMs - inMs;
  return o >= outMs ? 0 : 1 - easeOutQuad(o / outMs);
}

export interface ImpactPlan {
  kind: ImpactKind;
  delayMs: number;
  hitStopMs: number;
  shake: { px: number; ms: number; intensity: number };
  flash: { alpha: number; ms: number };
  particles: number;
  knockbackPx: number;
  slowMo: { scale: number; ms: number } | null;
  haptic: HapticProfile | null;
}

export interface HitLike {
  target: 'enemy' | 'hero' | 'prop';
  zone: DuelEvents['onHit']['zone'];
  crit: boolean;
  killed: boolean;
}

/** Everything one hit does, already capped. Pure so it can be table-tested. */
export function planImpact(hit: HitLike, delayMs: number, reduced: boolean, cfg: FeelConfig = FEEL): ImpactPlan {
  const kind = impactKindFor(hit.target, hit.zone);
  const t = cfg.impact[kind];
  let stop = t.hitStopMs;
  let shake = t.shakePx;
  const critHit = hit.crit && hit.target === 'enemy';
  if (critHit) {
    if (stop > 0) stop += cfg.crit.hitStopAddMs;
    shake *= cfg.crit.shakeMul;
  }
  let slowMo: ImpactPlan['slowMo'] = null;
  if (hit.killed && hit.target !== 'prop') {
    stop = Math.max(stop, cfg.kill.hitStopMs);
    shake *= cfg.kill.shakeMul;
    slowMo = hit.target === 'enemy'
      ? capSlowMo(cfg.kill.slowMoScale, cfg.kill.slowMoMs, cfg)
      : capSlowMo(cfg.heroKill.slowMoScale, cfg.heroKill.slowMoMs, cfg);
  }
  const haptic = hit.target === 'hero' ? cfg.haptics.playerHit
    : critHit || hit.zone === 'head' ? cfg.haptics.critHit
    : hit.killed ? cfg.haptics.kill
    : null;
  return {
    kind,
    delayMs: clamp(delayMs, 0, cfg.tracer.maxDelayMs),
    hitStopMs: capHitStopMs(stop, cfg),
    shake: capShake(shake, t.shakeMs, reduced, cfg),
    flash: capFlash(t.flashAlpha, cfg.impactFlash.ms, cfg),
    particles: Math.min(t.particles, cfg.caps.maxParticlesPerBurst),
    knockbackPx: t.knockbackPx,
    slowMo,
    haptic,
  };
}

export interface PerfectDrawPlan {
  punchZoom: number;
  punchInMs: number;
  punchOutMs: number;
  flash: { alpha: number; ms: number };
  slowMo: { scale: number; ms: number };
}

export function planPerfectDraw(reduced: boolean, cfg: FeelConfig = FEEL): PerfectDrawPlan {
  const p = cfg.perfectDraw;
  return {
    punchZoom: capPunchZoom(p.punchZoom, reduced, cfg),
    punchInMs: p.punchInMs,
    punchOutMs: p.punchOutMs,
    flash: capFlash(p.flashAlpha, p.flashMs, cfg),
    slowMo: capSlowMo(p.slowMoScale, p.slowMoMs, cfg),
  };
}

export interface DodgePlan {
  kind: 'perfect' | 'ok' | 'fail' | 'pastShot';
  shake: { px: number; ms: number; intensity: number };
  flash: { alpha: number; ms: number; colour: number };
  punchZoom: number;
  slowMo: { scale: number; ms: number } | null;
  particles: number;
  haptic: HapticProfile | null;
  /** Extra layered audio event (the bus already plays 'dodge' for every successful dodge). */
  audio: 'dodge_perfect' | null;
}

export interface DodgeLike {
  result: DuelEvents['onDodge']['result'];
  cloud?: boolean;
}

/** Everything one dodge (or evaded shot) does, already capped. */
export function planDodge(d: DodgeLike, reduced: boolean, cfg: FeelConfig = FEEL): DodgePlan {
  const kind: DodgePlan['kind'] = d.result === 'perfect' ? 'perfect' : d.result === 'ok' ? 'ok' : 'fail';
  return planDodgeKind(kind, !!d.cloud && kind !== 'fail', reduced, cfg);
}

export function planDodgeKind(kind: DodgePlan['kind'], cloud: boolean, reduced: boolean, cfg: FeelConfig = FEEL): DodgePlan {
  const t = cfg.dodge[kind];
  const sm = t.slowMoMs > 0 ? capSlowMo(t.slowMoScale, t.slowMoMs, cfg) : null;
  const particles = Math.min(cfg.caps.maxParticlesPerBurst, t.particles + (cloud ? cfg.dodge.cloudParticles : 0));
  return {
    kind,
    shake: capShake(t.shakePx, t.shakeMs, reduced, cfg),
    flash: { ...capFlash(t.flashAlpha, t.flashMs, cfg), colour: t.flashColour },
    punchZoom: capPunchZoom(t.punchZoom, reduced, cfg),
    slowMo: sm && sm.ms > 0 ? sm : null,
    particles,
    haptic: kind === 'perfect' ? cfg.haptics.dodgePerfect : kind === 'ok' ? cfg.haptics.dodgeOk : kind === 'fail' ? cfg.haptics.dodgeFail : null,
    audio: kind === 'perfect' ? 'dodge_perfect' : null,
  };
}

export interface ReactionPopPlan {
  text: string;
  colour: string;
  delayMs: number;
  totalMs: number;
}

export function planReactionPop(tier: DrawTier, reactionMs: number, flinched: boolean, cfg: FeelConfig = FEEL): ReactionPopPlan {
  const r = cfg.reactionPop;
  const ms = Number.isFinite(reactionMs) ? Math.max(0, Math.round(reactionMs)) : 0;
  const totalMs = Math.min(r.popInMs + r.settleMs + r.holdMs + r.fadeMs, cfg.caps.maxEffectLifeMs);
  return {
    text: `${r.labels[tier]}\n${ms} ms`,
    colour: flinched ? r.flinchedColour : r.colours[tier],
    delayMs: Math.max(0, r.delayMs),
    totalMs,
  };
}

/**
 * Time-scale timeline for hit-stop (scale 0) and slow-mo. Driven by REAL deltas.
 * Hit-stop wins over slow-mo; slow-mo only counts down while not frozen.
 * Nothing here can outlast its cap, and `cancel()` returns to 1 immediately.
 */
export class ScaleEnvelope {
  private stopMs = 0;
  private slowMs = 0;
  private slowScale = 1;

  constructor(private readonly cfg: FeelConfig = FEEL) {}

  hitStop(ms: number): void {
    this.stopMs = Math.min(this.cfg.caps.hitStopMs, Math.max(this.stopMs, capHitStopMs(ms, this.cfg)));
  }

  slowMo(scale: number, ms: number): void {
    const c = capSlowMo(scale, ms, this.cfg);
    if (c.ms <= 0) return;
    // the stronger (lower) scale wins; remaining time never exceeds the cap
    this.slowScale = this.slowMs > 0 ? Math.min(this.slowScale, c.scale) : c.scale;
    this.slowMs = Math.min(this.cfg.caps.slowMoMs, Math.max(this.slowMs, c.ms));
  }

  tick(realDeltaMs: number): number {
    const dt = clamp(realDeltaMs, 0, 50);
    if (this.stopMs > 0) this.stopMs = Math.max(0, this.stopMs - dt);
    else if (this.slowMs > 0) this.slowMs = Math.max(0, this.slowMs - dt);
    return this.scale;
  }

  get scale(): number {
    if (this.stopMs > 0) return 0;
    return this.slowMs > 0 ? this.slowScale : 1;
  }

  get active(): boolean {
    return this.stopMs > 0 || this.slowMs > 0;
  }

  /** Worst-case real time until the scale is back to 1. */
  get remainingMs(): number {
    return this.stopMs + this.slowMs;
  }

  cancel(): void {
    this.stopMs = 0;
    this.slowMs = 0;
    this.slowScale = 1;
  }
}

/** Real-time delayed callbacks (independent of scene.time and of hit-stop). */
export class RealScheduler {
  private items: { at: number; fn: () => void }[] = [];
  private clock = 0;

  after(ms: number, fn: () => void): void {
    if (ms <= 0) {
      fn();
      return;
    }
    this.items.push({ at: this.clock + ms, fn });
  }

  tick(realDeltaMs: number): void {
    this.clock += clamp(realDeltaMs, 0, 50);
    if (this.items.length === 0) return;
    const due = this.items.filter((i) => i.at <= this.clock);
    this.items = this.items.filter((i) => i.at > this.clock);
    for (const i of due) {
      try {
        i.fn();
      } catch {
        // juice never breaks the duel
      }
    }
  }

  get pending(): number {
    return this.items.length;
  }

  cancel(): void {
    this.items = [];
  }
}

// ---------------------------------------------------------------------------
// Phaser-facing layer
// ---------------------------------------------------------------------------

type Bus = Pick<TypedEmitter<DuelEvents>, 'on'>;
type Pt = { x: number; y: number };

export interface FeelOptions {
  config?: FeelConfig;
  settings?: () => FeelSettings;
  haptics?: { play(profile: HapticProfile): boolean };
  /** Optional audio sink for the layered dodge_perfect chime (defaults to the shared audioBus). */
  audio?: { emit(e: AudioEvent): void };
  /** Optional explicit display objects; otherwise found on the scene display list by position. */
  targets?: { hero?: Phaser.GameObjects.GameObject; enemy?: Phaser.GameObjects.GameObject };
}

function osPrefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Movable = Phaser.GameObjects.GameObject & { x: number; setX(v: number): unknown };
type Killable = { stop(): unknown; remove?(): unknown };

export class FeelSystem {
  private readonly cfg: FeelConfig;
  private readonly getSettings: () => FeelSettings;
  private readonly haptics: { play(profile: HapticProfile): boolean };
  private readonly audio: { emit(e: AudioEvent): void };
  private readonly env: ScaleEnvelope;
  private readonly sched = new RealScheduler();
  private readonly rng = new Rng(0xfee1);
  private scene: Phaser.Scene | null = null;
  private offs: (() => void)[] = [];
  private tweens = new Set<Killable>();
  private particles = new Set<Phaser.GameObjects.GameObject>();
  private muzzles = new Set<Phaser.GameObjects.GameObject>();
  private transient = new Set<Phaser.GameObjects.GameObject>();
  private overlay: (Phaser.GameObjects.Rectangle & { alpha: number }) | null = null;
  private overlayTween: Killable | null = null;
  private zoomTween: Killable | null = null;
  private recoilHome = new Map<Movable, number>();
  private targetOverride: FeelOptions['targets'];
  private cached: { hero?: Movable; enemy?: Movable } = {};
  private lastScale = 1;

  constructor(opts: FeelOptions = {}) {
    this.cfg = opts.config ?? FEEL;
    this.env = new ScaleEnvelope(this.cfg);
    const os = osPrefersReducedMotion();
    this.getSettings = opts.settings ?? (() => ({ reducedShake: os }));
    this.haptics = opts.haptics ?? defaultHaptics;
    this.audio = opts.audio ?? audioBus;
    this.targetOverride = opts.targets;
  }

  get attached(): boolean {
    return this.scene !== null;
  }

  /** Subscribe to the duel feedback bus. Safe to call again: the previous attachment is torn down first. */
  attach(scene: Phaser.Scene, bus: Bus): void {
    this.detach();
    this.scene = scene;
    const on = bus.on.bind(bus) as <K extends keyof DuelEvents>(n: K, f: (p: DuelEvents[K]) => void) => () => void;
    this.offs.push(
      on('onFlinch', () => this.onFlinch()),
      on('onDraw', (e) => this.onDraw(e)),
      on('onPerfectDraw', () => this.onPerfectDraw()),
      on('onShot', (e) => this.onShot(e)),
      on('onHit', (e) => this.onHit(e)),
      on('onDodge', (e) => this.onDodge(e)),
      on('onMiss', (e) => this.onMiss(e)),
      on('onRetry', () => this.cancelAll()),
      on('onWait', () => this.cancelAll()),
    );
    const ev = scene.events;
    ev.on('update', this.update, this);
    ev.once('shutdown', this.detach, this);
    ev.once('destroy', this.detach, this);
    this.offs.push(() => {
      ev.off('update', this.update, this);
      ev.off('shutdown', this.detach, this);
      ev.off('destroy', this.detach, this);
    });
  }

  /** Cancels every effect and unsubscribes. Idempotent. */
  detach(): void {
    this.cancelAll();
    for (const off of this.offs) off();
    this.offs = [];
    this.overlay?.destroy();
    this.overlay = null;
    this.scene = null;
    this.cached = {};
  }

  /** Stops every tween, timer, object and time-scale change. Called on retry and shutdown. */
  cancelAll(): void {
    this.sched.cancel();
    this.env.cancel();
    this.applyScale(1, true);
    for (const t of this.tweens) {
      try {
        t.stop();
      } catch {
        // already gone
      }
    }
    this.tweens.clear();
    this.overlayTween = null;
    this.zoomTween = null;
    for (const [obj, home] of this.recoilHome) if (obj.active) obj.setX(home);
    this.recoilHome.clear();
    for (const set of [this.particles, this.muzzles, this.transient]) {
      for (const o of set) if (o.active) o.destroy();
      set.clear();
    }
    const s = this.scene;
    if (s) {
      if (this.overlay?.active) this.overlay.alpha = 0;
      try {
        s.cameras.main.setZoom(1);
        s.cameras.main.shakeEffect.reset();
      } catch {
        // camera gone (shutdown)
      }
    }
  }

  /** Test/diagnostic view. */
  get liveParticles(): number {
    return this.particles.size;
  }
  get liveMuzzles(): number {
    return this.muzzles.size;
  }
  get timeScale(): number {
    return this.env.scale;
  }
  get pendingTimers(): number {
    return this.sched.pending;
  }

  private reduced(): boolean {
    try {
      return !!this.getSettings().reducedShake;
    } catch {
      return false;
    }
  }

  // ---- real-time driver ---------------------------------------------------

  private update = (_time: number, deltaMs: number): void => {
    this.sched.tick(deltaMs);
    this.env.tick(deltaMs);
    this.applyScale(this.env.scale);
  };

  private applyScale(s: number, force = false): void {
    if (!this.scene || (!force && s === this.lastScale)) return;
    this.lastScale = s;
    try {
      this.scene.tweens.timeScale = s;
      this.scene.anims.globalTimeScale = s;
    } catch {
      // scene tearing down
    }
  }

  /** Runs `fn` after `ms` of REAL time (immediately for 0). */
  private later(ms: number, fn: () => void): void {
    this.sched.after(ms, () => {
      if (this.scene) fn();
    });
  }

  private track<T extends Killable>(t: T): T {
    this.tweens.add(t);
    return t;
  }

  // ---- event handlers -----------------------------------------------------

  private onFlinch(): void {
    this.play(this.cfg.haptics.flinch);
    const hero = this.find('hero');
    if (hero) this.kick(hero, -1, this.cfg.flinch.twitchPx, this.cfg.flinch.twitchMs, this.cfg.flinch.twitchMs * 2);
  }

  private onDraw(e: DuelEvents['onDraw']): void {
    const plan = planReactionPop(e.tier, e.reactionMs, e.flinched, this.cfg);
    this.later(plan.delayMs, () => this.spawnReactionPop(plan));
  }

  private onPerfectDraw(): void {
    const s = this.scene;
    if (!s) return;
    const plan = planPerfectDraw(this.reduced(), this.cfg);
    this.play(this.cfg.haptics.perfectDraw);
    this.flash(this.cfg.perfectDraw.flashColour, plan.flash.alpha, plan.flash.ms);
    this.env.slowMo(plan.slowMo.scale, plan.slowMo.ms);
    this.applyScale(this.env.scale);
    if (plan.punchZoom > 0) this.punchZoom(plan.punchZoom, plan.punchInMs, plan.punchOutMs);
  }

  private onDodge(e: DuelEvents['onDodge']): void {
    const plan = planDodge(e, this.reduced(), this.cfg);
    this.runDodge(plan, e.dir === 'left' ? -1 : 1);
  }

  /** Enemy shot that missed because of a dodge or a dust cloud. Natural misses and the hero's own misses are not ours. */
  private onMiss(e: DuelEvents['onMiss']): void {
    if (e.shooter !== 'enemy' || !e.evaded) return;
    const plan = planDodgeKind('pastShot', e.evaded === 'dust', this.reduced(), this.cfg);
    this.runDodge(plan, 1);
  }

  private runDodge(plan: DodgePlan, dir: -1 | 1): void {
    const s = this.scene;
    if (!s) return;
    this.play(plan.haptic);
    if (plan.slowMo) this.env.slowMo(plan.slowMo.scale, plan.slowMo.ms);
    this.applyScale(this.env.scale);
    if (plan.shake.ms > 0 && plan.shake.intensity > 0) s.cameras.main.shake(plan.shake.ms, plan.shake.intensity, true);
    if (plan.flash.alpha > 0) this.flash(plan.flash.colour, plan.flash.alpha, plan.flash.ms);
    if (plan.punchZoom > 0) this.punchZoom(plan.punchZoom, this.cfg.perfectDraw.punchInMs, this.cfg.perfectDraw.punchOutMs);
    if (plan.particles > 0) {
      const A = DUEL_CONFIG.arena;
      this.burst(A.hero.x, A.hero.y + 20, plan.particles, 'prop', dir > 0 ? -1 : 1, this.cfg.dodge.dustColour);
    }
    if (plan.audio) {
      try {
        this.audio.emit({ type: plan.audio });
      } catch {
        // audio is optional
      }
    }
  }

  private onShot(e: DuelEvents['onShot']): void {
    const player = e.shooter === 'player';
    const c = this.cfg;
    this.later(c.muzzle.delayMs, () => this.spawnMuzzle(player));
    const who = this.find(player ? 'hero' : 'enemy');
    if (who) {
      const { kickMs, settleMs } = recoilTimings(c);
      this.kick(who, player ? -1 : 1, c.recoil.kickPx, kickMs, settleMs);
    }
  }

  private onHit(e: DuelEvents['onHit']): void {
    const A = DUEL_CONFIG.arena;
    const c = this.cfg;
    const playerShot = e.target !== 'hero';
    const from: Pt = playerShot
      ? { x: A.hero.x + c.muzzle.heroOffset.x, y: A.hero.y + c.muzzle.heroOffset.y }
      : { x: A.enemy.x + c.muzzle.enemyOffset.x, y: A.enemy.y + c.muzzle.enemyOffset.y };
    const plan = planImpact(e, impactDelayMs(from, { x: e.x, y: e.y }, c), this.reduced(), c);
    this.later(plan.delayMs, () => this.runImpact(plan, e));
  }

  private runImpact(plan: ImpactPlan, e: DuelEvents['onHit']): void {
    const s = this.scene;
    if (!s) return;
    const c = this.cfg;
    if (plan.hitStopMs > 0) this.env.hitStop(plan.hitStopMs);
    if (plan.slowMo) this.env.slowMo(plan.slowMo.scale, plan.slowMo.ms);
    this.applyScale(this.env.scale);
    if (plan.shake.ms > 0 && plan.shake.intensity > 0) s.cameras.main.shake(plan.shake.ms, plan.shake.intensity, true);
    if (plan.flash.alpha > 0) this.flash(c.impactFlash.colour, plan.flash.alpha, plan.flash.ms);
    this.impactRing(e.x, e.y);
    this.burst(e.x, e.y, plan.particles, plan.kind, e.target === 'hero' ? -1 : 1);
    this.play(plan.haptic);
    if (plan.knockbackPx > 0) {
      const who = this.find(e.target === 'hero' ? 'hero' : 'enemy');
      if (who) this.kick(who, e.target === 'hero' ? -1 : 1, plan.knockbackPx, c.recoil.kickMs, c.recoil.settleMs);
    }
  }

  // ---- effects --------------------------------------------------------------

  private play(p: HapticProfile | null): void {
    if (!p) return;
    try {
      this.haptics.play(p);
    } catch {
      // haptics are optional
    }
  }

  private find(which: 'hero' | 'enemy'): Movable | null {
    const s = this.scene;
    if (!s) return null;
    const cached = this.cached[which];
    if (cached?.active) return cached;
    const override = this.targetOverride?.[which] as Movable | undefined;
    if (override?.active) return (this.cached[which] = override);
    const spot = which === 'hero' ? DUEL_CONFIG.arena.hero : DUEL_CONFIG.arena.enemy;
    const found = s.children.list.find((o) => {
      const m = o as Partial<Movable> & { type?: string; y?: number };
      return m.type !== 'Text' && typeof m.setX === 'function' && m.active === true && Math.abs((m.x ?? NaN) - spot.x) < 0.5 && Math.abs((m.y ?? NaN) - spot.y) < 0.5;
    }) as Movable | undefined;
    if (found) this.cached[which] = found;
    return found ?? null;
  }

  /** Shove `obj` by `px` in direction `dir` and ease it home. Always returns to its resting x. */
  private kick(obj: Movable, dir: -1 | 1, px: number, kickMs: number, settleMs: number): void {
    const s = this.scene;
    if (!s) return;
    const home = this.recoilHome.get(obj) ?? obj.x;
    this.recoilHome.set(obj, home);
    obj.setX(home);
    const t1 = this.track(
      s.tweens.add({
        targets: obj,
        x: home + dir * px,
        duration: Math.max(1, kickMs),
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.delete(t1);
          if (!this.scene) return;
          const t2 = this.track(
            this.scene.tweens.add({
              targets: obj,
              x: home,
              duration: Math.max(1, settleMs),
              ease: 'Quad.easeInOut',
              onComplete: () => {
                this.tweens.delete(t2);
                if (obj.active) obj.setX(home);
                this.recoilHome.delete(obj);
              },
            }),
          );
        },
      }),
    );
  }

  private ensureOverlay(): (Phaser.GameObjects.Rectangle & { alpha: number }) | null {
    const s = this.scene;
    if (!s) return null;
    if (!this.overlay || !this.overlay.active) {
      const A = DUEL_CONFIG.arena;
      this.overlay = s.add.rectangle(A.width / 2, A.height / 2, A.width, A.height, 0xffffff, 0).setDepth(this.cfg.depth).setScrollFactor(0) as Phaser.GameObjects.Rectangle & { alpha: number };
    }
    return this.overlay;
  }

  private flash(colour: number, alpha: number, ms: number): void {
    const s = this.scene;
    const c = capFlash(alpha, ms, this.cfg);
    if (!s || c.alpha <= 0 || c.ms <= 0) return;
    const o = this.ensureOverlay();
    if (!o) return;
    if (this.overlayTween) {
      this.overlayTween.stop();
      this.tweens.delete(this.overlayTween);
    }
    o.setFillStyle(colour, 1);
    o.alpha = c.alpha;
    this.overlayTween = this.track(s.tweens.add({ targets: o, alpha: 0, duration: c.ms, ease: 'Quad.easeOut' }));
  }

  private punchZoom(zoom: number, inMs: number, outMs: number): void {
    const s = this.scene;
    if (!s) return;
    const cam = s.cameras.main;
    this.zoomTween?.stop();
    const z = capPunchZoom(zoom, false, this.cfg);
    const t1 = this.track(
      s.tweens.add({
        targets: cam,
        zoom: 1 + z,
        duration: inMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.delete(t1);
          if (!this.scene) return;
          this.zoomTween = this.track(this.scene.tweens.add({ targets: cam, zoom: 1, duration: outMs, ease: 'Quad.easeOut' }));
        },
      }),
    );
    this.zoomTween = t1;
  }

  private spawnMuzzle(player: boolean): void {
    const s = this.scene;
    const m = this.cfg.muzzle;
    if (!s || this.muzzles.size >= this.cfg.caps.maxLiveMuzzle) return;
    const A = DUEL_CONFIG.arena;
    const base = player ? A.hero : A.enemy;
    const off = player ? m.heroOffset : m.enemyOffset;
    const x = base.x + off.x;
    const y = base.y + off.y;
    let obj: Phaser.GameObjects.GameObject & { destroy(): void };
    const hasAnim = s.textures.exists(m.atlas) && s.anims.exists(m.anim);
    if (hasAnim) {
      const sp = s.add.sprite(x, y, m.atlas).setDepth(this.cfg.depth - 1).setScale(m.scale).setFlipX(!player);
      sp.play(m.anim);
      sp.once('animationcomplete', () => this.dropMuzzle(sp));
      obj = sp;
    } else {
      obj = s.add.circle(x, y, 7, m.fallbackColour, 1).setDepth(this.cfg.depth - 1);
      this.later(m.fallbackMs, () => this.dropMuzzle(obj));
    }
    this.muzzles.add(obj);
    // safety net so a missing animationcomplete can never leave a flash on screen
    this.later(Math.min(m.maxLifeMs, this.cfg.caps.maxEffectLifeMs), () => this.dropMuzzle(obj));
  }

  private dropMuzzle(o: Phaser.GameObjects.GameObject): void {
    this.muzzles.delete(o);
    if (o.active) o.destroy();
  }

  private impactRing(x: number, y: number): void {
    const s = this.scene;
    const f = this.cfg.impactFlash;
    if (!s || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const ring = s.add.circle(x, y, f.radiusPx * 0.4, f.colour, 0.9).setDepth(this.cfg.depth - 1);
    this.transient.add(ring);
    this.track(
      s.tweens.add({
        targets: ring,
        scale: 2.2,
        alpha: 0,
        duration: Math.min(f.ms, this.cfg.caps.flashMs),
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.transient.delete(ring);
          if (ring.active) ring.destroy();
        },
      }),
    );
  }

  private burst(x: number, y: number, requested: number, kind: ImpactKind, dir: -1 | 1, colour?: number): void {
    const s = this.scene;
    if (!s || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const n = particleBudget(requested, this.particles.size, this.cfg);
    const p = this.cfg.particle;
    const life = Math.min(p.lifeMs, this.cfg.caps.maxEffectLifeMs);
    for (let i = 0; i < n; i++) {
      const ang = (this.rng.next() - 0.5) * Math.PI * 1.1 + (dir > 0 ? 0 : Math.PI);
      const sp = p.speedPx * (0.5 + this.rng.next() * 0.5);
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp - p.speedPx * 0.4;
      const r = s.add.rectangle(x, y, p.sizePx, p.sizePx, colour ?? p.colours[kind], 1).setDepth(this.cfg.depth - 2);
      this.particles.add(r);
      const tw = this.track(
        s.tweens.addCounter({
          from: 0,
          to: 1,
          duration: life,
          onUpdate: (t: Phaser.Tweens.Tween) => {
            const k = t.getValue() ?? 0;
            const sec = (k * life) / 1000;
            r.setPosition(x + vx * sec, y + vy * sec + 0.5 * p.gravityPx * sec * sec);
            r.setAlpha(1 - k);
          },
          onComplete: () => {
            this.tweens.delete(tw);
            this.particles.delete(r);
            if (r.active) r.destroy();
          },
        }),
      );
    }
  }

  private spawnReactionPop(plan: ReactionPopPlan): void {
    const s = this.scene;
    const r = this.cfg.reactionPop;
    if (!s) return;
    const txt = s.add
      .text(r.x, r.y, plan.text, { fontFamily: 'monospace', fontSize: `${r.fontPx}px`, color: plan.colour, fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 6, align: 'center' })
      .setOrigin(0.5)
      .setDepth(this.cfg.depth - 3)
      .setScale(r.startScale);
    this.transient.add(txt);
    const done = (): void => {
      this.transient.delete(txt);
      if (txt.active) txt.destroy();
    };
    const t1 = this.track(
      s.tweens.add({
        targets: txt,
        scale: r.peakScale,
        duration: r.popInMs,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.delete(t1);
          if (!this.scene) return;
          const t2 = this.track(
            this.scene.tweens.add({
              targets: txt,
              scale: 1,
              duration: r.settleMs,
              ease: 'Quad.easeOut',
              onComplete: () => {
                this.tweens.delete(t2);
                if (!this.scene) return;
                const t3 = this.track(
                  this.scene.tweens.add({
                    targets: txt,
                    alpha: 0,
                    delay: r.holdMs,
                    duration: r.fadeMs,
                    onComplete: () => {
                      this.tweens.delete(t3);
                      done();
                    },
                  }),
                );
              },
            }),
          );
        },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const installed = new WeakMap<object, FeelSystem>();

/**
 * One-line hook for the duel scene (A02/Lead): in `DuelScene.create()`, after `this.startSystem()`:
 *
 *     installFeel(this, duelFeedback);
 *
 * (imports: `import { installFeel } from '../systems/FeelSystem';`). It auto-detaches on scene
 * shutdown, is idempotent per scene, and returns the FeelSystem for tests/settings wiring.
 * `bus` is a parameter, not an import, so this file never loads Phaser at runtime.
 */
export function installFeel(scene: Phaser.Scene, bus: Bus, opts?: FeelOptions): FeelSystem {
  const existing = installed.get(scene);
  if (existing) existing.detach();
  const fs = new FeelSystem(opts);
  fs.attach(scene, bus);
  installed.set(scene, fs);
  return fs;
}
