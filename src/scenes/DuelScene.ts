import Phaser from 'phaser';
import { registerAnimations } from '../animation';
import { getArena, DUST_CREEK, ZONE_H, ZONE_W } from '../data/arenas';
import type { TargetZone } from '../data/arenas';
import { DUEL_CONFIG, SCENE_TUNING } from '../data/duelConfig';
import type { DuelConfig } from '../data/duelConfig';
import { enemyHpFor, getEnemyDef, resolveSpritePrefix } from '../data/enemies';
import type { EnemyDef } from '../data/enemies';
import { Rng } from '../core/rng';
import { Duelist, Hero } from '../entities/Hero';
import { Projectile } from '../entities/Projectile';
import { TIER_LABEL } from '../systems/DrawSystem';
import { DUEL_EVENT_NAMES, DuelSystem, TypedEmitter, describeLoss } from '../systems/DuelSystem';
import type { DuelEvents, DuelResult, OpponentController } from '../systems/DuelSystem';
import { createOpponent } from '../systems/EnemyAISystem';
import type { EnemyOpponent } from '../systems/EnemyAISystem';
import { installFeel } from '../systems/FeelSystem';
import { SwipeTracker, pointInRect, reticleFromTouch } from '../systems/InputSystem';
import { buildArena } from './ArenaBuilder';
import type { ArenaHandle } from './ArenaBuilder';

export const DUEL_SCENE_KEY = 'Duel';

/**
 * Stable feedback bus. A03 Game Feel attaches here (`duelFeedback.on('onHit', ...)`)
 * before or after the scene starts; the scene forwards every DuelSystem event.
 */
export const duelFeedback = new TypedEmitter<DuelEvents>();

export interface DuelSceneData {
  seed?: number;
  /** Arena id from src/data/arenas (default 'dust_creek'). */
  arenaId?: string;
  /** Enemy id from src/data/enemies.ts (default 'bandit'). */
  enemyId?: string;
  /** 0..1 enemy difficulty (default 0.3). */
  difficulty?: number;
  /** Overrides the enemy AI built from `enemyId` (tests, tutorials). */
  opponent?: OpponentController;
  heroHp?: number;
  enemyHp?: number;
  /** Overrides the enemy name shown in the HUD. */
  enemyName?: string;
  /** Called once per resolved duel (win or lose). */
  onResolve?: (result: DuelResult) => void;
}

const glob = (g: Record<string, string>): { png?: string; json?: string } => ({
  png: Object.entries(g).find(([k]) => k.endsWith('.png'))?.[1],
  json: Object.entries(g).find(([k]) => k.endsWith('.json'))?.[1],
});
const PLACEHOLDER_URLS = glob(
  import.meta.glob('../../assets/generated/placeholder_atlas.*', { query: '?url', import: 'default', eager: true }) as Record<string, string>,
);
const TOWN_URLS = glob(
  import.meta.glob('../../assets/generated/town_atlas.*', { query: '?url', import: 'default', eager: true }) as Record<string, string>,
);

const COL = {
  ink: 0x1a0f08,
  brass: 0xe0b040,
  red: 0xd24a3a,
};
const FONT = 'monospace';
const HUD_DEPTH = 6;

type Phase = ReturnType<DuelSystem['snapshot']>['phase'];
const POST_DRAW: readonly Phase[] = ['DRAW', 'AIM', 'SHOT'];

interface DuelDebugHandle {
  snapshot: DuelSystem['snapshot'];
  system: DuelSystem;
  now: () => number;
  scene: DuelScene;
}

interface TargetBase {
  obj: Phaser.GameObjects.Image;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
}

export class DuelScene extends Phaser.Scene {
  private data0: DuelSceneData = {};
  private system!: DuelSystem;
  private cfg: DuelConfig = DUEL_CONFIG;
  private arena!: ArenaHandle;
  private enemyDef!: EnemyDef;
  private opponentCtl!: OpponentController;
  private tracker = new SwipeTracker('up', DUEL_CONFIG.input);

  // clock: real time minus compressed gaps (a long frame or a hidden tab never replays a duel)
  private t0 = 0;
  private lastReal = 0;
  private skew = 0;
  private hidden = false;

  // single pointer tracking (QA-07b)
  private activeId: number | null = null;
  private aimTouch = false;
  private retryId: number | null = null;
  private onVisibility = (): void => this.visibilityChanged();

  private hero!: Hero;
  private enemy!: Duelist;
  private cueText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private holsterText!: Phaser.GameObjects.Text;
  private readout!: Phaser.GameObjects.Text;
  private causeText!: Phaser.GameObjects.Text;
  private zoneText!: Phaser.GameObjects.Text;
  private heroPips: Phaser.GameObjects.Rectangle[] = [];
  private enemyPips: Phaser.GameObjects.Rectangle[] = [];
  private reticleGfx!: Phaser.GameObjects.Graphics;
  private slowMoTint!: Phaser.GameObjects.Rectangle;
  private retryBtn!: Phaser.GameObjects.Container;
  private tellBubble!: Phaser.GameObjects.Text;
  private resultPanel!: Phaser.GameObjects.Rectangle;
  private forwarders: (() => void)[] = [];
  private zoneTextToken = 0;

  // enemy presentation state (visual only)
  private enemyDrawn = false;
  private fakePlayed = false;
  private glintShot = -1;
  private waitStartedAt = 0;
  private fakeWindow: { from: number; to: number } | null = null;
  private targets = new Map<string, TargetBase>();
  private fxObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(DUEL_SCENE_KEY);
  }

  init(data: DuelSceneData): void {
    this.data0 = data ?? {};
  }

  preload(): void {
    if (!this.textures.exists('placeholder') && PLACEHOLDER_URLS.png && PLACEHOLDER_URLS.json) {
      this.load.atlas('placeholder', PLACEHOLDER_URLS.png, PLACEHOLDER_URLS.json);
    }
    if (!this.textures.exists('town') && TOWN_URLS.png && TOWN_URLS.json) {
      this.load.atlas('town', TOWN_URLS.png, TOWN_URLS.json);
    }
    // a failed load must not break the scene: Duelist falls back to rectangles
    this.load.on('loaderror', () => undefined);
  }

  create(): void {
    if (this.textures.exists('placeholder')) registerAnimations(this);
    this.arena = buildArena(this, getArena(this.data0.arenaId ?? DUST_CREEK.id));
    const hp = this.arena.heroPos;
    const ep = this.arena.enemyPos;

    this.enemyDef = this.resolveEnemyDef();
    const hasFrame = (prefix: string): boolean => this.textures.exists('placeholder') && this.textures.get('placeholder').has(`${prefix}_idle_0`);
    const prefix = resolveSpritePrefix(this.enemyDef, hasFrame);

    // the duel logic uses the arena's positions and target zones
    this.cfg = {
      ...DUEL_CONFIG,
      arena: {
        ...DUEL_CONFIG.arena,
        hero: { x: hp.x, y: hp.y },
        enemy: { x: ep.x, y: ep.y, w: ZONE_W, h: ZONE_H },
        props: this.arena.targetZones.map((z: TargetZone) => ({ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h })),
      },
    };
    this.tracker = new SwipeTracker('up', this.cfg.input);

    this.hero = new Hero(this, hp.x, hp.y);
    this.enemy = new Duelist(this, ep.x, ep.y, prefix, ZONE_W, ZONE_H);
    for (const z of this.arena.targetZones) {
      const obj = this.arena.targetObject(z.id);
      if (obj) this.targets.set(z.id, { obj, x: obj.x, y: obj.y, angle: obj.angle, scaleX: obj.scaleX, scaleY: obj.scaleY });
    }

    const name = this.data0.enemyName ?? this.enemyDef.name;
    const place = this.arena.def.id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    this.add.text(16, 48, `${place} - ${name}`, { fontFamily: FONT, fontSize: '16px', color: '#1a0f08', stroke: '#f2d08f', strokeThickness: 3 }).setDepth(HUD_DEPTH);

    this.slowMoTint = this.add.rectangle(180, 320, this.cfg.arena.width, this.cfg.arena.height, 0x000000, 1).setAlpha(0).setDepth(5);
    this.reticleGfx = this.add.graphics().setDepth(20);
    this.cueText = this.add.text(180, 190, '!', { fontFamily: FONT, fontSize: '120px', color: '#d24a3a', fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 8 }).setOrigin(0.5).setVisible(false).setDepth(30);
    this.phaseText = this.add.text(180, 100, '', { fontFamily: FONT, fontSize: '20px', color: '#1a0f08', fontStyle: 'bold', stroke: '#f2d08f', strokeThickness: 3 }).setOrigin(0.5).setDepth(HUD_DEPTH);
    this.tellBubble = this.add.text(ep.x, ep.y - ZONE_H - 40, '', { fontFamily: FONT, fontSize: '14px', color: '#fff3c4', stroke: '#1a0f08', strokeThickness: 3 }).setOrigin(0.5).setVisible(false).setDepth(HUD_DEPTH);
    this.zoneText = this.add.text(180, 250, '', { fontFamily: FONT, fontSize: '20px', color: '#fff3c4', fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 4 }).setOrigin(0.5).setDepth(25);
    this.resultPanel = this.add.rectangle(180, 196, 336, 170, COL.ink, 0.62).setStrokeStyle(2, COL.brass).setDepth(29).setVisible(false);
    this.readout = this.add.text(180, 130, '', { fontFamily: FONT, fontSize: '20px', color: '#fff3c4', align: 'center', stroke: '#1a0f08', strokeThickness: 4, lineSpacing: 6 }).setOrigin(0.5, 0).setDepth(30);
    this.causeText = this.add.text(180, 252, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd0c8', align: 'center', stroke: '#1a0f08', strokeThickness: 3, wordWrap: { width: 320 } }).setOrigin(0.5, 0).setDepth(30);

    const h = this.cfg.arena.holster;
    this.add.rectangle(h.x + h.w / 2, h.y + h.h / 2, h.w, h.h, COL.ink, 0.35).setStrokeStyle(3, COL.brass).setDepth(HUD_DEPTH);
    this.holsterText = this.add.text(h.x + h.w / 2, h.y + h.h / 2, 'HOLD', { fontFamily: FONT, fontSize: '24px', color: '#e0b040', fontStyle: 'bold' }).setOrigin(0.5).setDepth(HUD_DEPTH);
    this.buildRetryButton();

    this.startSystem();
    installFeel(this, duelFeedback, { targets: { hero: this.hero.display, enemy: this.enemy.display } });
    this.bindInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof window !== 'undefined') {
      (window as unknown as { __duel?: DuelDebugHandle }).__duel = { snapshot: () => this.system.snapshot(), system: this.system, now: () => this.nowMs(), scene: this };
    }
  }

  private resolveEnemyDef(): EnemyDef {
    try {
      return getEnemyDef(this.data0.enemyId ?? 'bandit');
    } catch {
      return getEnemyDef('bandit');
    }
  }

  // ---- clock ------------------------------------------------------------

  /**
   * Duel time in ms. Real time, except that a gap between two reads longer than
   * `SCENE_TUNING.maxFrameMs` (hitch, backgrounded tab) is compressed to that cap.
   */
  private nowMs(): number {
    const real = performance.now() - this.t0;
    const gap = real - this.lastReal;
    if (gap > SCENE_TUNING.maxFrameMs) this.skew += gap - SCENE_TUNING.maxFrameMs;
    this.lastReal = real;
    return real - this.skew;
  }

  /** Event time from the DOM timestamp (same origin as performance.now), never later than now. */
  private eventMs(p: Phaser.Input.Pointer): number {
    const now = this.nowMs();
    const raw = (p.event as Event | undefined)?.timeStamp;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return now;
    return Math.min(now, raw - this.t0 - this.skew);
  }

  private visibilityChanged(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.hidden = true;
      this.tracker.cancel();
      this.activeId = null;
      this.aimTouch = false;
    } else {
      // resume: the hidden time never counts
      const real = performance.now() - this.t0;
      this.skew += real - this.lastReal;
      this.lastReal = real;
      this.hidden = false;
    }
  }

  private startSystem(): void {
    this.t0 = performance.now();
    this.lastReal = 0;
    this.skew = 0;
    const seed = this.data0.seed ?? 1337;
    const difficulty = this.data0.difficulty ?? 0.3;
    this.opponentCtl = this.data0.opponent ?? createOpponent(this.enemyDef.id, new Rng(seed), difficulty);
    this.system = new DuelSystem({
      seed,
      config: this.cfg,
      opponent: this.opponentCtl,
      heroHp: this.data0.heroHp,
      enemyHp: this.data0.enemyHp ?? enemyHpFor(this.enemyDef, difficulty),
      startT: 0,
    });
    for (const name of DUEL_EVENT_NAMES) {
      // forward every event to the stable feedback bus
      const off = this.system.events.on(name, ((p: never) => duelFeedback.emit(name, p)) as never);
      this.forwarders.push(off);
    }
    this.wireVisuals();
    this.enterWaitVisuals();
  }

  private teardown(): void {
    for (const off of this.forwarders) off();
    this.forwarders = [];
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    this.arena?.destroy();
  }

  // ---- hud --------------------------------------------------------------

  private buildPips(max: number, x: number, y: number, colour: number): Phaser.GameObjects.Rectangle[] {
    return Array.from({ length: max }, (_, i) => this.add.rectangle(x + i * 22, y, 16, 16, colour).setStrokeStyle(2, COL.ink).setDepth(HUD_DEPTH));
  }

  private refreshPips(): void {
    const s = this.system.snapshot();
    if (this.heroPips.length !== s.heroMaxHp) {
      this.heroPips.forEach((p) => p.destroy());
      this.heroPips = this.buildPips(s.heroMaxHp, 24, 24, COL.red);
    }
    if (this.enemyPips.length !== Math.ceil(s.enemyMaxHp)) {
      this.enemyPips.forEach((p) => p.destroy());
      const e = this.cfg.arena.enemy;
      this.enemyPips = this.buildPips(Math.ceil(s.enemyMaxHp), e.x - (Math.ceil(s.enemyMaxHp) - 1) * 11, e.y - e.h - 24, COL.brass);
    }
    this.heroPips.forEach((p, i) => p.setFillStyle(i < Math.ceil(s.heroHp) ? COL.red : 0x3a2a20));
    this.enemyPips.forEach((p, i) => p.setFillStyle(i < Math.ceil(s.enemyHp) ? COL.brass : 0x3a2a20));
  }

  private buildRetryButton(): void {
    const R = SCENE_TUNING.retry;
    const bg = this.add.rectangle(0, 0, R.w - 80, R.h - 16, COL.brass).setStrokeStyle(3, COL.ink);
    const label = this.add.text(0, 0, 'RETRY', { fontFamily: FONT, fontSize: '28px', color: '#1a0f08', fontStyle: 'bold' }).setOrigin(0.5);
    this.retryBtn = this.add.container(R.cx, R.cy, [bg, label]).setDepth(40).setVisible(false);
  }

  /** The whole holster-zone plank is the hit area, wider than the drawn button. */
  private retryHit(x: number, y: number): boolean {
    const R = SCENE_TUNING.retry;
    return this.retryBtn.visible && pointInRect(x, y, { x: R.cx - R.w / 2, y: R.cy - R.h / 2, w: R.w, h: R.h });
  }

  private enterWaitVisuals(): void {
    this.hero.setState('idle');
    this.enemy.setState('idle');
    this.enemyDrawn = false;
    this.fakePlayed = false;
    this.glintShot = -1;
    this.fakeWindow = null;
    this.waitStartedAt = this.system.snapshot().now;
    this.cueText.setVisible(false);
    this.tellBubble.setVisible(false);
    this.readout.setText('');
    this.causeText.setText('');
    this.resultPanel.setVisible(false);
    this.zoneText.setText('');
    this.retryBtn.setVisible(false);
    this.holsterText.setText('HOLD').setColor('#e0b040');
    this.phaseText.setText('STAND OFF');
    this.reticleGfx.clear();
    this.resetTargets();
    this.setTint(0);
    this.refreshPips();
  }

  private flashZone(text: string, ms: number = SCENE_TUNING.flashZoneMs): void {
    const token = ++this.zoneTextToken;
    this.zoneText.setText(text);
    this.time.delayedCall(ms, () => {
      if (this.zoneTextToken === token) this.zoneText.setText('');
    });
  }

  private setTint(alpha: number): void {
    this.tweens.killTweensOf(this.slowMoTint);
    if (this.slowMoTint.alpha === alpha) return;
    this.tweens.add({ targets: this.slowMoTint, alpha, duration: 60 });
  }

  // ---- arena targets ----------------------------------------------------

  private resetTargets(): void {
    for (const f of this.fxObjs) f.destroy();
    this.fxObjs = [];
    for (const t of this.targets.values()) {
      this.tweens.killTweensOf(t.obj);
      t.obj.setPosition(t.x, t.y).setAngle(t.angle).setScale(t.scaleX, t.scaleY).setAlpha(1).setVisible(true);
    }
  }

  /** Plays the arena's effect key (data/arenas) on the target sprite. */
  private playTargetEffect(targetId: string): void {
    const zone = this.arena.targetZones.find((z) => z.id === targetId);
    const obj = this.arena.targetObject(targetId);
    if (!zone || !obj) return;
    const base = this.targets.get(targetId);
    switch (zone.effect) {
      case 'sign_swing':
        this.tweens.killTweensOf(obj);
        obj.setAngle(base?.angle ?? 0);
        this.tweens.add({ targets: obj, angle: (base?.angle ?? 0) + 14, duration: 90, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => obj.setAngle(base?.angle ?? 0) });
        break;
      case 'barrel_burst':
      case 'lantern_smash': {
        const colour = zone.effect === 'barrel_burst' ? 0x7a4a26 : 0xffe08a;
        this.tweens.killTweensOf(obj);
        obj.setVisible(false);
        for (let i = 0; i < 7; i++) {
          const piece = this.add.rectangle(zone.x + zone.w / 2, zone.y + zone.h / 2, 6, 4, colour).setDepth(3);
          this.fxObjs.push(piece);
          const ang = -Math.PI / 2 + (i - 3) * 0.45;
          this.tweens.add({ targets: piece, x: piece.x + Math.cos(ang) * 40, y: piece.y + Math.sin(ang) * 40 + 24, angle: 200, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
        }
        break;
      }
      default:
        this.tweens.killTweensOf(obj);
        this.tweens.add({ targets: obj, x: obj.x + 3, duration: 40, yoyo: true, repeat: 2, onComplete: () => base && obj.setX(base.x) });
    }
  }

  // ---- visuals wired to duel events --------------------------------------

  private wireVisuals(): void {
    const ev = this.system.events;
    const A = this.cfg.arena;
    const heroMuzzle = { x: A.hero.x + 20, y: A.hero.y - 40 };
    const enemyMuzzle = { x: A.enemy.x - 20, y: A.enemy.y - 40 };
    ev.on('onCue', () => {
      this.cueText.setVisible(true);
      this.tellBubble.setVisible(false);
      this.holsterText.setText('DRAW!').setColor('#d24a3a');
      this.phaseText.setText('DRAW!');
      // FEEL_REVIEW 1: the WAIT hold can be 3 s old; "flick within 600 ms" must mean "of the cue"
      const p = this.trackedPointer();
      if (p && p.isDown && this.tracker.isActive) this.tracker.reanchor(p.x, p.y, this.nowMs());
    });
    ev.on('onFlinch', (e) => {
      const fell = this.fakeWindow !== null && e.t >= this.fakeWindow.from && e.t <= this.fakeWindow.to;
      this.flashZone(fell ? 'FELL FOR THE FAKE +300ms' : 'FLINCH +300ms', SCENE_TUNING.flashFlinchMs);
    });
    ev.on('onDraw', () => {
      // keeps phaseText as DRAW!: the feel layer pops the reaction time (FEEL_REVIEW 8)
      this.cueText.setVisible(false);
      this.hero.setState('draw');
    });
    ev.on('onAimStart', (e) => {
      this.hero.setState('aim');
      if (!e.followUp) this.holsterText.setText('AIM');
    });
    ev.on('onShot', (e) => {
      const T = SCENE_TUNING.tracer;
      if (e.shooter === 'player') {
        this.hero.setState('shoot');
        if (Number.isFinite(e.x) && Number.isFinite(e.y)) {
          const dist = Math.hypot(e.x - heroMuzzle.x, e.y - heroMuzzle.y);
          new Projectile(this, heroMuzzle, { x: e.x, y: e.y }, Phaser.Math.Clamp(dist / T.pxPerMs, T.minMs, T.maxMs));
        }
      } else {
        this.enemy.setState('shoot');
        new Projectile(this, enemyMuzzle, { x: A.hero.x, y: A.hero.y - 40 }, T.enemyMs, COL.red);
      }
    });
    ev.on('onHit', (e) => {
      if (e.target === 'enemy') {
        this.enemy.setState(e.killed ? 'dead' : 'hit');
        this.flashZone(`${(e.zone ?? '').toUpperCase()} x${(e.damage).toFixed(2).replace(/\.?0+$/, '')}${e.crit ? ' CRIT' : ''}`);
      } else if (e.target === 'hero') {
        this.hero.setState(e.killed ? 'dead' : 'hit');
      } else {
        this.flashZone('PROP');
        if (e.propId) this.playTargetEffect(e.propId);
      }
      this.refreshPips();
    });
    ev.on('onMiss', (e) => {
      if (e.shooter === 'player') this.flashZone('MISS');
    });
    ev.on('onPhase', (e) => {
      this.setTint(e.phase === 'AIM' ? 0.2 : 0);
      if (e.phase === 'AIM' && e.prev === 'SHOT' && this.hero.state === 'shoot') this.hero.setState('aim');
      if (e.phase === 'RETRY') this.retryBtn.setVisible(true);
    });
    ev.on('onResolve', (e) => this.showResult(e.result));
    ev.on('onRetry', () => this.enterWaitVisuals());
  }

  private showResult(r: DuelResult): void {
    this.reticleGfx.clear();
    this.cueText.setVisible(false);
    this.tellBubble.setVisible(false);
    const you = r.reactionMs === null ? 'YOU --' : `YOU ${Math.round(r.reactionMs)} ms`;
    const tier = r.tier ? `  ${TIER_LABEL[r.tier]}` : '';
    this.readout.setText(`${r.outcome === 'WIN' ? 'YOU WIN' : 'YOU LOSE'}\n${you}${tier}\nENEMY ${Math.round(r.enemyShotMs)} ms`);
    this.causeText.setText(r.outcome === 'LOSE' ? describeLoss(r) : '');
    this.resultPanel.setVisible(true);
    this.phaseText.setText('');
    this.holsterText.setText('');
    this.refreshPips();
    this.data0.onResolve?.(r);
    this.events.emit('duel-resolved', r);
  }

  // ---- input ------------------------------------------------------------

  private pointerById(id: number | null): Phaser.Input.Pointer | undefined {
    if (id === null) return undefined;
    const m = this.input.manager;
    return [...m.pointers, m.mousePointer].find((q) => q && q.id === id) ?? undefined;
  }

  /** The pointer that owns the current gesture, if it is still down. */
  private trackedPointer(): Phaser.Input.Pointer | undefined {
    const p = this.pointerById(this.activeId);
    return p && p.isDown ? p : undefined;
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const phase = this.system.currentPhase;
      if (phase === 'RETRY' || phase === 'RESOLVE') {
        if (this.retryHit(p.x, p.y)) {
          this.retryId = p.id;
          this.system.input({ type: 'retry', t: this.eventMs(p) });
          this.system.retry();
          // a finger that was still down from the duel is dead until it lifts
          this.tracker.cancel();
          this.activeId = null;
          this.aimTouch = false;
        }
        return;
      }
      // single pointer: a second finger never feeds the gesture (QA-07b); a lost 'up' cannot wedge it
      if (this.activeId !== null && p.id !== this.activeId && this.trackedPointer()) return;
      this.activeId = p.id;
      const t = this.eventMs(p);
      if (POST_DRAW.includes(phase)) {
        // FEEL_REVIEW 3: after the draw any touch aims; a tap or slow drag is enough for a follow-up shot
        this.aimTouch = true;
        this.tracker.cancel();
        const r = reticleFromTouch(p.x, p.y, this.cfg.aim.reticleOffsetY);
        this.system.input({ type: 'aim', t, x: r.x, y: r.y });
        return;
      }
      this.aimTouch = false;
      this.tracker.begin(p.x, p.y, t, p.id);
      this.system.input({ type: 'hold', t });
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || p.id !== this.activeId) return;
      const t = this.eventMs(p);
      if (this.aimTouch) {
        const r = reticleFromTouch(p.x, p.y, this.cfg.aim.reticleOffsetY);
        this.system.input({ type: 'aim', t, x: r.x, y: r.y });
        return;
      }
      if (!this.tracker.isActive) return;
      const swipe = this.tracker.move(p.x, p.y, t, p.id);
      if (swipe) this.system.input({ type: 'draw', t: swipe.t });
      if (this.tracker.swiped) {
        const r = reticleFromTouch(p.x, p.y, this.cfg.aim.reticleOffsetY);
        this.system.input({ type: 'aim', t, x: r.x, y: r.y });
      }
    });
    const up = (p: Phaser.Input.Pointer): void => {
      if (p.id === this.retryId) {
        this.retryId = null; // the touch that pressed Retry never flinches
        return;
      }
      if (p.id !== this.activeId) return;
      this.activeId = null;
      const t = this.eventMs(p);
      const phase = this.system.currentPhase;
      if (this.aimTouch) {
        this.aimTouch = false;
        if (POST_DRAW.includes(phase)) {
          const r = reticleFromTouch(p.x, p.y, this.cfg.aim.reticleOffsetY);
          this.system.input({ type: 'fire', t, x: r.x, y: r.y });
        }
        return;
      }
      if (!this.tracker.isActive) return;
      const end = this.tracker.end(p.x, p.y, t, p.id);
      if (end.swiped && POST_DRAW.includes(phase)) {
        const r = reticleFromTouch(p.x, p.y, this.cfg.aim.reticleOffsetY);
        this.system.input({ type: 'fire', t, x: r.x, y: r.y });
      } else {
        this.system.input({ type: 'lift', t });
      }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  // ---- enemy playback (visual only) ---------------------------------------

  private playFakeTell(kind: string, durationMs: number): void {
    this.tellBubble.setText(kind.replace(/_/g, ' ')).setVisible(true).setAlpha(0.85);
    const e = this.enemy.display;
    const x = e.x;
    this.tweens.add({ targets: e, x: x + 3, duration: 55, yoyo: true, repeat: Math.max(1, Math.round(durationMs / 110)), onComplete: () => e.setX(x) });
    this.time.delayedCall(durationMs, () => {
      if (this.system.currentPhase === 'WAIT') this.tellBubble.setVisible(false);
    });
  }

  /** Brief glint at the enemy gun: the telegraph of a follow-up shot (the first shot's tell is the cue). */
  private playShotGlint(): void {
    const A = this.cfg.arena;
    const g = this.add.circle(A.enemy.x - 24, A.enemy.y - 40, 7, 0xfff3c4, 0.9).setDepth(HUD_DEPTH);
    this.fxObjs.push(g);
    this.tweens.add({ targets: g, scale: 2.2, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  private updateEnemyPlayback(s: ReturnType<DuelSystem['snapshot']>): void {
    const op = this.opponentCtl as Partial<EnemyOpponent>;
    // fake tell: shown, never fires. Falling for it (an early draw) is a flinch by the normal rules.
    const fake = op.fakeTell;
    if (fake && !this.fakePlayed && s.phase === 'WAIT') {
      const el = s.now - this.waitStartedAt;
      if (el >= fake.startMs) {
        this.fakePlayed = true;
        this.fakeWindow = { from: this.waitStartedAt + fake.startMs, to: this.waitStartedAt + fake.startMs + fake.durationMs + fake.recoverMs };
        this.playFakeTell(fake.kind, fake.durationMs);
      }
    }
    if (!this.enemyDrawn && s.cueAt !== null && s.phase !== 'RESOLVE' && s.phase !== 'RETRY' && s.now - s.cueAt >= this.system.plan.drawMs) {
      this.enemyDrawn = true;
      this.enemy.setState('draw');
    }
    // multi-shot: telegraph each follow-up shot `dodgeWindowMs` ahead
    if (s.enemyShotIndex > 0 && s.enemyShotEtaMs !== null && s.enemyShotIndex !== this.glintShot && s.enemyShotEtaMs <= (op.dodgeWindowMs ?? 250)) {
      this.glintShot = s.enemyShotIndex;
      this.playShotGlint();
    }
  }

  // ---- loop -------------------------------------------------------------

  update(): void {
    if (this.hidden) return;
    this.system.advanceTo(this.nowMs());
    const s = this.system.snapshot();
    this.updateEnemyPlayback(s);
    this.reticleGfx.clear();
    if (s.reticle && (s.phase === 'DRAW' || s.phase === 'AIM' || s.phase === 'SHOT')) {
      const { x, y } = s.reticle;
      this.reticleGfx.lineStyle(2, COL.red, 1).strokeCircle(x, y, 12);
      this.reticleGfx.lineBetween(x - 18, y, x + 18, y).lineBetween(x, y - 18, x, y + 18);
      if (s.aimRemainingMs !== null) {
        const frac = Phaser.Math.Clamp(s.aimRemainingMs / (this.cfg.aim.budgetMs * 1.3), 0, 1);
        this.reticleGfx.lineStyle(3, COL.brass, 1).beginPath().arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).strokePath();
      }
    }
  }
}
