import Phaser from 'phaser';
import { audioBus } from '../core/audioEvents';
import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { ICON_BITMAPS, RARITY_SHAPES } from '../ui/bitmaps';
import { CONFIRM_WINDOW_MS, initialConfirm, purchaseTap } from '../ui/buttonLogic';
import type { ConfirmState } from '../ui/buttonLogic';
import { CoinCounter } from '../ui/CoinCounter';
import { drawBitmap, drawChain, drawSlate, rect } from '../ui/draw';
import { drawIcon } from '../ui/IconView';
import { canAfford } from '../ui/buttonLogic';
import { priceLabel, SHEET, shopLayout, sheetLayout, SHOP_ROW } from '../ui/choiceLayout';
import type { ShopLayout } from '../ui/choiceLayout';
import { pairSlots } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { pixelText } from '../ui/PixelText';
import { buyButtonState, SHOP_MAX_ITEMS } from '../ui/shopLogic';
import { stampText } from '../ui/StampText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { ShopData, ShopItemVM } from '../ui/types';
import { C, RARITY } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const SHOP_SCENE_KEY = 'Shop';

const KIND_LABEL: Record<string, string> = { perk: 'PERK', item: 'ITEM', service: 'SERVICE' };

/**
 * Two-step shop: the list shows every item (name wraps, price right). Tapping a row opens a detail
 * sheet with the FULL description, then BUY (and a confirm tap above the price threshold). BACK or
 * a tap outside the sheet returns to the list. Nothing a player must read is ever clipped.
 */
export class ShopScene extends UiScene {
  private params: ShopData = { coins: 0, items: [] };
  private items: ShopItemVM[] = [];
  private coins = 0;
  private selected = -1;
  private open = false;
  private confirm: ConfirmState = initialConfirm();
  private rowObjs: Phaser.GameObjects.GameObject[] = [];
  private sheetObjs: Phaser.GameObjects.GameObject[] = [];
  private lay?: ShopLayout;
  private counter?: CoinCounter;
  private buy?: PlankButton;
  private back?: PlankButton;
  private reroll?: PlankButton;
  private leave?: PlankButton;
  private armTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super(SHOP_SCENE_KEY);
  }

  init(data?: ShopData): void {
    this.params = data ?? { coins: 0, items: [] };
    this.items = this.params.items.slice(0, SHOP_MAX_ITEMS).map((i) => ({ ...i }));
    this.coins = this.params.coins;
    this.selected = -1;
    this.open = false;
    this.confirm = initialConfirm();
    this.rowObjs = [];
    this.sheetObjs = [];
    this.setupUi(this.params);
  }

  create(): void {
    const p = this.params;
    paintWoodWall(this, 7, 0, 640, 0);
    // hanging lanterns flank the sign (atlas, if present)
    for (const lx of [22, 338]) if (this.textures.exists('town') && this.textures.get('town').has('lantern_hanging')) this.add.image(lx, 0, 'town', 'lantern_hanging').setOrigin(0.5, 0).setDepth(2);
    const sy = this.safe.y + 4;
    paintHangingSign(this, 52, sy, 256, 52, 8);
    pixelText(this, 180, sy + 24, p.title ?? S.shop.title, { scale: 3, color: C.brassLight, originX: 0.5, originY: 0.5, maxWidth: 232, maxLines: 1 }).setDepth(9);
    const rowY = sy + 52 + 10;
    this.counter = new CoinCounter(this, { x: 360 - this.safe.x, y: rowY, value: this.coins, anchor: 'right', reduceMotion: this.reduceMotion });
    this.counter.container.setDepth(10);
    pixelText(this, this.safe.x + 2, rowY + 7, S.shop.pickItem, { scale: 2, color: C.chalk }).setDepth(10);

    this.relayoutRows();
    const lay = this.lay!;
    const hasReroll = p.rerollCost !== undefined;
    const [a, b] = pairSlots(this.safe.x, this.safe.w, 8, this.leftHanded);
    const leaveSlot = hasReroll ? b : { x: Math.round((360 - 200) / 2), w: 200 };
    const barY = lay.rowBar.y;
    if (hasReroll) {
      this.reroll = new PlankButton(this, { x: a.x, y: barY, w: a.w, h: 48, label: `${S.shop.reroll} $${p.rerollCost}`, name: 'reroll', enabled: canAfford(this.coins, p.rerollCost!), onTap: () => { p.onReroll?.(); this.events.emit(UI_EVENTS.shopReroll); } });
      this.reroll.setDepth(20);
    }
    this.leave = new PlankButton(this, { x: leaveSlot.x, y: barY, w: leaveSlot.w, h: 48, label: S.shop.leave, name: 'leave', onTap: () => { p.onLeave?.(); this.events.emit(UI_EVENTS.shopLeave); } });
    this.leave.setDepth(20);
    this.buy = new PlankButton(this, { ...lay.buy, label: S.shop.buy, variant: 'primary', name: 'buy', sound: 'none', onTap: () => this.onBuy() });
    this.buy.setDepth(40);
    this.back = new PlankButton(this, { ...lay.back, label: S.shop.back, name: 'back', onTap: () => this.closeSheet() });
    this.back.setDepth(40);
    this.applyMode();
  }

  // ---- public sync API (the Lead pushes canonical state back) -------------------------------

  setCoins(n: number): void {
    this.coins = Math.trunc(n);
    this.counter?.setValue(this.coins, true);
    this.reroll?.setEnabled(canAfford(this.coins, this.params.rerollCost ?? Number.POSITIVE_INFINITY));
    this.refresh();
  }

  setItems(items: ShopItemVM[]): void {
    this.items = items.slice(0, SHOP_MAX_ITEMS).map((i) => ({ ...i }));
    this.selected = -1;
    this.open = false;
    this.confirm = initialConfirm();
    this.relayoutRows();
    this.applyMode();
  }

  markSold(id: string): void {
    const it = this.items.find((i) => i.id === id);
    if (it) it.sold = true;
    this.refresh();
  }

  /** Programmatic: open the detail sheet of item i (same path as a tap on its row). */
  selectIndex(i: number): void {
    this.openSheet(i);
  }
  buyTap(): void {
    this.onBuy();
  }
  backTap(): void {
    this.closeSheet();
  }
  get sheetOpen(): boolean {
    return this.open;
  }

  // ---- internals -------------------------------------------------------------------------------

  private relayoutRows(): void {
    this.lay = shopLayout(this.safe, this.items.map((it) => ({ name: it.name, description: it.description, price: it.price })));
    this.renderRows();
  }

  private refresh(): void {
    this.renderRows();
    if (this.open) this.renderSheet();
    this.applyMode();
  }

  private openSheet(i: number): void {
    if (i < 0 || i >= this.items.length) return;
    this.selected = i;
    this.open = true;
    this.confirm = initialConfirm();
    audioBus.emit({ type: 'ui_click' });
    this.renderSheet();
    this.applyMode();
  }

  private closeSheet(): void {
    if (!this.open) return;
    this.open = false;
    this.confirm = initialConfirm();
    this.armTimer?.remove(false);
    for (const o of this.sheetObjs) o.destroy();
    this.sheetObjs = [];
    this.applyMode();
  }

  /** Show/hide the controls that belong to the list vs the sheet, keeping the hit audit honest. */
  private applyMode(): void {
    const toggle = (btn: PlankButton | undefined, label: string, on: boolean): void => {
      if (!btn) return;
      btn.setVisible(on);
      this.unregisterHit(label);
      if (on) this.registerHit(label, btn.hitRect);
    };
    toggle(this.reroll, 'reroll', !this.open);
    toggle(this.leave, 'leave', !this.open);
    toggle(this.buy, 'buy', this.open);
    toggle(this.back, 'back', this.open);
    for (let i = 0; i < 12; i++) this.unregisterHit(`item:${i}`);
    if (this.open) {
      this.syncBuy();
      return;
    }
    this.lay?.rows.forEach((r, i) => this.registerHit(`item:${i}`, r));
  }

  private onBuy(): void {
    const it = this.items[this.selected];
    if (!this.open || !it || it.sold || !canAfford(this.coins, it.price)) return;
    const r = purchaseTap(this.confirm, it.id, it.price, this.time.now);
    this.confirm = r.state;
    if (r.action === 'arm') {
      audioBus.emit({ type: 'ui_click' });
      this.armTimer?.remove(false);
      this.armTimer = this.time.delayedCall(CONFIRM_WINDOW_MS, () => { this.confirm = initialConfirm(); this.syncBuy(); });
      this.syncBuy();
      return;
    }
    const res = this.params.onBuy?.(it.id);
    this.events.emit(UI_EVENTS.shopBuy, it.id);
    if (res === false) { audioBus.emit({ type: 'miss' }); return; }
    audioBus.emit({ type: 'coin' });
    it.sold = true;
    this.coins -= it.price;
    this.counter?.setValue(this.coins, true);
    this.reroll?.setEnabled(canAfford(this.coins, this.params.rerollCost ?? Number.POSITIVE_INFINITY));
    this.closeSheet();
    this.renderRows();
  }

  private syncBuy(): void {
    const it = this.items[this.selected];
    if (!it) return;
    const s = buyButtonState(it, this.coins, this.confirm.armedId);
    this.buy?.setLabel(s.label);
    this.buy?.setEnabled(s.enabled);
  }

  private renderRows(): void {
    for (const o of this.rowObjs) o.destroy();
    this.rowObjs = [];
    const lay = this.lay;
    if (!lay) return;
    this.items.forEach((it, i) => this.drawRow(it, i, lay, lay.rows[i]!));
  }

  private drawRow(it: ShopItemVM, i: number, lay: ShopLayout, r: { x: number; y: number; w: number; h: number }): void {
    const { x, y, w, h } = r;
    const R = SHOP_ROW;
    const poor = !it.sold && !canAfford(this.coins, it.price);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics().setPosition(x, y).setDepth(10);
    drawSlate(g, w, h, i * 5 + 1);
    objs.push(g);
    const px = R.plateX;
    const py = Math.round((h - R.plate) / 2);
    const plate = this.add.graphics().setPosition(x, y).setDepth(11);
    rect(plate, C.ink, px, py, R.plate, R.plate);
    rect(plate, it.rarity === 'legendary' ? C.brass : it.rarity === 'rare' ? C.midnight : C.parchmentDark, px + 2, py + 2, R.plate - 4, R.plate - 4);
    objs.push(plate);
    const icoColor = it.rarity === 'rare' ? C.cream : C.ink;
    objs.push(drawIcon(this, it.icon ?? { kind: it.kind === 'item' ? 'life' : 'star' }, x + px + 4, y + py + 4, R.plate - 8, icoColor, 12));

    const dim = it.sold ? 0.45 : 1;
    const tx = x + R.textX;
    const lines = lay.rowNameLines[i]!;
    const nameH = (lines.length - 1) * 18 + 14;
    const sub = it.rarity ? `${KIND_LABEL[it.kind] ?? ''} ${RARITY[it.rarity].label}` : (KIND_LABEL[it.kind] ?? '');
    const showSub = h - 2 * R.padY >= nameH + 4 + 14;
    const blockH = nameH + (showSub ? 4 + 14 : 0);
    const ty = y + Math.round((h - blockH) / 2);
    objs.push(pixelText(this, tx, ty, it.name, { scale: 2, color: C.chalk, maxWidth: lay.rowNameW }).setDepth(12).setAlpha(dim));
    if (showSub) {
      const sy = ty + nameH + 4;
      const kg = this.add.graphics().setPosition(tx, sy + 3).setDepth(12).setAlpha(dim);
      if (it.rarity) drawBitmap(kg, RARITY_SHAPES[RARITY[it.rarity].shape], 0, 0, 1, C.chalkDim);
      objs.push(kg);
      objs.push(pixelText(this, tx + (it.rarity ? 12 : 0), sy, sub, { scale: 2, color: C.chalkDim, maxWidth: lay.rowNameW - 12, maxLines: 1 }).setDepth(12).setAlpha(dim));
    }

    const price = priceLabel(it.price);
    if (!it.sold) objs.push(pixelText(this, x + w - R.priceRight, y + Math.round(h / 2), price, { scale: 2, color: poor ? C.redText : C.brassLight, originX: 1, originY: 0.5 }).setDepth(12));
    if (poor) {
      const lg = this.add.graphics().setDepth(13);
      drawBitmap(lg, ICON_BITMAPS.lock, x + w - R.priceRight - price.length * 12 - 20, y + Math.round(h / 2) - 8, 2, C.redText);
      drawChain(lg, x + 8, y + h - 6, x + w - 8, y + h - 6, C.chalkDim);
      objs.push(lg);
    }
    if (it.sold) objs.push(stampText(this, { x: x + w - 72, y: y + h / 2, text: S.shop.sold, scale: 3, color: C.redText, angle: -4, depth: 14 }));

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(15);
    zone.on('pointerup', () => { if (!this.open) this.openSheet(i); });
    objs.push(zone);
    this.rowObjs.push(...objs);
  }

  /** Detail sheet: full name, kind/rarity, FULL description, price and balance. */
  private renderSheet(): void {
    for (const o of this.sheetObjs) o.destroy();
    this.sheetObjs = [];
    const it = this.items[this.selected];
    if (!it || !this.lay) return;
    const sl = sheetLayout(this.safe, { name: it.name, description: it.description, price: it.price }, this.lay.buy.y);
    const { x, y, w, h } = sl.rect;
    const objs: Phaser.GameObjects.GameObject[] = [];
    // dim the list and catch taps outside the sheet (= BACK)
    const dim = this.add.graphics().setDepth(30);
    rect(dim, C.ink, 0, 0, 360, 640);
    dim.setAlpha(0.94);
    const catcher = this.add.zone(180, 320, 360, 640).setInteractive().setDepth(30);
    catcher.on('pointerup', () => this.closeSheet());
    objs.push(dim, catcher);
    objs.push(new ParchmentPanel(this, { x, y, w, h, seed: 13, depth: 31 }).container);
    const S_ = SHEET;
    const plate = this.add.graphics().setPosition(x, y).setDepth(32);
    const fill = it.rarity === 'legendary' ? C.brass : it.rarity === 'rare' ? C.midnight : C.parchmentDark;
    rect(plate, C.ink, S_.padX, S_.padY, S_.plate, S_.plate);
    rect(plate, fill, S_.padX + 2, S_.padY + 2, S_.plate - 4, S_.plate - 4);
    objs.push(plate, drawIcon(this, it.icon ?? { kind: it.kind === 'item' ? 'life' : 'star' }, x + S_.padX + 6, y + S_.padY + 6, S_.plate - 12, it.rarity === 'rare' ? C.cream : C.ink, 33));
    const hx = x + S_.padX + S_.plate + S_.headGap;
    objs.push(pixelText(this, hx, y + S_.padY, it.name, { scale: 2, color: C.ink, shadow: null, maxWidth: sl.nameW }).setDepth(33));
    const sub = it.rarity ? `${KIND_LABEL[it.kind] ?? ''} ${RARITY[it.rarity].label}` : (KIND_LABEL[it.kind] ?? '');
    const sg = this.add.graphics().setPosition(hx, y + sl.subY + 1).setDepth(33);
    if (it.rarity) drawBitmap(sg, RARITY_SHAPES[RARITY[it.rarity].shape], 0, 0, 2, C.parchmentBurn);
    objs.push(sg, pixelText(this, hx + (it.rarity ? 22 : 0), y + sl.subY, sub, { scale: 2, color: C.wood, shadow: null, maxWidth: sl.nameW - 22, maxLines: 1 }).setDepth(33));
    const rule = this.add.graphics().setPosition(x, y).setDepth(32);
    rect(rule, C.parchmentBurn, S_.padX, sl.ruleY, w - 2 * S_.padX, 2);
    objs.push(rule);
    objs.push(pixelText(this, x + sl.descX, y + sl.descY, it.description, { scale: 2, color: C.ink, shadow: null, maxWidth: sl.descW }).setDepth(33));
    const left = it.sold ? S.shop.soldOut : `${S.shop.price} ${priceLabel(it.price)}`;
    objs.push(pixelText(this, x + S_.padX, y + sl.footerY, left, { scale: 2, color: C.redDark, shadow: null }).setDepth(33));
    objs.push(pixelText(this, x + w - S_.padX, y + sl.footerY, `${S.shop.have} ${priceLabel(this.coins)}`, { scale: 2, color: C.wood, shadow: null, originX: 1 }).setDepth(33));
    this.sheetObjs = objs;
    this.syncBuy();
  }
}
