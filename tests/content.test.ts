import { describe, it, expect } from 'vitest';
import { MAPS, SCRIPTS, SPECIES, MOVES, ITEMS, ENCOUNTERS, TRAINERS, SHOPS, QUESTS, ABILITIES, BOSSES } from '../src/data';
import { compileMap, isSolidAt, tileDef } from '../src/world/mapCompiler';
import { G } from '../src/core/state';

// minimal localStorage shim for node
(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function withFlags<T>(flags: Record<string, any>, fn: () => T): T {
  const old = G.s.flags; G.s.flags = flags; try { return fn(); } finally { G.s.flags = old; }
}
const allFlags = () => {
  const f: Record<string, boolean> = {};
  const walk = (x: any) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) { if (['set', 'flag', 'not', 'unset'].includes(k) && typeof v === 'string') f[v] = true; walk(v); } } };
  walk(MAPS); walk(SCRIPTS);
  return f;
};

describe('maps', () => {
  it('all maps compile in both empty and fully-flagged states', () => {
    for (const [id, def] of Object.entries(MAPS)) {
      for (const flags of [{}, allFlags()]) withFlags(flags, () => {
        const cm = compileMap(def);
        expect(cm.w * cm.h, id).toBeGreaterThan(0);
      });
    }
  });
  it('warps target existing maps and in-bounds, walkable tiles', () => {
    for (const [id, def] of Object.entries<any>(MAPS)) for (const w of def.warps ?? []) {
      const t = MAPS[w.to]; expect(t, `${id} -> ${w.to}`).toBeTruthy();
      expect(w.tx >= 0 && w.ty >= 0 && w.tx < t.w && w.ty < t.h, `${id} warp target oob`).toBe(true);
      withFlags(allFlags(), () => {
        const cm = compileMap(t);
        expect(isSolidAt(cm, w.tx, w.ty), `${id}->${w.to} lands on solid (${w.tx},${w.ty})`).toBe(false);
      });
      expect(w.x >= 0 && w.y >= 0 && w.x < def.w && w.y < def.h, `${id} warp oob`).toBe(true);
    }
  });
  it('every warp arrival can reach every other warp tile (connectivity)', () => {
    for (const [id, def] of Object.entries<any>(MAPS)) {
      withFlags(allFlags(), () => {
        const cm = compileMap(def); const { w, h } = cm;
        const blocked = new Set<string>();
        for (const o of def.objects ?? []) if (o.sprite || o.solid || (o.type === 'item')) blocked.add(o.x + ',' + o.y);
        const npcCells = new Set<string>([...(def.npcs ?? []), ...(def.trainers ?? [])].map((n: any) => n.x + ',' + n.y));
        const passable = (x: number, y: number) => !isSolidAt(cm, x, y) && !blocked.has(x + ',' + y);
        const targets: [number, number][] = [];
        for (const wp of def.warps ?? []) targets.push([wp.x, wp.y]);
        // arrivals from other maps
        for (const [oid, od] of Object.entries<any>(MAPS)) for (const wp of od.warps ?? []) if (wp.to === id) targets.push([wp.tx, wp.ty]);
        if (targets.length < 2) return;
        const [sx, sy] = targets[0]; const seen = new Set<string>([sx + ',' + sy]); const q = [[sx, sy]];
        while (q.length) { const [x, y] = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; const k = nx + ',' + ny; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k)) continue; const g = tileDef(cm.g[ny * w + nx]); if (g?.ledge && dy !== 1) continue; if (!passable(nx, ny) && !(targets.some((t) => t[0] === nx && t[1] === ny) && !isSolidAt(cm, nx, ny))) continue; seen.add(k); q.push([nx, ny]); } }
        for (const [tx, ty] of targets) expect(seen.has(tx + ',' + ty), `${id}: ${tx},${ty} unreachable from ${sx},${sy}`).toBe(true);
        void npcCells;
      });
    }
  });
  it('NPCs, trainers, objects stand on walkable tiles (or solid furniture for objects)', () => {
    for (const [id, def] of Object.entries<any>(MAPS)) withFlags(allFlags(), () => {
      const cm = compileMap(def);
      const bad: string[] = [];
      for (const n of [...(def.npcs ?? []), ...(def.trainers ?? [])]) { if (n.x < 0 || n.y < 0 || n.x >= def.w || n.y >= def.h) bad.push(`${id}:${n.id} oob`); else if (isSolidAt(cm, n.x, n.y)) bad.push(`${id}:${n.id} on solid (${n.x},${n.y})`); }
      expect(bad).toEqual([]);
      for (const o of def.objects ?? []) expect(o.x >= 0 && o.y >= 0 && o.x < def.w && o.y < def.h, `${id} object oob`).toBe(true);
    });
  });
  it('referenced scripts, trainers, species, items exist', () => {
    for (const [id, def] of Object.entries<any>(MAPS)) {
      for (const t of def.triggers ?? []) expect(SCRIPTS[t.script], `${id} trigger ${t.id}`).toBeTruthy();
      for (const o of def.objects ?? []) { if (o.script) expect(SCRIPTS[o.script], `${id} object script ${o.script}`).toBeTruthy(); if (o.item) expect(ITEMS[o.item], o.item).toBeTruthy(); if (o.sprite) expect(SPECIES[o.sprite]).toBeTruthy(); }
      for (const n of def.npcs ?? []) { for (const s of n.scripts ?? []) expect(SCRIPTS[s.run], `${id}:${n.id} -> ${s.run}`).toBeTruthy(); if (n.script) expect(SCRIPTS[n.script]).toBeTruthy(); }
      for (const t of def.trainers ?? []) expect(TRAINERS[t.id], `${id} trainer ${t.id}`).toBeTruthy();
      if (def.area) expect(ENCOUNTERS[def.area], `${id} area`).toBeTruthy();
    }
  });
  it('scripts reference valid items, trainers, species and sub-scripts', () => {
    const visit = (cmds: any[], where: string) => { for (const c of cmds) {
      if (c.give) expect(ITEMS[c.give], `${where} give ${c.give}`).toBeTruthy();
      if (c.take) expect(ITEMS[c.take]).toBeTruthy();
      if (c.battle && c.battle !== 'wild') expect(TRAINERS[c.battle], `${where} battle ${c.battle}`).toBeTruthy();
      if (c.battle === 'wild') expect(SPECIES[c.species], `${where} wild ${c.species}`).toBeTruthy();
      if (c.pickStarter) expect(SPECIES[c.pickStarter]).toBeTruthy();
      if (c.run) expect(SCRIPTS[c.run], `${where} run ${c.run}`).toBeTruthy();
      if (c.shop) expect(SHOPS[c.shop]).toBeTruthy();
      if (c.warp) { expect(MAPS[c.warp], `${where} warp ${c.warp}`).toBeTruthy(); }
      if (c.quest && c.id) expect(QUESTS[c.id], `${where} quest ${c.id}`).toBeTruthy();
      for (const k of ['then', 'else', 'yes', 'no']) if (Array.isArray(c[k])) visit(c[k], where);
      if (c.on) for (const v of Object.values<any>(c.on)) visit(v, where);
      if (c.choose) for (const b of c.choose.branches) visit(b, where);
    } };
    for (const [id, s] of Object.entries(SCRIPTS)) visit(s, id);
  });
});

describe('trainers', () => {
  it('every trainer has an unobstructed line of sight that crosses walkable ground', () => {
    const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const bad: string[] = [];
    for (const [id, def] of Object.entries<any>(MAPS)) withFlags(allFlags(), () => {
      const cm = compileMap(def);
      for (const t of def.trainers ?? []) {
        const [dx, dy] = DIRS[t.dir]; const sight = t.sight ?? 4; let seen = 0;
        for (let i = 1; i <= sight; i++) { const x = t.x + dx * i, y = t.y + dy * i; if (isSolidAt(cm, x, y)) break; seen++; }
        if (seen < Math.min(2, sight)) bad.push(`${id}:${t.id} sees only ${seen} tiles from (${t.x},${t.y}) facing ${t.dir}`);
      }
    });
    expect(bad).toEqual([]);
  });
});

describe('game data', () => {
  it('encounter tables, trainers, shops, quests are valid', () => {
    for (const [id, z] of Object.entries(ENCOUNTERS)) for (const e of z.table) { expect(SPECIES[e.s], `${id}:${e.s}`).toBeTruthy(); expect(e.min).toBeLessThanOrEqual(e.max); }
    for (const [id, t] of Object.entries<any>(TRAINERS)) { const teams = t.team ? [t.team] : Object.values<any>(t.teamBy); for (const team of teams) for (const [s, l] of team) { expect(SPECIES[s], `${id}:${s}`).toBeTruthy(); expect(l).toBeGreaterThan(0); } if (t.boss) expect(BOSSES[t.boss]).toBeTruthy(); }
    for (const [id, s] of Object.entries(SHOPS)) for (const i of s.stock) expect(ITEMS[i], `${id}:${i}`).toBeTruthy();
    for (const [id, q] of Object.entries<any>(QUESTS)) { expect(q.objectives.length, id).toBeGreaterThan(0); if (q.followup) expect(QUESTS[q.followup], id).toBeTruthy(); for (const [it] of Object.entries(q.rewards?.items ?? {})) expect(ITEMS[it], `${id}:${it}`).toBeTruthy(); for (const o of q.objectives) if (o.item) expect(ITEMS[o.item]).toBeTruthy(); }
    for (const [id, s] of Object.entries(SPECIES)) { for (const a of [...s.abilities, s.hidden]) expect(ABILITIES[a], `${id}:${a}`).toBeTruthy(); for (const [, m] of s.learnset) expect(MOVES[m]).toBeTruthy(); }
  });
  it('every quest flag objective is set somewhere in scripts or code', () => {
    const setFlags = new Set<string>(Object.keys(allFlags()));
    // flags the engine itself sets: starter_selected, has_*, relay_puzzle_solved ...
    const engine = new Set(['game_start', 'starter_selected', 'relay_puzzle_solved', 'node1_valves_done', 'relay_done']);
    for (const [id, q] of Object.entries<any>(QUESTS)) for (const o of q.objectives) if (o.type === 'flag') expect(setFlags.has(o.flag) || engine.has(o.flag), `${id}: flag ${o.flag} never set`).toBe(true);
  });
});

describe('text', () => {
  it('all player-facing strings use only glyphs the pixel font has (ASCII 32-126)', () => {
    const bad: string[] = [];
    const walk = (x: any, path: string) => {
      if (typeof x === 'string') { if (/[^\x20-\x7e]/.test(x)) bad.push(`${path}: ${x.slice(0, 40)}`); }
      else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
    };
    walk(MAPS, 'maps'); walk(SCRIPTS, 'scripts'); walk(QUESTS, 'quests'); walk(SPECIES, 'species'); walk(ITEMS, 'items'); walk(MOVES, 'moves'); walk(TRAINERS, 'trainers'); walk(ABILITIES, 'abilities');
    expect(bad).toEqual([]);
  });
  it('dialogue lines are short enough to read (each say <= 220 chars)', () => {
    const long: string[] = [];
    const visit = (cmds: any[], where: string) => { for (const c of cmds) { if (typeof c.say === 'string' && c.say.length > 220) long.push(`${where}: ${c.say.slice(0, 40)}`); for (const k of ['then', 'else', 'yes', 'no']) if (Array.isArray(c[k])) visit(c[k], where); if (c.on) for (const v of Object.values<any>(c.on)) visit(v, where); } };
    for (const [id, s] of Object.entries(SCRIPTS)) visit(s, id);
    expect(long).toEqual([]);
  });
});
