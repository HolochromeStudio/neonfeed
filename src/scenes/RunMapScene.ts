import { paintHangingSign, paintWoodWall } from '../ui/backdrops';
import { CoinCounter } from '../ui/CoinCounter';
import { rect } from '../ui/draw';
import { HeartPips } from '../ui/HeartPips';
import { clipChars, pairSlots, stackFromBottom } from '../ui/layout';
import { ParchmentPanel } from '../ui/ParchmentPanel';
import { PlankButton } from '../ui/PlankButton';
import { lineWidth } from '../ui/pixelFont';
import { pixelText } from '../ui/PixelText';
import type { UiSceneOptions } from '../ui/types';
import { C } from '../ui/UiTheme';
import { UiScene } from '../ui/UiScene';
import { SCENE_KEYS } from './sceneKeys';

export const RUN_MAP_SCENE_KEY = SCENE_KEYS.map;

/** Node types as RunSystem reports them, or 'unknown' beyond the lookahead. */
export type MapNodeKind = 'duel' | 'elite' | 'shop' | 'event' | 'rest' | 'treasure' | 'boss' | 'unknown';

export interface RunMapNodeVM {
  id: string;
  type: MapNodeKind;
  /** Lane inside the layer (0..n-1) and the number of lanes of that layer (for the x position). */
  lane: number;
  lanes: number;
  next: string[];
  state: 'done' | 'choice' | 'future';
  /** The node the player walked through on this layer (highlighted path). */
  visited?: boolean;
}

export interface RunMapChoiceVM {
  id: string;
  type: MapNodeKind;
  /** Plank label, e.g. "DUEL: BANDIT". */
  label: string;
}

export interface RunMapData extends UiSceneOptions {
  /** "DUST CREEK 3/7". */
  progressLabel: string;
  hp: number;
  maxHp: number;
  coins: number;
  perkCount: number;
  /** The current region's layers, first duel (bottom of the screen) first. */
  rows: RunMapNodeVM[][];
  choices: RunMapChoiceVM[];
  onChoose?: (id: string) => void;
  onPerks?: () => void;
  onMenu?: () => void;
}

/** Shape-unique glyph per node type (never colour alone): letter in a box, elite/boss framed. */
export const NODE_GLYPH: Record<MapNodeKind, string> = {
  duel: 'D', elite: '!', shop: '$', event: '?', rest: 'Z', treasure: 'T', boss: 'B', unknown: '.',
};
const NODE_FILL: Record<MapNodeKind, number> = {
  duel: C.sandDark, elite: C.red, shop: C.brassDark, event: C.midnightLight, rest: C.cactus, treasure: C.brass, boss: C.redDark, unknown: C.parchmentBurn,
};
export const NODE_NAME: Record<MapNodeKind, string> = {
  duel: 'DUEL', elite: 'ELITE', shop: 'SHOP', event: 'EVENT', rest: 'REST', treasure: 'TREASURE', boss: 'BOSS', unknown: '?',
};

const PANEL_W = 336;
const NODE = 26;

export class RunMapScene extends UiScene {
  private params!: RunMapData;
  private locked = false;

  constructor() {
    super(RUN_MAP_SCENE_KEY);
  }

  init(data?: RunMapData): void {
    this.params = data ?? { progressLabel: '', hp: 0, maxHp: 0, coins: 0, perkCount: 0, rows: [], choices: [] };
    this.locked = false;
    this.setupUi(this.params);
  }

  create(): void {
    const p = this.params;
    paintWoodWall(this, 14, 0, 640, 0);
    const sy = this.safe.y + 4;
    paintHangingSign(this, 24, sy, 312, 52, 8);
    pixelText(this, 180, sy + 24, p.progressLabel, { scale: lineWidth(p.progressLabel, 3) > 288 ? 2 : 3, color: C.brassLight, originX: 0.5, originY: 0.5, maxWidth: 288, maxLines: 1 }).setDepth(9);

    const rowY = sy + 52 + 10;
    new HeartPips(this, { x: this.safe.x, y: rowY + 6, max: p.maxHp, current: p.hp }).gfx.setDepth(10);
    new CoinCounter(this, { x: 360 - this.safe.x, y: rowY, value: p.coins, anchor: 'right', reduceMotion: this.reduceMotion }).container.setDepth(10);

    // bottom stack first: choices, then [PERKS | MENU]
    const n = Math.min(3, p.choices.length);
    const heights = [...Array(n).fill(48), 48] as number[];
    const tops = stackFromBottom(this.safe, heights, 8);
    const mapTop = rowY + CoinCounter.H + 8;
    const mapBottom = (tops[0] ?? this.safe.y + this.safe.h) - 10;
    this.drawMap(mapTop, mapBottom);

    p.choices.slice(0, 3).forEach((c, i) => {
      new PlankButton(this, {
        x: Math.round((360 - 280) / 2), y: tops[i]!, w: 280, h: 48, label: clipChars(c.label, 24), variant: c.type === 'boss' || c.type === 'elite' ? 'danger' : i === 0 ? 'primary' : 'secondary',
        name: `go:${c.id}`, labelScale: 2,
        onTap: () => {
          if (this.locked) return;
          this.locked = true;
          p.onChoose?.(c.id);
        },
      }).setDepth(20);
    });
    const [a, b] = pairSlots(this.safe.x, this.safe.w, 8, this.leftHanded);
    const rowTop = tops[tops.length - 1]!;
    new PlankButton(this, { x: a.x, y: rowTop, w: a.w, h: 48, label: `PERKS ${p.perkCount}`, name: 'perks', onTap: () => p.onPerks?.() }).setDepth(20);
    new PlankButton(this, { x: b.x, y: rowTop, w: b.w, h: 48, label: 'MENU', name: 'menu', onTap: () => p.onMenu?.() }).setDepth(20);
  }

  /** Parchment route: first layer at the bottom, boss at the top, lines for every `next` link. */
  private drawMap(top: number, bottom: number): void {
    const rows = this.params.rows;
    const h = Math.max(96, bottom - top);
    const x0 = this.safe.x + Math.round((this.safe.w - PANEL_W) / 2);
    new ParchmentPanel(this, { x: x0, y: top, w: PANEL_W, h, seed: 23, depth: 10 });
    if (rows.length === 0) return;
    const padY = 22;
    const step = rows.length > 1 ? Math.min(46, (h - padY * 2 - NODE) / (rows.length - 1)) : 0;
    const innerH = step * (rows.length - 1) + NODE;
    const y0 = top + Math.round((h - innerH) / 2);
    const cx = (r: RunMapNodeVM): number => {
      const span = 190;
      return Math.round(180 + (r.lanes <= 1 ? 0 : (r.lane / (r.lanes - 1) - 0.5) * span));
    };
    const cy = (li: number): number => Math.round(y0 + (rows.length - 1 - li) * step + NODE / 2);
    const pos = new Map<string, { x: number; y: number }>();
    rows.forEach((row, li) => row.forEach((r) => pos.set(r.id, { x: cx(r), y: cy(li) })));

    const lines = this.add.graphics().setDepth(11);
    rows.forEach((row) => row.forEach((r) => {
      const from = pos.get(r.id)!;
      for (const nid of r.next) {
        const to = pos.get(nid);
        if (!to) continue; // links that leave the region
        const walked = r.visited === true && rows.some((rr) => rr.some((q) => q.id === nid && q.visited === true));
        lines.lineStyle(walked ? 4 : 2, walked ? C.redDark : C.parchmentBurn, 1);
        lines.lineBetween(from.x, from.y, to.x, to.y);
      }
    }));

    rows.forEach((row) => row.forEach((r) => this.drawNode(r, pos.get(r.id)!)));
  }

  private drawNode(r: RunMapNodeVM, at: { x: number; y: number }): void {
    const g = this.add.graphics().setDepth(12);
    if (r.type === 'unknown') {
      // beyond the lookahead: a small muted pip, so the choices stand out
      rect(g, C.parchmentBurn, at.x - 4, at.y - 4, 8, 8);
      return;
    }
    const x = at.x - NODE / 2;
    const y = at.y - NODE / 2;
    const choice = r.state === 'choice';
    const dim = r.state === 'done' && r.visited !== true;
    if (choice) rect(g, C.brassLight, x - 4, y - 4, NODE + 8, NODE + 8);
    rect(g, C.ink, x - 2, y - 2, NODE + 4, NODE + 4);
    rect(g, NODE_FILL[r.type], x, y, NODE, NODE);
    if (r.type === 'boss' || r.type === 'elite') {
      rect(g, C.brassLight, x + 2, y + 2, NODE - 4, 2);
      rect(g, C.brassLight, x + 2, y + NODE - 4, NODE - 4, 2);
    }
    if (dim) g.setAlpha(0.45);
    const t = pixelText(this, at.x, at.y, NODE_GLYPH[r.type], { scale: 2, color: r.type === 'treasure' ? C.ink : C.cream, originX: 0.5, originY: 0.5, shadow: r.type === 'treasure' ? null : C.ink }).setDepth(13);
    if (dim) t.setAlpha(0.45);
    if (r.visited) {
      // a check tick under the glyph box marks the walked node
      rect(g, C.redDark, x + 2, y + NODE + 2, NODE - 4, 2);
    }
  }
}
