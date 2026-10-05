import { STAMPS } from '../data';
import { TILE_INDEX, TILE_BY_INDEX } from '../gfx/tiles';
import { rng } from '../gfx/pen';
import { cond } from '../core/state';

export interface CompiledMap {
  w: number; h: number;
  g: Int16Array;   // ground tile index (always set)
  o: Int16Array;   // object tile index (-1 = none)
}
const idx = (name: string) => { const i = TILE_INDEX[name]; if (i === undefined) throw new Error(`Unknown tile "${name}"`); return i; };

export function compileMap(def: any): CompiledMap {
  const w = def.w, h = def.h;
  const g = new Int16Array(w * h).fill(idx(def.base ?? 'grass'));
  const o = new Int16Array(w * h).fill(-1);
  const put = (l: string, x: number, y: number, t: string | null) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const arr = l === 'g' ? g : o;
    arr[y * w + x] = t === null ? -1 : idx(t);
  };
  const lay = (op: any) => op.l ?? 'o';
  for (const op of def.ops ?? []) {
    if (op.when !== undefined && !cond(op.when)) continue;
    switch (op.op) {
      case 'fill': for (let y = op.y; y < op.y + op.h; y++) for (let x = op.x; x < op.x + op.w; x++) put(lay(op), x, y, op.t); break;
      case 'set': for (const [x, y] of op.pts) put(lay(op), x, y, op.t); break;
      case 'clear': for (let y = op.y; y < op.y + op.h; y++) for (let x = op.x; x < op.x + op.w; x++) put(op.l ?? 'o', x, y, null); break;
      case 'stamp': {
        const s = STAMPS[op.name]; if (!s) throw new Error('Unknown stamp ' + op.name);
        s.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const key = row[i]; if (key === '.') continue; const ref = s.legend[key]; if (!ref) continue; const [l, t] = ref.split(':'); put(l, op.x + i, op.y + j, t); } });
        break;
      }
      case 'rows': {
        op.rows.forEach((row: string, j: number) => { for (let i = 0; i < row.length; i++) { const key = row[i]; if (key === '.' || key === ' ') continue; const t = op.legend[key]; if (!t) throw new Error(`rows: no legend for '${key}' in ${def.id}`); put(lay(op), op.x + i, op.y + j, t); } });
        break;
      }
      case 'border': {
        const gaps = new Set((op.gaps ?? []).map((p: number[]) => p[0] + ',' + p[1]));
        const th = op.thick ?? 1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < th || y < th || x >= w - th || y >= h - th) { if (!gaps.has(x + ',' + y)) put(lay(op), x, y, op.t); }
        break;
      }
      case 'scatter': {
        const R = rng(op.seed ?? 1); const [rx, ry, rw, rh] = op.rect; let placed = 0, tries = 0;
        const only = (op.onlyOn ?? ['grass', 'grass2', 'grass3']).map(idx);
        const keep: number[][] = op.keep ?? [];
        while (placed < op.count && tries++ < op.count * 40) {
          const x = rx + ((R() * rw) | 0), y = ry + ((R() * rh) | 0);
          if (o[y * w + x] !== -1 || !only.includes(g[y * w + x])) continue;
          if (keep.some((k) => x >= k[0] && y >= k[1] && x < k[0] + k[2] && y < k[1] + k[3])) continue;
          put(lay(op), x, y, op.t); placed++;
        }
        break;
      }
      case 'patch': { // organic blotches of a ground tile
        const R = rng(op.seed ?? 1); const [rx, ry, rw, rh] = op.rect;
        for (let k = 0; k < (op.blobs ?? 3); k++) {
          const cx = rx + R() * rw, cy = ry + R() * rh, r = (op.r ?? 3) * (0.7 + R() * 0.6);
          for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            if (x < rx || y < ry || x >= rx + rw || y >= ry + rh) continue;
            if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r && (R() < 0.9)) { if (!op.onlyOn || op.onlyOn.map(idx).includes(g[y * w + x])) put('g', x, y, op.t); }
          }
        }
        break;
      }
      case 'speckle': { // sprinkle decorative ground tiles
        const R = rng(op.seed ?? 1); const [rx, ry, rw, rh] = op.rect; const only = (op.onlyOn ?? ['grass']).map(idx);
        for (let i = 0; i < op.count; i++) { const x = rx + ((R() * rw) | 0), y = ry + ((R() * rh) | 0); if (only.includes(g[y * w + x]) && o[y * w + x] === -1) put('g', x, y, op.t); }
        break;
      }
      default: throw new Error('Unknown map op ' + op.op);
    }
  }
  return { w, h, g, o };
}

export const tileDef = (i: number) => (i < 0 ? undefined : TILE_BY_INDEX[i]);
export const isSolidAt = (m: CompiledMap, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  const gd = tileDef(m.g[y * m.w + x]), od = tileDef(m.o[y * m.w + x]);
  return !!(gd?.solid || od?.solid);
};
