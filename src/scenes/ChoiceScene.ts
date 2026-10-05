import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { CoinCounter } from '../ui/CoinCounter';
import { HeartPips } from '../ui/HeartPips';
import { stackFromBottom } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import type { PlankVariant } from '../ui/PlankButton';
import { lineWidth } from '../ui/pixelFont';
import { pixelText } from '../ui/PixelText';
import { stampText } from '../ui/StampText';
import type { UiSceneOptions } from '../ui/types';
import { C } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';
import { SCENE_KEYS } from './sceneKeys';

export const CHOICE_SCENE_KEY = SCENE_KEYS.choice;

export interface ChoiceOption {
  label: string;
  enabled?: boolean;
  variant?: PlankVariant;
  onTap: () => void;
}

/**
 * Generic wooden "notice board" used for the run nodes that have no dedicated screen (rest, event, treasure,
 * spoils, retry offer, perk list, coming-soon stubs). Title sign, parchment body, plank options from the bottom.
 */
export interface ChoiceData extends UiSceneOptions {
  title: string;
  /** Parchment lines (each wraps to the panel width). */
  body?: string[];
  /** Short rubber stamp over the parchment (PAID, DEAD...). */
  stamp?: string;
  coins?: number;
  hp?: { current: number; max: number };
  /** Up to 5 options, stacked from the bottom. */
  options: ChoiceOption[];
  /** Wood seed (variety per screen). */
  wall?: number;
}

export const CHOICE_MAX_OPTIONS = 5;
const OPT_H = 48;
const W = 336;

export class ChoiceScene extends UiScene {
  private params: ChoiceData = { title: '', options: [] };
  private locked = false;

  constructor() {
    super(CHOICE_SCENE_KEY);
  }

  init(data?: ChoiceData): void {
    this.params = data ?? this.params;
    this.locked = false;
    this.setupUi(this.params);
  }

  create(): void {
    const p = this.params;
    paintWoodWall(this, p.wall ?? 5, 0, 640, 0);
    const sy = this.safe.y + 4;
    paintHangingSign(this, 40, sy, 280, 52, 8);
    pixelText(this, 180, sy + 24, p.title, { scale: lineWidth(p.title, 3) > 256 ? 2 : 3, color: C.brassLight, originX: 0.5, originY: 0.5, maxWidth: 256, maxLines: 1 }).setDepth(9);

    const rowY = sy + 52 + 10;
    if (p.hp) new HeartPips(this, { x: this.safe.x, y: rowY + 6, max: p.hp.max, current: p.hp.current }).gfx.setDepth(10);
    if (p.coins !== undefined) new CoinCounter(this, { x: 360 - this.safe.x, y: rowY, value: p.coins, anchor: 'right', reduceMotion: this.reduceMotion }).container.setDepth(10);

    const opts = p.options.slice(0, CHOICE_MAX_OPTIONS);
    const tops = stackFromBottom(this.safe, opts.map(() => OPT_H), 8);
    const bodyTop = rowY + CoinCounter.H + 10;
    const bodyBottom = (tops[0] ?? this.safe.y + this.safe.h) - 12;
    const bodyH = Math.max(64, bodyBottom - bodyTop);
    const x0 = this.safe.x + Math.round((this.safe.w - W) / 2);
    const panel = new ParchmentPanel(this, { x: x0, y: bodyTop, w: W, h: bodyH, seed: 11, depth: 10 });
    const lineH = 20;
    let y = panel.content.y + 4;
    const maxY = bodyTop + bodyH - 14;
    for (const line of p.body ?? []) {
      if (y + 16 > maxY) break;
      const maxLines = Math.max(1, Math.floor((maxY - y) / lineH));
      const t = pixelText(this, 180, y, line, { scale: 2, color: C.ink, shadow: null, align: 'center', originX: 0.5, maxWidth: W - 32, maxLines: Math.min(4, maxLines) }).setDepth(11);
      y += Math.min(4, Math.round(t.displayHeight / 18) || 1) * lineH + 6;
    }
    if (p.stamp) stampText(this, { x: 180 + 70, y: bodyTop + bodyH - 28, text: p.stamp, scale: 3, color: C.redDark, angle: -8, slam: true, reduceMotion: this.reduceMotion, depth: 21 });

    opts.forEach((o, i) => {
      const btn = new PlankButton(this, {
        x: Math.round((360 - 280) / 2), y: tops[i]!, w: 280, h: OPT_H, label: o.label, variant: o.variant ?? (i === 0 ? 'primary' : 'secondary'),
        enabled: o.enabled !== false, name: o.label, labelScale: 2,
        onTap: () => {
          if (this.locked) return;
          this.locked = true;
          this.time.delayedCall(250, () => { this.locked = false; });
          o.onTap();
        },
      });
      btn.setDepth(20);
    });
  }
}
