import { MOVES, SPECIES } from '../data';
import { typeMult } from './rules';
import { maxHp } from '../core/mon';
import type { Battle, Action, Side, Fighter } from './engine';

function expected(b: Battle, f: Fighter, foe: Fighter, moveId: string): number {
  const mv = MOVES[moveId];
  if (mv.cat === 'status') return 0;
  const eff = typeMult(mv.type, SPECIES[foe.mon.species].types);
  const stab = SPECIES[f.mon.species].types.includes(mv.type) ? 1.5 : 1;
  const acc = mv.acc === 0 ? 1 : mv.acc / 100;
  const multi = mv.fx.find((x) => x.t === 'multi') as any;
  const hits = multi ? (multi.min + multi.max) / 2 : 1;
  return mv.power * eff * stab * acc * hits;
}

function statusScore(b: Battle, f: Fighter, foe: Fighter, moveId: string): number {
  const mv = MOVES[moveId];
  if (mv.cat !== 'status') return 0;
  const hpF = f.mon.hp / maxHp(f.mon);
  let s = 8;
  for (const fx of mv.fx) {
    if (fx.t === 'heal') s += hpF < 0.5 ? 60 : hpF < 0.7 ? 20 : -30;
    if (fx.t === 'reboot') s += hpF < 0.35 ? 55 : -40;
    if (fx.t === 'cure') s += f.mon.status ? 30 : 0;
    if (fx.t === 'status' && fx.who === 'foe') s += foe.mon.status ? -40 : 28;
    if (fx.t === 'stat' && fx.who === 'self') s += f.stages[fx.stat] >= 2 ? -40 : f.turnsOut < 2 ? 22 : 6;
    if (fx.t === 'stat' && fx.who === 'foe') s += foe.stages[fx.stat] <= -2 ? -40 : 14;
    if (fx.t === 'stab') s += 6;
    if (fx.t === 'field') s += b.field ? -40 : 6;
    if (fx.t === 'copyLast') s += foe.lastMove ? 10 : -50;
  }
  if (f.mon.status === 'MUTED') s = -100;
  return s;
}

export function chooseAction(b: Battle, side: Side): Action {
  const f = b.fighter(side); const foe = b.foe(side);
  const usable = b.usable(f);
  if (usable.length === 0) return { t: 'move', i: 0 };
  const level = side === 'e' ? b.cfg.ai : 'basic';
  if (level === 'random') return { t: 'move', i: usable[(b.rand() * usable.length) | 0] };
  const hpF = f.mon.hp / maxHp(f.mon);
  // smart: consider switching on a terrible matchup
  if (level === 'smart' && side === 'e' && b.cfg.kind !== 'wild' && b.eParty.filter((m) => m.hp > 0).length > 1 && b.rand() < 0.35) {
    const best = Math.max(...usable.map((i) => expected(b, f, foe, f.mon.moves[i].id)));
    const incoming = Math.max(...foe.mon.moves.map((m) => typeMult(MOVES[m.id].type, SPECIES[f.mon.species].types) * (MOVES[m.id].cat === 'status' ? 0 : MOVES[m.id].power)));
    if (best < 40 && incoming > 100 && f.turnsOut > 0) {
      const cand = b.eParty.map((m, i) => ({ m, i })).filter(({ m }) => m.hp > 0 && m !== f.mon)
        .map(({ m, i }) => ({ i, s: Math.max(...m.moves.map((mv) => expected(b, { ...f, mon: m } as Fighter, foe, mv.id))) }))
        .sort((a, c) => c.s - a.s)[0];
      if (cand && cand.s > best * 1.8) return { t: 'switch', to: cand.i };
    }
  }
  let bestI = usable[0], bestS = -1e9;
  for (const i of usable) {
    const id = f.mon.moves[i].id; const mv = MOVES[id];
    let s = mv.cat === 'status' ? statusScore(b, f, foe, id) : expected(b, f, foe, id);
    // finishing blow bonus
    if (mv.cat !== 'status') {
      const approx = (expected(b, f, foe, id) * f.mon.level) / 30;
      if (approx >= foe.mon.hp) s += 40 + (mv.pri ?? 0) * 20;
    }
    s *= 0.85 + b.rand() * 0.3;
    if (level === 'basic') s *= 0.9 + b.rand() * 0.2;
    if (s > bestS) { bestS = s; bestI = i; }
  }
  return { t: 'move', i: bestI };
}
