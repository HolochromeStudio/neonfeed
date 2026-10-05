import Phaser from 'phaser';
import { Ui, Layer, INK, DIM, BLUE, RED, GREEN, GOLD, WHITE, MAG, typeBadge } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, dexCounts, activeQuests, objectiveDone, objectiveProgress, rootKeys, playtimeText, flag, clockText, timeOfDay, dayNumber } from '../core/state';
import { SPECIES, SPECIES_ORDER, TYPE_COLORS, ENCOUNTERS, QUESTS, WORLDMAP, ITEMS, ABILITIES } from '../data';
import { creatureTex } from '../gfx/textures';
import { wrapText } from './party';
import { mkCanvas, ctx2d, Pen, rng } from '../gfx/pen';

// ---------------- BYTEDEX ----------------
function habitats(species: string): string[] {
  const out: string[] = [];
  const names: Record<string, string> = { old_relay: 'Old Relay', route_01: 'Route 01', drainage_pipe: 'Drainage Pipe', briarfield_fields: 'Briarfield', savelet_spot: 'Save Terminals' };
  for (const [k, z] of Object.entries(ENCOUNTERS)) if (z.table.some((e) => e.s === species)) out.push(names[k] ?? k);
  return out;
}
export async function dexMenu(scene: Phaser.Scene, ui: Ui) {
  let idx = 0; let dexPage = 0;
  const ids = SPECIES_ORDER;
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    const c = dexCounts();
    ui.win(L, 2, 2, 236, 16); ui.text(L, 10, 7, 'BYTEDEX', BLUE); ui.text(L, 110, 7, `SEEN ${c.seen}  OWN ${c.got}  /${c.total}`, INK);
    ui.win(L, 2, 20, 104, 138);
    const VIS = 11; const top = Math.max(0, Math.min(idx - 5, ids.length - VIS));
    ids.slice(top, top + VIS).forEach((id, i) => {
      const y = 28 + i * 11; const st = G.s.dex[id] || 0; const sp = SPECIES[id];
      ui.text(L, 16, y, `${String(sp.dex).padStart(3, '0')} ${st ? sp.name.slice(0, 10) : '---------'}`, st ? INK : DIM);
      if (st === 2) ui.text(L, 94, y, '@', GREEN);
      if (top + i === idx) L.add(scene.add.image(7, y, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    });
    ui.win(L, 108, 20, 130, 138);
    const id = ids[idx]; const sp = SPECIES[id]; const st = G.s.dex[id] || 0;
    L.add(scene.add.image(150, 22, creatureTex(scene, id, st ? 'front' : 'sil')).setOrigin(0, 0).setScale(0.75));
    ui.text(L, 114, 24, `#${String(sp.dex).padStart(3, '0')}`, DIM);
    if (st) {
      ui.text(L, 114, 72, sp.name, INK);
      let bx = 114; for (const t of sp.types) bx += typeBadge(ui, L, bx, 82, t, TYPE_COLORS) + 3;
      if (dexPage === 0) {
        if (st === 2) wrapText(sp.desc, 21).slice(0, 6).forEach((ln, i) => ui.text(L, 114, 95 + i * 9, ln, INK));
        else { ui.text(L, 114, 98, 'CONTAIN IT TO LOG', DIM); ui.text(L, 114, 108, 'FULL RESEARCH DATA.', DIM); }
        ui.text(L, 114, 148, 'A: DATA', DIM);
      } else {
        const h = habitats(id);
        ui.text(L, 114, 95, `STABILITY: ${sp.stab.toUpperCase()}`, MAG);
        ui.text(L, 114, 105, `RARITY: ${sp.rarity.toUpperCase()}`, INK);
        ui.text(L, 114, 115, `ABILITY: ${st === 2 ? (ABILITIES[sp.abilities[0]]?.name ?? '').slice(0, 12) : '???'}`, INK);
        ui.text(L, 114, 125, `HABITAT: ${h[0] ?? '???'}`.slice(0, 21), INK);
        if (h.length > 1) ui.text(L, 114, 134, `+ ${h.slice(1).join(', ')}`.slice(0, 21), DIM);
        ui.text(L, 114, 148, 'A: ENTRY', DIM);
      }
    } else { ui.text(L, 114, 72, '??????????', DIM); ui.text(L, 114, 95, 'UNKNOWN BYTEKIN.', DIM); ui.text(L, 114, 105, 'FIND IT IN THE WILD.', DIM); }
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    if (b === 'a') dexPage ^= 1;
    if (b === 'up') idx = Math.max(0, idx - 1); else if (b === 'down') idx = Math.min(ids.length - 1, idx + 1);
    else if (b === 'left') idx = Math.max(0, idx - 10); else if (b === 'right') idx = Math.min(ids.length - 1, idx + 10);
    Audio.sfx('move');
  }
}

// ---------------- QUEST LOG ----------------
export async function questMenu(scene: Phaser.Scene, ui: Ui) {
  const TABS = ['MAIN', 'SIDE', 'RESEARCH', 'DONE']; let tab = 0; let idx = 0;
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 16);
    TABS.forEach((t, i) => ui.text(L, 10 + i * 56, 7, (i === tab ? '>' : ' ') + t, i === tab ? BLUE : DIM));
    const ids = tab === 3 ? Object.entries(G.s.quests).filter(([, s]) => s.state === 'done').map(([id]) => id).filter((id) => QUESTS[id])
      : activeQuests(['MAIN', 'SIDE', 'RESEARCH'][tab]);
    if (idx >= ids.length) idx = Math.max(0, ids.length - 1);
    ui.win(L, 2, 20, 236, 40);
    if (!ids.length) ui.text(L, 12, 34, tab === 3 ? 'NO COMPLETED QUESTS YET.' : 'NO ACTIVE QUESTS.', DIM);
    ids.slice(0, 3).forEach((id, i) => { const y = 26 + i * 11; ui.text(L, 18, y, QUESTS[id].title.slice(0, 32), tab === 3 ? DIM : INK); });
    // paging for >3
    const top = Math.max(0, Math.min(idx - 1, Math.max(0, ids.length - 3)));
    if (ids.length > 3) { L.objs.slice(-3).forEach((o) => o.destroy()); ids.slice(top, top + 3).forEach((id, i) => ui.text(L, 18, 26 + i * 11, QUESTS[id].title.slice(0, 32), tab === 3 ? DIM : INK)); }
    const sel = ids[idx];
    if (ids.length) L.add(scene.add.image(8, 26 + (idx - top) * 11, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    ui.win(L, 2, 62, 236, 96);
    if (sel) {
      const q = QUESTS[sel];
      ui.text(L, 10, 68, q.title, BLUE);
      ui.text(L, 10, 78, `FROM: ${q.giver}  AT: ${q.locationName ?? q.location}`.slice(0, 38), DIM);
      wrapText(q.desc, 36).slice(0, 2).forEach((ln, i) => ui.text(L, 10, 88 + i * 9, ln, INK));
      let y = 108;
      for (const o of q.objectives.slice(0, 4)) {
        const done = tab === 3 || objectiveDone(o); const [a, bb] = objectiveProgress(o);
        ui.text(L, 10, y, `${done ? '[x]' : '[ ]'} ${o.text}${bb > 1 && !done ? ` ${a}/${bb}` : ''}`.slice(0, 38), done ? GREEN : INK); y += 9;
      }
      const r = q.rewards ?? {}; const parts: string[] = []; if (r.credits) parts.push(`${r.credits} CR`); for (const [it, n] of Object.entries<number>(r.items ?? {})) parts.push(`${ITEMS[it].name} x${n}`);
      if (parts.length) ui.text(L, 10, 146, `REWARD: ${parts.join(', ')}`.slice(0, 38), GOLD);
    }
    const b = await Input.wait(['up', 'down', 'left', 'right', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    if (b === 'left') { tab = (tab + 3) % 4; idx = 0; } else if (b === 'right') { tab = (tab + 1) % 4; idx = 0; }
    else if (b === 'up') idx = Math.max(0, idx - 1); else if (b === 'down') idx = Math.min(ids.length - 1, idx + 1);
    Audio.sfx('move');
  }
}

// ---------------- REGION MAP ----------------
function buildMapBg(): HTMLCanvasElement {
  const c = mkCanvas(WORLDMAP.w, WORLDMAP.h); const p = new Pen(ctx2d(c)); const R = rng(77);
  p.r(0, 0, WORLDMAP.w, WORLDMAP.h, '#3a78c8');
  for (let i = 0; i < 40; i++) p.r(R() * WORLDMAP.w, R() * WORLDMAP.h, 4, 1, '#5a98e0');
  // landmass
  const land = (cx: number, cy: number, rx: number, ry: number, col: string) => p.ell(cx, cy, rx, ry, col);
  for (const [x, y, rx, ry] of [[60, 70, 58, 34], [110, 52, 70, 38], [150, 60, 44, 34], [190, 40, 26, 28], [196, 80, 16, 14], [30, 90, 24, 14]] as number[][]) land(x, y, rx, ry, '#68b040');
  for (const [x, y, rx, ry] of [[60, 70, 54, 30], [110, 52, 66, 34], [150, 60, 40, 30]] as number[][]) land(x, y, rx, ry, '#78c850');
  land(206, 102, 10, 6, '#68b040');
  // mountains
  for (let i = 0; i < 9; i++) { const x = 160 + i * 7 + (i % 2) * 3, y = 20 + (i % 3) * 6; p.tri(x, y, x - 5, y + 9, x + 5, y + 9, '#8a7a68'); p.tri(x, y, x - 2, y + 4, x + 2, y + 4, '#f0f0f8'); }
  // forest dots
  for (let i = 0; i < 30; i++) p.ell(70 + R() * 30, 30 + R() * 14, 2, 2, '#2f8a2c');
  // river
  for (let t = 0; t < 70; t++) p.p(100 + Math.sin(t / 6) * 6 + t * 0.5, 40 + t * 0.7, '#58a8f0');
  return c;
}
let mapBg: HTMLCanvasElement | null = null;
export function currentLocationId(): string {
  for (const l of WORLDMAP.locations) if (l.maps.includes(G.s.map)) return l.id; return '';
}
export function locationVisited(l: any) { return l.maps.some((m: string) => G.s.visited.includes(m)); }
export async function mapMenu(scene: Phaser.Scene, ui: Ui) {
  if (!mapBg) mapBg = buildMapBg();
  if (!scene.textures.exists('regionMap')) scene.textures.addCanvas('regionMap', mapBg);
  const locs: any[] = WORLDMAP.locations; let idx = Math.max(0, locs.findIndex((l) => l.id === currentLocationId()));
  const qLocs = new Set<string>();
  for (const id of activeQuests()) { const loc = QUESTS[id].location; const l = locs.find((x) => x.maps.includes(loc)); if (l) qLocs.add(l.id); }
  let blink = 0; let hints = flag('anomaly_hints');
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 16); ui.text(L, 10, 7, 'VELORA REGION', BLUE);
    ui.win(L, 2, 20, 236, 118);
    L.add(scene.add.image(8, 24, 'regionMap').setOrigin(0, 0));
    for (const l of WORLDMAP.links) { const a = locs.find((x) => x.id === l[0]), b = locs.find((x) => x.id === l[1]); const vis = locationVisited(a) && locationVisited(b) || (locationVisited(a) && l[1] === 'whisperwood'); const g = scene.add.graphics(); g.lineStyle(2, vis ? 0xf4e8b0 : 0x4a6a98, 1); g.lineBetween(8 + a.x, 24 + a.y, 8 + b.x, 24 + b.y); L.add(g); }
    locs.forEach((l, i) => {
      const v = locationVisited(l); const x = 8 + l.x, y = 24 + l.y;
      const col = v ? (l.kind === 'town' ? '#e04848' : '#f0c828') : '#6a7aa8';
      ui.rect(L, x - 3, y - 3, 7, 7, '#1a1830'); ui.rect(L, x - 2, y - 2, 5, 5, col);
      if (v && qLocs.has(l.id) && blink % 2 === 0) ui.text(L, x + 4, y - 9, '*', '#ffff40');
      if (!v) ui.text(L, x - 2, y - 4, '?', '#ffffff');
      if (l.id === currentLocationId() && blink % 2 === 0) { ui.rect(L, x - 5, y - 5, 11, 1, '#38e0e8'); ui.rect(L, x - 5, y + 5, 11, 1, '#38e0e8'); ui.rect(L, x - 5, y - 5, 1, 11, '#38e0e8'); ui.rect(L, x + 5, y - 5, 1, 11, '#38e0e8'); }
      if (i === idx) { L.add(scene.add.image(x + 5, y - 3, 'cursor').setOrigin(0, 0).setTint(0xffffff)); }
    });
    void hints;
    ui.win(L, 2, 140, 236, 18);
    const sl = locs[idx]; const v = locationVisited(sl);
    ui.text(L, 10, 146, v ? sl.name : '??? UNEXPLORED', INK);
    ui.text(L, 130, 146, qLocs.has(sl.id) ? '* QUEST HERE' : v ? 'VISITED' : '', qLocs.has(sl.id) ? GOLD : DIM);
    const t = scene.time.addEvent({ delay: 450, callback: () => Input.press('start') });
    const b = await Input.wait(['up', 'down', 'left', 'right', 'b', 'start']);
    t.remove(); Input.release('start'); L.destroy();
    if (b === 'start') { blink++; continue; }
    if (b === 'b') { Audio.sfx('back'); return; }
    // move selection to nearest in direction
    const cur = locs[idx]; let best = -1, bd = 1e9;
    locs.forEach((l, i) => { if (i === idx) return; const dx = l.x - cur.x, dy = l.y - cur.y; const ok = b === 'left' ? dx < -2 : b === 'right' ? dx > 2 : b === 'up' ? dy < -2 : dy > 2; if (!ok) return; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { idx = best; Audio.sfx('move'); }
  }
}

// ---------------- DEBUGGER (trainer card) ----------------
export async function debuggerMenu(scene: Phaser.Scene, ui: Ui) {
  const L = ui.layer();
  ui.rect(L, 0, 0, 240, 160, '#2a3a78');
  ui.win(L, 2, 2, 236, 156);
  const d = dexCounts();
  L.add(scene.add.image(8, 10, 'debugger').setOrigin(0, 0).setScale(1.1));
  ui.text(L, 60, 8, `${G.s.name}`, BLUE); ui.text(L, 60, 18, `DEBUGGER LV ${1 + rootKeys()}`, INK);
  ui.text(L, 60, 29, `TIME ${playtimeText()}`, DIM); ui.text(L, 60, 39, `DAY ${dayNumber()} ${clockText()} ${timeOfDay().toUpperCase()}`, DIM);
  ui.text(L, 60, 50, `CREDITS ${G.s.credits}`, GOLD);
  ui.text(L, 60, 60, `BYTEDEX ${d.seen}/${d.total}  OWN ${d.got}`, INK);
  ui.text(L, 60, 70, `WINS ${G.s.stats.wins}/${G.s.stats.battles}  CONTAINED ${G.s.stats.contained}`.slice(0, 29), INK);
  ui.text(L, 60, 80, `STEPS ${G.s.stats.steps}  ${G.s.settings.difficulty}`, DIM);
  ui.text(L, 10, 92, 'ROOT KEYS', BLUE);
  for (let i = 1; i <= 8; i++) { const have = G.s.bag[`root_key_0${i}`] > 0; ui.rect(L, 10 + (i - 1) * 28, 102, 24, 14, '#1a1830'); ui.rect(L, 11 + (i - 1) * 28, 103, 22, 12, have ? '#38e0e8' : '#d8dcec'); ui.text(L, 19 + (i - 1) * 28, 106, have ? String(i) : '?', have ? INK : DIM); }
  ui.text(L, 10, 122, 'FIELD ABILITIES', BLUE);
  const ab: [string, boolean][] = [['SCAN', flag('has_scan')], ['PULSE', flag('has_pulse')], ['FREQ', false], ['OVRD', false], ['TRCE', false], ['DCPT', false], ['PHSE', false], ['ANCR', false]];
  ab.forEach(([n, on], i) => ui.text(L, 10 + (i % 4) * 56, 132 + Math.floor(i / 4) * 10, on ? n : '----', on ? GREEN : DIM));
  if (G.s.settings.hints) ui.textR(L, 232, 148, 'B:BACK', DIM);
  await Input.wait(['b', 'a']); Audio.sfx('back'); L.destroy(); void RED; void WHITE; void ABILITIES;
}
