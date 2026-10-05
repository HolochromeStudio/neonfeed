import Phaser from 'phaser';
import { mkCanvas, ctx2d } from './pen';

// Classic 5x7 column-major pixel font (ASCII 0x20-0x7E). 6x8 cell, 40 columns on a 240px screen.
const RAW = `00 00 00 00 00|00 00 5F 00 00|00 07 00 07 00|14 7F 14 7F 14|24 2A 7F 2A 12|23 13 08 64 62|36 49 55 22 50|00 05 03 00 00|00 1C 22 41 00|00 41 22 1C 00|14 08 3E 08 14|08 08 3E 08 08|00 50 30 00 00|08 08 08 08 08|00 60 60 00 00|20 10 08 04 02|
3E 51 49 45 3E|00 42 7F 40 00|42 61 51 49 46|21 41 45 4B 31|18 14 12 7F 10|27 45 45 45 39|3C 4A 49 49 30|01 71 09 05 03|36 49 49 49 36|06 49 49 29 1E|00 36 36 00 00|00 56 36 00 00|08 14 22 41 00|14 14 14 14 14|00 41 22 14 08|02 01 51 09 06|
32 49 79 41 3E|7E 11 11 11 7E|7F 49 49 49 36|3E 41 41 41 22|7F 41 41 22 1C|7F 49 49 49 41|7F 09 09 09 01|3E 41 49 49 7A|7F 08 08 08 7F|00 41 7F 41 00|20 40 41 3F 01|7F 08 14 22 41|7F 40 40 40 40|7F 02 0C 02 7F|7F 04 08 10 7F|3E 41 41 41 3E|
7F 09 09 09 06|3E 41 51 21 5E|7F 09 19 29 46|46 49 49 49 31|01 01 7F 01 01|3F 40 40 40 3F|1F 20 40 20 1F|3F 40 38 40 3F|63 14 08 14 63|07 08 70 08 07|61 51 49 45 43|00 7F 41 41 00|02 04 08 10 20|00 41 41 7F 00|04 02 01 02 04|40 40 40 40 40|
00 01 02 04 00|20 54 54 54 78|7F 48 44 44 38|38 44 44 44 20|38 44 44 48 7F|38 54 54 54 18|08 7E 09 01 02|0C 52 52 52 3E|7F 08 04 04 78|00 44 7D 40 00|20 40 44 3D 00|7F 10 28 44 00|00 41 7F 40 00|7C 04 18 04 78|7C 08 04 04 78|38 44 44 44 38|
7C 14 14 14 08|08 14 14 18 7C|7C 08 04 04 08|48 54 54 54 20|04 3F 44 40 20|3C 40 40 20 7C|1C 20 40 20 1C|3C 40 30 40 3C|44 28 10 28 44|0C 50 50 50 3C|44 64 54 4C 44|00 08 36 41 00|00 00 7F 00 00|00 41 36 08 00|10 08 08 10 08`;

export const FONT_KEY = 'px';
export const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
export const CELL_W = 6;
export const CELL_H = 8;

export function buildFontCanvas(): HTMLCanvasElement {
  const glyphs = RAW.replace(/\n/g, '|').split('|').map((s) => s.trim()).filter((s) => s.length).map((s) => s.split(/\s+/).map((h) => parseInt(h, 16)));
  const cols = 16;
  const c = mkCanvas(cols * CELL_W, Math.ceil(glyphs.length / cols) * CELL_H);
  const g = ctx2d(c);
  g.fillStyle = '#fff';
  glyphs.forEach((cols5, gi) => {
    const ox = (gi % cols) * CELL_W, oy = Math.floor(gi / cols) * CELL_H;
    cols5.forEach((bits, x) => { for (let y = 0; y < 7; y++) if (bits & (1 << y)) g.fillRect(ox + x, oy + y, 1, 1); });
  });
  return c;
}

let baseCanvas: HTMLCanvasElement | null = null;
const colorFonts = new Set<string>();

/** Creates (once) a pre-coloured copy of the font and returns its bitmap-font key. Works in every renderer (no GPU tint needed). */
export function colorFontKey(scene: Phaser.Scene, color: number): string {
  if (color === 0xffffff || !baseCanvas) return FONT_KEY;
  const hex = color.toString(16).padStart(6, '0');
  const key = `${FONT_KEY}_${hex}`;
  if (colorFonts.has(key) && scene.cache.bitmapFont.exists(key)) return key;
  const c = mkCanvas(baseCanvas.width, baseCanvas.height); const g = ctx2d(c);
  g.drawImage(baseCanvas, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#' + hex; g.fillRect(0, 0, c.width, c.height);
  const tk = `fontTex_${hex}`;
  if (!scene.textures.exists(tk)) scene.textures.addCanvas(tk, c);
  const config: any = { image: tk, width: CELL_W, height: CELL_H, chars: CHARS, charsPerRow: 16, lineSpacing: 0 };
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, config) as any;
  scene.cache.bitmapFont.add(key, entry); colorFonts.add(key);
  return key;
}

export function registerFont(scene: Phaser.Scene) {
  baseCanvas = scene.textures.get('fontTex').getSourceImage() as HTMLCanvasElement;
  const proto: any = Phaser.GameObjects.BitmapText.prototype;
  if (!proto.__tintPatched) {
    proto.__tintPatched = true;
    proto.setTint = function (color: number) { this.setFont(colorFontKey(this.scene, color)); return this; };
    proto.clearTint = function () { this.setFont(FONT_KEY); return this; };
  }
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;
  const config: Phaser.Types.GameObjects.BitmapText.RetroFontConfig = {
    image: 'fontTex', width: CELL_W, height: CELL_H, chars: CHARS, charsPerRow: 16,
    spacing: { x: 0, y: 0 }, lineSpacing: 0, offset: { x: 0, y: 0 },
  } as any;
  (config as any)['offset.x'] = 0; (config as any)['offset.y'] = 0;
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, config) as any;
  scene.cache.bitmapFont.add(FONT_KEY, entry);
}

/** Word-wrap text to a character width. Honors explicit \n. */
export function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if (!line.length) line = w;
      else if ((line + ' ' + w).length <= cols) line += ' ' + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
