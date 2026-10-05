import Phaser from 'phaser';
import { audioBus } from '../core/audioEvents';
import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { drawPlank, PLANK_LOOKS, rect } from '../ui/draw';
import { fillStack, stackFromBottom } from '../ui/layout';
import type { Rect } from '../ui/layout';
import { PlankButton } from '../ui/PlankButton';
import { pixelText } from '../ui/PixelText';
import { leverValue, normalizeSettings, volumeFromX, withLever, withVolume } from '../ui/settingsLogic';
import type { LeverKey, SliderKey } from '../ui/settingsLogic';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { GameSettings, SettingsData } from '../ui/types';
import { C } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const SETTINGS_SCENE_KEY = 'Settings';

const W = 336;
const TRACK_X = 96; // inside the row
const TRACK_RIGHT = 84; // room right of the track for the percentage

type RowDef = { kind: 'slider'; key: SliderKey; label: string } | { kind: 'lever'; key: LeverKey; label: string };

const ROWS: readonly RowDef[] = [
  { kind: 'slider', key: 'musicVol', label: S.settings.music },
  { kind: 'slider', key: 'sfxVol', label: S.settings.sfx },
  { kind: 'lever', key: 'haptics', label: S.settings.haptics },
  { kind: 'lever', key: 'reducedShake', label: S.settings.shake },
  { kind: 'lever', key: 'left', label: S.settings.lefty },
  { kind: 'lever', key: 'tellAssist', label: S.settings.assist },
  { kind: 'lever', key: 'captions', label: S.settings.captions },
];

/** Wood-plank settings board: sliding brass-knob planks for volume, brass levers for switches. */
export class SettingsScene extends UiScene {
  private params: SettingsData = { settings: { musicVol: 0.7, sfxVol: 0.8, haptics: true, reducedShake: false, handedness: 'right' } };
  private s: GameSettings = this.params.settings;
  private rowRects: Rect[] = [];
  private dyn: Phaser.GameObjects.GameObject[][] = [];
  private drag: { key: SliderKey; row: number; id: number } | null = null;

  constructor() {
    super(SETTINGS_SCENE_KEY);
  }

  init(data?: SettingsData): void {
    this.params = data ?? this.params;
    this.s = normalizeSettings(this.params.settings);
    this.drag = null;
    this.dyn = [];
    this.setupUi(this.params);
  }

  create(): void {
    paintWoodWall(this, 12, 0, 640, 0);
    const sy = this.safe.y + 4;
    paintHangingSign(this, 52, sy, 256, 52, 8);
    pixelText(this, 180, sy + 24, S.settings.title, { scale: 3, color: C.brassLight, originX: 0.5, originY: 0.5, maxWidth: 232, maxLines: 1 }).setDepth(9);

    const [doneTop] = stackFromBottom(this.safe, [56], 0);
    const top = sy + 52 + 12;
    const st = fillStack(ROWS.length, top, doneTop! - 12, 8, 56, 48);
    const x = this.safe.x + Math.round((this.safe.w - W) / 2);
    this.rowRects = st.tops.map((y) => ({ x, y, w: W, h: st.itemH }));
    ROWS.forEach((row, i) => this.buildRow(row, i));

    new PlankButton(this, { x: Math.round((360 - 280) / 2), y: doneTop!, w: 280, h: 56, label: S.settings.done, variant: 'primary', name: 'done', onTap: () => this.close() }).setDepth(20);

    // dragging continues outside the track; release anywhere ends it
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.endDrag(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.endDrag(p));
  }

  // ---- public API (previews / tests / the Lead) ------------------------------------------------

  get settings(): GameSettings {
    return { ...this.s };
  }

  /** Programmatic slider set (same path as a drag step). */
  setVolume(key: SliderKey, v: number): void {
    this.change(withVolume(this.s, key, v), ROWS.findIndex((r) => r.key === key));
  }

  /** Programmatic lever tap (same path as a real tap). */
  tapLever(key: LeverKey): void {
    this.flip(key);
  }

  // ---- internals -------------------------------------------------------------------------------

  private trackRect(i: number): Rect {
    const r = this.rowRects[i]!;
    return { x: r.x + TRACK_X, y: r.y, w: r.w - TRACK_X - TRACK_RIGHT, h: r.h };
  }

  private buildRow(row: RowDef, i: number): void {
    const r = this.rowRects[i]!;
    const g = this.add.graphics().setPosition(r.x, r.y).setDepth(10);
    drawPlank(g, r.w, r.h, PLANK_LOOKS.secondary, false, i * 11 + 3);
    pixelText(this, r.x + 14, r.y + Math.round((r.h - 4) / 2), row.label, { scale: 2, color: C.cream, originY: 0.5, maxWidth: row.kind === 'slider' ? TRACK_X - 20 : 160, maxLines: 1 }).setDepth(12);
    if (row.kind === 'slider') {
      const t = this.trackRect(i);
      const zone = this.add.zone(t.x - 8 + (t.w + TRACK_RIGHT + 8) / 2, r.y + r.h / 2, t.w + TRACK_RIGHT + 8, r.h).setInteractive({ useHandCursor: true }).setDepth(15);
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => { this.drag = { key: row.key, row: i, id: p.id }; this.dragTo(p); });
      this.registerHit(row.key, { x: t.x - 8, y: r.y, w: t.w + TRACK_RIGHT + 8, h: r.h });
    } else {
      const zone = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setInteractive({ useHandCursor: true }).setDepth(15);
      zone.on('pointerup', () => this.flip(row.key));
      this.registerHit(row.key, r);
    }
    this.paintRow(i);
  }

  private paintRow(i: number): void {
    for (const o of this.dyn[i] ?? []) o.destroy();
    const row = ROWS[i]!;
    const r = this.rowRects[i]!;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics().setPosition(r.x, r.y).setDepth(11);
    objs.push(g);
    const cy = Math.round((r.h - 4) / 2);
    if (row.kind === 'slider') {
      const v = this.s[row.key];
      const tw = r.w - TRACK_X - TRACK_RIGHT;
      // groove: dark slot with notch ticks every 25%
      rect(g, C.ink, TRACK_X - 2, cy - 8, tw + 4, 16);
      rect(g, C.woodDeep, TRACK_X, cy - 6, tw, 12);
      rect(g, C.brassDark, TRACK_X, cy - 6, Math.round(tw * v), 12);
      rect(g, C.brass, TRACK_X, cy - 6, Math.round(tw * v), 4);
      for (const f of [0.25, 0.5, 0.75]) rect(g, C.ink, TRACK_X + Math.round(tw * f) - 1, cy - 10, 2, 4);
      // brass knob (a plank with a nail), clearly bigger than the groove
      const kx = TRACK_X + Math.round(tw * v) - 10;
      rect(g, C.ink, kx - 1, cy - 15, 22, 30);
      rect(g, C.brassDark, kx, cy - 14, 20, 28);
      rect(g, C.brass, kx, cy - 14, 20, 24);
      rect(g, C.brassLight, kx + 2, cy - 12, 16, 3);
      rect(g, C.ink, kx + 8, cy - 4, 4, 4);
      objs.push(pixelText(this, r.x + r.w - 14, r.y + cy, `${Math.round(v * 100)}%`, { scale: 2, color: C.cream, originX: 1, originY: 0.5 }).setDepth(12));
    } else {
      const on = leverValue(this.s, row.key);
      const hw = 64, hh = 30;
      const hx = r.w - 14 - 52 - 10 - hw;
      const hy = cy - Math.round(hh / 2);
      // housing slot
      rect(g, C.ink, hx, hy, hw, hh);
      rect(g, on ? C.brassDark : C.woodDeep, hx + 2, hy + 2, hw - 4, hh - 4);
      rect(g, C.ink, hx + 2, hy + 2, hw - 4, 2);
      // base plate and pivot
      const px = hx + hw / 2;
      rect(g, C.brassDark, px - 8, hy + hh - 8, 16, 6);
      // lever arm: pixel stair leaning towards ON (right) or OFF (left)
      const dir = on ? 1 : -1;
      for (let k = 0; k < 11; k++) {
        const ax = px + dir * k * 2;
        const ay = hy + hh - 8 - k * 2;
        rect(g, C.ink, ax - 3, ay - 1, 7, 5);
        rect(g, on ? C.brassLight : C.chalkDim, ax - 2, ay, 5, 3);
      }
      const kx = px + dir * 22;
      const ky = hy + hh - 8 - 22;
      rect(g, C.ink, kx - 7, ky - 7, 14, 14);
      rect(g, on ? C.brassLight : C.sand, kx - 5, ky - 5, 10, 10);
      // state in words too, never position/colour alone
      objs.push(pixelText(this, r.x + r.w - 14, r.y + cy, on ? S.settings.on : S.settings.off, { scale: 2, color: on ? C.brassLight : C.chalkDim, originX: 1, originY: 0.5 }).setDepth(12));
    }
    this.dyn[i] = objs;
  }

  private flip(key: LeverKey): void {
    const i = ROWS.findIndex((r) => r.key === key);
    this.change(withLever(this.s, key, !leverValue(this.s, key)), i, true);
    audioBus.emit({ type: 'ui_click' });
  }

  private dragTo(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    const t = this.trackRect(d.row);
    this.change(withVolume(this.s, d.key, volumeFromX(p.x, t.x, t.w)), d.row);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.drag && p.id === this.drag.id && p.isDown) this.dragTo(p);
  }

  private endDrag(p: Phaser.Input.Pointer): void {
    if (this.drag && p.id === this.drag.id) {
      this.drag = null;
      audioBus.emit({ type: 'ui_click' });
    }
  }

  private change(next: GameSettings, row: number, force = false): void {
    const a = this.s;
    const b = normalizeSettings(next);
    const same = a.musicVol === b.musicVol && a.sfxVol === b.sfxVol && a.haptics === b.haptics && a.reducedShake === b.reducedShake &&
      a.handedness === b.handedness && a.tellAssist === b.tellAssist && a.captions === b.captions;
    if (same && !force) return;
    this.s = b;
    if (row >= 0) this.paintRow(row);
    this.params.onChange?.({ ...b });
    this.events.emit(UI_EVENTS.settingsChange, { ...b });
  }

  private close(): void {
    this.params.onClose?.();
    this.events.emit(UI_EVENTS.settingsClose);
  }
}
