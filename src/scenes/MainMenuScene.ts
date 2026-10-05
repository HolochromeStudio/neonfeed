import { audioBus } from '../core/audioEvents';
import { paintBoardwalk, paintDusk, paintHangingSign, paintSand, paintStreetProps } from '../ui/backdrops';
import { showConfirm } from '../ui/ConfirmDialog';
import { CoinCounter } from '../ui/CoinCounter';
import { drawBust, drawNail, drawParchment, rect } from '../ui/draw';
import { pairSlots, stackFromBottom } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { pixelText } from '../ui/PixelText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { MainMenuData, MenuAction } from '../ui/types';
import { C } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const MAIN_MENU_SCENE_KEY = 'MainMenu';

const GROUND = 380;

export class MainMenuScene extends UiScene {
  private params: MainMenuData = { coins: 0 };
  private coins?: CoinCounter;
  private note?: ParchmentPanel;

  constructor() {
    super(MAIN_MENU_SCENE_KEY);
  }

  init(data?: MainMenuData): void {
    this.params = data ?? { coins: 0 };
    this.setupUi(this.params);
  }

  create(): void {
    const p = this.params;
    paintDusk(this, GROUND, 0);
    paintSand(this, GROUND, GROUND + 28, 0);
    paintStreetProps(this, GROUND);
    paintBoardwalk(this, GROUND + 28, 6);
    this.buildPoster();

    // title sign
    const sy = this.safe.y + 40;
    paintHangingSign(this, 40, sy, 280, 68, 8);
    pixelText(this, 180, sy + 22, S.title, { scale: 3, color: C.brassLight, originX: 0.5, originY: 0.5 }).setDepth(9);
    pixelText(this, 180, sy + 46, p.runLabel ?? S.subtitle, { scale: 2, color: C.cream, originX: 0.5, originY: 0.5, maxWidth: 250, maxLines: 1 }).setDepth(9);

    this.coins = new CoinCounter(this, { x: this.safe.x, y: this.safe.y, value: p.coins, reduceMotion: this.reduceMotion });
    this.coins.container.setDepth(10);

    this.buildButtons();
  }

  setCoins(n: number): void {
    this.coins?.setValue(n, true);
  }

  private buildPoster(): void {
    const w = 52, h = 68;
    const g = this.add.graphics();
    drawParchment(g, w, h, 21);
    drawBust(g, w / 2, h - 8, 1, 4);
    rect(g, C.ink, 12, 8, w - 24, 2);
    drawNail(g, w / 2 - 2, 3);
    const c = this.add.container(300, 238 + h / 2, [g.setPosition(-w / 2, -h / 2)]).setDepth(5);
    c.setAngle(-3);
    if (!this.reduceMotion) {
      this.tweens.add({ targets: c, angle: 2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private fire(a: MenuAction): void {
    this.params.onAction?.(a);
    this.events.emit(UI_EVENTS.menuAction, a);
  }

  private buildButtons(): void {
    const p = this.params;
    const [t0, t1, t2] = stackFromBottom(this.safe, [56, 48, 48], 8);
    const left = this.safe.x;
    const full = this.safe.w;
    const pw = 280;
    const px = Math.round((360 - pw) / 2);
    const mk = (label: string, x: number, y: number, w: number, h: number, action: MenuAction, variant: 'primary' | 'secondary' = 'secondary'): PlankButton => {
      const b = new PlankButton(this, { x, y, w, h, label, variant, name: action, onTap: () => this.onAction(action) });
      b.setDepth(20);
      return b;
    };
    mk(p.hasRun ? S.menu.continueRun : S.menu.duel, px, t0!, pw, 56, p.hasRun ? 'continue' : 'duel', 'primary');
    const [a, b] = pairSlots(left, full, 8, this.leftHanded);
    const [c, d] = pairSlots(left, full, 8, this.leftHanded);
    if (p.hasRun) {
      mk(S.menu.newRun, a.x, t1!, a.w, 48, 'new_run');
      mk(S.menu.saloon, b.x, t1!, b.w, 48, 'saloon');
      mk(S.menu.bounties, c.x, t2!, c.w, 48, 'bounties');
      mk(S.menu.settings, d.x, t2!, d.w, 48, 'settings');
    } else {
      mk(S.menu.saloon, a.x, t1!, a.w, 48, 'saloon');
      mk(S.menu.bounties, b.x, t1!, b.w, 48, 'bounties');
      mk(S.menu.practice, c.x, t2!, c.w, 48, 'practice');
      mk(S.menu.settings, d.x, t2!, d.w, 48, 'settings');
    }
  }

  private onAction(a: MenuAction): void {
    if (a === 'new_run' && this.params.hasRun) {
      showConfirm(this, {
        title: S.menu.abandonTitle, body: S.menu.abandonBody, yes: S.menu.yes, no: S.menu.no, leftHanded: this.leftHanded,
        onYes: () => { this.unhideHits(); this.fire('new_run'); },
        onNo: () => this.unhideHits(),
      });
      return;
    }
    if (a === 'settings') this.showNote(S.menu.settingsSoon);
    this.fire(a);
  }

  private unhideHits(): void {
    this.unregisterHit('confirm-yes');
    this.unregisterHit('confirm-no');
  }

  /** Settings is a stub: a short parchment note so the tap is acknowledged. */
  private showNote(text: string): void {
    this.note?.destroy();
    const w = 288, h = 48;
    const note = new ParchmentPanel(this, { x: 36, y: 392, w, h, depth: 50, seed: 17 });
    const t = pixelText(this, 180, 392 + h / 2, text, { scale: 2, color: C.ink, shadow: null, originX: 0.5, originY: 0.5, maxWidth: w - 24, maxLines: 1 }).setDepth(51);
    this.note = note;
    audioBus.emit({ type: 'miss' });
    this.time.delayedCall(1600, () => { note.destroy(); t.destroy(); if (this.note === note) this.note = undefined; });
  }
}
