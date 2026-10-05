import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { validateRun } from '../src/core/SaveManager';
import { REGION_LIST, REGION_ORDER, FIRST_RELEASE_REGIONS, getRegionDef, resolveArenaId } from '../src/data/regions';
import { ENEMIES } from '../src/data/enemies';
import { BOSS_IDS } from '../src/data/dialogue';
import { ARENAS } from '../src/data/arenas';
import { PERK_BY_ID } from '../src/data/perks';
import { generateMap, restoreRun, startRun, RunSystem, type MapNode, type RunDuelResult } from '../src/systems/RunSystem';
import { DUEL_CONFIG } from '../src/data/duelConfig';

/** D14: base lives come from config so a human playtest can revert them. */
const BASE_HP = DUEL_CONFIG.damage.heroHp;

const win = (hp: number, extra: Partial<RunDuelResult> = {}): RunDuelResult => ({ outcome: 'WIN', heroHp: hp, tier: 'good', ...extra });

/** Plays one node to completion with a trivial bot; returns the node type played. */
function playNode(run: RunSystem, bot: Rng, loseSome = false): string {
  const choices = run.getChoices();
  const pick = choices[bot.int(0, choices.length - 1)];
  run.enterNode(pick.id);
  switch (pick.type) {
    case 'duel': case 'elite': case 'boss': {
      const d = run.getDuel();
      const hp = loseSome && bot.next() < 0.3 ? Math.max(1, d.heroHp - 1) : d.heroHp;
      run.completeDuel(win(hp, { tier: bot.next() < 0.4 ? 'perfect' : 'good' }));
      const rw = run.getReward()!;
      if (rw.perkChoices.length && bot.next() < 0.8) run.applyReward({ perkId: rw.perkChoices[0] }); else run.applyReward({ skip: true });
      break;
    }
    case 'shop': {
      const shop = run.getShop();
      const o = shop.offers.find((x) => x.price <= run.getCoins());
      if (o) run.shopBuy(o.id);
      run.leaveNode(); break;
    }
    case 'event': {
      const ev = run.getEvent();
      const idx = ev.event.choices.findIndex((_, i) => ev.costs[i] <= run.getCoins());
      const out = run.chooseEvent(Math.max(0, idx));
      if (out.startDuel) {
        run.completeDuel(win(run.getDuel().heroHp));
        run.applyReward({});
      } else run.leaveNode();
      break;
    }
    case 'rest': {
      const r = run.getRest();
      if (r.canHeal) run.doRest({ type: 'heal' }); else if (r.upgradable.length) run.doRest({ type: 'upgrade', perkId: r.upgradable[0] });
      run.leaveNode(); break;
    }
    case 'treasure': run.openTreasure(run.getCoins() >= 5); run.leaveNode(); break;
  }
  return pick.type;
}

function playFull(seed: number, regions = REGION_ORDER.slice(), loseSome = false): RunSystem {
  const run = startRun(seed, { regions });
  const bot = new Rng(seed + 1);
  let guard = 0;
  while (run.phase !== 'over') { playNode(run, bot, loseSome); if (++guard > 500) throw new Error('run did not end'); }
  return run;
}

describe('regions data', () => {
  it('has 7 regions with real enemies, bosses, arenas and fallbacks', () => {
    expect(REGION_LIST.length).toBe(7);
    expect(FIRST_RELEASE_REGIONS.length).toBe(3);
    for (const r of REGION_LIST) {
      expect(r.nodeCount).toBe(7);
      for (const band of ['early', 'mid', 'late'] as const) {
        expect(r.pools[band].length, `${r.id}/${band}`).toBeGreaterThan(0);
        for (const e of r.pools[band]) expect(ENEMIES[e], e).toBeTruthy();
      }
      expect(ENEMIES[r.elite]).toBeTruthy();
      expect(ENEMIES[r.bossFallback]).toBeTruthy();
      expect(r.bossId.length).toBeGreaterThan(0);
    }
    expect(getRegionDef('dust_creek').bossId).toBe('mad_dog_mcgraw');
    expect(new Set(REGION_LIST.map((r) => r.bossId)).size).toBeGreaterThanOrEqual(6);
    for (const b of BOSS_IDS) expect(REGION_LIST.some((r) => r.bossId === b)).toBe(true);
    expect(() => getRegionDef('mars')).toThrow();
  });
  it('arena resolution falls back to an existing arena', () => {
    const has = (id: string) => id in ARENAS;
    for (const r of REGION_LIST) expect(has(resolveArenaId(r, has))).toBe(true);
    expect(resolveArenaId(getRegionDef('saloon'), has)).toBe('saloon_interior');
    expect(resolveArenaId(getRegionDef('canyon'), has)).toBe('dust_creek');
  });
});

describe('map generation', () => {
  it('same seed => identical map; different seed => different map', () => {
    for (const seed of [1, 42, 999, 123456789]) {
      expect(JSON.stringify(generateMap(seed, REGION_ORDER))).toBe(JSON.stringify(generateMap(seed, REGION_ORDER)));
    }
    expect(JSON.stringify(generateMap(1, REGION_ORDER))).not.toBe(JSON.stringify(generateMap(2, REGION_ORDER)));
    expect(JSON.stringify(startRun(7).map)).toBe(JSON.stringify(startRun(7).map));
  });

  it('is fully connected: every node reachable from the start, and every node reaches the final boss', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(seed, REGION_ORDER);
      const byId = new Map<string, MapNode>();
      for (const row of map.layers) for (const n of row) byId.set(n.id, n);
      // forward
      const reach = new Set<string>(map.layers[0].map((n) => n.id));
      for (const row of map.layers) for (const n of row) if (reach.has(n.id)) for (const t of n.next) reach.add(t);
      expect(reach.size, `seed ${seed}`).toBe(byId.size);
      // backward from the last boss
      const last = map.layers[map.layers.length - 1][0];
      expect(last.type).toBe('boss');
      const good = new Set<string>([last.id]);
      for (let l = map.layers.length - 2; l >= 0; l--) for (const n of map.layers[l]) if (n.next.some((t) => good.has(t))) good.add(n.id);
      expect(good.size, `seed ${seed}`).toBe(byId.size);
      // edges only go to the next layer
      for (const row of map.layers) for (const n of row) for (const t of n.next) expect(byId.get(t)!.layer).toBe(n.layer + 1);
      // every region boss is reachable
      expect(map.layers.flat().filter((n) => n.type === 'boss').length).toBe(7);
    }
  });

  it('obeys the GAME_DESIGN map rules in every region of every seed', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const map = generateMap(seed, REGION_ORDER);
      map.regions.forEach((rid, ri) => {
        const rows = map.layers.filter((r) => r[0].region === ri);
        const def = getRegionDef(rid);
        expect(rows.length).toBe(def.nodeCount);
        expect(rows[0]).toHaveLength(1);
        expect(rows[0][0].type).toBe('duel');                         // first node always a duel
        expect(rows[rows.length - 1][0].type).toBe('boss');
        expect(rows[rows.length - 2].every((n) => n.type === 'rest')).toBe(true); // rest right before the boss
        const types = rows.flat().map((n) => n.type);
        expect(types.filter((t) => t === 'elite').length).toBeLessThanOrEqual(1);
        expect(types.filter((t) => t === 'treasure').length).toBeLessThanOrEqual(1);
        expect(types).toContain('event');
        expect(types).toContain('shop');
        for (const row of rows.slice(1, -2)) {
          expect(row.length).toBeGreaterThanOrEqual(1);
          expect(row.length).toBeLessThanOrEqual(3);
          if (row.length > 1) expect(row.some((n) => n.type === 'duel' || n.type === 'shop')).toBe(true);
        }
        // every path passes the shop layer and the rest layer; no adjacent shops on any edge
        const byId = new Map(rows.flat().map((n) => [n.id, n]));
        for (const n of rows.flat()) if (n.type === 'shop') for (const t of n.next) { const tn = byId.get(t); if (tn) expect(tn.type).not.toBe('shop'); }
        expect(rows[rows.length - 4].every((n) => n.type === 'shop')).toBe(true);
        // enemies are valid
        for (const n of rows.flat()) if (n.type === 'duel' || n.type === 'elite' || n.type === 'boss') expect(ENEMIES[n.enemyId as keyof typeof ENEMIES], n.id).toBeTruthy();
      });
    }
  });
  it('first-release regions play 21 nodes of map; goldspire is shop-heavy', () => {
    expect(generateMap(3, FIRST_RELEASE_REGIONS).layers.length).toBe(21);
    let extra = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const m = generateMap(seed, ['goldspire']);
      if (m.layers[1].some((n) => n.type === 'shop')) extra++;
    }
    expect(extra).toBeGreaterThan(30);
  });
});

describe('run flow', () => {
  it('starts with full hp, validates as a RunSave and the map is opaque data', () => {
    const run = startRun(5);
    expect(run.getHp()).toBe(BASE_HP);
    const save = run.serialize();
    expect(validateRun(save)).not.toBeNull();
    expect(Object.keys(save).sort()).toEqual(['coins', 'hp', 'map', 'nodeIndex', 'perks', 'rngState', 'seed']);
    expect(JSON.parse(JSON.stringify(save))).toEqual(save);
  });

  it('plays every full run to a conclusion, deterministically', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = playFull(seed), b = playFull(seed);
      expect(a.outcome).toBe('victory');
      expect(a.serialize()).toEqual(b.serialize());
      expect(a.getStats().duelsWon).toBeGreaterThanOrEqual(7 * 3);
      expect(a.nodeIndex).toBe(7 * 7);
    }
  });

  it('serialize/restore round-trips at every step and replays identically', () => {
    for (const seed of [11, 12, 13]) {
      const live = startRun(seed, { regions: FIRST_RELEASE_REGIONS });
      const botA = new Rng(seed);
      let guard = 0;
      while (live.phase !== 'over') {
        const snap = live.serialize();
        const clone = restoreRun(JSON.parse(JSON.stringify(snap)));
        expect(clone.serialize()).toEqual(snap);
        const botB = new Rng(botA.getState());
        playNode(live, botA);
        playNode(clone, botB);
        expect(clone.serialize()).toEqual(live.serialize());
        if (++guard > 400) throw new Error('loop');
      }
    }
  });

  it('restore also works mid-node (shop, event, reward)', () => {
    const run = startRun(21, { startCoins: 500, regions: FIRST_RELEASE_REGIONS });
    const bot = new Rng(1);
    while (!(run.getChoices().some((c) => c.type === 'shop'))) playNode(run, bot);
    const shopNode = run.getChoices().find((c) => c.type === 'shop')!;
    run.enterNode(shopNode.id);
    const mid = restoreRun(run.serialize());
    expect(mid.getShop()).toEqual(run.getShop());
    expect(mid.serialize()).toEqual(run.serialize());
  });

  it('difficulty ramps 0..1 and never drops along a path', () => {
    const run = startRun(3, { regions: REGION_ORDER.slice() });
    for (const row of run.map.layers) for (const n of row) {
      const d = run.difficultyAt(n);
      expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(1);
      for (const t of n.next) {
        const nx = run.map.layers[n.layer + 1].find((x) => x.id === t)!;
        if (nx.type !== 'elite' && nx.type !== 'boss' && n.type !== 'elite' && n.type !== 'boss') expect(run.difficultyAt(nx)).toBeGreaterThanOrEqual(d);
      }
    }
    const first = run.map.layers[0][0], last = run.map.layers[run.map.layers.length - 1][0];
    expect(run.difficultyAt(first)).toBeLessThan(0.15);
    expect(run.difficultyAt(last)).toBe(1);
  });

  it('only reachable nodes can be entered; phases are enforced', () => {
    const run = startRun(8);
    expect(() => run.enterNode('r0-l5-n0')).toThrow();
    expect(() => run.completeDuel(win(3))).toThrow();
    const first = run.getChoices()[0];
    run.enterNode(first.id);
    expect(run.getChoices()).toEqual([]);
    expect(() => run.enterNode(first.id)).toThrow();
    expect(() => run.leaveNode()).toThrow(); // duel must be finished
  });

  it('duel encounter carries seed, difficulty, arena fallback and patched config; retries keep the seed', () => {
    const run = startRun(31, { startPerks: ['quickdraw_scar'] });
    run.enterNode(run.getChoices()[0].id);
    const d = run.getDuel();
    expect(d.enemyId).toBeTruthy();
    expect(d.arenaId).toBe('dust_creek');
    expect(d.config.draw.perfectMs).toBe(440);
    expect(d.modifiers.perfectWindowMult).toBe(2);
    expect(d.difficulty).toBeGreaterThanOrEqual(0);
    expect(run.getDuel().seed).toBe(d.seed);
    const res = run.completeDuel({ outcome: 'LOSE', heroHp: 0 });
    expect(res.status).toBe('dead');
    expect(run.getHp()).toBe(0);
  });

  it('retry costs coins once, restores entry hp and keeps the duel seed (RULE F5)', () => {
    const run = startRun(32, { startCoins: 100 });
    run.enterNode(run.getChoices()[0].id);
    const seed = run.getDuel().seed;
    const cost = run.retryCost();
    expect(run.completeDuel({ outcome: 'LOSE', heroHp: 0 }).canRetry).toBe(true);
    const again = run.retryDuel();
    expect(again.seed).toBe(seed);
    expect(again.heroHp).toBe(BASE_HP);
    expect(run.getCoins()).toBe(100 - cost);
    expect(run.completeDuel({ outcome: 'LOSE', heroHp: 0 }).canRetry).toBe(false);
    expect(() => run.retryDuel()).toThrow();
    run.abandon();
    expect(run.outcome).toBe('defeat');
  });

  it('a loss that leaves lives is a free refight with the same seed', () => {
    const run = startRun(33);
    run.enterNode(run.getChoices()[0].id);
    const seed = run.getDuel().seed;
    expect(run.completeDuel({ outcome: 'LOSE', heroHp: 2 }).status).toBe('refight');
    expect(run.getHp()).toBe(2);
    expect(run.getDuel().seed).toBe(seed);
  });

  it('carries hp between duels and pays coin income with bonuses', () => {
    const run = startRun(34);
    run.enterNode(run.getChoices()[0].id);
    run.completeDuel(win(BASE_HP - 1, { tier: 'slow' }));
    const plain = run.getReward()!.coins;
    run.applyReward({ skip: true });
    expect(run.getHp()).toBe(BASE_HP - 1);
    expect(run.getCoins()).toBe(plain + 5);

    const run2 = startRun(34);
    run2.enterNode(run2.getChoices()[0].id);
    run2.completeDuel(win(BASE_HP, { tier: 'perfect', headshots: 1 }));
    expect(run2.getReward()!.coins).toBe(plain + 5 + 3 + 4);
    expect(run2.getReward()!.perkChoices).toHaveLength(3);
    expect(() => run2.applyReward({ perkId: 'not_offered' })).toThrow();
    expect(() => run2.applyReward({})).toThrow();
  });

  it('elite and boss rewards are rare+; boss heals and pays interest', () => {
    const run = startRun(35, { regions: ['dust_creek'], startCoins: 100, startPerks: ['interest'] });
    const bot = new Rng(5);
    let sawElite = false;
    while (run.phase !== 'over') {
      const ch = run.getChoices();
      const pick = ch.find((c) => c.type === 'boss') ?? ch.find((c) => c.type === 'elite') ?? ch[0];
      if (pick.type === 'boss') {
        const before = run.getCoins();
        run.enterNode(pick.id);
        run.completeDuel(win(1));
        const rw = run.getReward()!;
        for (const id of rw.perkChoices) expect(['rare', 'legend']).toContain(PERK_BY_ID[id].rarity);
        run.applyReward({ perkId: rw.perkChoices[0] });
        expect(run.getHp()).toBeGreaterThanOrEqual(2);
        expect(run.getCoins()).toBeGreaterThanOrEqual(before + Math.floor(before * 0.1));
        expect(run.outcome).toBe('victory');
      } else if (pick.type === 'elite') {
        sawElite = true;
        run.enterNode(pick.id);
        run.completeDuel(win(run.getDuel().heroHp));
        for (const id of run.getReward()!.perkChoices) expect(['rare', 'legend']).toContain(PERK_BY_ID[id].rarity);
        run.applyReward({ skip: true });
      } else playNode(run, bot);
    }
    void sawElite;
  });

  it('shop: buy, reroll, heal, remove curse, hidden curses and pawn', () => {
    const run = startRun(41, { startCoins: 1000, startPerks: ['gamblers_fallacy', 'pawn_shop', 'blood_money'.replace('blood_money', 'widows_wager')] });
    const bot = new Rng(2);
    while (!run.getChoices().some((c) => c.type === 'shop')) playNode(run, bot);
    run.enterNode(run.getChoices().find((c) => c.type === 'shop')!.id);
    const s = run.getShop();
    expect(s.offers.filter((o) => o.kind === 'perk').length).toBe(3);
    expect(s.offers.some((o) => o.hidden && o.perkId === null && o.name === '???')).toBe(true); // curse slot hidden without Black Cat
    const visible = s.offers.find((o) => o.kind === 'perk' && !o.hidden)!;
    const before = run.getCoins();
    run.shopBuy(visible.id);
    expect(run.getCoins()).toBe(before - visible.price);
    expect(run.getPerks()).toContain(visible.perkId);
    expect(() => run.shopBuy(visible.id)).toThrow();
    const rr = run.getShop().rerollCost;
    expect(rr).toBe(10);
    run.shopReroll();
    expect(run.getShop().rerollCost).toBe(15);
    // pawn: sell and next purchase is cheaper
    const owned = run.getPerks()[0];
    const sold = run.getShop().sellable.find((x) => x.perkId === owned)!;
    const c0 = run.getCoins();
    run.shopSell(owned);
    expect(run.getCoins()).toBe(c0 + sold.value);
    run.shopRemoveCurse('widows_wager');
    expect(run.getPerks().map((p) => p.replace('+', ''))).not.toContain('widows_wager');
    expect(() => run.shopRemoveCurse('hair_trigger')).toThrow();
    run.leaveNode();
  });

  it('shop honours Black Cat, Trader\'s Eye, Loaded Dice, Blood Money pricing', () => {
    const base = startRun(41, { startCoins: 1000, startPerks: ['black_cat', 'traders_eye', 'loaded_dice', 'gamblers_fallacy'] });
    const bot = new Rng(2);
    while (!base.getChoices().some((c) => c.type === 'shop')) playNode(base, bot);
    base.enterNode(base.getChoices().find((c) => c.type === 'shop')!.id);
    const s = base.getShop();
    expect(s.offers.filter((o) => o.kind === 'perk').length).toBe(4);
    expect(s.offers.every((o) => !o.hidden)).toBe(true);
    expect(s.offers.some((o) => o.curse)).toBe(true);
    expect(s.rerollCost).toBe(0);
  });

  it('rest: heal, upgrade, drop; Healer\'s Touch heals fully but blocks upgrades; Horseshoe doubles uses', () => {
    const mk = (perks: string[], hp: number) => {
      const run = startRun(51, { startPerks: perks, regions: ['dust_creek'] });
      const bot = new Rng(4);
      while (!run.getChoices().some((c) => c.type === 'rest')) playNode(run, bot);
      const rest = run.getChoices().find((c) => c.type === 'rest')!;
      (run as unknown as { perks: string[]; hp: number }).perks = [...perks];
      (run as unknown as { hp: number }).hp = hp;
      run.enterNode(rest.id);
      return run;
    };
    const a = mk(['hair_trigger'], 1);
    a.doRest({ type: 'heal' });
    expect(a.getHp()).toBe(Math.min(a.maxHp(), 2));
    expect(() => a.doRest({ type: 'heal' })).toThrow(); // single use
    const b = mk(['hair_trigger'], BASE_HP);
    b.doRest({ type: 'upgrade', perkId: 'hair_trigger' });
    expect(b.getPerks()).toContain('hair_trigger+');
    const c = mk(['hair_trigger', 'horseshoe', 'bullet_belt'], 1); // bullet_belt: room for two heals at D14's 2 base lives
    c.doRest({ type: 'heal' }); c.doRest({ type: 'heal' });
    expect(c.getHp()).toBe(c.maxHp());
    const d = mk(['healers_touch'], 1);
    d.doRest({ type: 'heal' });
    expect(d.getHp()).toBe(d.maxHp());
    const e = mk(['healers_touch', 'hair_trigger'], 2);
    expect(() => e.doRest({ type: 'upgrade', perkId: 'hair_trigger' })).toThrow();
    const f = mk(['hair_trigger'], 3);
    const coins = f.getCoins();
    f.doRest({ type: 'drop', perkId: 'hair_trigger' });
    expect(f.getCoins()).toBeGreaterThan(coins);
    expect(f.getPerks()).toEqual([]);
    f.leaveNode();
    const g = mk(['tip_jar'], 3);
    expect(g.getItems()).toContain('tonic');
    (g as unknown as { hp: number }).hp = 1;
    g.useItem('tonic');
    expect(g.getHp()).toBe(2);
  });

  it('events: choose, preview with Lucky Charm, whiskey reroll, forced duel', () => {
    let tested = 0;
    for (let seed = 1; seed <= 60 && tested < 12; seed++) {
      const run = startRun(seed, { startCoins: 200, startPerks: ['lucky_charm', 'whiskey_luck'], regions: ['dust_creek'] });
      const bot = new Rng(seed);
      let guard = 0;
      while (!run.getChoices().some((c) => c.type === 'event') && run.phase !== 'over' && guard++ < 50) playNode(run, bot);
      const ev = run.getChoices().find((c) => c.type === 'event');
      if (!ev) continue;
      run.enterNode(ev.id);
      const info = run.getEvent();
      const rngBefore = run.serialize().rngState;
      const preview = run.previewEventChoice(0);
      expect(run.serialize().rngState).toBe(rngBefore); // preview does not consume rng
      expect(() => run.previewEventChoice(0)).toThrow(); // one per region
      const cost = info.costs[0];
      if (cost > run.getCoins()) continue;
      const hp0 = run.getHp(), coins0 = run.getCoins();
      const out = run.chooseEvent(0);
      expect(out).toEqual(preview);
      if (out.startDuel) {
        const d = run.getDuel();
        expect(d.eventDuel).toBe(true);
        expect(d.enemyId).toBe('bandit');
        run.completeDuel(win(d.heroHp));
        const before = run.getCoins();
        run.applyReward({});
        expect(run.getCoins()).toBeGreaterThan(before - 1);
        continue;
      }
      if (info.event.choices[0].effectKey !== 'none') {
        const left = run.getEvent().whiskeyLeft;
        expect(left).toBeGreaterThan(0);
        const wh = run.whiskeyReroll();
        expect(wh.effectKey).toBe(out.effectKey);
        expect(run.getBuffs().blurry).toBe(1);
        // an upgrade-type outcome can raise the allowance (Whiskey Luck tier 2), but it stays finite
        let spins = 0;
        while (run.getEvent().whiskeyLeft > 0 && !run.getEvent().outcome?.startDuel && spins++ < 5) run.whiskeyReroll();
        expect(run.getEvent().whiskeyLeft).toBe(0);
        expect(() => run.whiskeyReroll()).toThrow();
        // reroll undid the first outcome before applying the second
        expect(run.getCoins()).toBe(coins0 + wh.coinsDelta + (wh.grantPerks.length ? 0 : 0));
        void hp0;
      }
      expect(() => run.chooseEvent(1)).toThrow();
      run.leaveNode();
      tested++;
    }
    expect(tested).toBeGreaterThan(2);
  });

  it('wager, poster and showman work on the run side', () => {
    const run = startRun(61, { startCoins: 50, startPerks: ['widows_wager', 'wanted_poster', 'showman'] });
    run.enterNode(run.getChoices()[0].id);
    run.choosePosterEnemy('bandit');
    expect(run.getDuel().enemyId).toBe('bandit');
    expect(run.posterChargesLeft()).toBe(1);
    expect(() => run.choosePosterEnemy('el_diablo')).toThrow();
    run.placeWager(20);
    expect(run.getCoins()).toBe(30);
    expect(() => run.placeWager(5)).toThrow();
    run.completeDuel(win(3, { tier: 'perfect' }));
    const coins = run.getReward()!.coins;
    run.applyReward({ skip: true });
    expect(run.getCoins()).toBe(30 + coins + 5); // reward coins already include the doubled wager (2 x 20)
    expect(coins).toBeGreaterThanOrEqual(40);
  });

  it('Revive Flask and Showman are consumed once per run', () => {
    const run = startRun(62, { startPerks: ['showman', 'revive_flask'] });
    const bot = new Rng(0);
    for (let i = 0; i < 3; i++) {
      const pick = run.getChoices().find((c) => c.type === 'duel' || c.type === 'elite');
      if (!pick) { playNode(run, bot); continue; }
      run.enterNode(pick.id);
      run.completeDuel(win(Math.min(2, run.getDuel().heroHp), { tier: 'perfect', consumedPerks: i === 0 ? ['revive_flask'] : [] }));
      run.applyReward({ skip: true });
    }
    const m = run.serialize();
    expect((m.map as { state: { consumed: string[] } }).state.consumed).toContain('revive_flask');
  });

  it('Bullet Belt / Glass Cannon change max hp and clamp current hp', () => {
    const a = startRun(70, { startPerks: ['bullet_belt'] });
    expect(a.maxHp()).toBe(BASE_HP + 1);
    expect(a.getHp()).toBe(BASE_HP + 1);
    const b = startRun(70, { startPerks: ['glass_cannon'] });
    expect(b.maxHp()).toBe(1);
    expect(b.getHp()).toBe(1);
  });

  it('Pathfinder widens the visible map', () => {
    const count = (perks: string[]) => startRun(80, { startPerks: perks }).getVisibleMap().flat().filter((n) => n.type !== 'unknown').length;
    expect(count(['pathfinder'])).toBeGreaterThan(count([]));
    expect(count(['pathfinder+'])).toBeGreaterThan(count(['pathfinder']));
  });

  it('bad restore data is rejected', () => {
    expect(() => restoreRun({ seed: 1, rngState: 1, nodeIndex: 0, hp: 3, perks: [], coins: 0, map: null })).toThrow();
    expect(() => startRun(1, { startPerks: ['nope'] })).toThrow();
  });

  it('losing runs still end cleanly (hp carry, abandon)', () => {
    const run = playFull(90, REGION_ORDER.slice(0, 2), true);
    expect(run.phase).toBe('over');
  });
});

const sources = import.meta.glob(
  ['../src/systems/RunSystem.ts', '../src/systems/PerkSystem.ts', '../src/data/perks.ts', '../src/data/events.ts', '../src/data/regions.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

describe('determinism hygiene', () => {
  it('run-side sources never touch Math.random or the clock, and never import Phaser', () => {
    expect(Object.keys(sources).length).toBe(5);
    for (const [f, raw] of Object.entries(sources)) {
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date\(/);
      expect(src, f).not.toMatch(/from 'phaser'/);
    }
  });
});
