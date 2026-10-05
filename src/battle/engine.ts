import { MOVES, SPECIES, ABILITIES, STATUS, ITEMS } from '../data';
import type { Bytekin, BattleStat, StatusId, MoveData, MoveFx } from '../types';
import { calcStat, maxHp, displayName, addExp, learnMove, LevelUpResult } from '../core/mon';
import { typeMult, stageMult, STATUS_IMMUNE_TYPE, PERSISTENT_STATUS, STAT_NAMES, expMultiplier } from './rules';
import { containChance, rollContain } from './contain';
import { chooseAction } from './ai';

export type Side = 'p' | 'e';
export type BEvent =
  | { k: 'msg'; text: string }
  | { k: 'move'; side: Side; move: string }
  | { k: 'hp'; side: Side; hp: number; max: number; dmg?: number; heal?: number }
  | { k: 'stab'; side: Side; v: number }
  | { k: 'status'; side: Side; status: StatusId | null }
  | { k: 'stat'; side: Side; stat: BattleStat; n: number }
  | { k: 'eff'; mult: number; crit?: boolean }
  | { k: 'faint'; side: Side }
  | { k: 'send'; side: Side; idx: number }
  | { k: 'field'; id: string | null }
  | { k: 'contain'; shakes: number; ok: boolean }
  | { k: 'exp'; uid: string; amount: number; bar: number; level: number }
  | { k: 'levelup'; uid: string; level: number; learned: string[]; pending: string[] }
  | { k: 'flee'; side: Side }
  | { k: 'rule'; id: string }
  | { k: 'over'; result: 'win' | 'lose' | 'ran' | 'contained' | 'fled' };

export type Action =
  | { t: 'move'; i: number }
  | { t: 'switch'; to: number }
  | { t: 'item'; id: string; target: number; moveIdx?: number }
  | { t: 'contain'; module?: string }
  | { t: 'run' }
  | { t: 'struggle' }
  | { t: 'flee' };

export type BossRule = { t: 'cacheLink'; everyTurns: number; pct: number; breakBelow: number } | { t: 'broadcastFirst'; everyTurns: number; text?: string }
export interface BattleConfig {
  kind: 'wild' | 'trainer' | 'boss';
  player: Bytekin[]; enemy: Bytekin[];
  difficulty: 'CASUAL' | 'STANDARD' | 'EXPERT';
  ai: 'random' | 'basic' | 'smart';
  rules?: BossRule[];
  rootKeys: number; levelCap: number; partyExp: boolean;
  trainerName?: string; rand?: () => number;
  playerFirst?: number;
}

export interface Fighter {
  mon: Bytekin; side: Side;
  stages: Record<BattleStat, number>;
  stab: number; turnsOut: number; statusTurns: number; lastMove?: string; retryUsed: boolean; ghostUsed: boolean;
  lowStabFlag: boolean; fleeing: boolean; potionUsed?: boolean; participants?: Set<string>; loopLeft: number; linkBroken?: boolean;
}

const newStages = () => ({ atk: 0, def: 0, sys: 0, spd: 0 });

export class Battle {
  cfg: BattleConfig;
  rand: () => number;
  p: Fighter; e: Fighter;
  pParty: Bytekin[]; eParty: Bytekin[];
  turn = 0;
  field: { id: string; turns: number } | null = null;
  over: null | 'win' | 'lose' | 'ran' | 'contained' | 'fled' = null;
  needSwitch = false;
  participants = new Set<string>();
  runAttempts = 0;
  log: BEvent[] = [];
  expGained: Record<string, number> = {};
  pendingLearn: { uid: string; moves: string[] }[] = [];
  trainerPotions = 1; priorityTurn = false;
  stabBattleLow: Record<string, boolean> = {};

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.rand = cfg.rand ?? Math.random;
    this.pParty = cfg.player; this.eParty = cfg.enemy;
    const first = cfg.playerFirst ?? Math.max(0, cfg.player.findIndex((m) => m.hp > 0));
    this.p = this.mkFighter(cfg.player[first], 'p');
    this.e = this.mkFighter(cfg.enemy[0], 'e');
    this.participants.add(this.p.mon.uid);
  }
  mkFighter(mon: Bytekin, side: Side): Fighter {
    return { mon, side, stages: newStages(), stab: 100, turnsOut: 0, statusTurns: 0, retryUsed: false, ghostUsed: false, lowStabFlag: false, fleeing: false, loopLeft: 0 };
  }
  fighter(side: Side) { return side === 'p' ? this.p : this.e; }
  foe(side: Side) { return side === 'p' ? this.e : this.p; }
  nameOf(f: Fighter) { return (f.side === 'e' && this.cfg.kind === 'wild' ? 'Wild ' : f.side === 'e' && this.cfg.trainerName ? '' : '') + displayName(f.mon); }
  ev(e: BEvent) { this.log.push(e); }
  msg(t: string) { this.ev({ k: 'msg', text: t }); }

  // ---- stat helpers ----
  stat(f: Fighter, s: 'atk' | 'def' | 'sys' | 'spd'): number {
    let v = calcStat(f.mon, s) * stageMult(f.stages[s]);
    if (s === 'atk' && f.mon.status === 'OVERLOADED') v *= 0.5;
    if (s === 'def' && f.mon.status === 'FRAGMENTED') v *= 0.75;
    if (s === 'spd' && f.mon.status === 'DESYNCED') v *= 0.75;
    if (f.mon.ability === 'OVERCLOCK') { if (s === 'spd') v *= 1.3; if (s === 'def') v *= 0.9; }
    if (f.side === 'e' && s === 'atk' && SPECIES[f.mon.species].stab === 'frenzy' && f.stab < 30) v *= 1.5;
    return Math.max(1, v);
  }
  usable(f: Fighter): number[] {
    const out: number[] = [];
    f.mon.moves.forEach((m, i) => { if (m.pp > 0) out.push(i); });
    return out;
  }

  // ---- public turn API ----
  /** Resolve one full turn. Returns the events generated (also appended to this.log). */
  doTurn(pAct: Action): BEvent[] {
    const start = this.log.length;
    if (this.over) return [];
    this.turn++;
    this.priorityTurn = false;
    for (const r of this.cfg.rules ?? []) if (r.t === 'broadcastFirst' && this.turn % r.everyTurns === 0 && this.e.mon.hp > 0) { this.priorityTurn = true; this.msg(r.text ?? 'The foe tuned to a priority channel!'); this.ev({ k: 'rule', id: 'broadcastFirst' }); }
    const eAct = this.cfg.kind === 'wild' && this.e.fleeing ? ({ t: 'flee' } as Action) : chooseAction(this, 'e');
    const order = this.order(pAct, eAct);
    for (const [side, act] of order) {
      if (this.over) break;
      const f = this.fighter(side);
      if (f.mon.hp <= 0 && act.t !== 'switch') continue;
      this.runAction(side, act);
      this.checkFaints();
      if (this.over || this.needSwitch) break;
    }
    if (!this.over && !this.needSwitch) this.endOfTurn();
    return this.log.slice(start);
  }

  /** Player chose a replacement after a faint. */
  forceSwitch(to: number): BEvent[] {
    const start = this.log.length;
    this.switchIn('p', to, true);
    this.needSwitch = false;
    if (!this.over) this.endOfTurnFlags();
    return this.log.slice(start);
  }

  order(pAct: Action, eAct: Action): [Side, Action][] {
    const pri = (side: Side, a: Action) => {
      if (a.t === 'switch') return 7;
      if (a.t === 'item' || a.t === 'contain' || a.t === 'run' || a.t === 'flee') return 8;
      if (a.t === 'struggle') return 0;
      const f = this.fighter(side); const mv = MOVES[f.mon.moves[a.i].id];
      let p = mv.pri ?? 0; if (f.mon.ability === 'QUICK_BOOT' && f.turnsOut === 0) p += 1;
      if (side === 'e' && this.priorityTurn) p += 5;
      return p;
    };
    const items: [Side, Action, number, number][] = [
      ['p', pAct, pri('p', pAct), this.stat(this.p, 'spd')],
      ['e', eAct, pri('e', eAct), this.stat(this.e, 'spd')],
    ];
    items.sort((a, b) => b[2] - a[2] || b[3] - a[3] || (this.rand() < 0.5 ? -1 : 1));
    return items.map((i) => [i[0], i[1]]);
  }

  runAction(side: Side, a: Action) {
    const f = this.fighter(side);
    switch (a.t) {
      case 'switch': this.switchIn(side, a.to, false); return;
      case 'item': this.useItem(a); return;
      case 'contain': this.attemptContain(a.module); return;
      case 'run': this.attemptRun(); return;
      case 'flee': this.doFlee(side); return;
      case 'struggle': this.useStruggle(f); return;
      case 'move': this.useMove(f, a.i); return;
    }
  }

  doFlee(side: Side) {
    this.msg(`${this.nameOf(this.fighter(side))} slipped back into the Signal!`);
    this.ev({ k: 'flee', side }); this.over = 'fled'; this.ev({ k: 'over', result: 'fled' });
  }

  // ---- switching ----
  switchIn(side: Side, idx: number, forced: boolean) {
    const party = side === 'p' ? this.pParty : this.eParty;
    const old = this.fighter(side);
    if (!forced && old.mon.hp > 0) this.msg(`${side === 'p' ? 'Come back, ' : ''}${displayName(old.mon)}${side === 'p' ? '!' : ' withdrew!'}`);
    this.endBenchEffects(old);
    const nf = this.mkFighter(party[idx], side);
    if (side === 'p') this.p = nf; else this.e = nf;
    if (side === 'p') this.participants.add(nf.mon.uid);
    else { this.participants = new Set([this.p.mon.uid]); }
    this.ev({ k: 'send', side, idx });
    this.msg(side === 'p' ? `Go, ${displayName(nf.mon)}!` : `${this.cfg.trainerName ?? 'Foe'} sent out ${displayName(nf.mon)}!`);
    this.ev({ k: 'hp', side, hp: nf.mon.hp, max: maxHp(nf.mon) });
    this.ev({ k: 'status', side, status: nf.mon.status });
    this.ev({ k: 'stab', side, v: nf.stab });
  }
  endBenchEffects(_f: Fighter) { /* hook */ }

  // ---- items / contain / run ----
  useItem(a: Extract<Action, { t: 'item' }>) {
    const it = ITEMS[a.id]; if (!it) return;
    const fx = it.fx;
    if (fx.stab !== undefined) {
      this.msg(`Used ${it.name}!`);
      this.changeStab(this.e, fx.stab, true); return;
    }
    const m = this.pParty[a.target];
    if (!m) return;
    this.msg(`Used ${it.name} on ${displayName(m)}.`);
    if (fx.revive !== undefined) { if (m.hp <= 0) { m.hp = Math.max(1, Math.floor((maxHp(m) * fx.revive) / 100)); m.status = null; } }
    if (fx.heal !== undefined && m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + fx.heal);
    if (fx.healPct !== undefined && m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + Math.floor((maxHp(m) * fx.healPct) / 100));
    if (fx.cure && m.status) m.status = null;
    if (fx.pp && a.moveIdx !== undefined) m.moves[a.moveIdx].pp = Math.min(m.moves[a.moveIdx].maxPp, m.moves[a.moveIdx].pp + fx.pp);
    const side: Side = 'p';
    if (m === this.p.mon) { this.ev({ k: 'hp', side, hp: m.hp, max: maxHp(m) }); this.ev({ k: 'status', side, status: m.status }); }
  }
  containProbability(moduleMult = 1): number {
    const f = this.e;
    const p = containChance({ species: f.mon.species, hp: f.mon.hp, maxHp: maxHp(f.mon), stab: f.stab, status: f.mon.status, rootKeys: this.cfg.rootKeys, moduleMult, difficulty: this.cfg.difficulty });
    return (this as any).tutorial ? Math.max(p, 0.92) : p;
  }
  attemptContain(moduleId?: string) {
    if (this.cfg.kind !== 'wild') { this.msg('The Debugger cannot CONTAIN another Debugger\'s Bytekin!'); return; }
    const mult = moduleId ? ITEMS[moduleId]?.fx.containMult ?? 1 : 1;
    this.msg('Debugger: CONTAIN!');
    const p = this.containProbability(mult);
    const r = rollContain(p, this.rand);
    this.ev({ k: 'contain', shakes: r.shakes, ok: r.ok });
    if (r.ok) {
      this.msg(`Gotcha! ${displayName(this.e.mon)} was stabilized!`);
      this.over = 'contained'; this.ev({ k: 'over', result: 'contained' });
    } else {
      this.msg(r.shakes >= 2 ? 'So close! It broke free!' : r.shakes === 1 ? 'It broke free!' : 'It resisted instantly!');
    }
  }
  attemptRun() {
    if (this.cfg.kind !== 'wild') { this.msg('No running from a Debugger battle!'); return; }
    this.runAttempts++;
    const ps = this.stat(this.p, 'spd'), es = this.stat(this.e, 'spd');
    const chance = Math.max(0.3, Math.min(1, 0.5 + (ps - es) / (es * 2) + 0.15 * this.runAttempts));
    if (this.rand() < chance) { this.msg('Got away safely!'); this.over = 'ran'; this.ev({ k: 'over', result: 'ran' }); }
    else this.msg("Can't escape!");
  }

  // ---- moves ----
  /** When every move is out of PP: a weak typeless-ish hit that hurts the user. */
  useStruggle(f: Fighter) {
    const foe = this.foe(f.side);
    if (!this.canAct(f)) return;
    this.msg(`${this.nameOf(f)} has no PP left!`); this.msg(`${this.nameOf(f)} used STRUGGLE!`);
    this.ev({ k: 'move', side: f.side, move: 'struggle' });
    const mv = MOVES.struggle;
    const r = this.dealDamage(f, foe, mv, 'struggle');
    if (r) { const rec = Math.max(1, Math.floor(maxHp(f.mon) / 4)); this.msg(`${this.nameOf(f)} was hurt by recoil!`); this.applyDamage(f, rec, undefined); }
  }
  canAct(f: Fighter): boolean {
    const st = f.mon.status;
    if (st === 'FROZEN') {
      if (this.rand() < 0.25) { f.mon.status = null; this.ev({ k: 'status', side: f.side, status: null }); this.msg(`${this.nameOf(f)} thawed out!`); return true; }
      this.msg(`${this.nameOf(f)} is frozen solid!`); return false;
    }
    if (st === 'CACHED') {
      if (f.statusTurns > 0) { f.statusTurns--; this.msg(`${this.nameOf(f)} is still loading...`); return false; }
      f.mon.status = null; this.ev({ k: 'status', side: f.side, status: null }); this.msg(`${this.nameOf(f)} finished loading!`); return true;
    }
    if (st === 'DESYNCED' && this.rand() < 1 / 3) { this.msg(`${this.nameOf(f)} is out of sync!`); return false; }
    return true;
  }
  useMove(f: Fighter, idx: number) {
    const foe = this.foe(f.side);
    let slot = f.mon.moves[idx];
    if (f.mon.status === 'LOOPED' && f.lastMove && f.loopLeft > 0) {
      const looped = f.mon.moves.findIndex((m) => m.id === f.lastMove);
      if (looped >= 0 && f.mon.moves[looped].pp > 0) { idx = looped; slot = f.mon.moves[looped]; this.msg(`${this.nameOf(f)} repeats itself!`); }
      f.loopLeft--; if (f.loopLeft <= 0) { f.mon.status = null; this.ev({ k: 'status', side: f.side, status: null }); this.msg(`${this.nameOf(f)} broke the loop.`); }
    }
    if (!this.canAct(f)) return;
    const mv: MoveData = MOVES[slot.id];
    if (mv.cat === 'status' && f.mon.status === 'MUTED') { this.msg(`${this.nameOf(f)} is muted and cannot use ${mv.name}!`); return; }
    slot.pp = Math.max(0, slot.pp - 1);
    f.lastMove = slot.id;
    this.msg(`${this.nameOf(f)} used ${mv.name}!`);
    this.ev({ k: 'move', side: f.side, move: slot.id });
    // copy
    if (mv.fx.some((x) => x.t === 'copyLast')) {
      const copy = foe.lastMove;
      if (!copy || copy === slot.id) { this.msg('But it failed!'); return; }
      const cm = MOVES[copy];
      this.msg(`${this.nameOf(f)} copied ${cm.name}!`);
      this.resolveMove(f, foe, cm, copy); return;
    }
    this.resolveMove(f, foe, mv, slot.id);
  }

  resolveMove(f: Fighter, foe: Fighter, mv: MoveData, id: string) {
    // accuracy
    if (mv.acc > 0 || mv.cat !== 'status') {
      let acc = mv.acc;
      if (acc > 0) {
        if (foe.mon.ability === 'PACKET_LOSS' && f !== foe) acc *= 0.85;
        const selfTarget = mv.cat === 'status' && !mv.fx.some((x: MoveFx) => 'who' in x && (x as any).who === 'foe') && !mv.fx.some((x) => x.t === 'stab' && x.who !== 'self');
        if (!selfTarget && this.rand() * 100 >= acc) { this.msg(`${this.nameOf(f)}'s attack missed!`); return; }
      }
    }
    if (mv.cat !== 'status') {
      const multi = mv.fx.find((x) => x.t === 'multi') as Extract<MoveFx, { t: 'multi' }> | undefined;
      const hits = multi ? multi.min + Math.floor(this.rand() * (multi.max - multi.min + 1)) : 1;
      let landed = 0;
      for (let h = 0; h < hits; h++) {
        if (foe.mon.hp <= 0) break;
        const r = this.dealDamage(f, foe, mv, id);
        if (!r) break;
        landed++;
        if (h === 0 || true) this.applyDamageFx(f, foe, mv, r.dmg);
      }
      if (multi && landed > 1) this.msg(`Hit ${landed} times!`);
    }
    this.applyStatusFx(f, foe, mv);
  }

  dealDamage(f: Fighter, foe: Fighter, mv: MoveData, id: string): { dmg: number } | null {
    const spA = SPECIES[f.mon.species];
    const useAtk = mv.cat === 'hit';
    let A = this.stat(f, useAtk ? 'atk' : 'sys');
    const D0 = this.stat(foe, useAtk ? 'def' : 'sys');
    let D = D0;
    if (f.mon.ability === 'ROOT_ACCESS') { A = calcStat(f.mon, useAtk ? 'atk' : 'sys'); D = calcStat(foe.mon, useAtk ? 'def' : 'sys'); }
    const lv = f.mon.level;
    let dmg = Math.floor(Math.floor((Math.floor((2 * lv) / 5 + 2) * mv.power * A) / D) / 70) + 2;
    const stabBonus = spA.types.includes(mv.type) ? 1.5 : 1;
    const eff = typeMult(mv.type, SPECIES[foe.mon.species].types);
    const crit = mv.fx.some((x) => x.t === 'crit') ? this.rand() < 0.25 : this.rand() < 1 / 16;
    let m = stabBonus * eff * (crit ? 1.5 : 1) * (0.85 + this.rand() * 0.15);
    if (mv.fx.some((x) => x.t === 'unstable')) m *= 0.5 + this.rand() * 1.3;
    if (foe.mon.ability === 'DEEP_CACHE' && foe.mon.hp >= maxHp(foe.mon)) m *= 0.6;
    if (foe.mon.ability === 'GHOST_PROCESS' && !foe.ghostUsed) { m *= 0.5; foe.ghostUsed = true; }
    if (f.side === 'e') m *= this.cfg.difficulty === 'CASUAL' ? 0.85 : this.cfg.difficulty === 'EXPERT' ? 1.1 : 1;
    if (f.side === 'e' && (this as any).tutorial) m *= 0.6;
    dmg = Math.max(1, Math.floor(dmg * m));
    if (eff === 0) { this.msg('It had no effect...'); return null; }
    this.ev({ k: 'eff', mult: eff, crit });
    if (eff > 1) this.msg("It's super effective!"); else if (eff < 1) this.msg("It's not very effective...");
    if (crit) this.msg('A critical hit!');
    this.applyDamage(foe, dmg, f);
    // static skin
    if (foe.mon.ability === 'STATIC_SKIN' && useAtk && foe.mon.hp > 0 && this.rand() < 0.3) this.inflict(f, 'OVERLOADED', foe);
    return { dmg };
  }

  applyDamage(target: Fighter, dmg: number, source?: Fighter, silent = false) {
    const max = maxHp(target.mon);
    let d = Math.min(target.mon.hp, dmg);
    if (d >= target.mon.hp && target.mon.ability === 'RETRY' && !target.retryUsed && target.mon.hp > 1) {
      target.retryUsed = true; d = target.mon.hp - 1; this.msg(`${this.nameOf(target)}'s RETRY kept it at 1 HP!`);
    } else if (d >= target.mon.hp && target.mon.ability === 'RETRY' && !target.retryUsed && target.mon.hp === 1) {
      target.retryUsed = true; d = 0; this.msg(`${this.nameOf(target)}'s RETRY held on!`);
    }
    target.mon.hp -= d;
    if (!silent) this.ev({ k: 'hp', side: target.side, hp: target.mon.hp, max, dmg: d });
    if (d > 0) {
      let mult = 0.4;
      if (target.side === 'e' && this.cfg.kind === 'boss') mult = 0.65;
      if (SPECIES[target.mon.species].stab === 'calm') mult *= 0.5;
      if (target.mon.status === 'FRAGMENTED') mult *= 1.5;
      this.changeStab(target, -Math.max(1, Math.round((d / max) * 100 * mult)), true, true);
    }
    void source;
  }

  changeStab(f: Fighter, delta: number, announce = false, quiet = false) {
    const old = f.stab;
    f.stab = Math.max(0, Math.min(100, f.stab + delta));
    this.ev({ k: 'stab', side: f.side, v: f.stab });
    if (announce && !quiet && f.stab !== old) this.msg(`${this.nameOf(f)}'s Stability ${delta < 0 ? 'dropped' : 'rose'}! (${f.stab}%)`);
    if (f.side === 'e' && f.stab <= 30 && old > 30 && SPECIES[f.mon.species].stab === 'frenzy' && f.mon.hp > 0) this.msg(`${this.nameOf(f)} is going berserk!`);
    if (f.side === 'e' && f.stab <= 30 && old > 30 && SPECIES[f.mon.species].stab === 'flee' && f.mon.hp > 0 && this.cfg.kind === 'wild') this.msg(`${this.nameOf(f)} looks ready to bolt!`);
  }

  applyDamageFx(f: Fighter, foe: Fighter, mv: MoveData, dmg: number) {
    for (const fx of mv.fx) {
      if (fx.t === 'drain') { const h = Math.max(1, Math.floor((dmg * fx.pct) / 100)); this.heal(f, h); this.msg(`${this.nameOf(f)} drained energy!`); }
      if (fx.t === 'recoil') { const r = Math.max(1, Math.floor((dmg * fx.pct) / 100)); this.msg(`${this.nameOf(f)} was hurt by recoil!`); this.applyDamage(f, r, undefined); }
      if (fx.t === 'stab' && foe.mon.hp > 0 && (fx.who ?? 'foe') === 'foe') this.changeStab(foe, fx.amt, false, true);
      if (fx.t === 'status' && foe.mon.hp > 0 && fx.who === 'foe' && this.rand() * 100 < fx.chance) this.inflict(foe, fx.status, f);
      if (fx.t === 'status' && fx.who === 'self' && this.rand() * 100 < fx.chance) this.inflict(f, fx.status, f);
      if (fx.t === 'stat' && this.rand() < 1) this.stageChange(fx.who === 'self' ? f : foe, fx.stat, fx.n);
    }
  }
  applyStatusFx(f: Fighter, foe: Fighter, mv: MoveData) {
    if (mv.cat !== 'status') return;
    for (const fx of mv.fx) {
      switch (fx.t) {
        case 'stat': this.stageChange(fx.who === 'self' ? f : foe, fx.stat, fx.n); break;
        case 'status': if (this.rand() * 100 < fx.chance) this.inflict(fx.who === 'self' ? f : foe, fx.status, f); break;
        case 'heal': this.heal(f, Math.floor((maxHp(f.mon) * fx.pct) / 100)); break;
        case 'cure': if (f.mon.status) { f.mon.status = null; this.ev({ k: 'status', side: f.side, status: null }); this.msg(`${this.nameOf(f)}'s condition cleared.`); } break;
        case 'stab': if ((fx.who ?? 'foe') === 'self') this.changeStab(f, fx.amt, true); else this.changeStab(foe, fx.amt, true); break;
        case 'field': this.field = { id: fx.id, turns: fx.turns }; this.ev({ k: 'field', id: fx.id }); this.msg(fx.id === 'NULL_FIELD' ? 'A NULL FIELD spreads! Stat changes are erased.' : 'The field changed!'); break;
        case 'reboot':
          f.mon.hp = maxHp(f.mon); f.mon.status = 'CACHED'; f.statusTurns = 2;
          this.ev({ k: 'hp', side: f.side, hp: f.mon.hp, max: maxHp(f.mon), heal: 1 }); this.ev({ k: 'status', side: f.side, status: 'CACHED' });
          this.msg(`${this.nameOf(f)} rebooted and is loading...`); break;
        default: break;
      }
    }
  }
  heal(f: Fighter, amt: number) {
    const max = maxHp(f.mon); const before = f.mon.hp;
    f.mon.hp = Math.min(max, f.mon.hp + amt);
    if (f.mon.hp !== before) this.ev({ k: 'hp', side: f.side, hp: f.mon.hp, max, heal: f.mon.hp - before });
  }
  stageChange(f: Fighter, s: BattleStat, n: number) {
    const old = f.stages[s];
    f.stages[s] = Math.max(-6, Math.min(6, old + n));
    if (f.stages[s] === old) { this.msg(`${this.nameOf(f)}'s ${STAT_NAMES[s]} won't go ${n > 0 ? 'higher' : 'lower'}!`); return; }
    this.ev({ k: 'stat', side: f.side, stat: s, n });
    this.msg(`${this.nameOf(f)}'s ${STAT_NAMES[s]} ${n > 1 ? 'rose sharply' : n > 0 ? 'rose' : n < -1 ? 'fell harshly' : 'fell'}!`);
  }
  inflict(f: Fighter, st: StatusId, src?: Fighter) {
    if (f.mon.hp <= 0 || f.mon.status) return;
    const imm = STATUS_IMMUNE_TYPE[st];
    if (imm && SPECIES[f.mon.species].types.includes(imm)) { this.msg(`${this.nameOf(f)} is immune to ${st}!`); return; }
    if (f.mon.ability === 'FAILSAFE' && f.mon.hp > maxHp(f.mon) / 2 && src !== f) { this.msg(`${this.nameOf(f)}'s FAILSAFE blocked ${st}!`); return; }
    f.mon.status = st;
    f.statusTurns = st === 'CACHED' ? 1 + Math.floor(this.rand() * 3) : st === 'MUTED' ? 4 : 0;
    if (st === 'LOOPED') f.loopLeft = 3;
    this.ev({ k: 'status', side: f.side, status: st });
    this.msg(`${this.nameOf(f)} ${STATUS[st].verb}`);
  }

  // ---- faints & flow ----
  checkFaints() {
    for (const side of ['e', 'p'] as Side[]) {
      const f = this.fighter(side);
      if (f.mon.hp > 0 || (f as any)._fainted === f.mon.uid) continue;
      (f as any)._fainted = f.mon.uid;
      f.mon.status = null;
      this.msg(`${this.nameOf(f)} fainted!`);
      this.ev({ k: 'faint', side });
      if (side === 'e') { this.awardExp(); this.nextEnemy(); }
      else {
        if (!this.pParty.some((m) => m.hp > 0)) { this.over = 'lose'; this.msg('You are out of usable Bytekin!'); this.ev({ k: 'over', result: 'lose' }); }
        else this.needSwitch = true;
      }
    }
  }
  nextEnemy() {
    const idx = this.eParty.findIndex((m) => m.hp > 0);
    if (idx < 0) { this.over = 'win'; this.msg(this.cfg.kind === 'wild' ? 'The wild Bytekin was defeated!' : `You defeated ${this.cfg.trainerName ?? 'the Debugger'}!`); this.ev({ k: 'over', result: 'win' }); return; }
    this.switchIn('e', idx, true);
  }
  awardExp() {
    const e = this.e.mon; const sp = SPECIES[e.species];
    const base = Math.floor((sp.exp * e.level) / 7 * (this.cfg.kind === 'wild' ? 1 : 1.5));
    const party = this.pParty;
    for (const m of party) {
      if (m.hp <= 0) continue;
      const took = this.participants.has(m.uid);
      if (!took && !this.cfg.partyExp) continue;
      let amt = Math.max(1, Math.floor(base * (took ? 1 : 0.5) * expMultiplier(m.level, this.cfg.levelCap)));
      if (this.cfg.difficulty === 'CASUAL') amt = Math.floor(amt * 1.15);
      this.expGained[m.uid] = (this.expGained[m.uid] ?? 0) + amt;
      const before = m.level;
      const ups = addExp(m, amt);
      const sideFighter = m === this.p.mon;
      this.msg(`${displayName(m)} gained ${amt} EXP!`);
      this.ev({ k: 'exp', uid: m.uid, amount: amt, bar: 0, level: m.level });
      for (const up of ups) {
        const learned: string[] = []; const pending: string[] = [];
        for (const mv of up.learn) { if (learnMove(m, mv)) learned.push(mv); else pending.push(mv); }
        if (pending.length) this.pendingLearn.push({ uid: m.uid, moves: pending });
        this.ev({ k: 'levelup', uid: m.uid, level: up.newLevel, learned, pending });
        if (sideFighter) this.ev({ k: 'hp', side: 'p', hp: m.hp, max: maxHp(m) });
      }
      void before;
    }
  }

  endOfTurn() {
    // status ticks, abilities, boss rules, fields
    for (const side of ['p', 'e'] as Side[]) {
      const f = this.fighter(side);
      if (f.mon.hp <= 0) continue;
      const max = maxHp(f.mon);
      if (f.mon.status === 'CORRUPTED') { this.msg(`${this.nameOf(f)} ${STATUS.CORRUPTED.tick}`); this.applyDamage(f, Math.max(1, Math.floor(max / 8)), undefined); }
      if (f.mon.status === 'OVERLOADED') { this.msg(`${this.nameOf(f)} ${STATUS.OVERLOADED.tick}`); this.applyDamage(f, Math.max(1, Math.floor(max / 16)), undefined); }
      if (f.mon.status === 'MUTED') { f.statusTurns--; if (f.statusTurns <= 0) { f.mon.status = null; this.ev({ k: 'status', side, status: null }); this.msg(`${this.nameOf(f)} can speak again.`); } }
      if (f.mon.ability === 'AUTO_SAVE' && f.mon.hp > 0) this.heal(f, Math.max(1, Math.floor(max / 16)));
      if (f.mon.ability === 'MEMORY_LEAK' && f.mon.hp > 0) { const foe = this.foe(side); if (foe.mon.hp > 0) { const d = Math.max(1, Math.floor(maxHp(foe.mon) / 16)); this.msg(`${this.nameOf(foe)}'s data leaks away!`); this.applyDamage(foe, d, f); this.heal(f, d); } }
    }
    for (const m of this.pParty) if (m !== this.p.mon && m.hp > 0 && m.ability === 'BACKGROUND_TASK') m.hp = Math.min(maxHp(m), m.hp + Math.max(1, Math.floor(maxHp(m) / 16)));
    // stability behaviours (enemy)
    if (this.e.mon.hp > 0) {
      const b = SPECIES[this.e.mon.species].stab;
      if (b === 'regen' && this.e.stab < 100) this.changeStab(this.e, 4, false, true);
      if (b === 'flee' && this.cfg.kind === 'wild' && !(this as any).tutorial && this.e.stab <= 30 && this.rand() < 0.3) { this.checkFaints(); if (!this.over) { this.doFlee('e'); return; } }
    }
    // boss rules
    if (this.cfg.rules && this.e.mon.hp > 0) for (const r of this.cfg.rules) {
      if (r.t === 'cacheLink' && this.turn % r.everyTurns === 0) {
        if (this.e.stab >= r.breakBelow) { this.ev({ k: 'rule', id: 'cacheLink' }); this.msg('The CACHE LINK restores its Bytekin!'); this.heal(this.e, Math.max(1, Math.floor((maxHp(this.e.mon) * r.pct) / 100))); }
        else if (!this.e.linkBroken) { this.e.linkBroken = true; this.ev({ k: 'rule', id: 'cacheLinkBroken' }); this.msg('The CACHE LINK is broken! No more recovery!'); }
      }
    }
    // fields
    if (this.field) {
      if (this.field.id === 'NULL_FIELD') { for (const f of [this.p, this.e]) f.stages = newStages(); }
      this.field.turns--; if (this.field.turns <= 0) { this.field = null; this.ev({ k: 'field', id: null }); this.msg('The field faded.'); }
    }
    this.checkFaints();
    if (!this.over && !this.needSwitch) this.endOfTurnFlags();
  }
  endOfTurnFlags() {
    this.p.turnsOut++; this.e.turnsOut++;
  }

  /** Call when battle ends. Cleans status, tracks stability evolution stats. */
  finish() {
    for (const m of this.pParty) {
      if (m.status && !PERSISTENT_STATUS.includes(m.status)) m.status = null;
    }
    const pm = this.p.mon;
    if (pm.hp > 0 && this.p.stab < 20) pm.lowStabBattles++;
    else if (pm.hp > 0 && pm.lowStabBattles > 0 && this.p.stab >= 60) pm.lowStabBattles = Math.max(0, pm.lowStabBattles - 1);
  }
}

export function abilityName(id: string) { return ABILITIES[id]?.name ?? id; }
export type { LevelUpResult };
