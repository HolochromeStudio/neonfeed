import Phaser from 'phaser';
import { audioBus } from '../core/audioEvents';
import { drawBitmap, drawPlank, PLANK_LOOKS } from './draw';
import type { PlankLookName } from './draw';
import { ICON_BITMAPS } from './bitmaps';
import { initialButton, reduceButton } from './buttonLogic';
import type { ButtonEvent, ButtonState } from './buttonLogic';
import { inflateToMin, MIN_TARGET } from './layout';
import type { Rect } from './layout';
import { lineWidth } from './pixelFont';
import { pixelText, setPixelText } from './PixelText';
import { C } from './UiTheme';
import type { UiScene } from './UiScene';

export type PlankVariant = 'primary' | 'secondary' | 'danger';

export interface PlankButtonConfig {
  /** Top-left of the visual plank in logical px. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  variant?: PlankVariant;
  enabled?: boolean;
  /** Preferred label scale (shrinks to fit). Default 3 primary / 2 otherwise. */
  labelScale?: number;
  /** Sound on activation. Default: confirm for primary, click otherwise. */
  sound?: 'click' | 'confirm' | 'none';
  /** Show a padlock while disabled. Default true. */
  lockWhenDisabled?: boolean;
  /** Accessible label for audits (defaults to label). */
  name?: string;
  onTap: () => void;
}

/**
 * Wood plank sign button: >=44px hit box, brass trim, press = 2px down with the shadow removed,
 * fires on pointer-up inside (cancel on leave), disabled = faded with a padlock (not colour only).
 */
export class PlankButton {
  readonly container: Phaser.GameObjects.Container;
  readonly zone: Phaser.GameObjects.Zone;
  readonly rect: Rect;
  readonly hitRect: Rect;
  private readonly upG: Phaser.GameObjects.Graphics;
  private readonly downG: Phaser.GameObjects.Graphics;
  private readonly offG: Phaser.GameObjects.Graphics;
  private readonly labelImg: Phaser.GameObjects.Image;
  private readonly lockG: Phaser.GameObjects.Graphics;
  private readonly textScale: number;
  private state: ButtonState;
  private cfg: PlankButtonConfig;
  private labelStr: string;

  constructor(scene: Phaser.Scene, cfg: PlankButtonConfig) {
    this.cfg = cfg;
    this.labelStr = cfg.label;
    const variant = cfg.variant ?? 'secondary';
    const w = Math.max(cfg.w, MIN_TARGET);
    const h = Math.max(cfg.h, MIN_TARGET);
    this.rect = { x: Math.round(cfg.x), y: Math.round(cfg.y), w, h };
    this.hitRect = inflateToMin(this.rect);
    this.state = initialButton(cfg.enabled !== false);
    const look = PLANK_LOOKS[variant as PlankLookName];
    const seed = Math.round(cfg.x * 7 + cfg.y * 13 + w);

    this.upG = scene.add.graphics();
    drawPlank(this.upG, w, h, look, false, seed);
    this.downG = scene.add.graphics();
    drawPlank(this.downG, w, h, look, true, seed);
    this.offG = scene.add.graphics();
    drawPlank(this.offG, w, h, PLANK_LOOKS.disabled, false, seed);

    // fit label
    let scale = cfg.labelScale ?? (variant === 'primary' ? 3 : 2);
    const lockRoom = cfg.lockWhenDisabled === false ? 0 : 12;
    const room = w - 28 - lockRoom;
    while (scale > 1 && lineWidth(cfg.label, scale) > room) scale--;
    this.textScale = scale;
    this.labelImg = pixelText(scene, w / 2, (h - 4) / 2, cfg.label, { scale, color: C.cream, originX: 0.5, originY: 0.5 });
    this.lockG = scene.add.graphics();
    drawBitmap(this.lockG, ICON_BITMAPS.lock, 0, 0, 2, C.disabledText);
    this.lockG.setPosition(10, Math.round((h - 4) / 2 - 8));
    this.container = scene.add.container(this.rect.x, this.rect.y, [this.offG, this.downG, this.upG, this.lockG, this.labelImg]);
    this.zone = scene.add.zone(this.hitRect.x + this.hitRect.w / 2, this.hitRect.y + this.hitRect.h / 2, this.hitRect.w, this.hitRect.h);
    this.zone.setInteractive({ useHandCursor: true });
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.dispatch({ type: 'down', id: p.id }));
    this.zone.on('pointerup', (p: Phaser.Input.Pointer) => this.dispatch({ type: 'up', id: p.id }));
    this.zone.on('pointerout', (p: Phaser.Input.Pointer) => this.dispatch({ type: 'leave', id: p.id }));
    this.zone.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.dispatch({ type: 'leave', id: p.id }));
    this.paint();
    const reg = (scene as Partial<UiScene>).registerHit;
    if (typeof reg === 'function') reg.call(scene, cfg.name ?? cfg.label, this.hitRect);
  }

  private dispatch(e: ButtonEvent): void {
    const r = reduceButton(this.state, e);
    this.state = r.state;
    if (r.feedback === 'click') audioBus.emit({ type: 'ui_click' });
    else if (r.feedback === 'denied') audioBus.emit({ type: 'miss' });
    this.paint();
    if (r.fire) {
      const s = this.cfg.sound ?? (this.cfg.variant === 'primary' ? 'confirm' : 'click');
      if (s === 'confirm') audioBus.emit({ type: 'ui_confirm' });
      this.cfg.onTap();
    }
  }

  private paint(): void {
    const disabled = this.state.phase === 'disabled';
    const pressed = this.state.phase === 'pressed';
    this.offG.setVisible(disabled);
    this.upG.setVisible(!disabled && !pressed);
    this.downG.setVisible(pressed);
    const dy = pressed ? 2 : 0;
    this.labelImg.setY(Math.round((this.rect.h - 4) / 2) + dy);
    this.labelImg.setX(Math.round(this.rect.w / 2) + (disabled && this.cfg.lockWhenDisabled !== false ? 10 : 0));
    this.lockG.setVisible(disabled && this.cfg.lockWhenDisabled !== false);
    this.lockG.setY(Math.round((this.rect.h - 4) / 2 - 8));
    const color = disabled ? C.disabledText : C.cream;
    if (this.labelImg.getData('px')?.style.color !== color) {
      const d = this.labelImg.getData('px') as { style: { color: number } };
      d.style.color = color;
      setPixelText(this.labelImg, this.labelStr);
    }
  }

  get enabled(): boolean { return this.state.phase !== 'disabled'; }

  setEnabled(on: boolean): void {
    this.dispatch({ type: on ? 'enable' : 'disable' });
  }

  setLabel(label: string): void {
    this.labelStr = label;
    let scale = this.cfg.labelScale ?? (this.cfg.variant === 'primary' ? 3 : 2);
    while (scale > 1 && lineWidth(label, scale) > this.rect.w - 28 - (this.cfg.lockWhenDisabled === false ? 0 : 12)) scale--;
    const d = this.labelImg.getData('px') as { style: { scale: number } };
    d.style.scale = scale;
    setPixelText(this.labelImg, label);
  }

  /** Programmatic tap (tests, keyboard): same path as a real tap. */
  tap(): void {
    this.dispatch({ type: 'down', id: -1 });
    this.dispatch({ type: 'up', id: -1 });
  }

  setDepth(d: number): this {
    this.container.setDepth(d);
    this.zone.setDepth(d);
    return this;
  }

  setVisible(v: boolean): this {
    this.container.setVisible(v);
    if (v) this.zone.setInteractive(); else this.zone.disableInteractive();
    return this;
  }

  destroy(): void {
    this.container.destroy();
    this.zone.destroy();
  }

  get scale(): number { return this.textScale; }
}
