import Phaser from 'phaser';
import { getWanted } from '../data/wanted';
import { paintWoodWall } from '../ui/backdrops';
import { COIN_BITMAP } from '../ui/bitmaps';
import { drawBitmap, rect } from '../ui/draw';
import { drawIcon } from '../ui/IconView';
import { clipChars, formatCoins, pairSlots, stackFromBottom } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { pixelText, setPixelText } from '../ui/PixelText';
import { stampText } from '../ui/StampText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { ResultsAction, ResultsData } from '../ui/types';
import { C, RARITY } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';
import { wantedPoster } from '../ui/WantedPoster';

export const RESULTS_SCENE_KEY = 'Results';

const COIN_COLORS: Record<string, number> = { d: C.brassDark, y: C.brass, Y: C.brassLight };
const W = 336;

export function formatReaction(ms: number | null): string {
  return ms === null || !Number.isFinite(ms) ? '--' : `${Math.round(ms)} MS`;
}

export class ResultsScene extends UiScene {
  private params!: ResultsData;

  constructor() {
    super(RESULTS_SCENE_KEY);
  }

  init(data?: ResultsData): void {
    this.params = data!;
    this.setupUi(this.params);
  }

  create(): void {
    const { summary: s } = this.params;
    const win = s.outcome === 'victory';
    const entry = getWanted(s.targetId);
    paintWoodWall(this, win ? 9 : 4, 0, 640, 0);
    const x0 = this.safe.x + Math.round((this.safe.w - W) / 2);

    // buttons first (bottom anchored), they bound the flow above
    const [primaryTop, rowTop] = stackFromBottom(this.safe, [56, 48], 8);
    const bounty = (s.bounties ?? []).slice(0, 2);
    const fixed = 49 + 42 + 94 + (s.perks.length ? 30 : 0) + 38 + bounty.length * 20 + 6;
    let y = this.safe.y + 8;
    const posterH = Math.max(128, Math.min(190, primaryTop! - 8 - y - fixed));

    // header stamp
    const header = stampText(this, { x: 180, y: y + 20, text: win ? S.results.victory : S.results.death, scale: 3, color: win ? C.brassLight : C.red, angle: -2, slam: true, reduceMotion: this.reduceMotion, depth: 20 });
    void header;
    y += 49;

    // poster of the defeated target
    const pw = 208;
    wantedPoster(this, { x: 180 - pw / 2, y, w: pw, h: posterH, target: s.targetId, angle: win ? 1 : -1, depth: 10 });
    stampText(this, { x: 180 + (win ? 60 : 66), y: y + 40 + Math.floor((posterH - 100) * 0.5), text: win ? S.results.stampWin : S.results.stampDeath, scale: win ? 3 : 2, color: C.redDark, angle: win ? -12 : -8, slam: true, reduceMotion: this.reduceMotion, depth: 21 });
    y += posterH + 8;

    // cause line
    const cause = s.causeLine ?? (win ? `${entry?.name ?? 'TARGET'} COLLECTED` : `KILLED BY ${entry?.name ?? 'AN OUTLAW'}`);
    pixelText(this, 180, y, cause, { scale: 2, color: C.cream, align: 'center', originX: 0.5, maxWidth: W, maxLines: 2 }).setDepth(10);
    y += 42;

    // stats parchment
    const stats = new ParchmentPanel(this, { x: x0, y, w: W, h: 88, seed: 8, depth: 10 });
    const rows: Array<[string, string]> = [
      [S.results.duelsWon, String(s.duelsWon)],
      [S.results.bestReaction, formatReaction(s.bestReactionMs)],
      [S.results.perfect, String(s.perfectDraws)],
      [S.results.region, clipChars(s.regionName.toUpperCase(), 13)],
    ];
    rows.forEach(([label, value], i) => {
      const ry = y + 12 + i * 18;
      pixelText(this, x0 + 14, ry, label, { scale: 2, color: C.ink, shadow: null }).setDepth(11);
      pixelText(this, x0 + W - 14, ry, value, { scale: 2, color: C.redDark, shadow: null, originX: 1 }).setDepth(11);
    });
    void stats;
    y += 94;

    // perks held
    if (s.perks.length) {
      const max = 10;
      const shown = s.perks.slice(0, max);
      const cell = 24, gap = 6;
      const total = shown.length * cell + (shown.length - 1) * gap + (s.perks.length > max ? 40 : 0);
      let px = Math.round(180 - total / 2);
      for (const pk of shown) {
        const g = this.add.graphics().setDepth(10);
        rect(g, C.ink, px, y, cell, cell);
        rect(g, pk.rarity === 'legendary' ? C.brass : pk.rarity === 'rare' ? C.midnightLight : C.parchmentDark, px + 2, y + 2, cell - 4, cell - 4);
        drawIcon(this, pk.icon ?? { kind: 'star' }, px + 4, y + 4, 16, pk.rarity === 'rare' ? C.cream : C.ink, 11);
        void RARITY;
        px += cell + gap;
      }
      if (s.perks.length > max) pixelText(this, px, y + 5, `+${s.perks.length - max}`, { scale: 2, color: C.chalk }).setDepth(10);
      y += 30;
    }

    // coins banked
    pixelText(this, x0 + 2, y + 9, S.results.coins, { scale: 2, color: C.chalk }).setDepth(10);
    const coinG = this.add.graphics().setDepth(10);
    drawBitmap(coinG, COIN_BITMAP, 360 - x0 - 24 - (`+${formatCoins(s.coinsEarned)}`.length * 18) - 8, y + 4, 3, (ch) => COIN_COLORS[ch] ?? C.brass);
    const coinTxt = pixelText(this, 360 - x0 - 2, y + 4, '+0', { scale: 3, color: C.brassLight, originX: 1 }).setDepth(10);
    this.countUp(coinTxt, s.coinsEarned);
    y += 38;

    // bounty progress
    for (const b of bounty) {
      pixelText(this, x0 + 2, y, clipChars(b.label.toUpperCase(), 20), { scale: 2, color: C.cream }).setDepth(10);
      pixelText(this, x0 + W - 2, y, `${Math.min(b.progress, b.goal)}/${b.goal}`, { scale: 2, color: b.progress >= b.goal ? C.brassLight : C.chalk, originX: 1 }).setDepth(10);
      y += 20;
    }

    // actions
    const retry = win && this.params.canContinue === true ? 'continue' : 'retry';
    new PlankButton(this, {
      x: Math.round((360 - 280) / 2), y: primaryTop!, w: 280, h: 56, label: retry === 'continue' ? S.results.cont : S.results.retry,
      variant: 'primary', name: retry, onTap: () => this.fire(retry),
    }).setDepth(20);
    const [a, b] = pairSlots(this.safe.x, this.safe.w, 8, this.leftHanded);
    new PlankButton(this, { x: a.x, y: rowTop!, w: a.w, h: 48, label: S.results.saloon, name: 'saloon', onTap: () => this.fire('saloon') }).setDepth(20);
    new PlankButton(this, { x: b.x, y: rowTop!, w: b.w, h: 48, label: S.results.menu, name: 'menu', onTap: () => this.fire('menu') }).setDepth(20);
  }

  private countUp(img: Phaser.GameObjects.Image, target: number): void {
    const text = (n: number): string => `+${formatCoins(n)}`;
    if (this.reduceMotion || target <= 0) { setPixelText(img, text(target)); return; }
    const steps = 12;
    let i = 0;
    this.time.addEvent({ delay: 45, repeat: steps - 1, callback: () => { i++; setPixelText(img, text(i >= steps ? target : Math.round((target * i) / steps))); } });
  }

  private fire(a: ResultsAction): void {
    this.params.onAction?.(a);
    this.events.emit(UI_EVENTS.resultsAction, a);
  }
}
