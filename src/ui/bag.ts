import Phaser from 'phaser';
import { Ui, INK, DIM, BLUE, RED, GREEN } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, itemCount, takeItem, addItem } from '../core/state';
import { ITEMS, SHOPS, SPECIES } from '../data';
import { maxHp, displayName, checkEvolution } from '../core/mon';
import { partyMenu, wrapText } from './party';
import { playEvolution } from './evolution';

const CATS = ['HEALING', 'STATUS', 'CAPTURE', 'DEBUG', 'EVOLUTION', 'MATERIALS', 'KEY ITEMS'];

export type BagPick = { id: string; target: number; moveIdx?: number; module?: string } | null;

/** Applies a field item to a party member. Returns true if consumed. */
async function useField(scene: Phaser.Scene, ui: Ui, id: string): Promise<boolean> {
  const it = ITEMS[id]; const fx = it.fx;
  if (fx.beacon) { G.s.beaconSteps = fx.beacon; await ui.say(`Signal Beacon activated! Wild encounters will be more frequent for ${fx.beacon} steps.`); return true; }
  const t = await partyMenu(scene, ui, { prompt: `USE ${it.name.toUpperCase()} ON?`, pick: true, allowFainted: fx.revive !== undefined, item: id });
  if (t < 0) return false;
  const m = G.s.party[t];
  if (fx.evoItem) {
    const to = checkEvolution(m, { item: id });
    if (!to) { await ui.say(`It won't have any effect on ${displayName(m)}.`); return false; }
    takeItem(id); await playEvolution(scene, ui, m, to); return true;
  }
  if (fx.revive !== undefined) {
    if (m.hp > 0) { await ui.say("It won't have any effect."); return false; }
    m.hp = Math.max(1, Math.floor((maxHp(m) * fx.revive) / 100)); m.status = null; takeItem(id); Audio.sfx('heal'); await ui.say(`${displayName(m)} was revived!`, { auto: 500 }); return true;
  }
  if (m.hp <= 0) { Audio.sfx('error'); await ui.say("It won't have any effect on a fainted Bytekin."); return false; }
  if (fx.pp) {
    const mi = await ui.choose(m.moves.map((x) => `${x.id.toUpperCase().replace(/_/g, ' ')} ${x.pp}/${x.maxPp}`.slice(0, 22)), { x: 100, y: 40, w: 136 });
    if (mi < 0) return false;
    if (m.moves[mi].pp >= m.moves[mi].maxPp) { await ui.say("PP is already full."); return false; }
    m.moves[mi].pp = Math.min(m.moves[mi].maxPp, m.moves[mi].pp + fx.pp); takeItem(id); Audio.sfx('heal'); await ui.say('PP restored!', { auto: 500 }); return true;
  }
  let used = false;
  if (fx.heal !== undefined || fx.healPct !== undefined) {
    const max = maxHp(m);
    if (m.hp < max) { const add = fx.heal ?? Math.floor((max * fx.healPct) / 100); m.hp = Math.min(max, m.hp + add); used = true; }
  }
  if (fx.cure && m.status) { m.status = null; used = true; }
  if (!used) { Audio.sfx('error'); await ui.say("It won't have any effect."); return false; }
  takeItem(id); Audio.sfx('heal'); await ui.say(`${displayName(m)} was restored!`, { auto: 500 });
  return true;
}

export async function bagMenu(scene: Phaser.Scene, ui: Ui, o: { battle?: boolean; wild?: boolean } = {}): Promise<BagPick> {
  let cat = 0; let idx = 0;
  const catHas = (c: string) => Object.entries(G.s.bag).some(([id, n]) => n > 0 && ITEMS[id]?.cat === c);
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 18);
    const c = CATS[cat];
    ui.text(L, 10, 8, `< ${c} >`, BLUE); ui.text(L, 96, 8, `${G.s.credits} CR`, '#c89818');
    const items = Object.entries(G.s.bag).filter(([id, n]) => n > 0 && ITEMS[id]?.cat === c).map(([id]) => id);
    if (idx >= items.length) idx = Math.max(0, items.length - 1);
    ui.win(L, 2, 22, 236, 86);
    if (!items.length) ui.text(L, 14, 40, 'NOTHING HERE', DIM);
    const VIS = 6; const top = Math.max(0, Math.min(idx - 2, items.length - VIS));
    items.slice(top, top + VIS).forEach((id, i) => {
      const y = 30 + i * 12;
      ui.text(L, 18, y, ITEMS[id].name.slice(0, 20), INK); ui.text(L, 200, y, `x${itemCount(id)}`, INK);
      if (top + i === idx) L.add(scene.add.image(8, y, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    });
    ui.win(L, 2, 110, 236, 48);
    const sel = items[idx];
    if (sel) wrapText(ITEMS[sel].desc, 37).slice(0, 4).forEach((ln, i) => ui.text(L, 10, 118 + i * 9, ln, INK));
    if (G.s.settings.hints) ui.textR(L, 232, 8, 'A:USE B:BACK', DIM);
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return null; }
    if (b === 'left' || b === 'right') { cat = (cat + (b === 'left' ? CATS.length - 1 : 1)) % CATS.length; idx = 0; Audio.sfx('move'); }
    else if (b === 'up') { idx = Math.max(0, idx - 1); Audio.sfx('move'); } else if (b === 'down') { idx = Math.min(items.length - 1, idx + 1); Audio.sfx('move'); }
    else if (b === 'a' && sel) {
      const it = ITEMS[sel]; Audio.sfx('select');
      if (o.battle) {
        if (it.use !== 'battle' && it.use !== 'both') { await ui.say('That can\'t be used in battle.'); continue; }
        if (it.fx.stab !== undefined) { if (!o.wild) { await ui.say('Only wild Bytekin can be clamped.'); continue; } return { id: sel, target: -1 }; }
        const t = await partyMenu(scene, ui, { prompt: `USE ${it.name.toUpperCase()} ON?`, pick: true, allowFainted: it.fx.revive !== undefined, battle: true });
        if (t < 0) continue;
        const m = G.s.party[t];
        if (it.fx.revive !== undefined ? m.hp > 0 : m.hp <= 0) { await ui.say("It won't have any effect."); continue; }
        if ((it.fx.heal !== undefined || it.fx.healPct !== undefined) && m.hp >= maxHp(m)) { await ui.say("It won't have any effect."); continue; }
        if (it.fx.cure && !m.status) { await ui.say("It won't have any effect."); continue; }
        return { id: sel, target: t };
      }
      if (it.use === 'field' || it.use === 'both') { await useField(scene, ui, sel); }
      else if (it.cat === 'KEY ITEMS') { await ui.say(it.desc); }
      else await ui.say(it.use === 'battle' ? 'Use this during a battle.' : it.use === 'contain' ? 'Select this under CONTAIN in battle.' : 'Nothing to do with this right now.');
    }
  }
}

export async function shopMenu(scene: Phaser.Scene, ui: Ui, shopId: string) {
  const shop = SHOPS[shopId];
  for (;;) {
    const m = await ui.choose(['BUY', 'SELL', 'EXIT'], { x: 4, y: 4, w: 60, align: 'left', title: shop.name.slice(0, 14) });
    if (m === 0) await buy(scene, ui, shop); else if (m === 1) await sell(scene, ui); else return;
  }
}
async function qty(scene: Phaser.Scene, ui: Ui, unit: number, max: number, label: string, sign: string): Promise<number> {
  const L = ui.layer(); ui.win(L, 100, 60, 136, 40); ui.text(L, 108, 68, label.slice(0, 20), INK);
  const t = ui.text(L, 108, 82, '', BLUE); let n = 1;
  for (;;) {
    t.setText(`x${String(n).padStart(2, '0')}  ${sign}${unit * n} CR`);
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    if (b === 'up' || b === 'right') n = Math.min(max, n + (b === 'up' ? 1 : 5)); else if (b === 'down' || b === 'left') n = Math.max(1, n - (b === 'down' ? 1 : 5));
    else if (b === 'a') { Audio.sfx('select'); L.destroy(); return n; } else if (b === 'b') { Audio.sfx('back'); L.destroy(); return 0; }
    Audio.sfx('move');
  }
}
async function buy(scene: Phaser.Scene, ui: Ui, shop: { name: string; stock: string[] }) {
  let idx = 0;
  for (;;) {
    const L = ui.layer(); ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 18); ui.text(L, 10, 8, shop.name, BLUE); ui.text(L, 150, 8, `${G.s.credits} CR`, '#c89818');
    ui.win(L, 2, 22, 236, 86);
    shop.stock.forEach((id, i) => { const y = 30 + (i % 7) * 11; if (i < 7) { ui.text(L, 18, y, ITEMS[id].name.slice(0, 18), INK); ui.text(L, 176, y, `${ITEMS[id].price} CR`, INK); ui.text(L, 130, y, `x${itemCount(id)}`, DIM); } if (i === idx) L.add(scene.add.image(8, 30 + (idx % 7) * 11, 'cursor').setOrigin(0, 0).setTint(0x1a1830)); });
    ui.win(L, 2, 110, 236, 48); wrapText(ITEMS[shop.stock[idx]].desc, 37).slice(0, 4).forEach((ln, i) => ui.text(L, 10, 118 + i * 9, ln, INK));
    const b = await Input.wait(['up', 'down', 'a', 'b']); L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    if (b === 'up') idx = (idx + shop.stock.length - 1) % shop.stock.length; else if (b === 'down') idx = (idx + 1) % shop.stock.length;
    else if (b === 'a') {
      const id = shop.stock[idx]; const it = ITEMS[id]; Audio.sfx('select');
      const max = Math.min(99, Math.floor(G.s.credits / it.price));
      if (max < 1) { Audio.sfx('error'); await ui.say("You don't have enough CREDITS."); continue; }
      const n = await qty(scene, ui, it.price, max, it.name, '');
      if (n > 0) { G.s.credits -= it.price * n; addItem(id, n); Audio.sfx('buy'); await ui.say(`Bought ${n} ${it.name}. Thank you!`, { auto: 500 }); }
    }
  }
}
async function sell(scene: Phaser.Scene, ui: Ui) {
  for (;;) {
    const ids = Object.entries(G.s.bag).filter(([id, n]) => n > 0 && ITEMS[id].cat !== 'KEY ITEMS').map(([id]) => id);
    if (!ids.length) { await ui.say('You have nothing to sell.'); return; }
    const names = ids.map((id) => `${ITEMS[id].name.slice(0, 16)} x${itemCount(id)}`);
    const i = await ui.choose(names, { x: 60, y: 4, w: 176, title: `SELL  ${G.s.credits} CR` });
    if (i < 0) return;
    const id = ids[i]; const price = ITEMS[id].sell ?? Math.floor(ITEMS[id].price / 2);
    if (price <= 0) { await ui.say("I can't take that."); continue; }
    const n = await qty(scene, ui, price, itemCount(id), ITEMS[id].name, '+');
    if (n > 0) { takeItem(id, n); G.s.credits += price * n; Audio.sfx('buy'); await ui.say(`Sold ${n} for ${price * n} CR.`, { auto: 500 }); }
  }
}
void RED; void GREEN; void SPECIES;
