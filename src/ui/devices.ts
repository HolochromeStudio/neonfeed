import Phaser from 'phaser';
import { Ui, INK, DIM, BLUE, MAG, GREEN, GOLD } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { cond, setFlag, flag } from '../core/state';

export interface Station { f: string; name: string; lines: string[]; set?: string; needs?: any; heard?: string }

/** Radio console: tune between stations; each broadcast is read out in a dark window. Stations can set story flags. */
export async function radioMenu(scene: Phaser.Scene, ui: Ui, title: string, stations: Station[]) {
  let idx = 0;
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 18, 'winDark'); ui.text(L, 10, 8, title, '#f0e070'); ui.textR(L, 232, 8, 'A:LISTEN B:OFF', '#8a90b0');
    ui.win(L, 2, 22, 236, 100, 'winDark');
    // dial bar
    ui.rect(L, 12, 30, 216, 1, '#38e0e8');
    for (let i = 0; i <= 20; i++) ui.rect(L, 12 + i * 10.8, 28, 1, i % 5 === 0 ? 5 : 3, '#38e0e8');
    const f0 = parseFloat(stations[0].f), f1 = parseFloat(stations[stations.length - 1].f);
    const px = (f: string) => 12 + ((parseFloat(f) - f0) / Math.max(0.1, f1 - f0)) * 216;
    stations.forEach((s, i) => { const vis = !s.needs || cond(s.needs); ui.rect(L, px(s.f) - 1, 34, 3, 5, i === idx ? '#f0e070' : vis ? '#b43cd8' : '#4a4e78'); });
    const VIS = 6; const top = Math.max(0, Math.min(idx - 2, stations.length - VIS));
    stations.slice(top, top + VIS).forEach((s, i) => {
      const y = 48 + i * 11; const vis = !s.needs || cond(s.needs);
      ui.text(L, 22, y, `${vis ? s.f : '--.-'} ${vis ? s.name : '(static)'}`.slice(0, 34), vis ? '#ffffff' : '#6a6e98');
      if (flag(s.heard ?? `heard_${s.f}`)) ui.text(L, 216, y, '*', '#30c868');
      if (top + i === idx) L.add(scene.add.image(12, y, 'cursor').setOrigin(0, 0).setTint(0xf0e070));
    });
    const s = stations[idx];
    ui.text(L, 10, 128, `TUNED: ${s.f}`, '#38e0e8');
    const b = await Input.wait(['up', 'down', 'a', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    if (b === 'up') { idx = (idx + stations.length - 1) % stations.length; Audio.sfx('move'); }
    else if (b === 'down') { idx = (idx + 1) % stations.length; Audio.sfx('move'); }
    else if (b === 'a') {
      Audio.sfx('glitch');
      const vis = !s.needs || cond(s.needs);
      if (!vis) { await ui.say('...only static. Something might be hiding behind it.', { kind: 'winDark' }); continue; }
      await ui.say(s.lines, { who: `${s.f} ${s.name}`.slice(0, 22), kind: 'winDark' });
      setFlag(s.heard ?? `heard_${s.f}`);
      if (s.set) setFlag(s.set);
    }
  }
}

/** Numeric keypad: up/down change a digit, left/right move, A confirm, B cancel. Returns the code or null. */
export async function numberEntry(scene: Phaser.Scene, ui: Ui, digits: number, title = 'ENTER CODE'): Promise<string | null> {
  const d = Array(digits).fill(0); let pos = 0;
  const L = ui.layer(); ui.win(L, 50, 40, 140, 66, 'winDark'); ui.text(L, 60, 48, title, '#f0e070');
  const cells = d.map((_, i) => ui.text(L, 100 + i * 18 - (digits - 3) * 9, 74, '0', '#ffffff'));
  const arrows = [ui.text(L, 0, 62, '^', '#38e0e8'), ui.text(L, 0, 86, 'v', '#38e0e8')];
  ui.text(L, 60, 96, 'A:OK  B:CANCEL', '#8a90b0');
  const redraw = () => { cells.forEach((c, i) => { c.setText(String(d[i])); c.setTint(i === pos ? 0xf0e070 : 0xffffff); }); arrows[0].x = cells[pos].x; arrows[1].x = cells[pos].x; };
  redraw();
  let res: string | null = null;
  for (;;) {
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    if (b === 'up') d[pos] = (d[pos] + 1) % 10; else if (b === 'down') d[pos] = (d[pos] + 9) % 10;
    else if (b === 'left') pos = (pos + digits - 1) % digits; else if (b === 'right') pos = (pos + 1) % digits;
    else if (b === 'a') { Audio.sfx('select'); res = d.join(''); break; }
    else if (b === 'b') { Audio.sfx('back'); break; }
    Audio.sfx('move'); redraw();
  }
  L.destroy(); void INK; void DIM; void BLUE; void MAG; void GREEN; void GOLD;
  return res;
}
