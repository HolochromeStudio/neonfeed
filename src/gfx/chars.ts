import { Pen, mkCanvas, ctx2d, shade } from './pen';

export interface Look {
  skin: string; hair: string; jacket: string; pants?: string; bag?: string | null;
  style: 'cap' | 'short' | 'long' | 'beanie' | 'bald' | 'bun' | 'hat'; hat?: string;
  accent?: string; // trim / scarf / badge color
  small?: boolean;  // kids
  old?: boolean;    // grey + stoop
}
export const FW = 16, FH = 20;
export const SKINS = ['#f8d0a8', '#e8b080', '#c88858', '#8a5a38', '#5a3a28'];
export const HAIRS = ['#2a2018', '#6a4426', '#c89040', '#d84a3a', '#3a68c8', '#e8e8f0'];
export const JACKETS = ['#d84a3a', '#3a68c8', '#30a860', '#e8b028', '#8a4ac8', '#58586a'];
export const BAGS = ['#e8b028', '#3a68c8', '#d84a3a', '#30a860', '#58586a', '#e8e8f0'];

type Dir = 'down' | 'up' | 'left';

function drawFrame(p: Pen, L: Look, dir: Dir, step: number) {
  const hi = (c: string) => shade(c, 0.2), lo = (c: string) => shade(c, -0.3);
  const outline = '#1a1830';
  const bob = step === 1 || step === 2 ? 0 : 0;
  const top = L.small ? 3 : 0; // kids are shorter
  const pants = L.pants ?? '#3a4a78';
  const oy = top;
  // shadow
  p.r(4, 18, 8, 2, 'rgba(0,0,0,0.25)');
  // legs
  const legA = step === 1 ? -1 : 0, legB = step === 2 ? -1 : 0;
  if (dir === 'left') {
    p.r(6, 16 + legA, 3, 3 - legA, pants); p.r(8, 16 + legB, 3, 3 - legB, lo(pants));
    p.r(5, 18 + legA, 4, 1, outline); p.r(8, 18 + legB, 4, 1, outline);
  } else {
    p.r(5, 16, 3, 3 + legA, pants); p.r(8, 16, 3, 3 + legB, pants);
    p.r(5, 18 + legA, 3, 1, outline); p.r(8, 18 + legB, 3, 1, outline);
    p.r(5, 17 + legA, 3, 1, '#222'); p.r(8, 17 + legB, 3, 1, '#222');
  }
  // torso
  const bodyY = 10 + oy + bob;
  const bh = 7 - oy;
  if (dir === 'left') {
    p.r(5, bodyY, 6, bh, L.jacket); p.r(5, bodyY, 6, 1, hi(L.jacket)); p.r(5, bodyY + bh - 1, 6, 1, lo(L.jacket));
    const sw = step === 1 ? 1 : step === 2 ? -1 : 0;
    p.r(6 + sw, bodyY + 1, 3, 4, lo(L.jacket)); p.r(6 + sw, bodyY + 4, 3, 1, L.skin);
    if (L.bag) { p.r(10, bodyY, 3, 5, L.bag); p.r(10, bodyY, 3, 1, hi(L.bag)); }
  } else {
    p.r(4, bodyY, 8, bh, L.jacket); p.r(4, bodyY, 8, 1, hi(L.jacket)); p.r(4, bodyY + bh - 1, 8, 1, lo(L.jacket));
    const a = step === 1 ? 1 : 0, b = step === 2 ? 1 : 0;
    p.r(3, bodyY + 1 + a, 1, 4, lo(L.jacket)); p.r(3, bodyY + 4 + a, 1, 1, L.skin);
    p.r(12, bodyY + 1 + b, 1, 4, lo(L.jacket)); p.r(12, bodyY + 4 + b, 1, 1, L.skin);
    if (dir === 'down') {
      if (L.accent) p.r(7, bodyY, 2, 3, L.accent);
      if (L.bag) { p.r(4, bodyY, 1, 5, L.bag); p.r(11, bodyY + 4, 1, 1, L.bag); }
    } else if (L.bag) { p.r(4, bodyY, 8, 6 - oy, L.bag); p.r(4, bodyY, 8, 1, hi(L.bag)); p.r(5, bodyY + 3, 6, 1, lo(L.bag)); }
  }
  // head
  const hy = 1 + oy;
  const hair = L.old ? '#d8d8e4' : L.hair;
  if (dir === 'left') {
    p.r(4, hy, 8, 9, L.skin); p.r(4, hy, 8, 1, hi(L.skin));
    p.r(5, hy + 5, 1, 2, '#1a1830'); // eye
    p.p(4, hy + 6, lo(L.skin)); // nose
    p.r(9, hy + 7, 3, 1, lo(L.skin));
    hairSide(p, L, hair, hy);
  } else if (dir === 'down') {
    p.r(3, hy, 10, 9, L.skin); p.r(3, hy, 10, 1, hi(L.skin));
    p.r(5, hy + 5, 2, 2, '#fff'); p.r(9, hy + 5, 2, 2, '#fff'); p.r(5, hy + 5, 1, 2, '#1a1830'); p.r(9, hy + 5, 1, 2, '#1a1830');
    p.r(6, hy + 7, 4, 1, lo(L.skin));
    hairFront(p, L, hair, hy);
  } else {
    p.r(3, hy, 10, 9, L.skin);
    hairBack(p, L, hair, hy);
  }
  // outline: darken edges of head
  p.r(3, hy + 1, 1, 6, outline); p.r(12, hy + 1, 1, 6, outline);
}

function hairFront(p: Pen, L: Look, hair: string, hy: number) {
  const hi = shade(hair, 0.25), lo = shade(hair, -0.3);
  switch (L.style) {
    case 'cap': { const c = L.hat ?? '#d84a3a'; p.r(2, hy - 1, 12, 5, c); p.r(2, hy - 1, 12, 1, shade(c, 0.3)); p.r(3, hy + 3, 10, 2, shade(c, -0.25)); p.r(5, hy + 2, 6, 1, '#fff'); p.r(3, hy + 4, 1, 3, hair); p.r(12, hy + 4, 1, 3, hair); break; }
    case 'beanie': { const c = L.hat ?? '#3a68c8'; p.r(3, hy - 1, 10, 5, c); p.r(3, hy + 2, 10, 2, shade(c, -0.25)); p.r(3, hy - 1, 10, 1, shade(c, 0.3)); p.r(7, hy - 2, 2, 1, shade(c, 0.3)); p.r(3, hy + 4, 1, 3, hair); p.r(12, hy + 4, 1, 3, hair); break; }
    case 'long': p.r(3, hy, 10, 4, hair); p.r(3, hy, 10, 1, hi); p.r(2, hy + 1, 2, 9, hair); p.r(12, hy + 1, 2, 9, hair); p.r(4, hy + 3, 3, 1, hair); p.r(9, hy + 3, 3, 1, hair); p.r(2, hy + 8, 2, 1, lo); p.r(12, hy + 8, 2, 1, lo); break;
    case 'bun': p.r(3, hy, 10, 4, hair); p.r(3, hy, 10, 1, hi); p.r(6, hy - 2, 4, 2, hair); p.r(3, hy + 4, 1, 2, hair); p.r(12, hy + 4, 1, 2, hair); break;
    case 'hat': { const c = L.hat ?? '#8a6a40'; p.r(1, hy + 1, 14, 2, c); p.r(3, hy - 1, 10, 3, shade(c, 0.15)); p.r(3, hy + 2, 10, 1, shade(c, -0.3)); p.r(3, hy + 3, 1, 3, hair); p.r(12, hy + 3, 1, 3, hair); break; }
    case 'bald': p.r(3, hy, 10, 1, shade(L.skin, 0.2)); p.r(3, hy + 4, 1, 2, hair); p.r(12, hy + 4, 1, 2, hair); break;
    default: p.r(3, hy, 10, 4, hair); p.r(3, hy, 10, 1, hi); p.r(3, hy + 3, 3, 1, lo); p.r(10, hy + 3, 3, 1, lo); p.r(3, hy + 4, 1, 2, hair); p.r(12, hy + 4, 1, 2, hair);
  }
}
function hairSide(p: Pen, L: Look, hair: string, hy: number) {
  const hi = shade(hair, 0.25);
  switch (L.style) {
    case 'cap': { const c = L.hat ?? '#d84a3a'; p.r(3, hy - 1, 9, 5, c); p.r(3, hy - 1, 9, 1, shade(c, 0.3)); p.r(2, hy + 3, 5, 1, shade(c, -0.25)); p.r(9, hy + 4, 3, 4, hair); break; }
    case 'beanie': { const c = L.hat ?? '#3a68c8'; p.r(4, hy - 1, 8, 5, c); p.r(4, hy + 2, 8, 2, shade(c, -0.25)); p.r(8, hy - 2, 2, 1, shade(c, 0.3)); p.r(9, hy + 4, 3, 4, hair); break; }
    case 'long': p.r(4, hy, 8, 4, hair); p.r(4, hy, 8, 1, hi); p.r(8, hy + 1, 5, 9, hair); break;
    case 'bun': p.r(4, hy, 8, 4, hair); p.r(4, hy, 8, 1, hi); p.r(9, hy - 2, 4, 3, hair); p.r(9, hy + 4, 3, 3, hair); break;
    case 'hat': { const c = L.hat ?? '#8a6a40'; p.r(2, hy + 1, 11, 2, c); p.r(4, hy - 1, 8, 3, shade(c, 0.15)); p.r(9, hy + 3, 3, 3, hair); break; }
    case 'bald': p.r(4, hy, 8, 1, shade(L.skin, 0.2)); break;
    default: p.r(4, hy, 8, 4, hair); p.r(4, hy, 8, 1, hi); p.r(9, hy + 4, 3, 4, hair);
  }
}
function hairBack(p: Pen, L: Look, hair: string, hy: number) {
  const hi = shade(hair, 0.25), lo = shade(hair, -0.3);
  switch (L.style) {
    case 'cap': { const c = L.hat ?? '#d84a3a'; p.r(2, hy - 1, 12, 6, c); p.r(2, hy - 1, 12, 1, shade(c, 0.3)); p.r(3, hy + 5, 10, 4, hair); p.r(7, hy + 1, 2, 2, shade(c, 0.3)); break; }
    case 'beanie': { const c = L.hat ?? '#3a68c8'; p.r(3, hy - 1, 10, 6, c); p.r(3, hy + 3, 10, 2, shade(c, -0.25)); p.r(7, hy - 2, 2, 1, shade(c, 0.3)); p.r(3, hy + 5, 10, 4, hair); break; }
    case 'long': p.r(2, hy, 12, 12, hair); p.r(2, hy, 12, 1, hi); p.r(7, hy + 6, 2, 6, lo); break;
    case 'bun': p.r(3, hy, 10, 9, hair); p.r(3, hy, 10, 1, hi); p.r(6, hy - 2, 4, 3, hair); break;
    case 'hat': { const c = L.hat ?? '#8a6a40'; p.r(1, hy + 1, 14, 2, c); p.r(3, hy - 1, 10, 3, shade(c, 0.15)); p.r(3, hy + 3, 10, 6, hair); break; }
    case 'bald': p.r(3, hy + 4, 10, 3, shade(L.skin, -0.1)); break;
    default: p.r(3, hy, 10, 9, hair); p.r(3, hy, 10, 1, hi); p.r(3, hy + 6, 10, 3, lo);
  }
}

/** Sheet layout: columns = dir (down, up, left) * 3 steps -> 9 frames, 1 row. Right = flip of left. */
export function buildCharSheet(L: Look): HTMLCanvasElement {
  const c = mkCanvas(FW * 9, FH);
  const g = ctx2d(c);
  const dirs: Dir[] = ['down', 'up', 'left'];
  dirs.forEach((d, di) => { for (let s = 0; s < 3; s++) drawFrame(new Pen(g, (di * 3 + s) * FW, 0), L, d, s); });
  return c;
}
export function frameIndex(dir: 'down' | 'up' | 'left' | 'right', step: number) {
  const d = dir === 'right' ? 2 : dir === 'down' ? 0 : dir === 'up' ? 1 : 2;
  return d * 3 + step;
}

export const PALETTES: Record<string, Look> = {
  mom: { skin: '#f8d0a8', hair: '#6a4426', jacket: '#e888b8', pants: '#8a6a98', style: 'bun', accent: '#fff' },
  mira: { skin: '#e8b080', hair: '#d84a3a', jacket: '#30b8a8', pants: '#3a4a78', style: 'long', bag: '#e8e8f0', accent: '#f0c828' },
  vale: { skin: '#e8b080', hair: '#e8e8f0', jacket: '#f4f4f0', pants: '#3a3a58', style: 'short', accent: '#38e0e8', old: false },
  kid: { skin: '#f8d0a8', hair: '#3a2a18', jacket: '#e8b028', pants: '#3a68c8', style: 'short', small: true },
  kid2: { skin: '#c88858', hair: '#1a1018', jacket: '#d84a3a', pants: '#58586a', style: 'beanie', hat: '#30a860', small: true },
  oldman: { skin: '#e8b080', hair: '#e8e8f0', jacket: '#8a7a58', pants: '#58503a', style: 'hat', hat: '#6a5a3a', old: true },
  oldlady: { skin: '#f8d0a8', hair: '#e8e8f0', jacket: '#a868c8', pants: '#58586a', style: 'bun', old: true },
  clerk: { skin: '#e8b080', hair: '#3a2a18', jacket: '#3a68c8', pants: '#262c48', style: 'cap', hat: '#3a68c8', accent: '#fff' },
  farmer: { skin: '#c88858', hair: '#3a2a18', jacket: '#4a8a48', pants: '#6a5a3a', style: 'hat', hat: '#e8c870' },
  farmer2: { skin: '#f8d0a8', hair: '#c89040', jacket: '#c8603a', pants: '#3a4a78', style: 'long', hat: '#e8c870' },
  tech: { skin: '#e8b080', hair: '#2a2018', jacket: '#e88838', pants: '#3a3a58', style: 'beanie', hat: '#e88838', bag: '#58586a' },
  courier: { skin: '#8a5a38', hair: '#1a1018', jacket: '#e8b028', pants: '#262c48', style: 'cap', hat: '#e8b028', bag: '#d84a3a' },
  hiker: { skin: '#f8d0a8', hair: '#6a4426', jacket: '#58a048', pants: '#6a5a3a', style: 'hat', hat: '#8a6a40', bag: '#d84a3a' },
  coder: { skin: '#e8b080', hair: '#3a68c8', jacket: '#262c48', pants: '#262c48', style: 'short', accent: '#30c868' },
  mara: { skin: '#8a5a38', hair: '#1a1018', jacket: '#58b048', pants: '#6a5a3a', style: 'bun', accent: '#f0c828', bag: '#e8c870' },
  clean: { skin: '#e8b080', hair: '#2a2018', jacket: '#f4f4f8', pants: '#f4f4f8', style: 'short', accent: '#3a68c8', bag: null },
  voss: { skin: '#f0c8a0', hair: '#b8b8c8', jacket: '#e8e8f0', pants: '#e8e8f0', style: 'short', accent: '#3a68c8' },
  rex: { skin: '#e8b080', hair: '#b43cd8', jacket: '#262c48', pants: '#58586a', style: 'short', accent: '#38e0e8', bag: null },
  nurse: { skin: '#f8d0a8', hair: '#e888b8', jacket: '#f4f4f8', pants: '#f4f4f8', style: 'bun', accent: '#e04848' },
  shadow: { skin: '#2a2a40', hair: '#1a1830', jacket: '#2a2a40', pants: '#2a2a40', style: 'short' },
  ranger: { skin: '#e8b080', hair: '#6a4426', jacket: '#4a7a58', pants: '#5a4a38', style: 'hat', hat: '#4a7a58', bag: '#c8a868' },
  broadcaster: { skin: '#c88858', hair: '#8a4ac8', jacket: '#d85aa8', pants: '#262c48', style: 'short', accent: '#f0e070' },
  sona: { skin: '#8a5a38', hair: '#e8e8f0', jacket: '#3a78d8', pants: '#e8e8f0', style: 'long', accent: '#38e0e8', bag: null },
  hermit: { skin: '#e8b080', hair: '#e8e8f0', jacket: '#7a5a38', pants: '#58503a', style: 'hat', hat: '#8a6a40', old: true },
  busker: { skin: '#f8d0a8', hair: '#d84a3a', jacket: '#58b8a8', pants: '#3a3a58', style: 'beanie', hat: '#d84a3a', bag: '#e8b028' },
  grandpa: { skin: '#f8d0a8', hair: '#e8e8f0', jacket: '#8a7a58', pants: '#58503a', style: 'hat', hat: '#6a5a3a', old: true, bag: '#c85a48' },
};
