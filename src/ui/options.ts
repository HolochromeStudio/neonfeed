import Phaser from 'phaser';
import { Ui, INK, DIM, BLUE, GREEN, RED } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, saveGlobalSettings, writeSlot, slotSummary, playtimeText, SLOTS } from '../core/state';
import type { Settings } from '../types';

interface Opt { label: string; vals: string[]; get: (s: Settings) => number; set: (s: Settings, i: number) => void; hint: string }
const onoff = (key: keyof Settings, label: string, hint: string): Opt => ({ label, vals: ['OFF', 'ON'], get: (s) => ((s[key] as boolean) ? 1 : 0), set: (s, i) => ((s as any)[key] = i === 1), hint });
const num = (key: keyof Settings, label: string, lo: number, hi: number, hint: string): Opt => ({ label, vals: Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)), get: (s) => (s[key] as number) - lo, set: (s, i) => ((s as any)[key] = lo + i), hint });
const OPTS: Opt[] = [
  { label: 'TEXT SPEED', vals: ['SLOW', 'NORMAL', 'FAST'], get: (s) => s.textSpeed - 1, set: (s, i) => (s.textSpeed = (i + 1) as any), hint: 'Dialogue speed.' },
  { label: 'GAME SPEED', vals: ['1X', '2X', '3X'], get: (s) => s.gameSpeed - 1, set: (s, i) => (s.gameSpeed = (i + 1) as any), hint: 'Walk and animation speed.' },
  { label: 'DIFFICULTY', vals: ['CASUAL', 'STANDARD', 'EXPERT'], get: (s) => ['CASUAL', 'STANDARD', 'EXPERT'].indexOf(s.difficulty), set: (s, i) => (s.difficulty = ['CASUAL', 'STANDARD', 'EXPERT'][i] as any), hint: 'Casual: weaker foes, easier CONTAIN. Expert: smarter AI.' },
  { label: 'ENCOUNTERS', vals: ['CLASSIC', 'VISIBLE', 'HYBRID'], get: (s) => ['CLASSIC', 'VISIBLE', 'HYBRID'].indexOf(s.encounters), set: (s, i) => (s.encounters = ['CLASSIC', 'VISIBLE', 'HYBRID'][i] as any), hint: 'Hybrid: random commons, visible rares.' },
  onoff('partyExp', 'PARTY EXP', 'Whole party earns EXP.'),
  onoff('battleAnim', 'BATTLE ANIM', 'Attack animations.'),
  num('musicVol', 'MUSIC VOL', 0, 10, 'Music volume.'),
  num('sfxVol', 'SFX VOL', 0, 10, 'Sound effect volume.'),
  onoff('autosave', 'AUTOSAVE', 'Saves when you change maps.'),
  onoff('autoRun', 'AUTO RUN', 'Always run (hold B to walk).'),
  onoff('crt', 'SCANLINES', 'CRT scanline overlay.'),
  num('touchOpacity', 'PAD OPACITY', 1, 10, 'Touch control opacity.'),
  onoff('swapPad', 'PAD SWAP', 'Swap D-pad / buttons sides.'),
  onoff('hints', 'HINTS', 'Show control hints in menus.'),
];

export async function openOptions(scene: Phaser.Scene, ui: Ui, _inGame: boolean) {
  const L = ui.layer();
  ui.win(L, 4, 4, 232, 152);
  ui.text(L, 14, 11, 'OPTIONS', BLUE);
  const VIS = 9; let idx = 0, top = 0;
  const rows: { a: Phaser.GameObjects.BitmapText; b: Phaser.GameObjects.BitmapText }[] = [];
  for (let i = 0; i < VIS; i++) rows.push({ a: ui.text(L, 22, 26 + i * 12, '', INK), b: ui.text(L, 130, 26 + i * 12, '', BLUE) });
  const hint = ui.text(L, 14, 140, '', DIM);
  const cur = L.add(scene.add.image(12, 27, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
  const apply = () => { Audio.setVolumes(G.s.settings.musicVol, G.s.settings.sfxVol); (window as any).__applyScale?.(); saveGlobalSettings(); };
  const draw = () => {
    if (idx < top) top = idx; if (idx >= top + VIS) top = idx - VIS + 1;
    rows.forEach((r, i) => { const o = OPTS[top + i]; if (!o) { r.a.setText(''); r.b.setText(''); return; } r.a.setText(o.label); const v = o.vals[o.get(G.s.settings)]; r.b.setText(`< ${v} >`); r.b.setTint(v === 'ON' ? 0x28a050 : v === 'OFF' ? 0xd84040 : 0x3a68c8); });
    cur.setPosition(12, 27 + (idx - top) * 12); hint.setText(OPTS[idx].hint.slice(0, 36));
  };
  draw();
  for (;;) {
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    const o = OPTS[idx];
    if (b === 'up') idx = (idx + OPTS.length - 1) % OPTS.length; else if (b === 'down') idx = (idx + 1) % OPTS.length;
    else if (b === 'left' || b === 'right' || b === 'a') { const d = b === 'left' ? -1 : 1; const n = (o.get(G.s.settings) + d + o.vals.length) % o.vals.length; o.set(G.s.settings, n); apply(); if (o.label === 'SFX VOL') Audio.sfx('select'); }
    else if (b === 'b') { Audio.sfx('back'); break; }
    Audio.sfx('move'); draw();
  }
  L.destroy(); void GREEN; void RED;
}

export async function saveMenu(scene: Phaser.Scene, ui: Ui): Promise<boolean> {
  const L = ui.layer();
  ui.win(L, 10, 20, 220, 120); ui.text(L, 20, 28, 'SAVE GAME', BLUE);
  const sums = [1, 2, 3].map((n) => slotSummary(n));
  sums.forEach((s, i) => { ui.text(L, 26, 44 + i * 26, (s ? `SLOT ${i + 1}  ${s.name}  ${playtimeText(s.playtime)}  DEX ${s.dex}` : `SLOT ${i + 1}  - EMPTY -`).slice(0, 34), s ? INK : DIM); if (s) ui.text(L, 26, 54 + i * 26, `BYTEKIN ${s.party}  MAP ${s.map}`.slice(0, 34), DIM); });
  let idx = Math.max(0, G.slot - 1); const cur = L.add(scene.add.image(16, 44, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
  let saved = false;
  for (;;) {
    cur.setPosition(16, 44 + idx * 26);
    const b = await Input.wait(['up', 'down', 'a', 'b']);
    if (b === 'up') idx = (idx + 2) % 3; else if (b === 'down') idx = (idx + 1) % 3; else if (b === 'b') { Audio.sfx('back'); break; }
    else if (b === 'a') {
      Audio.sfx('select');
      if (sums[idx] && G.slot !== idx + 1) { const ok = await ui.choose(['NO', 'YES'], { x: 170, y: 100, w: 48, title: 'OVERWRITE?' }); if (ok !== 1) continue; }
      G.slot = idx + 1;
      if (writeSlot(G.slot)) { saved = true; Audio.sfx('heal'); await ui.say('Game saved to slot ' + (idx + 1) + '.', { auto: 600 }); } else { Audio.sfx('error'); await ui.say('Save failed! Storage may be full or blocked.'); }
      break;
    }
  }
  L.destroy(); void SLOTS;
  return saved;
}
