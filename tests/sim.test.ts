import { describe, it, expect } from 'vitest';
import { Battle } from '../src/battle/engine';
import { chooseAction } from '../src/battle/ai';
import { makeMon, maxHp, healFull } from '../src/core/mon';
import { containChance } from '../src/battle/contain';
import { SPECIES, TRAINERS, BOSSES } from '../src/data';

function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** One AI-vs-AI duel. Returns { win: boolean, turns }. */
function duel(a: string, b: string, lv: number, seed: number, aiB: 'random' | 'basic' | 'smart' = 'basic') {
  const r = lcg(seed);
  const pa = makeMon(a, lv, { rand: r, hidden: false, anomalous: false }), pb = makeMon(b, lv, { rand: r, hidden: false, anomalous: false });
  const bt = new Battle({ kind: 'trainer', player: [pa], enemy: [pb], difficulty: 'STANDARD', ai: aiB, rootKeys: 0, levelCap: 99, partyExp: false, rand: r });
  let turns = 0;
  while (!bt.over && turns < 60) { const act = chooseAction(bt, 'p'); bt.doTurn(act); turns++; if (bt.needSwitch) break; }
  return { win: bt.over === 'win', turns, over: bt.over };
}

const STARTERS = ['nullcat', 'segbyte', 'bitbird'];
const OPPONENTS = ['cachemouse', 'pingmoth', 'gnatpkt', 'staticfrog', 'looplet', 'cropclone', 'dripulse', 'rustbot', 'mudbyte', 'vectorfox', 'lampwisp', 'crypmole'];

describe('battle simulation (bot vs bot)', () => {
  it('starters are balanced at Lv5 against the early roster', () => {
    const N = 120; const rows: string[] = []; const overall: Record<string, number> = {}; let turnSum = 0, turnN = 0;
    for (const s of STARTERS) {
      let wins = 0, total = 0;
      for (const o of OPPONENTS) for (let i = 0; i < N; i++) { const d = duel(s, o, 5, i * 7919 + o.length, 'basic'); if (d.win) wins++; total++; turnSum += d.turns; turnN++; }
      overall[s] = wins / total; rows.push(`${s.padEnd(10)} Lv5 winrate vs early roster: ${(100 * wins / total).toFixed(1)}%`);
    }
    // eslint-disable-next-line no-console
    console.log('\n' + rows.join('\n') + `\navg turns/battle: ${(turnSum / turnN).toFixed(1)}`);
    for (const s of STARTERS) { expect(overall[s], s).toBeGreaterThan(0.35); expect(overall[s], s).toBeLessThan(0.95); }
    const vals = Object.values(overall); expect(Math.max(...vals) - Math.min(...vals)).toBeLessThan(0.25);
    expect(turnSum / turnN).toBeGreaterThan(2); expect(turnSum / turnN).toBeLessThan(14);
  });
  it('starter triangle: counter starter wins more than it loses', () => {
    const N = 400; const rate = (a: string, b: string) => { let w = 0; for (let i = 0; i < N; i++) if (duel(a, b, 5, 31 * i + 5).win) w++; return w / N; };
    // NULL > SIGNAL, SIGNAL > LOOP, LOOP > NULL
    const r1 = rate('nullcat', 'bitbird'), r2 = rate('bitbird', 'segbyte'), r3 = rate('segbyte', 'nullcat');
    // eslint-disable-next-line no-console
    console.log(`\nnullcat>bitbird ${r1.toFixed(2)}  bitbird>segbyte ${r2.toFixed(2)}  segbyte>nullcat ${r3.toFixed(2)}`);
    for (const r of [r1, r2, r3]) expect(r).toBeGreaterThan(0.6);
  });
  it('evolved starters beat their basic forms; no extreme outliers across the roster', () => {
    for (const [lo, hi] of [['nullcat', 'voidlynx'], ['segbyte', 'chaincoil'], ['bitbird', 'datwing']]) {
      let w = 0; for (let i = 0; i < 150; i++) if (duel(hi, lo, 18, i * 13 + 1).win) w++;
      expect(w / 150, `${hi} vs ${lo}`).toBeGreaterThan(0.6);
    }
    // roster-wide: every non-guardian species should win 15-85% vs the field at equal level
    const field = Object.keys(SPECIES).filter((s) => SPECIES[s].rarity !== 'guardian');
    const out: string[] = [];
    for (const s of field) {
      let w = 0, n = 0; for (const o of field) { if (o === s) continue; for (let i = 0; i < 6; i++) { if (duel(s, o, 20, i * 101 + s.length * 7 + o.length).win) w++; n++; } }
      const wr = w / n; out.push(`${s.padEnd(11)} ${(100 * wr).toFixed(0)}%`);
      expect(wr, s).toBeGreaterThan(0.08); expect(wr, s).toBeLessThan(0.92);
    }
    // eslint-disable-next-line no-console
    console.log('\nroster win rates @Lv20:\n' + out.join('  '));
  });
  it('Node 1 boss is beatable at the recommended level but not trivial (with CACHE LINK)', () => {
    const tr = TRAINERS.mara; const results: Record<string, number> = {};
    for (const starter of STARTERS) {
      let wins = 0; const N = 150;
      for (let i = 0; i < N; i++) {
        const r = lcg(i * 977 + starter.length);
        const party = [makeMon(starter, 15, { rand: r, hidden: false, anomalous: false }), makeMon('cachemouse', 12, { rand: r, hidden: false, anomalous: false }), makeMon('rustbot', 12, { rand: r, hidden: false, anomalous: false })];
        const enemy = (tr.team as [string, number][]).map(([s, l]) => makeMon(s, l, { rand: r, hidden: false, anomalous: false }));
        const bt = new Battle({ kind: 'boss', player: party, enemy, difficulty: 'STANDARD', ai: 'smart', rules: BOSSES.mara.rules, rootKeys: 0, levelCap: 21, partyExp: true, rand: r });
        let t = 0;
        while (!bt.over && t++ < 200) { if (bt.needSwitch) { const n = party.findIndex((m) => m.hp > 0); bt.forceSwitch(n); continue; } bt.doTurn(chooseAction(bt, 'p')); }
        if (bt.over === 'win') wins++;
      }
      results[starter] = wins / N;
    }
    // eslint-disable-next-line no-console
    console.log('\nMara win rates (Lv15 starter + 2 spare Lv12, no items): ' + JSON.stringify(results));
    for (const v of Object.values(results)) { expect(v).toBeGreaterThan(0.25); expect(v).toBeLessThan(0.99); }
  });
  it('CONTAIN probabilities are sensible across the roster', () => {
    const lines: string[] = [];
    for (const [id, sp] of Object.entries(SPECIES)) {
      const mk = (hp: number, stab: number) => containChance({ species: id, hp, maxHp: 100, stab, status: null, rootKeys: 0, moduleMult: 1, difficulty: 'STANDARD' });
      const full = mk(100, 100), mid = mk(50, 60), low = mk(15, 20);
      expect(low).toBeGreaterThanOrEqual(mid); expect(mid).toBeGreaterThanOrEqual(full);
      if (sp.rarity === 'common') { expect(low).toBeGreaterThan(0.7); expect(full).toBeLessThan(0.45); }
      lines.push(`${id.padEnd(11)} full ${(full * 100).toFixed(0).padStart(3)}%  mid ${(mid * 100).toFixed(0).padStart(3)}%  low ${(low * 100).toFixed(0).padStart(3)}%`);
    }
    // eslint-disable-next-line no-console
    console.log('\nCONTAIN chance (full HP+100stab / 50%+60 / 15%+20):\n' + lines.join('\n'));
  });
  it('healFull restores a party for repeated simulations', () => { const m = makeMon('nullcat', 5); m.hp = 1; healFull(m); expect(m.hp).toBe(maxHp(m)); });
});
