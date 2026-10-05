// Tiny pixel pen over a 2D canvas context. All art in BUGBYTE is drawn with this - no ripped assets.
export class Pen {
  constructor(public ctx: CanvasRenderingContext2D, public ox = 0, public oy = 0) {}
  r(x: number, y: number, w: number, h: number, c: string) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
  }
  p(x: number, y: number, c: string) { this.r(x, y, 1, 1, c); }
  clear(x: number, y: number, w: number, h: number) { this.ctx.clearRect(this.ox + x, this.oy + y, w, h); }
  /** rows of chars mapped through a palette; '.' or ' ' is transparent */
  art(x: number, y: number, rows: string[], pal: Record<string, string>) {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) this.p(x + i, y + j, c); } });
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx + 0.25) + (y * y) / (ry * ry + 0.25) <= 1) this.p(Math.round(cx + x), Math.round(cy + y), c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.p(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: string) {
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2), minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    const s = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (px - bx) * (ay - by) - (ax - bx) * (py - by);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const d1 = s(x0, y0, x1, y1, x, y), d2 = s(x1, y1, x2, y2, x, y), d3 = s(x2, y2, x0, y0, x, y);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) this.p(x, y, c);
    }
  }
}

export function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export function ctx2d(c: HTMLCanvasElement) {
  const x = c.getContext('2d', { willReadFrequently: true })!; x.imageSmoothingEnabled = false; return x;
}

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function shade(h: string, f: number) {
  const [r, g, b] = hexToRgb(h);
  return f >= 0 ? rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// deterministic rng
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const PAL = {
  ink: '#1a1830', steel: '#3c4a6e', steelLo: '#262c48', win: '#f4f4f0', shade: '#b8b8c8', blue: '#3a68c8',
  magenta: '#b43cd8', cyan: '#38e0e8', green: '#30c868', yellow: '#f0c828', red: '#e04848', orange: '#e88838',
};
