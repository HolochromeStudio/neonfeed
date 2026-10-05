import Phaser from 'phaser';
import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { RARITY_SHAPES } from '../ui/bitmaps';
import { initialButton, reduceButton } from '../ui/buttonLogic';
import type { ButtonEvent, ButtonState } from '../ui/buttonLogic';
import { CoinCounter } from '../ui/CoinCounter';
import { audioBus } from '../core/audioEvents';
import { drawBitmap, drawCard, rect } from '../ui/draw';
import { drawIcon } from '../ui/IconView';
import { REWARD_CARD, REWARD_MAX_CARDS, rewardLayout } from '../ui/choiceLayout';
import type { RewardLayout } from '../ui/choiceLayout';
import { pairSlots } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { pixelText, setPixelText } from '../ui/PixelText';
import { stampText } from '../ui/StampText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { PerkCardVM, RewardData } from '../ui/types';
import { C, RARITY } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const REWARD_SCENE_KEY = 'Reward';

export { REWARD_MAX_CARDS };

interface CardView {
  vm: PerkCardVM;
  container: Phaser.GameObjects.Container;
  inner: Phaser.GameObjects.Container;
  up: Phaser.GameObjects.Graphics;
  down: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  state: ButtonState;
  rect: { x: number; y: number; w: number; h: number };
  frame: Phaser.GameObjects.Graphics;
}

export class RewardScene extends UiScene {
  private params: RewardData = { cards: [] };
  private views: CardView[] = [];
  private locked = false;
  private reroll?: PlankButton;
  private skip?: PlankButton;
  private coins?: CoinCounter;
  private take?: PlankButton;
  private selected = -1;
  private lay?: RewardLayout;
  private detailText?: Phaser.GameObjects.Image;
  private hintText?: Phaser.GameObjects.Image;

  constructor() {
    super(REWARD_SCENE_KEY);
  }

  init(data?: RewardData): void {
    this.params = data ?? { cards: [] };
    this.locked = false;
    this.views = [];
    this.selected = -1;
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

    const hasRow = p.rerollCost !== undefined || p.skipCoins !== undefined;
    const cards = p.cards.slice(0, REWARD_MAX_CARDS);
    const lay = rewardLayout(this.safe, cards, hasRow);
    this.lay = lay;
    cards.forEach((vm, i) => this.buildCard(vm, i, lay));

    // detail parchment: the FULL description of the selected perk (never clipped)
    const d = lay.detail;
    new ParchmentPanel(this, { x: d.x, y: d.y, w: d.w, h: d.h, seed: 11, depth: 10 });
    this.detailText = pixelText(this, d.x + 14, d.y + 12, ' ', { scale: 2, color: C.ink, shadow: null, maxWidth: lay.detailTextW }).setDepth(11).setVisible(false);
    this.hintText = pixelText(this, d.x + d.w / 2, d.y + d.h / 2, S.reward.hint, { scale: 2, color: C.parchmentBurn, shadow: null, originX: 0.5, originY: 0.5, align: 'center', maxWidth: lay.detailTextW }).setDepth(11);

    this.take = new PlankButton(this, { ...lay.take, label: S.reward.takeLocked, variant: 'primary', name: 'take', enabled: false, onTap: () => { if (this.selected >= 0) this.pick(this.views[this.selected]!); } });
    this.take.setDepth(20);
    if (hasRow) this.buildRow(lay.row!.y, lay.row!.h);
    const pre = p.selectedId !== undefined ? cards.findIndex((c) => c.id === p.selectedId) : -1;
    if (pre >= 0) this.select(pre, true);
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

  private buildCard(vm: PerkCardVM, index: number, lay: RewardLayout): void {
    const { x, y, w, h } = lay.cards[index]!;
    const C_ = REWARD_CARD;
    const st = RARITY[vm.rarity];
    const seed = vm.id.length * 31 + vm.name.length;
    const up = this.add.graphics();
    drawCard(up, w, h, vm.rarity, false, seed);
    const down = this.add.graphics().setVisible(false);
    drawCard(down, w, h, vm.rarity, true, seed);
    const frame = this.add.graphics().setVisible(false);
    for (const [bx, by, bw, bh] of [[2, 2, w - 4, 3], [2, h - 6, w - 4, 3], [2, 2, 3, h - 4], [w - 5, 2, 3, h - 4]] as const) rect(frame, C.brassLight, bx, by, bw, bh);

    const kids: Phaser.GameObjects.GameObject[] = [];
    // icon plate
    const plate = this.add.graphics();
    const py = Math.round((h - 4 - C_.plate) / 2);
    const plateFill = vm.rarity === 'common' ? C.parchmentDark : vm.rarity === 'rare' ? C.midnight : C.brass;
    const iconColor = vm.rarity === 'rare' ? C.cream : C.ink;
    rect(plate, C.ink, C_.plateX, py, C_.plate, C_.plate);
    rect(plate, plateFill, C_.plateX + 2, py + 2, C_.plate - 4, C_.plate - 4);
    kids.push(plate, drawIcon(this, vm.icon ?? { kind: 'star' }, C_.plateX + 6, py + 6, C_.plate - 12, iconColor));

    const tx = C_.textX;
    const tw = w - tx - C_.textRight;
    const nameLines = lay.nameLines[index]!;
    // name wraps (never clipped); the block (name + rarity row) is centred in the card
    const nameH = (nameLines.length - 1) * 18 + 14;
    const blockH = nameH + C_.nameToRarity + C_.rarityRow;
    const ny = Math.max(C_.padTop - 2, Math.round((h - 4 - blockH) / 2));
    kids.push(pixelText(this, tx, ny, vm.name, { scale: 2, color: C.ink, shadow: null, maxWidth: lay.nameW }));
    // rarity shape + label + tag badge (shape and text, never colour alone)
    const ry = ny + nameH + C_.nameToRarity;
    const sg = this.add.graphics();
    drawBitmap(sg, RARITY_SHAPES[st.shape], tx, ry - 2, 2, vm.rarity === 'common' ? C.parchmentBurn : vm.rarity === 'rare' ? C.midnightLight : C.brassDark);
    kids.push(sg);
    kids.push(pixelText(this, tx + 22, ry, st.label, { scale: 2, color: vm.rarity === 'legendary' ? C.redDark : vm.rarity === 'rare' ? C.midnight : C.wood, shadow: null }));
    if (vm.tag) {
      const bx = tx + 22 + st.label.length * 12 + 8;
      const tagW = Math.min(vm.tag.length * 12 - 2 + 10, tw - (bx - tx));
      const bg = this.add.graphics();
      rect(bg, C.ink, bx, ry - 3, tagW, 18);
      kids.push(bg, pixelText(this, bx + 5, ry - 1, vm.tag, { scale: 2, color: C.cream, shadow: null, maxWidth: tagW - 6, maxLines: 1 }));
    }

    const inner = this.add.container(0, 0, kids);
    const container = this.add.container(x, y, [up, down, frame, inner]).setDepth(10);
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(10);
    const view: CardView = { vm, container, inner, up, down, frame, zone, state: initialButton(true), rect: { x, y, w, h } };
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
    if (r.fire) this.select(this.views.indexOf(v));
  }

  /** First step: read the full description. The second step (TAKE) commits. */
  private select(i: number, silent = false): void {
    if (this.locked || i < 0 || i >= this.views.length) return;
    this.selected = i;
    this.views.forEach((v, k) => v.frame.setVisible(k === i));
    const lines = this.lay!.descLines[i]!;
    if (this.detailText) { setPixelText(this.detailText, lines.join('\n')); this.detailText.setVisible(true); }
    this.hintText?.setVisible(false);
    this.take?.setLabel(S.reward.take);
    this.take?.setEnabled(true);
    if (!silent) this.events.emit(UI_EVENTS.rewardSelect, this.views[i]!.vm.id);
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
    this.take?.setEnabled(false);
  }

  private pick(v: CardView): void {
    this.lock();
    audioBus.emit({ type: 'ui_confirm' });
    for (const o of this.views) if (o !== v) o.container.setAlpha(0.45);
    this.take?.setLabel(S.reward.taken);
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
