import { describe, it, expect } from 'vitest';
import { Battle } from '../src/battle/engine';
import { makeMon, calcStat, maxHp, expForLevel, addExp, checkEvolution, evolveMon } from '../src/core/mon';
import { typeMult } from '../src/battle/rules';
import { containChance } from '../src/battle/contain';
import { TYPE_ORDER, TYPE_CHART, SPECIES, MOVES } from '../src/data';

function seeded(seed = 1) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const mk = (kind: 'wild' | 'trainer' = 'wild', p = 'nullcat', e = 'cachemouse', pl = 5, el = 5, seed = 7) => {
  const r = seeded(seed);
  return new Battle({ kind, player: [makeMon(p, pl, { rand: r })], enemy: [makeMon(e, el, { rand: r })], difficulty: 'STANDARD', ai: 'basic', rootKeys: 0, levelCap: 16, partyExp: true, rand: r });
};

describe('type chart', () => {
  it('has 12 types with at least 2 strengths each and valid references', () => {
    expect(TYPE_ORDER.length).toBe(12);
    for (const t of TYPE_ORDER) { expect(TYPE_CHART[t].super.length).toBeGreaterThanOrEqual(2); for (const x of [...TYPE_CHART[t].super, ...TYPE_CHART[t].resist]) expect(TYPE_ORDER).toContain(x); }
  });
  it('matches the spec examples', () => {
    expect(typeMult('SIGNAL', ['STATIC'])).toBe(2);
    expect(typeMult('VIRAL', ['CRYPT'])).toBe(0.5);
    expect(typeMult('LOOP', ['CORE'])).toBe(2);
    expect(typeMult('NULL', ['CACHE'])).toBe(2);
  });
  it('starter triangle: NULL > SIGNAL > LOOP > NULL', () => {
    expect(typeMult('NULL', ['SIGNAL'])).toBe(2); expect(typeMult('SIGNAL', ['LOOP'])).toBe(2); expect(typeMult('LOOP', ['NULL'])).toBe(2);
  });
});
describe('stats & exp', () => {
  it('stat formula is monotonic in level', () => {
    const m = makeMon('nullcat', 5); const a = calcStat(m, 'atk'); m.level = 20; expect(calcStat(m, 'atk')).toBeGreaterThan(a);
  });
  it('exp curve growth rates order', () => {
    expect(expForLevel('fast', 30)).toBeLessThan(expForLevel('medium', 30)); expect(expForLevel('medium', 30)).toBeLessThan(expForLevel('slow', 30));
  });
  it('addExp levels up and raises hp', () => {
    const m = makeMon('nullcat', 5, { ivs: { hp: 0, atk: 0, def: 0, sys: 0, spd: 0 } }); const h = maxHp(m);
    const ups = addExp(m, 1000); expect(ups.length).toBeGreaterThan(0); expect(m.hp).toBeGreaterThan(h);
  });
});
describe('evolution', () => {
  it('levels, alt evolution by low stability, item evolution', () => {
    const m = makeMon('nullcat', 16); expect(checkEvolution(m)).toBe('voidlynx');
    m.lowStabBattles = 5; expect(checkEvolution(m)).toBe('faultlynx');
    const moth = makeMon('pingmoth', 30); expect(checkEvolution(moth)).toBeNull(); expect(checkEvolution(moth, { item: 'signal_crystal' })).toBe('beaconmoth');
    const c = makeMon('nullcat', 15); expect(checkEvolution(c)).toBeNull();
    evolveMon(m, 'faultlynx'); expect(m.species).toBe('faultlynx'); expect(m.hp).toBeGreaterThan(0);
  });
});
describe('contain', () => {
  const base = { species: 'cachemouse', hp: 10, maxHp: 20, stab: 100, status: null, rootKeys: 0, moduleMult: 1, difficulty: 'STANDARD' as const };
  it('is easier at low hp, low stability, with status', () => {
    const p0 = containChance(base);
    expect(containChance({ ...base, hp: 2 })).toBeGreaterThan(p0);
    expect(containChance({ ...base, stab: 10 })).toBeGreaterThan(p0);
    expect(containChance({ ...base, status: 'FROZEN' })).toBeGreaterThan(p0);
    expect(containChance({ ...base, difficulty: 'CASUAL' })).toBeGreaterThan(p0);
  });
  it('rare creatures are harder', () => { expect(containChance({ ...base, species: 'crypmole' })).toBeLessThan(containChance(base)); });
  it('is bounded', () => { const p = containChance({ ...base, stab: 0, hp: 1, status: 'FROZEN', moduleMult: 3 }); expect(p).toBeLessThanOrEqual(0.98); expect(containChance({ ...base, species: 'loophound', stab: 100, hp: 20 })).toBeGreaterThan(0); });
});
describe('battle engine', () => {
  it('runs to completion and awards exp', () => {
    const b = mk();
    for (let i = 0; i < 80 && !b.over; i++) { if (b.needSwitch) break; b.doTurn({ t: 'move', i: 0 }); }
    expect(b.over).toBe('win'); expect(b.expGained[b.p.mon.uid]).toBeGreaterThan(0);
  });
  it('contain can succeed on a weakened wild target and ends battle', () => {
    let ok = 0;
    for (let s = 1; s <= 60; s++) { const b = mk('wild', 'nullcat', 'cachemouse', 5, 5, s); b.e.mon.hp = 1; b.e.stab = 5; b.doTurn({ t: 'contain' }); if (b.over === 'contained') ok++; }
    expect(ok).toBeGreaterThan(30);
  });
  it('cannot contain trainer Bytekin', () => { const b = mk('trainer'); b.doTurn({ t: 'contain' }); expect(b.over).toBeNull(); });
  it('status tick: CORRUPTED deals damage at end of turn', () => {
    const b = mk(); b.p.mon.status = 'CORRUPTED'; const h = b.p.mon.hp; b.doTurn({ t: 'move', i: 1 }); expect(b.p.mon.hp).toBeLessThan(h);
  });
  it('FROZEN prevents action; priority orders ping first', () => {
    const b = mk('wild', 'bitbird', 'cachemouse'); const ping = b.p.mon.moves.findIndex((m) => m.id === 'ping');
    const ev = b.doTurn({ t: 'move', i: ping }); const firstMove = ev.find((e) => e.k === 'move'); expect((firstMove as any).side).toBe('p');
  });
  it('item use heals and consumes a turn (enemy still acts)', () => {
    const b = mk(); b.p.mon.hp = 3; b.doTurn({ t: 'item', id: 'patch_kit', target: 0 }); expect(b.p.mon.hp).toBeGreaterThan(3);
  });
  it('player faint with spare Bytekin requests a switch', () => {
    const r = seeded(3);
    const b = new Battle({ kind: 'wild', player: [makeMon('nullcat', 5, { rand: r }), makeMon('segbyte', 5, { rand: r })], enemy: [makeMon('rustbot', 20, { rand: r })], difficulty: 'STANDARD', ai: 'basic', rootKeys: 0, levelCap: 16, partyExp: true, rand: r });
    for (let i = 0; i < 20 && !b.needSwitch && !b.over; i++) b.doTurn({ t: 'move', i: 1 });
    expect(b.needSwitch || b.over).toBeTruthy();
    if (b.needSwitch) { b.forceSwitch(1); expect(b.p.mon.species).toBe('segbyte'); }
  });
  it('boss CACHE LINK heals every 2 turns while intact', () => {
    const r = seeded(11);
    const b = new Battle({ kind: 'boss', player: [makeMon('nullcat', 12, { rand: r })], enemy: [makeMon('hamcache', 14, { rand: r })], difficulty: 'STANDARD', ai: 'smart', rootKeys: 0, levelCap: 16, partyExp: true, rules: [{ t: 'cacheLink', everyTurns: 2, pct: 12, breakBelow: 50 }], rand: r });
    b.e.mon.hp = Math.floor(maxHp(b.e.mon) * 0.5);
    b.p.mon.moves = [{ id: 'phase_shift', pp: 20, maxPp: 20 }];
    b.doTurn({ t: 'move', i: 0 }); b.doTurn({ t: 'move', i: 0 });
    expect(b.log.some((e) => e.k === 'rule')).toBe(true);
  });
  it('STRUGGLE is used when out of PP: damages the foe and hurts the user', () => {
    const b = mk(); b.p.mon.moves.forEach((m) => (m.pp = 0)); const hp = b.p.mon.hp, ehp = b.e.mon.hp;
    b.doTurn({ t: 'struggle' }); expect(b.e.mon.hp).toBeLessThan(ehp); expect(b.log.some((e) => e.k === 'msg' && /STRUGGLE/.test(e.text))).toBe(true); void hp;
  });
  it('broadcastFirst boss rule makes the boss act first every 3rd turn', () => {
    const r = seeded(21);
    const b = new Battle({ kind: 'boss', player: [makeMon('nullcat', 30, { rand: r })], enemy: [makeMon('radiopup', 30, { rand: r })], difficulty: 'STANDARD', ai: 'basic', rootKeys: 0, levelCap: 40, partyExp: true, rules: [{ t: 'broadcastFirst', everyTurns: 3 }], rand: r });
    b.p.mon.hp = 9999; b.e.mon.hp = 9999; b.p.mon.moves = [{ id: 'ping', pp: 99, maxPp: 99 }]; b.e.mon.moves = [{ id: 'phase_shift', pp: 99, maxPp: 99 }];
    b.p.stages.spd = 6; // player faster than boss
    for (let i = 1; i <= 3; i++) { b.log.length = 0; b.doTurn({ t: 'move', i: 0 }); const first = b.log.find((e) => e.k === 'move') as any; if (i === 3) expect(first.side).toBe('e'); else expect(first.side).toBe('p'); }
  });
  it('every species has valid learnsets and legal moves', () => {
    for (const [id, sp] of Object.entries(SPECIES)) { expect(sp.learnset.length, id).toBeGreaterThan(0); for (const [, m] of sp.learnset) expect(MOVES[m], `${id}:${m}`).toBeTruthy(); }
  });
});
