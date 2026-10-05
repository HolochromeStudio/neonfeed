import Phaser from 'phaser';
import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { RARITY_SHAPES } from '../ui/bitmaps';
import { initialButton, reduceButton } from '../ui/buttonLogic';
import type { ButtonEvent, ButtonState } from '../ui/buttonLogic';
import { CoinCounter } from '../ui/CoinCounter';
import { audioBus } from '../core/audioEvents';
import { drawBitmap, drawCard, rect } from '../ui/draw';
import { drawIcon } from '../ui/IconView';
import { clipChars, fillStack, pairSlots, stackFromBottom } from '../ui/layout';
import { PlankButton } from '../ui/PlankButton';
import { pixelText } from '../ui/PixelText';
import { stampText } from '../ui/StampText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { PerkCardVM, RewardData } from '../ui/types';
import { C, RARITY } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const REWARD_SCENE_KEY = 'Reward';

export const REWARD_MAX_CARDS = 3;
const CARD_W = 336;
const CARD_MAX_H = 124;

interface CardView {
  vm: PerkCardVM;
  container: Phaser.GameObjects.Container;
  inner: Phaser.GameObjects.Container;
  up: Phaser.GameObjects.Graphics;
  down: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  state: ButtonState;
  rect: { x: number; y: number; w: number; h: number };
}

export class RewardScene extends UiScene {
  private params: RewardData = { cards: [] };
  private views: CardView[] = [];
  private locked = false;
  private reroll?: PlankButton;
  private skip?: PlankButton;
  private coins?: CoinCounter;

  constructor() {
    super(REWARD_SCENE_KEY);
  }

  init(data?: RewardData): void {
    this.params = data ?? { cards: [] };
    this.locked = false;
    this.views = [];
    this.setupUi(this.params);
  }

  create(): void {
    const p = this.params;
    paintWoodWall(this, 3, 0, 640, 0);
    const sy = this.safe.y + 4;
    paintHangingSign(this, 40, sy, 280, 52, 8);
    pixelText(this, 180, sy + 24, p.title ?? S.reward.title, { scale: 3, color: C.brassLight, originX: 0.5, originY: 0.5, maxWidth: 256, maxLines: 1 }).setDepth(9);
    const rowY = sy + 52 + 10;
    if (p.coins !== undefined) {
      this.coins = new CoinCounter(this, { x: this.safe.x, y: rowY, value: p.coins, reduceMotion: this.reduceMotion });
      this.coins.container.setDepth(10);
    }
    if (p.subtitle) {
      pixelText(this, 360 - this.safe.x, rowY + 7, p.subtitle, { scale: 2, color: C.chalk, originX: 1, maxWidth: 190, maxLines: 1 }).setDepth(10);
    }

    // bottom row first: it decides how much room the cards get
    const hasRow = p.rerollCost !== undefined || p.skipCoins !== undefined;
    const rowH = 48;
    const [rowTop] = stackFromBottom(this.safe, [rowH], 0);
    const cardsTop = rowY + CoinCounter.H + 10;
    const cardsBottom = (hasRow ? rowTop! - 12 : this.safe.y + this.safe.h);
    const cards = p.cards.slice(0, REWARD_MAX_CARDS);
    const stack = fillStack(cards.length, cardsTop, cardsBottom, 8, CARD_MAX_H, 96);
    cards.forEach((vm, i) => this.buildCard(vm, this.safe.x + Math.round((this.safe.w - CARD_W) / 2), stack.tops[i]!, CARD_W, stack.itemH));

    if (hasRow) this.buildRow(rowTop!, rowH);
  }

  private buildRow(top: number, h: number): void {
    const p = this.params;
    const coins = p.coins ?? Number.POSITIVE_INFINITY;
    const both = p.rerollCost !== undefined && p.skipCoins !== undefined;
    const slots = pairSlots(this.safe.x, this.safe.w, 8, this.leftHanded);
    const single = { x: Math.round((360 - 200) / 2), w: 200 };
    if (p.rerollCost !== undefined) {
      const slot = both ? slots[0] : single;
      this.reroll = new PlankButton(this, {
        x: slot.x, y: top, w: slot.w, h, label: `${S.reward.reroll} $${p.rerollCost}`, name: 'reroll', enabled: coins >= p.rerollCost,
        onTap: () => { if (this.locked) return; p.onReroll?.(); this.events.emit(UI_EVENTS.rewardReroll); },
      });
    }
    if (p.skipCoins !== undefined) {
      const slot = both ? slots[1] : single;
      this.skip = new PlankButton(this, {
        x: slot.x, y: top, w: slot.w, h, label: `${S.reward.skip} +$${p.skipCoins}`, name: 'skip',
        onTap: () => { if (this.locked) return; this.lock(); p.onSkip?.(); this.events.emit(UI_EVENTS.rewardSkip); },
      });
    }
    this.reroll?.setDepth(20);
    this.skip?.setDepth(20);
  }

  private buildCard(vm: PerkCardVM, x: number, y: number, w: number, h: number): void {
    const st = RARITY[vm.rarity];
    const seed = vm.id.length * 31 + vm.name.length;
    const up = this.add.graphics();
    drawCard(up, w, h, vm.rarity, false, seed);
    const down = this.add.graphics().setVisible(false);
    drawCard(down, w, h, vm.rarity, true, seed);

    const kids: Phaser.GameObjects.GameObject[] = [];
    // icon plate
    const plate = this.add.graphics();
    const py = Math.round((h - 4 - 56) / 2);
    const plateFill = vm.rarity === 'common' ? C.parchmentDark : vm.rarity === 'rare' ? C.midnight : C.brass;
    const iconColor = vm.rarity === 'rare' ? C.cream : C.ink;
    rect(plate, C.ink, 14, py, 56, 56);
    rect(plate, plateFill, 16, py + 2, 52, 52);
    kids.push(plate, drawIcon(this, vm.icon ?? { kind: 'star' }, 22, py + 8, 40, iconColor));

    const tx = 84;
    const tw = w - tx - 16;
    kids.push(pixelText(this, tx, 14, clipChars(vm.name, Math.floor((tw + 2) / 12)), { scale: 2, color: C.ink, shadow: null }));
    // rarity shape + label + tag badge (shape and text, never colour alone)
    const sg = this.add.graphics();
    drawBitmap(sg, RARITY_SHAPES[st.shape], tx, 33, 2, vm.rarity === 'common' ? C.parchmentBurn : vm.rarity === 'rare' ? C.midnightLight : C.brassDark);
    kids.push(sg);
    const lab = pixelText(this, tx + 22, 35, st.label, { scale: 2, color: vm.rarity === 'legendary' ? C.redDark : vm.rarity === 'rare' ? C.midnight : C.wood, shadow: null });
    kids.push(lab);
    if (vm.tag) {
      const bx = tx + 22 + st.label.length * 12 + 8;
      const tagW = vm.tag.length * 12 - 2 + 10;
      const bg = this.add.graphics();
      rect(bg, C.ink, bx, 32, Math.min(tagW, tw - (bx - tx)), 18);
      kids.push(bg, pixelText(this, bx + 5, 34, clipChars(vm.tag, 6), { scale: 2, color: C.cream, shadow: null }));
    }
    const lines = Math.max(1, Math.floor((h - 4 - 56 - 14) / 18) + 1);
    kids.push(pixelText(this, tx, 56, vm.description, { scale: 2, color: C.ink, shadow: null, maxWidth: tw, maxLines: Math.min(3, lines) }));

    const inner = this.add.container(0, 0, kids);
    const container = this.add.container(x, y, [up, down, inner]).setDepth(10);
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(10);
    const view: CardView = { vm, container, inner, up, down, zone, state: initialButton(true), rect: { x, y, w, h } };
    const send = (e: ButtonEvent): void => this.cardEvent(view, e);
    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => send({ type: 'down', id: ptr.id }));
    zone.on('pointerup', (ptr: Phaser.Input.Pointer) => send({ type: 'up', id: ptr.id }));
    zone.on('pointerout', (ptr: Phaser.Input.Pointer) => send({ type: 'leave', id: ptr.id }));
    zone.on('pointerupoutside', (ptr: Phaser.Input.Pointer) => send({ type: 'leave', id: ptr.id }));
    this.views.push(view);
    this.registerHit(`card:${vm.id}`, view.rect);
  }

  private cardEvent(v: CardView, e: ButtonEvent): void {
    if (this.locked) return;
    const r = reduceButton(v.state, e);
    v.state = r.state;
    if (r.feedback === 'click') audioBus.emit({ type: 'ui_click' });
    const pressed = v.state.phase === 'pressed';
    v.up.setVisible(!pressed);
    v.down.setVisible(pressed);
    v.inner.setY(pressed ? 2 : 0);
    if (r.fire) this.pick(v);
  }

  /** Test/programmatic pick: same path as a tap. */
  pickById(id: string): void {
    const v = this.views.find((c) => c.vm.id === id);
    if (v && !this.locked) this.pick(v);
  }

  private lock(): void {
    this.locked = true;
    this.reroll?.setEnabled(false);
    this.skip?.setEnabled(false);
  }

  private pick(v: CardView): void {
    this.lock();
    audioBus.emit({ type: 'ui_confirm' });
    for (const o of this.views) if (o !== v) o.container.setAlpha(0.45);
    v.up.setVisible(false);
    v.down.setVisible(true);
    v.inner.setY(2);
    stampText(this, { x: v.rect.x + v.rect.w - 72, y: v.rect.y + v.rect.h / 2, text: S.reward.taken, scale: 3, angle: -4, slam: true, reduceMotion: this.reduceMotion, depth: 30 });
    const done = (): void => {
      this.params.onPick?.(v.vm.id);
      this.events.emit(UI_EVENTS.rewardPick, v.vm.id);
    };
    if (this.reduceMotion) done(); else this.time.delayedCall(220, done);
  }
}
