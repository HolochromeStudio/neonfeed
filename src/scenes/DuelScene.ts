import Phaser from 'phaser';
import { registerAnimations } from '../animation';
import { DUEL_CONFIG } from '../data/duelConfig';
import { Duelist, Hero } from '../entities/Hero';
import { Projectile } from '../entities/Projectile';
import { TIER_LABEL } from '../systems/DrawSystem';
import { BasicOpponent, DUEL_EVENT_NAMES, DuelSystem, TypedEmitter, describeLoss } from '../systems/DuelSystem';
import type { DuelEvents, DuelResult, OpponentController } from '../systems/DuelSystem';
import { SwipeTracker, pointInRect, reticleFromTouch } from '../systems/InputSystem';

export const DUEL_SCENE_KEY = 'Duel';

/**
 * Stable feedback bus. A03 Game Feel attaches here (`duelFeedback.on('onHit', ...)`)
 * before or after the scene starts; the scene forwards every DuelSystem event.
 */
export const duelFeedback = new TypedEmitter<DuelEvents>();

export interface DuelSceneData {
  seed?: number;
  opponent?: OpponentController;
  heroHp?: number;
  enemyHp?: number;
  enemyName?: string;
  /** Called once per resolved duel (win or lose). */
  onResolve?: (result: DuelResult) => void;
}

const ATLAS_URLS = import.meta.glob('../../assets/generated/placeholder_atlas.*', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const COL = {
  sky: 0xd9a05b,
  skyLow: 0xe9c07a,
  ground: 0xc79a5c,
  groundDark: 0xa57a44,
  ink: 0x1a0f08,
  brass: 0xe0b040,
  red: 0xd24a3a,
};
const FONT = 'monospace';

interface DuelDebugHandle {
  snapshot: DuelSystem['snapshot'];
  system: DuelSystem;
  now: () => number;
}

export class DuelScene extends Phaser.Scene {
  private data0: DuelSceneData = {};
  private system!: DuelSystem;
  private t0 = 0;
  private tracker = new SwipeTracker('up', DUEL_CONFIG.input);
  private touchOnButton = false;

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
  private enemyDrawn = false;
  private forwarders: (() => void)[] = [];

  constructor() {
    super(DUEL_SCENE_KEY);
  }

  init(data: DuelSceneData): void {
    this.data0 = data ?? {};
  }

  preload(): void {
    if (this.textures.exists('placeholder')) return;
    const png = Object.entries(ATLAS_URLS).find(([k]) => k.endsWith('.png'))?.[1];
    const json = Object.entries(ATLAS_URLS).find(([k]) => k.endsWith('.json'))?.[1];
    if (png && json) this.load.atlas('placeholder', png, json);
    // a failed load must not break the scene: Duelist falls back to rectangles
    this.load.on('loaderror', () => undefined);
  }

  create(): void {
    const A = DUEL_CONFIG.arena;
    if (this.textures.exists('placeholder')) registerAnimations(this);
    this.drawArena();

    this.hero = new Hero(this, A.hero.x, A.hero.y);
    this.enemy = new Duelist(this, A.enemy.x, A.enemy.y, 'enemy', A.enemy.w, A.enemy.h);
    this.add.text(16, 48, `Dust Creek - ${this.data0.enemyName ?? 'Bandit'}`, { fontFamily: FONT, fontSize: '16px', color: '#1a0f08' });

    this.slowMoTint = this.add.rectangle(180, 320, A.width, A.height, 0x000000, 0).setDepth(5);
    this.reticleGfx = this.add.graphics().setDepth(20);
    this.cueText = this.add.text(180, 190, '!', { fontFamily: FONT, fontSize: '120px', color: '#d24a3a', fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 8 }).setOrigin(0.5).setVisible(false).setDepth(30);
    this.phaseText = this.add.text(180, 100, '', { fontFamily: FONT, fontSize: '20px', color: '#1a0f08', fontStyle: 'bold' }).setOrigin(0.5);
    this.zoneText = this.add.text(180, 250, '', { fontFamily: FONT, fontSize: '20px', color: '#fff3c4', fontStyle: 'bold', stroke: '#1a0f08', strokeThickness: 4 }).setOrigin(0.5).setDepth(25);
    this.readout = this.add.text(180, 130, '', { fontFamily: FONT, fontSize: '20px', color: '#fff3c4', align: 'center', stroke: '#1a0f08', strokeThickness: 4, lineSpacing: 6 }).setOrigin(0.5, 0).setDepth(30);
    this.causeText = this.add.text(180, 252, '', { fontFamily: FONT, fontSize: '16px', color: '#ffd0c8', align: 'center', stroke: '#1a0f08', strokeThickness: 3, wordWrap: { width: 320 } }).setOrigin(0.5, 0).setDepth(30);

    const h = A.holster;
    this.add.rectangle(h.x + h.w / 2, h.y + h.h / 2, h.w, h.h, COL.ink, 0.35).setStrokeStyle(3, COL.brass);
    this.holsterText = this.add.text(h.x + h.w / 2, h.y + h.h / 2, 'HOLD', { fontFamily: FONT, fontSize: '24px', color: '#e0b040', fontStyle: 'bold' }).setOrigin(0.5);
    this.buildRetryButton();

    this.startSystem();
    this.bindInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    if (typeof window !== 'undefined') {
      (window as unknown as { __duel?: DuelDebugHandle }).__duel = { snapshot: () => this.system.snapshot(), system: this.system, now: () => this.nowMs() };
    }
  }

  private nowMs(): number {
    return performance.now() - this.t0;
  }

  private startSystem(): void {
    this.t0 = performance.now();
    this.system = new DuelSystem({
      seed: this.data0.seed ?? 1337,
      opponent: this.data0.opponent ?? new BasicOpponent(),
      heroHp: this.data0.heroHp,
      enemyHp: this.data0.enemyHp,
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
  }

  // ---- arena + hud ------------------------------------------------------

  private drawArena(): void {
    const A = DUEL_CONFIG.arena;
    this.add.rectangle(180, 150, A.width, 300, COL.sky);
    this.add.rectangle(180, 290, A.width, 60, COL.skyLow);
    this.add.rectangle(180, 470, A.width, 340, COL.ground);
    this.add.rectangle(180, 335, A.width, 6, COL.groundDark);
    this.add.circle(300, 90, 26, 0xffe9a8);
    for (const p of A.props) {
      this.add.rectangle(p.x + p.w / 2, p.y + p.h, p.w, p.h, 0x7a4a26).setOrigin(0.5, 1).setStrokeStyle(2, COL.ink);
    }
  }

  private buildPips(max: number, x: number, y: number, colour: number): Phaser.GameObjects.Rectangle[] {
    return Array.from({ length: max }, (_, i) => this.add.rectangle(x + i * 22, y, 16, 16, colour).setStrokeStyle(2, COL.ink));
  }

  private refreshPips(): void {
    const s = this.system.snapshot();
    if (this.heroPips.length !== s.heroMaxHp) {
      this.heroPips.forEach((p) => p.destroy());
      this.heroPips = this.buildPips(s.heroMaxHp, 24, 24, COL.red);
    }
    if (this.enemyPips.length !== Math.ceil(s.enemyMaxHp)) {
      this.enemyPips.forEach((p) => p.destroy());
      const e = DUEL_CONFIG.arena.enemy;
      this.enemyPips = this.buildPips(Math.ceil(s.enemyMaxHp), e.x - (Math.ceil(s.enemyMaxHp) - 1) * 11, e.y - e.h - 24, COL.brass);
    }
    this.heroPips.forEach((p, i) => p.setFillStyle(i < Math.ceil(s.heroHp) ? COL.red : 0x3a2a20));
    this.enemyPips.forEach((p, i) => p.setFillStyle(i < Math.ceil(s.enemyHp) ? COL.brass : 0x3a2a20));
  }

  private buildRetryButton(): void {
    const bg = this.add.rectangle(0, 0, 200, 56, COL.brass).setStrokeStyle(3, COL.ink);
    const label = this.add.text(0, 0, 'RETRY', { fontFamily: FONT, fontSize: '24px', color: '#1a0f08', fontStyle: 'bold' }).setOrigin(0.5);
    this.retryBtn = this.add.container(180, 468, [bg, label]).setDepth(40).setVisible(false);
  }

  private retryHit(x: number, y: number): boolean {
    return this.retryBtn.visible && pointInRect(x, y, { x: 80, y: 440, w: 200, h: 56 });
  }

  private enterWaitVisuals(): void {
    this.hero.setState('idle');
    this.enemy.setState('idle');
    this.enemyDrawn = false;
    this.cueText.setVisible(false);
    this.readout.setText('');
    this.causeText.setText('');
    this.zoneText.setText('');
    this.retryBtn.setVisible(false);
    this.holsterText.setText('HOLD').setColor('#e0b040');
    this.phaseText.setText('STAND OFF');
    this.reticleGfx.clear();
    this.refreshPips();
  }

  private flashZone(text: string): void {
    this.zoneText.setText(text);
    this.time.delayedCall(700, () => {
      if (this.zoneText.text === text) this.zoneText.setText('');
    });
  }

  private wireVisuals(): void {
    const ev = this.system.events;
    const A = DUEL_CONFIG.arena;
    ev.on('onCue', () => {
      this.cueText.setVisible(true);
      this.holsterText.setText('DRAW!').setColor('#d24a3a');
      this.phaseText.setText('DRAW!');
    });
    ev.on('onFlinch', () => this.flashZone('FLINCH +300ms'));
    ev.on('onDraw', (e) => {
      this.cueText.setVisible(false);
      this.hero.setState('draw');
      this.phaseText.setText(`${TIER_LABEL[e.tier]}  ${Math.round(e.reactionMs)} ms`);
    });
    ev.on('onAimStart', (e) => {
      this.hero.setState('aim');
      if (!e.followUp) this.holsterText.setText('AIM');
    });
    ev.on('onShot', (e) => {
      if (e.shooter === 'player') {
        this.hero.setState('shoot');
        if (Number.isFinite(e.x)) new Projectile(this, { x: A.hero.x + 20, y: A.hero.y - 40 }, { x: e.x, y: e.y });
      } else {
        this.enemy.setState('shoot');
        new Projectile(this, { x: A.enemy.x - 20, y: A.enemy.y - 40 }, { x: A.hero.x, y: A.hero.y - 40 }, 90, COL.red);
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
      }
      this.refreshPips();
    });
    ev.on('onMiss', (e) => {
      if (e.shooter === 'player') this.flashZone('MISS');
    });
    ev.on('onPhase', (e) => {
      if (e.phase === 'SHOT' || e.phase === 'AIM') this.slowMoTint.setFillStyle(0x000000, e.phase === 'AIM' ? 0.2 : 0);
      else this.slowMoTint.setFillStyle(0x000000, 0);
      if (e.phase === 'AIM' && e.prev === 'SHOT' && this.hero.state === 'shoot') this.hero.setState('aim');
      if (e.phase === 'RETRY') this.retryBtn.setVisible(true);
    });
    ev.on('onResolve', (e) => this.showResult(e.result));
    ev.on('onRetry', () => this.enterWaitVisuals());
  }

  private showResult(r: DuelResult): void {
    this.reticleGfx.clear();
    this.cueText.setVisible(false);
    const you = r.reactionMs === null ? 'YOU --' : `YOU ${Math.round(r.reactionMs)} ms`;
    const tier = r.tier ? `  ${TIER_LABEL[r.tier]}` : '';
    this.readout.setText(`${r.outcome === 'WIN' ? 'YOU WIN' : 'YOU LOSE'}\n${you}${tier}\nENEMY ${Math.round(r.enemyShotMs)} ms`);
    this.causeText.setText(r.outcome === 'LOSE' ? describeLoss(r) : '');
    this.phaseText.setText('');
    this.holsterText.setText('');
    this.refreshPips();
    this.data0.onResolve?.(r);
    this.events.emit('duel-resolved', r);
  }

  // ---- input ------------------------------------------------------------

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.system.currentPhase === 'RETRY' || this.system.currentPhase === 'RESOLVE') {
        if (this.retryHit(p.x, p.y)) {
          this.touchOnButton = true;
          this.system.input({ type: 'retry', t: this.nowMs() });
          this.system.retry();
        }
        return;
      }
      this.touchOnButton = false;
      const t = this.nowMs();
      this.tracker.begin(p.x, p.y, t);
      this.system.input({ type: 'hold', t });
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.tracker.isActive) return;
      const t = this.nowMs();
      const swipe = this.tracker.move(p.x, p.y, t);
      if (swipe) this.system.input({ type: 'draw', t: swipe.t });
      if (this.tracker.swiped) {
        const r = reticleFromTouch(p.x, p.y, DUEL_CONFIG.aim.reticleOffsetY);
        this.system.input({ type: 'aim', t, x: r.x, y: r.y });
      }
    });
    const up = (p: Phaser.Input.Pointer): void => {
      if (this.touchOnButton) {
        this.touchOnButton = false;
        return;
      }
      if (!this.tracker.isActive) return;
      const t = this.nowMs();
      const end = this.tracker.end(p.x, p.y, t);
      const phase = this.system.currentPhase;
      if (end.swiped && (phase === 'DRAW' || phase === 'AIM' || phase === 'SHOT')) {
        const r = reticleFromTouch(p.x, p.y, DUEL_CONFIG.aim.reticleOffsetY);
        this.system.input({ type: 'fire', t, x: r.x, y: r.y });
      } else {
        this.system.input({ type: 'lift', t });
      }
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  // ---- loop -------------------------------------------------------------

  update(): void {
    this.system.advanceTo(this.nowMs());
    const s = this.system.snapshot();
    // enemy draws its own gun at its planned time (visual only)
    if (!this.enemyDrawn && s.cueAt !== null && s.phase !== 'RESOLVE' && s.phase !== 'RETRY' && s.now - s.cueAt >= this.system.plan.drawMs) {
      this.enemyDrawn = true;
      this.enemy.setState('draw');
    }
    this.reticleGfx.clear();
    if (s.reticle && (s.phase === 'DRAW' || s.phase === 'AIM' || s.phase === 'SHOT')) {
      const { x, y } = s.reticle;
      this.reticleGfx.lineStyle(2, COL.red, 1).strokeCircle(x, y, 12);
      this.reticleGfx.lineBetween(x - 18, y, x + 18, y).lineBetween(x, y - 18, x, y + 18);
      if (s.aimRemainingMs !== null) {
        const frac = Phaser.Math.Clamp(s.aimRemainingMs / (DUEL_CONFIG.aim.budgetMs * 1.3), 0, 1);
        this.reticleGfx.lineStyle(3, COL.brass, 1).beginPath().arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2).strokePath();
      }
    }
  }
}
