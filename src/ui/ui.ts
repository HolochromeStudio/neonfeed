import Phaser from 'phaser';
import { FONT_KEY, wrap } from '../gfx/font';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, flagVal } from '../core/state';
import { SPECIES } from '../data';

export const INK = '#1a1830', DIM = '#8a90b0', WHITE = '#ffffff', BLUE = '#3a68c8', RED = '#d84040', GREEN = '#28a050', MAG = '#a02cc8', GOLD = '#c89818';
const num = (c: string) => parseInt(c.slice(1), 16);

let depthCounter = 2000;

const WIN_COLORS: Record<string, [string, string, string, string, string]> = {
  win: ['#1a1830', '#3c4a6e', '#8a96c0', '#f4f4f0', '#ffffff'],
  winDark: ['#1a1830', '#5a68a0', '#1e2444', '#1e2444', '#2a3260'],
  winGlitch: ['#1a1830', '#6a3c98', '#120c24', '#120c24', '#2a1a48'],
};
/** Renders a hard-edged pixel window of any size into a cached texture (renderer-agnostic, no nine-slice needed). */
export function windowTex(scene: Phaser.Scene, kind: string, w: number, h: number): string {
  const key = `win_${kind}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  const [ink, edge, inner, fill, hi] = WIN_COLORS[kind];
  g.fillStyle = ink; g.fillRect(0, 0, w, h);
  g.fillStyle = edge; g.fillRect(1, 1, w - 2, h - 2);
  g.fillStyle = kind === 'win' ? inner : edge; g.fillRect(2, 2, w - 4, h - 4);
  g.fillStyle = fill; g.fillRect(3, 3, w - 6, h - 6);
  g.fillStyle = hi; g.fillRect(3, 3, w - 6, 1);
  g.clearRect(0, 0, 1, 1); g.clearRect(w - 1, 0, 1, 1); g.clearRect(0, h - 1, 1, 1); g.clearRect(w - 1, h - 1, 1, 1);
  scene.textures.addCanvas(key, c);
  return key;
}

export class Layer {
  objs: Phaser.GameObjects.GameObject[] = [];
  depth: number;
  constructor(public scene: Phaser.Scene) { this.depth = (depthCounter += 10); }
  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as any).setScrollFactor?.(0); (o as any).setDepth?.(this.depth + this.objs.length * 0.001);
    this.objs.push(o); return o;
  }
  destroy() { for (const o of this.objs) o.destroy(); this.objs = []; }
  setVisible(v: boolean) { for (const o of this.objs) (o as any).setVisible?.(v); }
}

export function textSpeedCps() { return [0, 28, 55, 140][G.s.settings.textSpeed] * G.s.settings.gameSpeed; }
export function subst(t: string) {
  return t.replace(/\{p\}/g, G.s.name).replace(/\{starter\}/g, (SPECIES[G.s.starter]?.name ?? 'it').toUpperCase()).replace(/\{rival\}/g, (SPECIES[G.s.rivalStarter]?.name ?? 'its Bytekin').toUpperCase())
    .replace(/\{(\w+)\}/g, (_m, k) => String(flagVal(k) ?? 0));
}
export const wait = (scene: Phaser.Scene, ms: number) => new Promise<void>((res) => scene.time.delayedCall(Math.max(1, ms / G.s.settings.gameSpeed), res));

export class Ui {
  constructor(public scene: Phaser.Scene) {}
  layer() { return new Layer(this.scene); }

  win(L: Layer, x: number, y: number, w: number, h: number, kind: 'win' | 'winDark' | 'winGlitch' = 'win') {
    return L.add(this.scene.add.image(x, y, windowTex(this.scene, kind, w, h)).setOrigin(0, 0));
  }
  text(L: Layer, x: number, y: number, s: string, color = INK) {
    const t = this.scene.add.bitmapText(x, y, FONT_KEY, s).setOrigin(0, 0).setTint(num(color));
    return L.add(t);
  }
  textR(L: Layer, xr: number, y: number, s: string, color = INK) { const t = this.text(L, xr, y, s, color); t.x = xr - s.length * 6; return t; }
  textC(L: Layer, cx: number, y: number, s: string, color = INK) { const t = this.text(L, cx, y, s, color); t.x = Math.round(cx - (s.length * 6) / 2); return t; }
  img(L: Layer, x: number, y: number, key: string, frame?: string | number) { return L.add(this.scene.add.image(x, y, key, frame as any).setOrigin(0, 0)); }
  rect(L: Layer, x: number, y: number, w: number, h: number, color: string, alpha = 1) { return L.add(this.scene.add.rectangle(x, y, w, h, num(color), alpha).setOrigin(0, 0)); }

  /** Classic bottom dialogue box. Pages auto-split into two lines. Resolves when the player has read it all. */
  async say(text: string | string[], opts: { who?: string; noWait?: boolean; auto?: number; kind?: 'win' | 'winDark' | 'winGlitch' } = {}) {
    const raw = Array.isArray(text) ? text : [text];
    const lines: string[] = [];
    for (const r of raw) lines.push(...wrap(subst(r), 35));
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += 2) pages.push(lines.slice(i, i + 2));
    const L = this.layer();
    const dark = opts.kind && opts.kind !== 'win';
    this.win(L, 2, 110, 236, 48, opts.kind ?? 'win');
    const tc = dark ? WHITE : INK;
    const t1 = this.text(L, 12, 121, '', tc), t2 = this.text(L, 12, 134, '', tc);
    if (opts.who) { this.win(L, 8, 100, opts.who.length * 6 + 16, 16); this.text(L, 16, 105, opts.who, BLUE); }
    const more = L.add(this.scene.add.image(222, 148, 'more').setOrigin(0, 0).setTint(num(dark ? WHITE : INK)));
    more.setVisible(false);
    const blink = this.scene.time.addEvent({ delay: 280, loop: true, callback: () => { if (more.visible !== undefined && waiting) more.setVisible(!more.visible); } });
    let waiting = false;
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi];
      t1.setText(''); t2.setText(''); more.setVisible(false); waiting = false;
      const full = [pg[0] ?? '', pg[1] ?? ''];
      const total = full[0].length + full[1].length;
      let shown = 0; let skip = false; let acc = 0;
      Input.clearPressed();
      const cps = textSpeedCps();
      await new Promise<void>((res) => {
        const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
          if (Input.consumePressed('a') || Input.consumePressed('b')) skip = true;
          acc += (cps * 16) / 1000; const step = skip ? total : Math.floor(acc); acc -= Math.floor(acc);
          if (step > 0) {
            shown = Math.min(total, shown + step);
            t1.setText(full[0].slice(0, Math.min(shown, full[0].length))); t2.setText(full[1].slice(0, Math.max(0, shown - full[0].length)));
            if (shown % 3 === 0) Audio.sfx('text');
          }
          if (shown >= total) { ev.remove(); res(); }
        } });
      });
      const last = pi === pages.length - 1;
      if (opts.noWait && last) break;
      if (opts.auto && last) { await wait(this.scene, opts.auto); break; }
      waiting = true; more.setVisible(true);
      const b = await Input.wait(['a', 'b']);
      void b; Audio.sfx('select');
      waiting = false;
    }
    blink.remove();
    if (opts.noWait) return L;
    L.destroy();
    return null;
  }

  /** Vertical choice list. Returns chosen index or -1 when cancelled. */
  async choose(items: string[], o: { x?: number; y?: number; w?: number; cancel?: boolean; start?: number; disabled?: number[]; title?: string; align?: 'right' | 'left' } = {}): Promise<number> {
    const w = o.w ?? Math.max(...items.map((s) => s.length), (o.title ?? '').length) * 6 + 24;
    const h = items.length * 12 + 12 + (o.title ? 12 : 0);
    let x = o.x ?? 240 - w - 4; const y = o.y ?? 108 - h;
    if (o.align === 'left') x = o.x ?? 4;
    const L = this.layer();
    this.win(L, x, y, w, h);
    let oy = y + 7;
    if (o.title) { this.text(L, x + 12, oy, o.title, BLUE); oy += 12; }
    const cur = L.add(this.scene.add.image(x + 6, oy + 1, 'cursor').setOrigin(0, 0).setTint(num(INK)));
    const labels = items.map((s, i) => this.text(L, x + 14, oy + i * 12, s, o.disabled?.includes(i) ? DIM : INK));
    let idx = o.start ?? 0;
    const place = () => cur.setPosition(x + 6, oy + idx * 12 + 1);
    place();
    for (;;) {
      const b = await Input.wait(['up', 'down', 'a', 'b']);
      if (b === 'up') { idx = (idx + items.length - 1) % items.length; Audio.sfx('move'); place(); }
      else if (b === 'down') { idx = (idx + 1) % items.length; Audio.sfx('move'); place(); }
      else if (b === 'a') { if (o.disabled?.includes(idx)) { Audio.sfx('error'); continue; } Audio.sfx('select'); break; }
      else if (b === 'b' && o.cancel !== false) { Audio.sfx('back'); idx = -1; break; }
    }
    void labels; L.destroy();
    return idx;
  }
  async yesNo(): Promise<boolean> { return (await this.choose(['YES', 'NO'], { x: 190, y: 82, w: 48 })) === 0; }

  toastQueue: string[] = [];
  toastBusy = false;
  toast(text: string) {
    this.toastQueue.push(text); if (!this.toastBusy) this.pumpToast();
  }
  private async pumpToast() {
    this.toastBusy = true;
    while (this.toastQueue.length) {
      const t = this.toastQueue.shift()!;
      if (!this.scene.sys.isActive() && !this.scene.sys.isPaused()) { /* scene asleep: drop */ }
      const L = this.layer();
      const w = Math.min(232, t.length * 6 + 16);
      const b = this.win(L, 120 - w / 2, -20, w, 18, 'winDark');
      const tx = this.text(L, 120 - w / 2 + 8, -15, t, '#f0e070');
      this.scene.tweens.add({ targets: [b, tx], y: '+=26', duration: 200 });
      Audio.sfx('item');
      await new Promise<void>((r) => this.scene.time.delayedCall(1800, r));
      this.scene.tweens.add({ targets: [b, tx], y: '-=26', duration: 200 });
      await new Promise<void>((r) => this.scene.time.delayedCall(220, r));
      L.destroy();
    }
    this.toastBusy = false;
  }

  hpBar(L: Layer, x: number, y: number, w: number, frac: number, color?: string) {
    this.rect(L, x, y, w, 3, '#1a1830'); const c = color ?? (frac > 0.5 ? '#30c868' : frac > 0.2 ? '#f0c828' : '#e04848');
    return this.rect(L, x + 1, y, Math.max(0, Math.round((w - 2) * frac)), 3, c).setOrigin(0, 0);
  }
}

export function typeBadge(ui: Ui, L: Layer, x: number, y: number, type: string, colors: Record<string, string>) {
  const w = type.length * 6 + 4;
  ui.rect(L, x, y, w, 9, '#1a1830'); ui.rect(L, x + 1, y + 1, w - 2, 7, colors[type] ?? '#888');
  ui.text(L, x + 2, y + 1, type, '#ffffff');
  return w;
}
