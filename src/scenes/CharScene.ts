import Phaser from 'phaser';
import { Ui, INK, DIM, BLUE, wait } from '../ui/ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G } from '../core/state';
import { ensurePlayerSheet } from '../gfx/textures';
import { SKINS, HAIRS, JACKETS, BAGS } from '../gfx/chars';
import { FONT_KEY } from '../gfx/font';

const BODIES: ['masc' | 'fem' | 'neutral', string][] = [['masc', 'MASCULINE'], ['fem', 'FEMININE'], ['neutral', 'NEUTRAL']];

export class CharScene extends Phaser.Scene {
  ui!: Ui;
  constructor() { super('Char'); }
  create() {
    this.ui = new Ui(this);
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(200);
    void this.run();
  }
  async bootText() {
    const lines = ['SYSTEM CHECK...', 'REGION NODE: VELORA', 'SIGNAL STATUS: STABLE', 'PACKET LOSS: 0.003%', 'UNKNOWN PROCESS DETECTED', '...', 'IGNORE?'];
    const t = this.add.bitmapText(14, 14, FONT_KEY, '').setTint(0x30e078);
    let s = '';
    for (const l of lines) {
      for (const ch of l) { s += ch; t.setText(s + '_'); await wait(this, 28); }
      s += '\n'; t.setText(s + '_'); await wait(this, l === '...' ? 700 : 260);
    }
    const yes = this.add.bitmapText(14, 14 + lines.length * 8 + 6, FONT_KEY, '> YES').setTint(0xffffff);
    await Input.wait(['a', 'start']); Audio.sfx('select');
    t.setText(s + '\nYES'); yes.destroy();
    Audio.sfx('glitch'); this.cameras.main.shake(260, 0.01);
    await wait(this, 500);
    t.destroy();
  }
  async run() {
    await this.bootText();
    const ui = this.ui;
    const look = { body: 'neutral' as 'masc' | 'fem' | 'neutral', skin: 1, hair: 0, jacket: 0, bag: 0 };
    ensurePlayerSheet(this, look);
    const L = ui.layer();
    this.cameras.main.setBackgroundColor('#2a3a78');
    this.add.rectangle(0, 0, 240, 160, 0x2a3a78).setOrigin(0, 0).setDepth(0);
    for (let i = 0; i < 16; i++) this.add.rectangle(0, i * 10, 240, 5, 0x34469a).setOrigin(0, 0).setDepth(0);
    ui.win(L, 8, 8, 224, 20); ui.text(L, 20, 14, 'WHO ARE YOU? (LEFT/RIGHT TO CHANGE)', BLUE);
    ui.win(L, 8, 32, 80, 120);
    const sprite = this.add.image(48, 100, 'char_player', 0).setScale(3).setDepth(5000);
    const opts: { label: string; get: () => string; step: (d: number) => void }[] = [
      { label: 'BODY', get: () => BODIES.find((b) => b[0] === look.body)![1], step: (d) => { const i = BODIES.findIndex((b) => b[0] === look.body); look.body = BODIES[(i + d + 3) % 3][0]; } },
      { label: 'SKIN', get: () => `TONE ${look.skin + 1}`, step: (d) => { look.skin = (look.skin + d + SKINS.length) % SKINS.length; } },
      { label: 'HAIR', get: () => `COLOR ${look.hair + 1}`, step: (d) => { look.hair = (look.hair + d + HAIRS.length) % HAIRS.length; } },
      { label: 'JACKET', get: () => `COLOR ${look.jacket + 1}`, step: (d) => { look.jacket = (look.jacket + d + JACKETS.length) % JACKETS.length; } },
      { label: 'BAG', get: () => `COLOR ${look.bag + 1}`, step: (d) => { look.bag = (look.bag + d + BAGS.length) % BAGS.length; } },
      { label: 'DONE', get: () => '', step: () => {} },
    ];
    const rows = opts.map((o, i) => ({ a: ui.text(L, 100, 40 + i * 20, o.label, INK), b: ui.text(L, 100, 50 + i * 20, '', DIM) }));
    ui.win(L, 92, 32, 140, 120);
    // re-add text above window (window drawn after text above)
    rows.forEach((r, i) => { r.a.destroy(); r.b.destroy(); rows[i] = { a: ui.text(L, 106, 42 + i * 18, opts[i].label, INK), b: ui.text(L, 160, 42 + i * 18, '', BLUE) }; });
    let idx = 0; const cur = L.add(this.add.image(98, 42, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    const refresh = () => {
      ensurePlayerSheet(this, look); sprite.setTexture('char_player', 0);
      opts.forEach((o, i) => rows[i].b.setText(o.get()));
      cur.setPosition(98, 42 + idx * 18);
    };
    this.add.rectangle(48, 120, 28, 4, 0x000000, 0.3).setDepth(4999);
    refresh();
    for (;;) {
      const b = await Input.wait(['up', 'down', 'left', 'right', 'a']);
      if (b === 'up') idx = (idx + opts.length - 1) % opts.length; else if (b === 'down') idx = (idx + 1) % opts.length;
      else if (b === 'left') opts[idx].step(-1); else if (b === 'right') opts[idx].step(1);
      else if (b === 'a') { if (idx === opts.length - 1) break; opts[idx].step(1); }
      Audio.sfx('move'); refresh();
    }
    Audio.sfx('select');
    L.destroy(); sprite.destroy();
    const name = await this.nameEntry('JAX');
    G.s.look = look; G.s.name = name;
    const L2 = ui.layer(); ui.win(L2, 2, 110, 236, 48);
    L2.destroy();
    await ui.say(`So your name is ${name}. Welcome to Rivermoor, in the Velora Region.`, {});
    this.cameras.main.fadeOut(400, 0, 0, 0);
    await wait(this, 450);
    this.scene.start('World', { fromSave: false });
  }
  /** On-screen keyboard (touch friendly) + hardware typing. */
  async nameEntry(def: string): Promise<string> {
    const ui = this.ui; const L = ui.layer();
    ui.win(L, 8, 8, 224, 144); ui.text(L, 20, 16, 'ENTER YOUR NAME', BLUE);
    let name = def; const MAX = 8;
    const nameTxt = ui.text(L, 20, 30, '', INK);
    const cursorBlink = this.time.addEvent({ delay: 400, loop: true, callback: () => nameTxt.setText(name + ((cursorBlink.getOverallProgress as any, Date.now() % 800 < 400) ? '_' : ' ')) });
    const rowsU = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789-.!?'];
    const rowsL = ['abcdefghij', 'klmnopqrst', 'uvwxyz0123', '456789-.!?'];
    let lower = false;
    const grid: { c: string; t: Phaser.GameObjects.BitmapText }[][] = [];
    const specials = ['aA', 'DEL', 'OK'];
    for (let r = 0; r < 4; r++) { grid[r] = []; for (let c = 0; c < 10; c++) grid[r][c] = { c: rowsU[r][c], t: ui.text(L, 24 + c * 20, 52 + r * 18, rowsU[r][c], INK) }; }
    const spT = specials.map((s, i) => ui.text(L, 24 + i * 56, 52 + 4 * 18 + 4, s, INK));
    let r = 0, c = 0;
    const cur = L.add(this.add.image(0, 0, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    const setCase = () => grid.forEach((row, ri) => row.forEach((cell, ci) => { cell.c = (lower ? rowsL : rowsU)[ri][ci]; cell.t.setText(cell.c); }));
    const place = () => { if (r < 4) cur.setPosition(16 + c * 20, 52 + r * 18); else cur.setPosition(16 + Math.min(c, 2) * 56, 52 + 4 * 18 + 4); };
    place();
    Input.typing = true;
    let done = false; const hw = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { if (name.length) { done = true; Input.press('start'); Input.release('start'); } return; }
      if (e.key === 'Backspace') { name = name.slice(0, -1); Audio.sfx('back'); return; }
      if (e.key.length === 1 && /[A-Za-z0-9\-.!? ]/.test(e.key) && name.length < MAX) { name += e.key; Audio.sfx('move'); }
    };
    window.addEventListener('keydown', hw);
    nameTxt.setText(name + '_');
    while (!done) {
      const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b', 'start']);
      if (b === 'start') { if (done) break; continue; }
      if (b === 'up') r = (r + 4) % 5; else if (b === 'down') r = (r + 1) % 5;
      else if (b === 'left') c = (c + (r === 4 ? 2 : 9)) % (r === 4 ? 3 : 10); else if (b === 'right') c = (c + 1) % (r === 4 ? 3 : 10);
      else if (b === 'b') { name = name.slice(0, -1); Audio.sfx('back'); }
      else if (b === 'a') {
        if (r < 4) { if (name.length < MAX) { name += grid[r][c].c; Audio.sfx('move'); } }
        else if (c === 0) { lower = !lower; setCase(); Audio.sfx('select'); }
        else if (c === 1) { name = name.slice(0, -1); Audio.sfx('back'); }
        else if (name.length) { Audio.sfx('select'); break; }
      }
      if (r === 4 && c > 2) c = 2;
      place(); nameTxt.setText(name + '_');
    }
    Input.typing = false; window.removeEventListener('keydown', hw); cursorBlink.remove(); void spT; void DIM;
    L.destroy();
    return name.trim() || def;
  }
}
