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
import { clipChars, fillStack, formatCoins, pairSlots, stackFromBottom } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { pixelText, setPixelText } from '../ui/PixelText';
import { buyButtonState, SHOP_MAX_ITEMS } from '../ui/shopLogic';
import { stampText } from '../ui/StampText';
import { S } from '../ui/strings';
import { UI_EVENTS } from '../ui/types';
import type { ShopData, ShopItemVM } from '../ui/types';
import { C, RARITY } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';

export const SHOP_SCENE_KEY = 'Shop';

const ROW_W = 336;
const KIND_LABEL: Record<string, string> = { perk: 'PERK', item: 'ITEM', service: 'SERVICE' };

export class ShopScene extends UiScene {
  private params: ShopData = { coins: 0, items: [] };
  private items: ShopItemVM[] = [];
  private coins = 0;
  private selected = -1;
  private confirm: ConfirmState = initialConfirm();
  private rowObjs: Phaser.GameObjects.GameObject[] = [];
  private rowTops: number[] = [];
  private rowH = 0;
  private listTop = 0;
  private listBottom = 0;
  private counter?: CoinCounter;
  private buy?: PlankButton;
  private reroll?: PlankButton;
  private detailText?: Phaser.GameObjects.Image;
  private armTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super(SHOP_SCENE_KEY);
  }

  init(data?: ShopData): void {
    this.params = data ?? { coins: 0, items: [] };
    this.items = this.params.items.slice(0, SHOP_MAX_ITEMS).map((i) => ({ ...i }));
    this.coins = this.params.coins;
    this.selected = this.items.length ? 0 : -1;
    this.confirm = initialConfirm();
    this.rowObjs = [];
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
    pixelText(this, this.safe.x + 2, rowY + 7, 'TAP AN ITEM', { scale: 2, color: C.chalk }).setDepth(10);

    // bottom-up: [reroll|leave] 48, buy 56, detail 52
    const [detailTop, buyTop, rowTop] = stackFromBottom(this.safe, [52, 56, 48], 8);
    this.listTop = rowY + CoinCounter.H + 8;
    this.listBottom = detailTop! - 8;
    const st = fillStack(this.items.length, this.listTop, this.listBottom, 8, 64, 44);
    this.rowH = st.itemH;
    this.rowTops = st.tops;

    const dp = new ParchmentPanel(this, { x: this.safe.x + Math.round((this.safe.w - ROW_W) / 2), y: detailTop!, w: ROW_W, h: 52, seed: 5, depth: 10 });
    this.detailText = pixelText(this, 360 / 2, detailTop! + 26, '', { scale: 2, color: C.ink, shadow: null, align: 'center', originX: 0.5, originY: 0.5, maxWidth: ROW_W - 28, maxLines: 2 }).setDepth(11);
    void dp;

    this.buy = new PlankButton(this, { x: Math.round((360 - 280) / 2), y: buyTop!, w: 280, h: 56, label: S.shop.buy, variant: 'primary', name: 'buy', sound: 'none', onTap: () => this.onBuy() });
    this.buy.setDepth(20);
    const [a, b] = pairSlots(this.safe.x, this.safe.w, 8, this.leftHanded);
    const hasReroll = p.rerollCost !== undefined;
    const leaveSlot = hasReroll ? b : { x: Math.round((360 - 200) / 2), w: 200 };
    if (hasReroll) {
      this.reroll = new PlankButton(this, { x: a.x, y: rowTop!, w: a.w, h: 48, label: `${S.shop.reroll} $${p.rerollCost}`, name: 'reroll', enabled: canAfford(this.coins, p.rerollCost!), onTap: () => { p.onReroll?.(); this.events.emit(UI_EVENTS.shopReroll); } });
      this.reroll.setDepth(20);
    }
    new PlankButton(this, { x: leaveSlot.x, y: rowTop!, w: leaveSlot.w, h: 48, label: S.shop.leave, name: 'leave', onTap: () => { p.onLeave?.(); this.events.emit(UI_EVENTS.shopLeave); } }).setDepth(20);

    this.renderRows();
    this.refresh();
  }

  // ---- public sync API (the Lead pushes canonical state back) -------------------------------

  setCoins(n: number): void {
    this.coins = Math.trunc(n);
    this.counter?.setValue(this.coins, true);
    this.reroll?.setEnabled(canAfford(this.coins, this.params.rerollCost ?? Number.POSITIVE_INFINITY));
    this.renderRows();
    this.refresh();
  }

  setItems(items: ShopItemVM[]): void {
    this.items = items.slice(0, SHOP_MAX_ITEMS).map((i) => ({ ...i }));
    this.selected = this.items.length ? Math.min(Math.max(0, this.selected), this.items.length - 1) : -1;
    this.confirm = initialConfirm();
    this.relayout();
  }

  markSold(id: string): void {
    const it = this.items.find((i) => i.id === id);
    if (it) it.sold = true;
    this.renderRows();
    this.refresh();
  }

  /** Programmatic select/buy for tests. */
  selectIndex(i: number): void {
    this.select(i);
  }
  buyTap(): void {
    this.onBuy();
  }

  private relayout(): void {
    const st = fillStack(this.items.length, this.listTop, this.listBottom, 8, 64, 44);
    this.rowH = st.itemH;
    this.rowTops = st.tops;
    this.renderRows();
    this.refresh();
  }

  // ---- internals -------------------------------------------------------------------------------

  private select(i: number): void {
    if (i === this.selected) return;
    this.selected = i;
    this.confirm = initialConfirm();
    audioBus.emit({ type: 'ui_click' });
    this.renderRows();
    this.refresh();
  }

  private current(): ShopItemVM | undefined {
    return this.items[this.selected];
  }

  private refresh(): void {
    const it = this.current();
    const s = buyButtonState(it, this.coins, this.confirm.armedId);
    this.buy?.setLabel(s.label);
    this.buy?.setEnabled(s.enabled);
    if (this.detailText) setPixelText(this.detailText, it ? (s.reason === 'confirm' ? S.shop.tapAgain : it.description) : S.shop.pickItem);
  }

  private onBuy(): void {
    const it = this.current();
    if (!it || it.sold || !canAfford(this.coins, it.price)) return;
    const r = purchaseTap(this.confirm, it.id, it.price, this.time.now);
    this.confirm = r.state;
    if (r.action === 'arm') {
      audioBus.emit({ type: 'ui_click' });
      this.armTimer?.remove(false);
      this.armTimer = this.time.delayedCall(CONFIRM_WINDOW_MS, () => { this.confirm = initialConfirm(); this.refresh(); });
      this.refresh();
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
    this.renderRows();
    this.refresh();
  }

  private renderRows(): void {
    for (const o of this.rowObjs) o.destroy();
    this.rowObjs = [];
    for (let i = 0; i < 12; i++) this.unregisterHit(`item:${i}`);
    const x = this.safe.x + Math.round((this.safe.w - ROW_W) / 2);
    this.items.forEach((it, i) => this.drawRow(it, i, x, this.rowTops[i]!, ROW_W, this.rowH));
  }

  private drawRow(it: ShopItemVM, i: number, x: number, y: number, w: number, h: number): void {
    const sel = i === this.selected;
    const poor = !it.sold && !canAfford(this.coins, it.price);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics().setPosition(x, y).setDepth(10);
    drawSlate(g, w, h, i * 5 + 1);
    if (sel) {
      for (const [bx, by, bw, bh] of [[1, 1, w - 2, 2], [1, h - 3, w - 2, 2], [1, 1, 2, h - 2], [w - 3, 1, 2, h - 2]] as const) rect(g, C.brass, bx, by, bw, bh);
      // arrow marker (shape cue for selection)
      for (let k = 0; k < 5; k++) rect(g, C.brassLight, 5 + k, Math.floor(h / 2) - 4 + k, 1, 9 - 2 * k);
    }
    objs.push(g);
    const px = 16;
    const py = Math.round((h - 40) / 2);
    const plate = this.add.graphics().setPosition(x, y).setDepth(11);
    rect(plate, C.ink, px, py, 40, 40);
    rect(plate, it.rarity === 'legendary' ? C.brass : it.rarity === 'rare' ? C.midnight : C.parchmentDark, px + 2, py + 2, 36, 36);
    objs.push(plate);
    const icoColor = it.rarity === 'rare' ? C.cream : C.ink;
    const ico = drawIcon(this, it.icon ?? { kind: it.kind === 'item' ? 'life' : 'star' }, x + px + 4, y + py + 4, 32, icoColor, 12);
    objs.push(ico);

    const dim = it.sold ? 0.45 : 1;
    const tx = x + 64;
    const nameW = 192;
    const name = pixelText(this, tx, y + 8, clipChars(it.name, Math.floor((nameW + 2) / 12)), { scale: 2, color: C.chalk }).setDepth(12).setAlpha(dim);
    objs.push(name);
    const kg = this.add.graphics().setPosition(tx, y + 30).setDepth(12).setAlpha(dim);
    if (it.rarity) drawBitmap(kg, RARITY_SHAPES[RARITY[it.rarity].shape], 0, 0, 1, C.chalkDim);
    objs.push(kg);
    const sub = it.rarity ? `${KIND_LABEL[it.kind] ?? ''} ${RARITY[it.rarity].label}` : (KIND_LABEL[it.kind] ?? '');
    objs.push(pixelText(this, tx + (it.rarity ? 12 : 0), y + 28, sub, { scale: 2, color: C.chalkDim, maxWidth: nameW - 12, maxLines: 1 }).setDepth(12).setAlpha(dim));

    const price = `$${formatCoins(it.price)}`;
    if (!it.sold) objs.push(pixelText(this, x + w - 12, y + Math.round(h / 2), price, { scale: 3, color: poor ? C.redText : C.brassLight, originX: 1, originY: 0.5 }).setDepth(12));
    if (poor) {
      const lg = this.add.graphics().setDepth(13);
      drawBitmap(lg, ICON_BITMAPS.lock, x + w - 12 - price.length * 18 - 22, y + Math.round(h / 2) - 8, 2, C.redText);
      drawChain(lg, x + 8, y + h - 6, x + w - 8, y + h - 6, C.chalkDim);
      objs.push(lg);
    }
    if (it.sold) objs.push(stampText(this, { x: x + w - 72, y: y + h / 2, text: S.shop.sold, scale: 3, color: C.redText, angle: -4, depth: 14 }));

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true }).setDepth(15);
    zone.on('pointerup', () => this.select(i));
    objs.push(zone);
    this.registerHit(`item:${i}`, { x, y, w, h });
    this.rowObjs.push(...objs);
  }
}
