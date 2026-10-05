import { Pen, mkCanvas, ctx2d, PAL } from './pen';

export function buildUiTextures(add: (key: string, c: HTMLCanvasElement) => void) {
  // 24x24 nine-slice window: hard edge steel border, white inside (8px corners)
  {
    const c = mkCanvas(24, 24); const p = new Pen(ctx2d(c));
    p.r(0, 0, 24, 24, PAL.ink);
    p.r(1, 1, 22, 22, PAL.steel);
    p.r(2, 2, 20, 20, '#8a96c0');
    p.r(3, 3, 18, 18, PAL.win);
    p.r(3, 3, 18, 1, '#ffffff');
    add('win', c);
  }
  {
    const c = mkCanvas(24, 24); const p = new Pen(ctx2d(c));
    p.r(0, 0, 24, 24, PAL.ink);
    p.r(1, 1, 22, 22, '#5a68a0');
    p.r(2, 2, 20, 20, '#1e2444');
    add('winDark', c);
  }
  {
    const c = mkCanvas(24, 24); const p = new Pen(ctx2d(c));
    p.r(0, 0, 24, 24, PAL.ink);
    p.r(1, 1, 22, 22, '#6a3c98');
    p.r(2, 2, 20, 20, '#120c24');
    add('winGlitch', c);
  }
  // cursor arrows
  {
    const c = mkCanvas(6, 8); const p = new Pen(ctx2d(c));
    p.art(0, 0, ['#.....', '###...', '#####.', '#######'.slice(0, 6), '#####.', '###...', '#.....'], { '#': '#fff' });
    add('cursor', c);
  }
  {
    const c = mkCanvas(7, 5); const p = new Pen(ctx2d(c));
    p.art(0, 0, ['#######', '.#####.', '..###..', '...#...'], { '#': '#fff' });
    add('more', c);
  }
  { // up/down scroll hints
    const c = mkCanvas(7, 4); const p = new Pen(ctx2d(c));
    p.art(0, 0, ['...#...', '..###..', '.#####.', '#######'], { '#': '#fff' }); add('arrowUp', c);
  }
  { // pixel for bars, particles
    const c = mkCanvas(2, 2); const p = new Pen(ctx2d(c)); p.r(0, 0, 2, 2, '#fff'); add('px', c);
  }
  // type badge backgrounds are drawn via tint on 'px'
  // debugger device (chunky early-2000s handheld)
  {
    const c = mkCanvas(40, 56); const p = new Pen(ctx2d(c));
    p.r(2, 0, 36, 56, '#10142a'); p.r(0, 2, 40, 52, '#10142a');
    p.r(2, 2, 36, 52, '#6a7a98'); p.r(3, 3, 34, 50, '#8a9ac0'); p.r(3, 3, 34, 2, '#b4c4e8');
    p.r(7, 7, 26, 20, '#10142a'); p.r(9, 9, 22, 16, '#2a4a3a'); p.r(9, 9, 22, 2, '#3a6a4a');
    p.r(8, 32, 6, 6, '#3c4a6e'); p.r(26, 32, 6, 6, '#e04848'); p.r(17, 34, 6, 3, '#3c4a6e');
    p.r(10, 44, 20, 4, '#4a5a80'); for (let i = 0; i < 5; i++) p.r(12 + i * 4, 45, 2, 2, '#262c48');
    p.r(30, 5, 3, 1, '#38e0e8');
    add('debugger', c);
  }
}
