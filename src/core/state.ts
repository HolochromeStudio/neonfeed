import { QUESTS, ITEMS, SPECIES } from '../data';
import type { SaveData, Settings, Bytekin } from '../types';
import { makeMon, maxHp, PARTY_MAX } from './mon';

export const SAVE_VERSION = 1;
export const SLOTS = 3;

export const defaultSettings = (): Settings => ({
  textSpeed: 2, gameSpeed: 1, difficulty: 'STANDARD', encounters: 'HYBRID', musicVol: 6, sfxVol: 7, touchOpacity: 7, swapPad: false,
  autosave: true, partyExp: true, battleAnim: true, crt: false, autoRun: false, hints: true,
});

export function newSave(name: string, look: SaveData['look']): SaveData {
  return {
    version: SAVE_VERSION, name, look, playtime: 0, clock: 9 * 60,
    map: 'player_house_2f', x: 2, y: 2, dir: 'down',
    flags: {}, party: [], vault: [], bag: { patch_kit: 2 }, credits: 300, dex: {}, quests: {},
    settings: loadGlobalSettings(), stats: { battles: 0, wins: 0, contained: 0, steps: 0, faints: 0 },
    starter: '', rivalStarter: '', beaconSteps: 0, lastHeal: { map: 'player_house_1f', x: 3, y: 4 },
    visited: [], trainersBeaten: [], scanned: [], savedAt: Date.now(),
  };
}

// ---------- global singleton ----------
export const G: { s: SaveData; slot: number; sessionStart: number; toast: ((t: string) => void) | null } = {
  s: newSave('JAX', { body: 'neutral', skin: 1, hair: 0, jacket: 0, bag: 0 }), slot: 0, sessionStart: Date.now(), toast: null,
};

// ---------- settings (global) ----------
const SETTINGS_KEY = 'bugbyte_settings_v1';
export function loadGlobalSettings(): Settings {
  try { const j = localStorage.getItem(SETTINGS_KEY); if (j) return { ...defaultSettings(), ...JSON.parse(j) }; } catch { /* ignore */ }
  return defaultSettings();
}
export function saveGlobalSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.s.settings)); } catch { /* ignore */ } }

// ---------- flags / conditions ----------
export const flag = (k: string) => !!G.s.flags[k];
export const flagVal = (k: string) => G.s.flags[k];
export const setFlag = (k: string, v: boolean | number | string = true) => { G.s.flags[k] = v; onFlagChanged(); };
export const clearFlag = (k: string) => { delete G.s.flags[k]; onFlagChanged(); };
export const incFlag = (k: string, n = 1) => { const v = ((G.s.flags[k] as number) || 0) + n; G.s.flags[k] = v; onFlagChanged(); return v; };

const flagListeners: (() => void)[] = [];
export const onFlags = (fn: () => void) => { flagListeners.push(fn); };
function onFlagChanged() { refreshQuests(); for (const f of flagListeners) f(); }

export type Cond = string | { flag?: string | string[]; not?: string | string[]; item?: string; keys?: number; time?: string[]; all?: Cond[]; any?: Cond[]; min?: [string, number]; party?: string } | undefined;
export function cond(c: Cond, ctx?: { time?: string }): boolean {
  if (c === undefined || c === null) return true;
  if (typeof c === 'string') return c.startsWith('!') ? !flag(c.slice(1)) : flag(c);
  const arr = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  for (const f of arr(c.flag)) if (!flag(f)) return false;
  for (const f of arr(c.not)) if (flag(f)) return false;
  if (c.item && !(G.s.bag[c.item] > 0)) return false;
  if (c.keys !== undefined && rootKeys() < c.keys) return false;
  if (c.min && ((flagVal(c.min[0]) as number) || 0) < c.min[1]) return false;
  if (c.time && !c.time.includes(ctx?.time ?? timeOfDay())) return false;
  if (c.all && !c.all.every((x) => cond(x, ctx))) return false;
  if (c.any && !c.any.some((x) => cond(x, ctx))) return false;
  return true;
}
export function rootKeys(): number { let n = 0; for (let i = 1; i <= 8; i++) if (G.s.bag[`root_key_0${i}`] > 0) n++; return n; }

// ---------- time ----------
export function timeOfDay(clock = G.s.clock): 'morning' | 'day' | 'evening' | 'night' {
  const h = Math.floor(clock / 60) % 24;
  return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night';
}
export function clockText(clock = G.s.clock) {
  const m = clock % 1440; const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function dayNumber() { return Math.floor(G.s.clock / 1440) + 1; }
export function restUntilMorning() { const day = Math.floor(G.s.clock / 1440); G.s.clock = (day + 1) * 1440 + 6 * 60; }

// ---------- inventory ----------
export const itemCount = (id: string) => G.s.bag[id] || 0;
export function addItem(id: string, n = 1) { if (!ITEMS[id]) throw new Error('bad item ' + id); G.s.bag[id] = (G.s.bag[id] || 0) + n; refreshQuests(); }
export function takeItem(id: string, n = 1): boolean { if (itemCount(id) < n) return false; G.s.bag[id] -= n; if (G.s.bag[id] <= 0) delete G.s.bag[id]; refreshQuests(); return true; }

// ---------- party / vault ----------
export function addMon(m: Bytekin): 'party' | 'vault' {
  markDex(m.species, 2);
  G.s.stats.contained++;
  m.caughtAt = Date.now();
  refreshQuests();
  if (G.s.party.length < PARTY_MAX) { G.s.party.push(m); return 'party'; }
  G.s.vault.push(m); return 'vault';
}
export function markDex(species: string, level: 1 | 2) { if ((G.s.dex[species] || 0) < level) G.s.dex[species] = level; }
export function dexCounts() {
  const all = Object.keys(SPECIES);
  let seen = 0, got = 0;
  for (const s of all) { const v = G.s.dex[s] || 0; if (v >= 1) seen++; if (v >= 2) got++; }
  return { seen, got, total: all.length };
}
export function firstAlive(): number { return G.s.party.findIndex((m) => m.hp > 0); }
export function healParty() {
  for (const m of G.s.party) { m.hp = maxHp(m); m.status = null; m.moves.forEach((s) => (s.pp = s.maxPp)); }
}
export function partyAlive() { return G.s.party.some((m) => m.hp > 0); }

// ---------- quests ----------
export type QuestState = SaveData['quests'][string];
export function questDone(id: string) { return G.s.quests[id]?.state === 'done'; }
export function questActive(id: string) { return G.s.quests[id]?.state === 'active'; }
export function startQuest(id: string) {
  if (!QUESTS[id] || G.s.quests[id]) return false;
  G.s.quests[id] = { state: 'active', progress: {} };
  G.toast?.(`NEW QUEST: ${QUESTS[id].title}`);
  refreshQuests();
  return true;
}
export function objectiveDone(o: any): boolean {
  switch (o.type) {
    case 'flag': return flag(o.flag);
    case 'item': return itemCount(o.item) >= (o.count ?? 1);
    case 'counter': return (((flagVal(o.flag) as number) || 0) >= o.count);
    case 'seen': return dexCounts().seen >= o.count;
    case 'contained': return dexCounts().got >= o.count;
    case 'wins': return G.s.stats.wins >= o.count;
    case 'party': return G.s.party.some((m) => m.species === o.species);
    case 'beat': return G.s.trainersBeaten.includes(o.trainer);
    case 'owns': return (G.s.dex[o.species] || 0) >= 2;
    default: return false;
  }
}
export function objectiveProgress(o: any): [number, number] {
  switch (o.type) {
    case 'item': return [Math.min(itemCount(o.item), o.count ?? 1), o.count ?? 1];
    case 'counter': return [Math.min((flagVal(o.flag) as number) || 0, o.count), o.count];
    case 'seen': return [Math.min(dexCounts().seen, o.count), o.count];
    case 'contained': return [Math.min(dexCounts().got, o.count), o.count];
    case 'wins': return [Math.min(G.s.stats.wins, o.count), o.count];
    default: return [objectiveDone(o) ? 1 : 0, 1];
  }
}
let refreshing = false;
export function refreshQuests() {
  if (refreshing) return; refreshing = true;
  try {
    for (const [id, q] of Object.entries<any>(QUESTS)) {
      const st = G.s.quests[id];
      if (!st && q.autoStart && cond(q.autoStart)) { G.s.quests[id] = { state: 'active', progress: {} }; G.toast?.(`NEW QUEST: ${q.title}`); }
    }
    for (const [id, st] of Object.entries(G.s.quests)) {
      if (st.state !== 'active') continue;
      const q = QUESTS[id]; if (!q) continue;
      if (q.objectives.every((o: any) => objectiveDone(o))) completeQuest(id);
    }
  } finally { refreshing = false; }
}
export function completeQuest(id: string) {
  const q = QUESTS[id]; const st = G.s.quests[id];
  if (!q || !st || st.state === 'done') return;
  st.state = 'done';
  const r = q.rewards ?? {};
  if (r.credits) G.s.credits += r.credits;
  for (const [it, n] of Object.entries<number>(r.items ?? {})) { G.s.bag[it] = (G.s.bag[it] || 0) + n; }
  for (const f of q.completionFlags ?? []) G.s.flags[f] = true;
  for (const t of q.takeItems ?? []) { const have = G.s.bag[t.item] || 0; G.s.bag[t.item] = Math.max(0, have - (t.count ?? 1)); if (!G.s.bag[t.item]) delete G.s.bag[t.item]; }
  G.toast?.(`QUEST COMPLETE: ${q.title}`);
  if (q.followup) { if (!G.s.quests[q.followup]) { G.s.quests[q.followup] = { state: 'active', progress: {} }; G.toast?.(`NEW QUEST: ${QUESTS[q.followup].title}`); } }
  setTimeout(() => refreshQuests(), 0);
}
export function activeQuests(cat?: string) {
  return Object.entries(G.s.quests).filter(([id, s]) => s.state === 'active' && QUESTS[id] && (!cat || QUESTS[id].category === cat)).map(([id]) => id);
}

// ---------- save / load ----------
const slotKey = (n: number) => `bugbyte_save_v1_${n}`;
type Migration = (d: any) => any;
const MIGRATIONS: Record<number, Migration> = {
  // version N -> N+1 migrations live here; e.g. 0: (d) => ({ ...d, version: 1, stats: { ...d.stats } })
  0: (d) => ({ ...newSave(d.name ?? 'JAX', d.look ?? { body: 'neutral', skin: 1, hair: 0, jacket: 0, bag: 0 }), ...d, version: 1 }),
};
export function migrate(d: any): SaveData {
  let v = d.version ?? 0;
  while (v < SAVE_VERSION) { const m = MIGRATIONS[v]; if (!m) break; d = m(d); v = d.version; }
  // forward-fill any newly added fields so old saves never break
  const base = newSave(d.name ?? 'JAX', d.look ?? { body: 'neutral', skin: 1, hair: 0, jacket: 0, bag: 0 });
  const out: any = { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) } };
  out.version = SAVE_VERSION;
  // drop species that no longer exist rather than corrupting
  out.party = (out.party as Bytekin[]).filter((m) => SPECIES[m.species]);
  out.vault = (out.vault as Bytekin[]).filter((m) => SPECIES[m.species]);
  for (const m of [...out.party, ...out.vault]) { m.moves = (m.moves ?? []).filter((x: any) => x && x.id); m.hp = Math.min(m.hp, maxHp(m)); }
  return out as SaveData;
}
export function readSlot(n: number): SaveData | null {
  try { const j = localStorage.getItem(slotKey(n)); if (!j) return null; return migrate(JSON.parse(j)); } catch { return null; }
}
export function slotSummary(n: number) {
  const d = readSlot(n); if (!d) return null;
  return { name: d.name, playtime: d.playtime, map: d.map, party: d.party.length, keys: ((): number => { let k = 0; for (let i = 1; i <= 8; i++) if (d.bag[`root_key_0${i}`]) k++; return k; })(), savedAt: d.savedAt, dex: Object.values(d.dex).filter((v) => v >= 1).length };
}
export function writeSlot(n: number): boolean {
  try {
    tickPlaytime();
    G.s.savedAt = Date.now();
    const tmp = slotKey(n) + '_tmp';
    const json = JSON.stringify(G.s);
    localStorage.setItem(tmp, json); // write-then-swap so an interrupted save never destroys the old one
    localStorage.setItem(slotKey(n), json); localStorage.removeItem(tmp);
    return true;
  } catch { return false; }
}
export function loadSlot(n: number): boolean {
  const d = readSlot(n); if (!d) return false;
  G.s = d; G.slot = n; G.sessionStart = Date.now(); return true;
}
export function deleteSlot(n: number) { try { localStorage.removeItem(slotKey(n)); } catch { /* ignore */ } }
export function tickPlaytime() { const now = Date.now(); G.s.playtime += Math.floor((now - G.sessionStart) / 1000); G.sessionStart = now; }
export function playtimeText(sec = G.s.playtime) { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return `${h}:${String(m).padStart(2, '0')}`; }

export function giveStarter(species: string) {
  const m = makeMon(species, 5, { ability: SPECIES[species].abilities[0], hidden: false, anomalous: false });
  m.originMap = 'old_relay_core';
  addMon(m); G.s.starter = species;
  return m;
}
