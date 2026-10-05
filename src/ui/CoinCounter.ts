import type Phaser from 'phaser';
import { COIN_BITMAP } from './bitmaps';
import { drawBitmap, notched, rect } from './draw';
import { formatCoins } from './layout';
import { pixelText, pixelTextSize, setPixelText } from './PixelText';
import { C } from './UiTheme';

const COIN_COLORS: Record<string, number> = { d: C.brassDark, y: C.brass, Y: C.brassLight };

export interface CoinCounterConfig {
  x: number;
  y: number;
  value: number;
  /** 'left': x is the plaque's left edge; 'right': x is its right edge. */
  anchor?: 'left' | 'right';
  reduceMotion?: boolean;
}

/** Brass coin icon + pixel digits on a dark plaque. Value changes count in integer steps. */
export class CoinCounter {
  readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly digits: Phaser.GameObjects.Image;
  private shown: number;
  private target: number;
  private timer?: Phaser.Time.TimerEvent;
  private readonly anchor: 'left' | 'right';
  private readonly px: number;
  private readonly reduce: boolean;
  static readonly H = 28;

  constructor(private readonly scene: Phaser.Scene, cfg: CoinCounterConfig) {
    this.anchor = cfg.anchor ?? 'left';
    this.px = cfg.x;
    this.reduce = cfg.reduceMotion === true;
    this.shown = this.target = cfg.value;
    this.bg = scene.add.graphics();
    const coin = scene.add.graphics();
    drawBitmap(coin, COIN_BITMAP, 6, 6, 2, (c) => COIN_COLORS[c] ?? C.brass);
    this.digits = pixelText(scene, 28, 7, formatCoins(cfg.value), { scale: 2, color: C.brassLight });
    this.container = scene.add.container(Math.round(cfg.x), Math.round(cfg.y), [this.bg, coin, this.digits]);
    this.layout();
  }

  get width(): number {
    return 28 + pixelTextSize(this.digits).width + 8;
  }

  private layout(): void {
    const w = this.width;
    this.bg.clear();
    notched(this.bg, C.ink, 0, 0, w, CoinCounter.H, 2);
    notched(this.bg, C.brassDark, 1, 1, w - 2, CoinCounter.H - 2, 2);
    rect(this.bg, C.woodDeep, 2, 2, w - 4, CoinCounter.H - 4);
    this.container.setX(this.anchor === 'left' ? this.px : this.px - w);
  }

  get value(): number { return this.target; }

  setValue(n: number, animate = true): void {
    this.target = Math.trunc(n);
    this.timer?.remove(false);
    if (!animate || this.reduce || this.target === this.shown) {
      this.shown = this.target;
      this.render();
      return;
    }
    const steps = 8;
    const start = this.shown;
    let i = 0;
    this.timer = this.scene.time.addEvent({
      delay: 40,
      repeat: steps - 1,
      callback: () => {
        i++;
        this.shown = i >= steps ? this.target : Math.round(start + ((this.target - start) * i) / steps);
        this.render();
      },
    });
  }

  private render(): void {
    setPixelText(this.digits, formatCoins(this.shown));
    this.layout();
  }

  destroy(): void {
    this.timer?.remove(false);
    this.container.destroy();
  }
}
