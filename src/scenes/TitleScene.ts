import Phaser from 'phaser';
import { Ui, INK, DIM, WHITE, wait } from '../ui/ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, SLOTS, slotSummary, loadSlot, readSlot, playtimeText, deleteSlot, newSave, loadGlobalSettings } from '../core/state';
import { openOptions } from '../ui/options';
import { FONT_KEY } from '../gfx/font';
import { mkCanvas, ctx2d, Pen, rng } from '../gfx/pen';

export class TitleScene extends Phaser.Scene {
  ui!: Ui;
  constructor() { super('Title'); }
  create() {
    this.ui = new Ui(this);
    G.s = { ...G.s, settings: loadGlobalSettings() };
    (window as any).__applyScale?.();
    this.cameras.main.setBackgroundColor('#05030c');
    Audio.setVolumes(G.s.settings.musicVol, G.s.settings.sfxVol);
    Audio.glitch = false; Audio.play('title');
    this.buildBackdrop();
    void this.run();
  }
  buildBackdrop() {
    const R = rng(42);
    const c = mkCanvas(240, 160); const p = new Pen(ctx2d(c));
    for (let y = 0; y < 160; y += 2) { const t = y / 160; p.r(0, y, 240, 2, `rgb(${Math.round(8 + 22 * t)},${Math.round(4 + 8 * t)},${Math.round(24 + 40 * t)})`); }
    for (let i = 0; i < 70; i++) p.p((R() * 240) | 0, (R() * 90) | 0, R() < 0.3 ? '#b8c8ff' : '#6a6aa8');
    // far hills
    for (let x = 0; x < 240; x++) { const h = 112 + Math.sin(x / 19) * 5 + Math.sin(x / 7) * 2; p.r(x, Math.round(h), 1, 160 - h, '#120a28'); }
    for (let x = 0; x < 240; x++) { const h = 128 + Math.sin(x / 11 + 2) * 4; p.r(x, Math.round(h), 1, 160 - h, '#0a0618'); }
    // tower silhouette (center-right)
    const tx = 160; const col = '#0a0618';
    p.r(tx - 1, 36, 3, 96, col); p.line(tx, 40, tx - 14, 126, col); p.line(tx + 1, 40, tx + 15, 126, col); p.line(tx - 1, 40, tx - 13, 126, col); p.line(tx + 2, 40, tx + 16, 126, col);
    for (let y = 56; y < 126; y += 14) { const w = 3 + (y - 40) * 0.17; p.r(tx - w, y, w * 2 + 1, 2, col); p.line(tx - w, y, tx + w, y + 14, col); }
    p.r(tx - 12, 118, 26, 14, col); p.r(tx - 3, 30, 7, 6, col);
    // little town glow lights
    for (let i = 0; i < 14; i++) p.p(10 + ((R() * 120) | 0), 120 + ((R() * 8) | 0), '#e8c060');
    this.textures.addCanvas('titleBg', c);
    this.add.image(0, 0, 'titleBg').setOrigin(0, 0);
    // flickering tower lights
    const lights: Phaser.GameObjects.Rectangle[] = [];
    for (const [lx, ly, col2] of [[160, 28, 0xe04848], [147, 100, 0x38e0e8], [173, 100, 0xb43cd8], [160, 70, 0x38e0e8]] as [number, number, number][]) lights.push(this.add.rectangle(lx, ly, 2, 2, col2));
    this.time.addEvent({ delay: 380, loop: true, callback: () => lights.forEach((l, i) => l.setVisible(Math.random() > (i === 0 ? 0.3 : 0.5))) });
    // logo
    const letters = 'BUGBYTE'.split('');
    const objs = letters.map((ch, i) => {
      const sh = this.add.bitmapText(38 + i * 24, 34, FONT_KEY, ch).setScale(4).setTint(0x2a1a58);
      const t = this.add.bitmapText(36 + i * 24, 32, FONT_KEY, ch).setScale(4).setTint(i < 3 ? 0xe8f0ff : 0x38e0e8);
      return { t, sh, ch };
    });
    this.add.bitmapText(120, 68, FONT_KEY, 'THE WORLD WAS NEVER SUPPOSED').setOrigin(0.5, 0).setTint(0x8a90d0).setX(120);
    this.add.bitmapText(120, 78, FONT_KEY, 'TO NOTICE ITS OWN MISTAKES.').setOrigin(0.5, 0).setTint(0x8a90d0).setX(120);
    this.time.addEvent({ delay: 2400, loop: true, callback: () => {
      const o = objs[(Math.random() * objs.length) | 0]; const orig = o.ch;
      const glyph = '#@%&?!0123456789'[(Math.random() * 16) | 0];
      o.t.setText(glyph).setTint(0xb43cd8); o.t.x += Phaser.Math.Between(-3, 3); Audio.sfx('glitch');
      this.time.delayedCall(140, () => { o.t.setText(orig).setTint(0xe8f0ff); o.t.x = o.sh.x - 2; });
    } });
    // rare: CHILD.ZERO behind the logo for one frame once the game has been beaten
    try {
      let beaten = false; for (let i = 1; i <= SLOTS; i++) { const d = readSlot(i); if (d?.flags['absolute_defeated']) beaten = true; }
      if (beaten) this.time.addEvent({ delay: 7000, loop: true, callback: () => { if (Math.random() < 0.3) { const z = this.add.rectangle(120, 40, 10, 24, 0xffffff).setDepth(5); this.time.delayedCall(16, () => z.destroy()); } } });
    } catch { /* ignore */ }
  }
  async run() {
    const ui = this.ui;
    const press = this.add.bitmapText(120, 128, FONT_KEY, 'PRESS START').setOrigin(0.5, 0).setTint(0xffffff);
    this.tweens.add({ targets: press, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.add.bitmapText(4, 150, FONT_KEY, 'v0.1 VERTICAL SLICE').setTint(0x4a4e78);
    await Input.wait(['a', 'start']); Audio.sfx('select'); press.destroy();
    for (;;) {
      const has = [1, 2, 3].some((n) => slotSummary(n));
      const items = ['CONTINUE', 'NEW GAME', 'LOAD GAME', 'OPTIONS', 'CREDITS'];
      const disabled = has ? [] : [0, 2];
      const i = await ui.choose(items, { x: 80, y: 88, w: 82, cancel: false, disabled, start: has ? 0 : 1 });
      if (i === 0) {
        let best = 0, bt = 0; for (let n = 1; n <= SLOTS; n++) { const d = readSlot(n); if (d && d.savedAt > bt) { bt = d.savedAt; best = n; } }
        if (best && loadSlot(best)) { this.start(false); return; }
      } else if (i === 1) {
        const slot = await this.pickSlot('NEW GAME - SLOT', true);
        if (slot) { deleteSlot(slot); G.s = newSave('JAX', { body: 'neutral', skin: 1, hair: 0, jacket: 0, bag: 0 }); G.slot = slot; G.sessionStart = Date.now(); this.start(true); return; }
      } else if (i === 2) {
        const slot = await this.pickSlot('LOAD GAME', false);
        if (slot && loadSlot(slot)) { this.start(false); return; }
      } else if (i === 3) { await openOptions(this, ui, false); }
      else if (i === 4) { this.scene.start('Credits', { from: 'Title' }); return; }
    }
  }
  async pickSlot(title: string, forNew: boolean): Promise<number> {
    const ui = this.ui; const L = ui.layer();
    ui.win(L, 10, 20, 220, 120);
    ui.text(L, 20, 28, title, '#3a68c8');
    const sums = [1, 2, 3].map((n) => slotSummary(n));
    const labels = sums.map((s, i) => s ? `SLOT ${i + 1}  ${s.name}  ${playtimeText(s.playtime)}  DEX ${s.dex}  KEYS ${s.keys}` : `SLOT ${i + 1}  - EMPTY -`);
    let idx = 0; const cur = L.add(this.add.image(16, 44, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    labels.forEach((l, i) => { ui.text(L, 26, 44 + i * 26, l.slice(0, 34), sums[i] ? INK : DIM); if (sums[i]) ui.text(L, 26, 54 + i * 26, `BYTEKIN ${sums[i]!.party}  MAP ${sums[i]!.map}`.slice(0, 34), DIM); });
    ui.text(L, 20, 124, 'A: SELECT   B: BACK', DIM);
    let res = 0;
    for (;;) {
      cur.setPosition(16, 44 + idx * 26);
      const b = await Input.wait(['up', 'down', 'a', 'b']);
      if (b === 'up') idx = (idx + 2) % 3; else if (b === 'down') idx = (idx + 1) % 3;
      else if (b === 'b') { Audio.sfx('back'); break; }
      else if (b === 'a') {
        if (!forNew && !sums[idx]) { Audio.sfx('error'); continue; }
        Audio.sfx('select');
        if (forNew && sums[idx]) { const L2 = ui.layer(); ui.win(L2, 40, 60, 160, 40); ui.text(L2, 50, 68, 'OVERWRITE THIS SAVE?', INK); const ok = await ui.choose(['NO', 'YES'], { x: 170, y: 70, w: 48 }); L2.destroy(); if (ok !== 1) continue; }
        res = idx + 1; break;
      }
    }
    L.destroy(); return res;
  }
  async start(isNew: boolean) {
    (window as any).__applyScale?.();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await wait(this, 320);
    Audio.stop();
    if (isNew) this.scene.start('Char'); else this.scene.start('World', { fromSave: true });
  }
}
void WHITE;
