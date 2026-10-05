import Phaser from 'phaser';
import { Ui, Layer, INK, DIM, BLUE, RED, GREEN, WHITE, typeBadge } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, itemCount, takeItem, markDex } from '../core/state';
import { SPECIES, MOVES, ABILITIES, TYPE_COLORS, STATUS } from '../data';
import { maxHp, displayName, calcStat, expBar, expToNext } from '../core/mon';
import { creatureTex } from '../gfx/textures';
import type { Bytekin } from '../types';

export function hpColor(f: number) { return f > 0.5 ? '#30c868' : f > 0.2 ? '#f0c828' : '#e04848'; }

/** One party row. */
function row(ui: Ui, L: Layer, scene: Phaser.Scene, m: Bytekin, x: number, y: number, w: number, extra?: string) {
  const sp = SPECIES[m.species];
  ui.win(L, x, y, w, 26);
  L.add(scene.add.image(x + 4, y + 4, creatureTex(scene, m.species, 'icon', m.anomalous)).setOrigin(0, 0));
  ui.text(L, x + 24, y + 5, displayName(m).slice(0, 12), m.hp <= 0 ? RED : INK);
  ui.text(L, x + 24, y + 14, `Lv${m.level}`, DIM);
  if (m.status) { ui.rect(L, x + 56, y + 13, 20, 9, STATUS[m.status].color); ui.text(L, x + 57, y + 14, STATUS[m.status].short, WHITE); }
  const bw = 70; const bx = x + w - bw - 8;
  ui.text(L, bx - 18, y + 6, 'HP', '#d89020');
  ui.hpBar(L, bx, y + 7, bw, m.hp / maxHp(m));
  ui.text(L, bx, y + 14, `${m.hp}/${maxHp(m)}`, INK);
  if (extra) ui.text(L, x + w - extra.length * 6 - 6, y + 14, extra, BLUE);
  void sp;
}

/** Party list. mode 'pick' returns index; mode 'browse' opens summary/switch actions. */
export async function partyMenu(scene: Phaser.Scene, ui: Ui, o: { prompt?: string; pick?: boolean; allowFainted?: boolean; battle?: boolean; current?: number; cancel?: boolean; item?: string } = {}): Promise<number> {
  const party = G.s.party;
  let idx = Math.max(0, o.current ?? 0);
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 16); ui.text(L, 10, 7, o.prompt ?? 'BYTE PARTY', BLUE);
    party.forEach((m, i) => row(ui, L, scene, m, 2, 20 + i * 23 - (party.length > 5 ? 1 : 0), 236, (o.item === 'signal_crystal' && SPECIES[m.species].evo.some((e) => e.item === o.item)) ? 'CAN EVOLVE' : undefined));
    const cur = L.add(scene.add.image(0, 0, 'cursor').setOrigin(0, 0).setTint(0xd84040));
    cur.setPosition(-1, 28 + idx * 23);
    if (G.s.settings.hints) ui.textR(L, 232, 7, o.pick ? 'A:SELECT B:BACK' : 'A:ACTIONS B:BACK', DIM);
    let chosen = -2;
    for (;;) {
      cur.setPosition(-1, 28 + idx * 23);
      const b = await Input.wait(['up', 'down', 'a', 'b']);
      if (b === 'up') { idx = (idx + party.length - 1) % party.length; Audio.sfx('move'); }
      else if (b === 'down') { idx = (idx + 1) % party.length; Audio.sfx('move'); }
      else if (b === 'b') { if (o.cancel === false) continue; Audio.sfx('back'); chosen = -1; break; }
      else if (b === 'a') { Audio.sfx('select'); chosen = idx; break; }
    }
    if (chosen === -1) { L.destroy(); return -1; }
    if (o.pick) { if (!o.allowFainted && party[chosen].hp <= 0) { Audio.sfx('error'); L.destroy(); continue; } L.destroy(); return chosen; }
    // actions
    const act = await ui.choose(['SUMMARY', 'SWITCH', o.battle ? 'CANCEL' : 'NICKNAME', 'FAVORITE'], { x: 150, y: 20 + chosen * 23 > 90 ? 60 : 40, w: 84 });
    if (act === 0) { await summary(scene, ui, party[chosen]); }
    else if (act === 1) {
      const to = await partyMenu(scene, ui, { prompt: 'SWITCH WITH WHICH?', pick: true, allowFainted: true, current: chosen });
      if (to >= 0 && to !== chosen) { [party[chosen], party[to]] = [party[to], party[chosen]]; Audio.sfx('select'); }
    } else if (act === 2 && !o.battle) {
      const nm = await nickEntry(scene, ui, displayName(party[chosen]));
      if (nm !== null) party[chosen].nick = nm === SPECIES[party[chosen].species].name ? undefined : nm;
    } else if (act === 3) { party[chosen].fav = !party[chosen].fav; await ui.say(party[chosen].fav ? `${displayName(party[chosen])} marked as favorite.` : 'Favorite removed.', { auto: 500 }); }
    L.destroy();
    idx = Math.min(chosen, G.s.party.length - 1);
  }
}

async function nickEntry(scene: Phaser.Scene, ui: Ui, def: string): Promise<string | null> {
  const L = ui.layer(); ui.win(L, 30, 50, 180, 60); ui.text(L, 40, 58, 'NICKNAME (TYPE, ENTER)', BLUE);
  let name = def.slice(0, 10); const t = ui.text(L, 40, 76, name + '_', INK); ui.text(L, 40, 92, 'ESC: CANCEL', DIM);
  Input.typing = true;
  const res = await new Promise<string | null>((resolve) => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { cleanup(); resolve(name.trim() || def); }
      else if (e.key === 'Escape') { cleanup(); resolve(null); }
      else if (e.key === 'Backspace') { name = name.slice(0, -1); t.setText(name + '_'); }
      else if (e.key.length === 1 && name.length < 10 && /[A-Za-z0-9\-.!? ]/.test(e.key)) { name += e.key; t.setText(name + '_'); }
    };
    const cleanup = () => window.removeEventListener('keydown', h);
    window.addEventListener('keydown', h);
    // on touch devices without a keyboard, allow a quick confirm/cancel via A/B
    Input.wait(['a', 'b']).then((b) => { cleanup(); resolve(b === 'a' ? (name.trim() || def) : null); });
  });
  Input.typing = false; Input.cancelWaiters(); L.destroy();
  return res;
}

export async function summary(scene: Phaser.Scene, ui: Ui, m: Bytekin) {
  const sp = SPECIES[m.species];
  let page = 0;
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 90, 156);
    L.add(scene.add.image(8, 14, creatureTex(scene, m.species, 'front', m.anomalous)).setOrigin(0, 0).setScale(1));
    ui.text(L, 10, 6, displayName(m).slice(0, 12), INK);
    ui.text(L, 10, 82, `Lv${m.level}  #${String(sp.dex).padStart(3, '0')}`, DIM);
    let bx = 10; for (const t of sp.types) bx += typeBadge(ui, L, bx, 94, t, TYPE_COLORS) + 3;
    if (m.anomalous) ui.text(L, 10, 106, 'ANOMALOUS', '#c89818');
    if (m.hiddenProcess) ui.text(L, 10, m.anomalous ? 116 : 106, 'HIDDEN PROCESS', MAGc);
    ui.text(L, 10, 128, `EXP ${m.exp}`, INK); ui.text(L, 10, 138, `NEXT ${expToNext(m)}`, DIM);
    ui.rect(L, 10, 148, 76, 3, '#1a1830'); ui.rect(L, 11, 148, Math.round(74 * expBar(m)), 3, '#38a8e8');
    ui.win(L, 94, 2, 144, 156);
    ui.text(L, 102, 8, page === 0 ? 'STATS' : page === 1 ? 'MOVES' : 'INFO', BLUE);
    ui.text(L, 160, 8, `< ${page + 1}/3 >`, DIM);
    if (page === 0) {
      const stats: ['hp' | 'atk' | 'def' | 'sys' | 'spd', string][] = [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['sys', 'SYS'], ['spd', 'SPD']];
      stats.forEach(([k, n], i) => {
        ui.text(L, 102, 24 + i * 14, n, INK);
        const v = k === 'hp' ? maxHp(m) : calcStat(m, k);
        ui.text(L, 130, 24 + i * 14, k === 'hp' ? `${m.hp}/${v}` : String(v), INK);
        const bw = Math.min(64, Math.round((v / (k === 'hp' ? 160 : 110)) * 64));
        ui.rect(L, 166, 25 + i * 14, 64, 5, '#d8dcec'); ui.rect(L, 166, 25 + i * 14, bw, 5, '#38a8e8');
      });
      const ab = ABILITIES[m.ability];
      ui.text(L, 102, 98, 'ABILITY', BLUE); ui.text(L, 102, 108, ab?.name ?? m.ability, INK);
      wrapText(ab?.desc ?? '', 22).slice(0, 3).forEach((ln, i) => ui.text(L, 102, 120 + i * 9, ln, DIM));
      if (m.status) ui.text(L, 102, 148, `STATUS: ${m.status}`, RED);
    } else if (page === 1) {
      m.moves.forEach((mv, i) => {
        const d = MOVES[mv.id]; const y = 22 + i * 32;
        ui.text(L, 102, y, d.name, INK); typeBadge(ui, L, 102, y + 10, d.type, TYPE_COLORS);
        ui.text(L, 160, y + 11, `PP ${mv.pp}/${mv.maxPp}`, INK);
        ui.text(L, 102, y + 21, `${d.cat === 'status' ? 'STATUS' : d.cat === 'hit' ? 'HIT' : 'SYS'} ${d.power ? 'PWR ' + d.power : ''} ${d.acc ? 'ACC ' + d.acc : ''}`, DIM);
      });
    } else {
      ui.text(L, 102, 24, 'ENTRY', BLUE);
      const lines = wrapText(sp.desc, 22);
      lines.slice(0, 9).forEach((ln, i) => ui.text(L, 102, 36 + i * 10, ln, INK));
      ui.text(L, 102, 132, `STABILITY: ${sp.stab.toUpperCase()}`, MAGc);
      ui.text(L, 102, 144, `RARITY: ${sp.rarity.toUpperCase()}`, DIM);
    }
    if (G.s.settings.hints) ui.textR(L, 232, 8, 'B:BACK', DIM);
    const b = await Input.wait(['left', 'right', 'a', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    page = (page + (b === 'left' ? 2 : 1)) % 3; Audio.sfx('move');
  }
}
const MAGc = '#a02cc8';
export function wrapText(s: string, cols: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of s.split(' ')) { if (!line) line = w; else if ((line + ' ' + w).length <= cols) line += ' ' + w; else { out.push(line); line = w; } }
  if (line) out.push(line); return out;
}

/** BYTE VAULT: storage with box paging, sort, favorites. */
export async function vaultMenu(scene: Phaser.Scene, ui: Ui) {
  let mode: 'vault' | 'party' = 'vault'; let idx = 0; let sort = 'RECENT'; let filter = 'ALL';
  const view = (): Bytekin[] => {
    let v = [...G.s.vault];
    if (filter === 'FAV') v = v.filter((m) => m.fav);
    else if (filter !== 'ALL') v = v.filter((m) => SPECIES[m.species].types.includes(filter as any));
    if (sort === 'LEVEL') v.sort((a, b) => b.level - a.level); else if (sort === 'NAME') v.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    else if (sort === 'DEX') v.sort((a, b) => SPECIES[a.species].dex - SPECIES[b.species].dex);
    return v;
  };
  const evoReady = (m: Bytekin) => SPECIES[m.species].evo.some((e) => e.lv && m.level >= e.lv);
  for (;;) {
    const L = ui.layer();
    ui.rect(L, 0, 0, 240, 160, '#2a3a78');
    ui.win(L, 2, 2, 236, 16); ui.text(L, 10, 7, `BYTE VAULT  ${G.s.vault.length} STORED`, BLUE); ui.text(L, 150, 7, `SORT:${sort} ${filter}`, DIM);
    const list = mode === 'vault' ? view() : G.s.party;
    if (idx >= list.length) idx = Math.max(0, list.length - 1);
    ui.win(L, 2, 20, 120, 120, 'win'); ui.text(L, 10, 25, mode === 'vault' ? 'VAULT' : 'PARTY', BLUE);
    const VIS = 9; const top = Math.max(0, Math.min(idx - 4, list.length - VIS));
    list.slice(top, top + VIS).forEach((m, i) => {
      const y = 36 + i * 11; const sel = top + i === idx;
      ui.text(L, 16, y, `${m.fav ? '*' : ' '}${displayName(m).slice(0, 10)}`, m.hp <= 0 ? RED : INK); ui.text(L, 84, y, `Lv${m.level}`, DIM);
      if (evoReady(m)) ui.text(L, 110, y, '^', GREEN);
      if (sel) L.add(scene.add.image(7, y, 'cursor').setOrigin(0, 0).setTint(0x1a1830));
    });
    if (list.length === 0) ui.text(L, 16, 50, 'EMPTY', DIM);
    ui.win(L, 124, 20, 114, 120);
    const sel = list[idx];
    if (sel) {
      L.add(scene.add.image(150, 22, creatureTex(scene, sel.species, 'front', sel.anomalous)).setOrigin(0, 0).setScale(0.75));
      ui.text(L, 130, 78, displayName(sel), INK); ui.text(L, 130, 88, `Lv${sel.level}  HP ${sel.hp}/${maxHp(sel)}`, DIM);
      let bx = 130; for (const t of SPECIES[sel.species].types) bx += typeBadge(ui, L, bx, 100, t, TYPE_COLORS) + 3;
      ui.text(L, 130, 112, (ABILITIES[sel.ability]?.name ?? '').slice(0, 17), BLUE);
    }
    if (G.s.settings.hints) ui.text(L, 6, 146, 'A:ACTION  L/R:SWITCH PANE  B:EXIT', '#c8d0ff');
    const b = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
    L.destroy();
    if (b === 'b') { Audio.sfx('back'); return; }
    if (b === 'up') { idx = Math.max(0, idx - 1); Audio.sfx('move'); } else if (b === 'down') { idx = Math.min(list.length - 1, idx + 1); Audio.sfx('move'); }
    else if (b === 'left' || b === 'right') { mode = mode === 'vault' ? 'party' : 'vault'; idx = 0; Audio.sfx('move'); }
    else if (b === 'a' && sel) {
      Audio.sfx('select');
      const acts = mode === 'vault' ? ['WITHDRAW', 'SUMMARY', 'FAVORITE', 'RELEASE', 'SORT/FILTER'] : ['DEPOSIT', 'SUMMARY', 'FAVORITE', 'SORT/FILTER'];
      const a = acts[await ui.choose(acts, { x: 150, y: 50, w: 88 }) ] ?? '';
      if (a === 'WITHDRAW') {
        if (G.s.party.length >= 6) { await ui.say('Your party is full!'); }
        else { G.s.vault.splice(G.s.vault.indexOf(sel), 1); G.s.party.push(sel); await ui.say(`${displayName(sel)} joined the party.`, { auto: 500 }); }
      } else if (a === 'DEPOSIT') {
        if (G.s.party.filter((m) => m.hp > 0).length <= 1 && sel.hp > 0) await ui.say('You need at least one healthy Bytekin!');
        else { G.s.party.splice(G.s.party.indexOf(sel), 1); G.s.vault.push(sel); await ui.say(`${displayName(sel)} was sent to the Vault.`, { auto: 500 }); }
      } else if (a === 'SUMMARY') await summary(scene, ui, sel);
      else if (a === 'FAVORITE') sel.fav = !sel.fav;
      else if (a === 'RELEASE') {
        if (sel.fav) await ui.say('Favorites cannot be released.');
        else if ((await ui.choose(['KEEP', 'RELEASE'], { x: 170, y: 90, w: 60, title: 'SURE?' })) === 1) { G.s.vault.splice(G.s.vault.indexOf(sel), 1); await ui.say(`${displayName(sel)} drifted back into the Signal.`, { auto: 600 }); }
      } else if (a === 'SORT/FILTER') {
        const s = await ui.choose(['SORT: RECENT', 'SORT: LEVEL', 'SORT: NAME', 'SORT: DEX', 'FILTER: ALL', 'FILTER: FAV', 'FILTER: TYPE'], { x: 140, y: 30, w: 100 });
        if (s >= 0 && s <= 3) sort = ['RECENT', 'LEVEL', 'NAME', 'DEX'][s]; else if (s === 4) filter = 'ALL'; else if (s === 5) filter = 'FAV';
        else if (s === 6) { const types = Object.keys(TYPE_COLORS); const t = await ui.choose(types, { x: 150, y: 4, w: 80 }); if (t >= 0) filter = types[t]; }
      }
    }
  }
}
void takeItem; void itemCount; void markDex;
