import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { RANDOM_EVENTS } from '../src/data/dialogue';
import {
  KNOWN_EFFECT_KEYS, getEffectCost, previewEffect, resolveEffect, pickEvent, type EventState,
} from '../src/data/events';

const state = (over: Partial<EventState> = {}): EventState => ({
  hp: 2, maxHp: 3, coins: 100, perks: ['hair_trigger'], upgradable: ['hair_trigger'], coinScale: 1, eventHpLossBlock: 0, ...over,
});

const allKeys = [...new Set(RANDOM_EVENTS.flatMap((e) => e.choices.map((c) => c.effectKey)))];

describe('event effect keys', () => {
  it('has at least the 25 keys the narrative uses', () => {
    expect(allKeys.length).toBeGreaterThanOrEqual(25);
  });
  it('every effectKey in RANDOM_EVENTS has a handler and resolves across many seeds', () => {
    for (const key of allKeys) {
      expect(KNOWN_EFFECT_KEYS, key).toContain(key);
      for (let s = 0; s < 50; s++) {
        const o = resolveEffect(key, { rng: new Rng(s), state: state() });
        expect(o.effectKey).toBe(key);
        expect(o.blocked).toBeNull();
      }
    }
  });
  it('every handler is used by some event (no dead handlers)', () => {
    for (const k of KNOWN_EFFECT_KEYS) expect(allKeys, k).toContain(k);
  });
  it('unknown keys throw loudly everywhere', () => {
    for (const bad of ['', 'nope', 'gain_coins_huge', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(() => resolveEffect(bad, { rng: new Rng(1), state: state() }), bad).toThrow(/Unknown event effectKey/);
      expect(() => getEffectCost(bad), bad).toThrow(/Unknown event effectKey/);
      expect(() => previewEffect(bad, { rng: new Rng(1), state: state() }), bad).toThrow();
    }
  });
  it('paid choices are blocked, not applied, when the player cannot pay', () => {
    for (const key of allKeys.filter((k) => getEffectCost(k) > 0)) {
      const o = resolveEffect(key, { rng: new Rng(1), state: state({ coins: getEffectCost(key) - 1 }) });
      expect(o.blocked).toBe('cannot_afford');
      expect(o.coinsDelta).toBe(0);
      const ok = resolveEffect(key, { rng: new Rng(1), state: state({ coins: getEffectCost(key) }) });
      expect(ok.blocked).toBeNull();
    }
    expect(getEffectCost('pay_20')).toBe(20);
    expect(getEffectCost('none')).toBe(0);
  });
  it('is deterministic and preview matches the real outcome without consuming rng', () => {
    for (const key of allKeys) {
      const a = resolveEffect(key, { rng: new Rng(9), state: state() });
      const b = resolveEffect(key, { rng: new Rng(9), state: state() });
      expect(a).toEqual(b);
      const rng = new Rng(9); const st = rng.getState();
      const p = previewEffect(key, { rng, state: state() });
      expect(rng.getState()).toBe(st);
      expect(p).toEqual(a);
    }
  });
  it('effects mean what their names say', () => {
    const r = (k: string, s = state(), seed = 1) => resolveEffect(k, { rng: new Rng(seed), state: s });
    expect(r('heal_small')).toMatchObject({ hpDelta: 1 });
    expect(r('pay_10_heal_medium')).toMatchObject({ hpDelta: 2, coinsDelta: -10 });
    expect(r('pay_20').coinsDelta).toBe(-20);
    expect(r('gain_coins_small').coinsDelta).toBe(15);
    expect(r('gain_coins_small', state({ coinScale: 2 })).coinsDelta).toBe(30);
    expect(r('gain_coins_medium_lose_reputation').reputationDelta).toBe(-1);
    expect(r('gain_reputation_small').reputationDelta).toBe(1);
    expect(r('lose_hp_small').hpDelta).toBe(-1);
    expect(r('lose_hp_small', state({ eventHpLossBlock: 1 })).hpDelta).toBe(0); // Body Shield
    expect(r('gain_coins_large_lose_hp_small')).toMatchObject({ coinsDelta: 60, hpDelta: -1 });
    expect(r('pay_5_buff_luck').buffs.lucky).toBe(99);
    expect(r('gain_coins_small_debuff_luck').buffs.unlucky).toBe(99);
    expect(r('buff_awareness').buffs.awareness).toBe(1);
    expect(r('pay_15_buff_focus')).toMatchObject({ coinsDelta: -15, buffs: { focus: 1 } });
    expect(r('start_duel_bandit_bonus').startDuel).toEqual({ enemyId: 'bandit', bonusCoins: 30 });
    const up = r('pay_30_upgrade_weapon');
    expect(up.upgradePerk).toBe('hair_trigger');
    expect(up.coinsDelta).toBe(-30);
    const none = r('pay_30_upgrade_weapon', state({ upgradable: [] }));
    expect(none.upgradePerk).toBeNull();
    expect(none.coinsDelta).toBe(0); // never charged for nothing
    expect(r('upgrade_weapon_small_quest').flags).toContain('gunsmith_quest');
  });
  it('gambles take both branches across seeds and never overdraw', () => {
    for (const key of ['coinflip_coins_small', 'cheat_gamble_coins_large', 'buff_focus_small', 'gain_item_random_common', 'gain_coins_medium_bounty_risk']) {
      const seen = new Set<string>();
      for (let s = 0; s < 80; s++) {
        const o = resolveEffect(key, { rng: new Rng(s), state: state({ coins: 5 }) });
        expect(5 + o.coinsDelta).toBeGreaterThanOrEqual(0);
        seen.add(JSON.stringify([Math.sign(o.coinsDelta), Math.sign(o.hpDelta), Object.keys(o.buffs).length, o.grantPerks.length, o.grantItems.length, o.flags.length]));
      }
      expect(seen.size, key).toBeGreaterThan(1);
    }
  });
  it('random item grants only owned-free common perks or known consumables', () => {
    for (let s = 0; s < 200; s++) {
      const o = resolveEffect('gain_item_random_common_safe', { rng: new Rng(s), state: state() });
      expect(o.hpDelta).toBe(0);
      expect(o.grantPerks.length + o.grantItems.length).toBe(1);
      expect(o.grantPerks).not.toContain('hair_trigger');
    }
  });
  it('pickEvent avoids seen events until exhausted', () => {
    const seen: string[] = [];
    const rng = new Rng(2);
    for (let i = 0; i < RANDOM_EVENTS.length; i++) { const e = pickEvent(rng, seen); expect(seen).not.toContain(e.id); seen.push(e.id); }
    expect(() => pickEvent(rng, seen)).not.toThrow();
  });
});
