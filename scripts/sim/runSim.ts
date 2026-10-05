/**
 * Full-run simulator (A18): plays the REAL RunSystem (map, rewards, shop, rest, events, retries) with a skill
 * model fighting every duel through duelSim.ts, a node policy and a perk-pick policy. Deterministic given
 * (seed, options). Nothing in src/ is modified; what-if scenarios patch objects in memory (see scenarios.ts).
 */
import { Rng } from '../../src/core/rng';
import { PERK_BY_ID, type PerkDef, type PerkTag } from '../../src/data/perks';
import { FIRST_RELEASE_REGIONS, getRegionDef } from '../../src/data/regions';
import { startRun, type DuelEncounter, type MapNode, type NodeType, type RunSystem } from '../../src/systems/RunSystem';
import { baseId, canUpgrade, heroHpFor } from '../../src/systems/PerkSystem';
import type { RunSummary } from '../../src/systems/EconomySystem';
import type { RegionId } from '../../src/data/dialogue';
import { simulateDuel } from './duelSim';
import type { SkillModel } from './skills';

// ---------------------------------------------------------------- policies

/** 'none' never takes or buys a perk (measures the bare duel game); 'random' takes one of the three offers. */
export type PerkPolicyId = 'none' | 'random' | 'smart' | `tag:${PerkTag}`;

/** Which perks actually change play in the current code (support === 'today' => modifiers are wired). */
const works = (p: PerkDef): boolean => p.support === 'today';
const RARITY_RANK: Record<string, number> = { common: 1, rare: 2, legend: 3, cursed: -5 };

export function pickPerk(policy: PerkPolicyId, offers: readonly string[], owned: readonly string[], rng: Rng): string | null {
  if (offers.length === 0 || policy === 'none') return null;
  if (policy === 'random') return rng.pick(offers);
  if (policy === 'smart') {
    // an informed player: prefers perks that work today, then rarity, then ones sharing a tag with the build
    const tags = new Set(owned.flatMap((o) => [...PERK_BY_ID[baseId(o)].tags]));
    const score = (id: string): number => {
      const p = PERK_BY_ID[id];
      return (works(p) ? 10 : 0) + RARITY_RANK[p.rarity] * 2 + (p.tags.some((t) => tags.has(t)) ? 1 : 0);
    };
    return [...offers].sort((a, b) => score(b) - score(a))[0];
  }
  const tag = policy.slice(4) as PerkTag;
  const on = offers.filter((o) => PERK_BY_ID[o].tags.includes(tag));
  return rng.pick(on.length ? on : offers);
}

const NODE_SCORE_BASE: Record<NodeType, number> = { duel: 3, event: 2.5, treasure: 3.2, shop: 3.5, rest: 3.4, elite: 2, boss: 9 };

function chooseNode(choices: readonly MapNode[], run: RunSystem, rng: Rng): MapNode {
  const hp = run.getHp(), max = run.maxHp();
  const low = hp <= Math.max(1, Math.floor(max / 2));
  let best = choices[0], bestScore = -Infinity;
  for (const n of choices) {
    let s = NODE_SCORE_BASE[n.type] + rng.next() * 0.4;
    if (low && n.type === 'rest') s += 3;
    if (low && n.type === 'shop' && run.getCoins() >= 25) s += 1.5;
    if (n.type === 'elite') s += hp >= max ? 1.5 : -3;
    if (n.type === 'treasure' && hp <= 1) s -= 1;
    if (s > bestScore) { best = n; bestScore = s; }
  }
  return best;
}

/** Event option scores keyed by effectKey (static heuristics of a sensible player). */
function eventScore(effectKey: string, hpMissing: number, canUpgradeAny: boolean, skillEdge: number): number {
  const heal = hpMissing > 0 ? 3 : 0.3;
  switch (effectKey) {
    case 'heal_small_gain_coins_small': return heal + 1;
    case 'pay_10_heal_medium': return hpMissing > 1 ? 3 : 0.5;
    case 'heal_small': return heal + 0.5;
    case 'gain_coins_medium_lose_reputation': return 1.6;
    case 'pay_15_buff_focus': return 0.6;
    case 'buff_focus_small': return 0.9;
    case 'coinflip_coins_small': return 0.3;
    case 'cheat_gamble_coins_large': return 1.2;
    case 'gain_item_random_common': return 1.8;
    case 'gain_item_random_common_safe': return 1.9;
    case 'gain_coins_medium_bounty_risk': return 1.3 - 0.4;
    case 'gain_reputation_small': return 0.7;
    case 'pay_5_buff_luck': return 0.5;
    case 'gain_coins_small_debuff_luck': return 0.8;
    case 'pay_20': return -0.5;
    case 'start_duel_bandit_bonus': return 0.4 + skillEdge;
    case 'lose_hp_small': return -2;
    case 'gain_coins_large_lose_hp_small': return 0.8;
    case 'gain_coins_small': return 1;
    case 'buff_awareness': return 0.8;
    case 'lose_hp_small_gain_coins_small': return -0.5;
    case 'gain_coins_medium_lose_hp_small': return 0.4;
    case 'pay_30_upgrade_weapon': return canUpgradeAny ? 1.8 : -1;
    case 'upgrade_weapon_small_quest': return canUpgradeAny ? 2.2 : 0.2;
    default: return 0;
  }
}

// ---------------------------------------------------------------- options and records

export interface TimeModel {
  /** Seconds of non-duel time per node: choosing on the map. */
  mapPickS: number;
  /** Duel framing: intro + result + reward screen, seconds. */
  duelOverheadS: number;
  bossOverheadS: number;
  shopS: number;
  restS: number;
  eventS: number;
  treasureS: number;
  retryS: number;
}
export const TIME_MODEL: TimeModel = { mapPickS: 3, duelOverheadS: 8, bossOverheadS: 14, shopS: 30, restS: 8, eventS: 14, treasureS: 8, retryS: 6 };

export interface RunSimOptions {
  skill: SkillModel;
  seed: number;
  regions?: readonly RegionId[];
  startPerks?: readonly string[];
  startCoins?: number;
  perkPolicy?: PerkPolicyId;
  /** 'run' = A08's single ramp over the whole run (current); 'region' = ramp restarts each region. */
  difficultyMode?: 'run' | 'region';
  /** Added to every duel's difficulty (what-if). */
  difficultyOffset?: number;
  /** Retry after a death when affordable. */
  retry?: boolean;
  lagMs?: number;
  emulate?: boolean;
  dodge?: boolean;
  time?: TimeModel;
  /** Emulate Tin Star-like perk effects that DuelSystem does not implement yet. Default true. */
  emulateMods?: boolean;
  /** What-if (GAME_DESIGN: "elite/boss may hit for 2"): enemy damage multiplier for boss and elite duels. */
  bossDamageMult?: number;
  eliteDamageMult?: number;
  /** What-if: reload gap after an enemy's sequence (ms; the game uses 1500). */
  reloadMs?: number;
  /** Replaces duel difficulty for bosses only (what-if). */
  bossDifficultyOffset?: number;
}

export interface RegionOutcome { region: string; reached: boolean; cleared: boolean; minutes: number }

export interface RunRecord {
  victory: boolean;
  /** Region ids whose boss fell, in order. */
  regionsCleared: string[];
  /** Index (0-based) of the region the run ended in (== regions.length on victory). */
  endRegion: number;
  /** Layer reached when the run ended. */
  endLayer: number;
  duels: number;
  duelsWon: number;
  deaths: number;
  retries: number;
  minutes: number;
  /** Minutes spent per region index. */
  regionMinutes: number[];
  coinsEarned: number;
  coinsEnd: number;
  coinsSpent: number;
  perksTaken: string[];
  offered: { common: number; rare: number; legend: number; cursed: number };
  taken: { common: number; rare: number; legend: number; cursed: number };
  heals: { rest: number; shop: number; tonic: number; boss: number; event: number };
  damage: number;
  nodes: Record<string, number>;
  defeated: string[];
  perfects: number;
  headshots: number;
  noDamageDuels: number;
  bestReactionMs: number | null;
  /** Hero hp when entering each boss, by region index. */
  hpAtBoss: number[];
  /** The enemy id and difficulty of the duel that killed the run. */
  killedBy: { enemyId: string; difficulty: number; region: number; boss: boolean } | null;
  summary: RunSummary;
}

const emptyRar = () => ({ common: 0, rare: 0, legend: 0, cursed: 0 });

/** Plays one full run. */
export function playRun(o: RunSimOptions): RunRecord {
  const regions = o.regions ?? FIRST_RELEASE_REGIONS;
  const prng = new Rng((o.seed * 2246822519) >>> 0 ^ 0x1234567);
  const run = startRun(o.seed, { regions, startPerks: o.startPerks, startCoins: o.startCoins ?? 0 });
  const tm = o.time ?? TIME_MODEL;
  const policy = o.perkPolicy ?? 'random';
  const retryOn = o.retry ?? true;
  const regionLayerStart: number[] = [];
  { let acc = 0; for (const r of regions) { regionLayerStart.push(acc); acc += getRegionDef(r).nodeCount; } }

  if (o.difficultyMode === 'region' || o.difficultyOffset) {
    const orig = run.difficultyAt.bind(run);
    (run as unknown as { difficultyAt: (n: MapNode) => number }).difficultyAt = (n: MapNode): number => {
      let d = orig(n);
      if (o.difficultyMode === 'region') {
        const rc = getRegionDef(regions[n.region]).nodeCount;
        const local = n.layer - regionLayerStart[n.region];
        // each region restarts at a base that creeps up (0.05, 0.2, 0.35 ...) and ends at base + 0.6
        const base = 0.05 + 0.15 * n.region;
        d = base + 0.6 * (local / Math.max(1, rc - 1)) + (n.type === 'elite' ? 0.08 : n.type === 'boss' ? 0.1 : 0);
      }
      return Math.max(0, Math.min(1, d + (o.difficultyOffset ?? 0)));
    };
  }

  const rec: RunRecord = {
    victory: false, regionsCleared: [], endRegion: 0, endLayer: 0, duels: 0, duelsWon: 0, deaths: 0, retries: 0, minutes: 0,
    regionMinutes: regions.map(() => 0), coinsEarned: 0, coinsEnd: 0, coinsSpent: 0, perksTaken: [], offered: emptyRar(), taken: emptyRar(),
    heals: { rest: 0, shop: 0, tonic: 0, boss: 0, event: 0 }, damage: 0, nodes: {}, defeated: [], perfects: 0, headshots: 0,
    noDamageDuels: 0, bestReactionMs: null, hpAtBoss: [], killedBy: null, summary: undefined as unknown as RunSummary,
  };
  let seconds = 0;
  let curRegion = 0;
  const addTime = (s: number): void => { seconds += s; rec.regionMinutes[curRegion] += s / 60; };

  const cfgFor = (enc: DuelEncounter): DuelEncounter['config'] => {
    const k = enc.boss ? o.bossDamageMult : enc.elite ? o.eliteDamageMult : undefined;
    if (!k || k === 1) return enc.config;
    return { ...enc.config, damage: { ...enc.config.damage, enemyDamage: enc.config.damage.enemyDamage * k } };
  };
  const fightDuel = (enc0: DuelEncounter, node: MapNode): boolean => {
    let enc = enc0;
    for (let guard = 0; guard < 6; guard++) {
      const d = Math.min(1, Math.max(0, enc.difficulty + (enc.boss ? o.bossDifficultyOffset ?? 0 : 0)));
      const r = simulateDuel(enc.enemyId, o.skill, new Rng((enc.seed * 40503 + guard * 977) >>> 0), {
        difficulty: d, seed: enc.seed, heroHp: enc.heroHp, heroMaxHp: heroHpFor(enc.modifiers), config: cfgFor(enc), lagMs: o.lagMs,
        emulate: o.emulate, dodge: o.dodge, reloadMs: o.reloadMs, modifiers: enc.modifiers, ignoreFirstHits: o.emulateMods === false ? 0 : enc.modifiers.ignoreFirstHits,
        bossId: enc.bossId, enemyHp: enc.boss || !enc.enemyHpBonus ? undefined : hpWithBonus(enc, d),
      });
      rec.duels++;
      rec.damage += r.damage;
      addTime((r.durationMs + 300) / 1000 + (enc.boss ? tm.bossOverheadS : tm.duelOverheadS));
      if (r.win) { rec.duelsWon++; if (r.tier === 'perfect') rec.perfects++; rec.headshots += r.headshots; if (r.damage === 0) rec.noDamageDuels++; }
      if (r.reactionMs !== null) rec.bestReactionMs = rec.bestReactionMs === null ? r.reactionMs : Math.min(rec.bestReactionMs, r.reactionMs);
      const out = run.completeDuel({
        outcome: r.win ? 'WIN' : 'LOSE', heroHp: r.heroHpEnd, tier: r.tier, reactionMs: r.reactionMs, headshots: r.headshots,
        consumedPerks: r.revives > 0 ? ['revive_flask'] : undefined,
      });
      if (out.status === 'won') {
        rec.defeated.push(enc.boss && enc.bossId ? enc.bossId : enc.enemyId);
        takeReward(run, rec, policy, prng);
        return true;
      }
      if (out.status === 'refight') { enc = run.getDuel(); continue; }
      rec.deaths++;
      if (retryOn && out.canRetry) { enc = run.retryDuel(); rec.retries++; addTime(tm.retryS); continue; }
      rec.killedBy = { enemyId: enc.enemyId, difficulty: d, region: node.region, boss: enc.boss };
      run.abandon();
      return false;
    }
    run.abandon();
    return false;
  };

  for (let guard = 0; guard < 400 && run.phase !== 'over'; guard++) {
    if (run.phase !== 'map') throw new Error(`unexpected phase ${run.phase}`);
    const node = chooseNode(run.getChoices(), run, prng);
    curRegion = node.region;
    rec.nodes[node.type] = (rec.nodes[node.type] ?? 0) + 1;
    addTime(tm.mapPickS);
    // consumables: tonic when low, flask before elites and bosses
    if (run.getItems().includes('tonic') && run.getHp() <= 1 && run.getHp() < run.maxHp()) { run.useItem('tonic'); rec.heals.tonic++; }
    if ((node.type === 'boss' || node.type === 'elite') && run.getItems().includes('flask')) run.useItem('flask');
    if (node.type === 'boss') rec.hpAtBoss[node.region] = run.getHp();
    const entered = run.enterNode(node.id);
    if (typeof entered === 'object') {
      const hpBefore = run.getHp();
      const ok = fightDuel(entered, node);
      if (!ok) break;
      if (node.type === 'boss') { rec.regionsCleared.push(regions[node.region]); if (run.getHp() > hpBefore) rec.heals.boss++; }
      continue;
    }
    switch (entered) {
      case 'shop': addTime(tm.shopS); playShop(run, rec, policy, prng); run.leaveNode(); break;
      case 'rest': {
        addTime(tm.restS);
        const info = run.getRest();
        if (info.usesLeft > 0 && info.canHeal) { run.doRest({ type: 'heal' }); rec.heals.rest++; }
        else if (info.upgradable.length) run.doRest({ type: 'upgrade', perkId: info.upgradable[0] });
        if (run.getRest().usesLeft > 0 && run.getRest().canHeal) { run.doRest({ type: 'heal' }); rec.heals.rest++; }
        run.leaveNode(); break;
      }
      case 'treasure': {
        addTime(tm.treasureS);
        const t = run.getTreasure();
        run.openTreasure(t.trapped && run.getCoins() >= t.disarmCost);
        run.leaveNode(); break;
      }
      case 'event': {
        addTime(tm.eventS);
        const hpB = run.getHp();
        const ev = run.getEvent();
        const upg = run.getPerks().some((p) => canUpgrade(run.getPerks(), baseId(p)));
        const edge = Math.max(-1, Math.min(1, (o.skill.reactMedianMs < 260 ? 1 : o.skill.reactMedianMs < 330 ? 0.3 : -0.8)));
        let best = -1, bs = -Infinity;
        ev.event.choices.forEach((c, i) => {
          if (ev.costs[i] > run.getCoins()) return;
          const s = eventScore(c.effectKey, run.maxHp() - run.getHp(), upg, edge) + prng.next() * 0.3;
          if (s > bs) { bs = s; best = i; }
        });
        const out = run.chooseEvent(best < 0 ? ev.event.choices.length - 1 : best);
        if (run.getHp() > hpB) rec.heals.event++;
        if (out.startDuel) {
          const enc = run.getDuel();
          const ok = fightDuel(enc, node);
          if (!ok) break;
        } else run.leaveNode();
        break;
      }
      default: throw new Error(`unhandled node kind ${String(entered)}`);
    }
    if ((run.phase as string) === 'over') break;
  }

  rec.victory = run.outcome === 'victory';
  rec.endLayer = run.nodeIndex;
  rec.endRegion = rec.victory ? regions.length : Math.max(0, Math.min(regions.length - 1, regionOfLayer(regionLayerStart, run.nodeIndex)));
  rec.minutes = seconds / 60;
  const st = run.getStats();
  rec.coinsEarned = st.coinsEarned;
  rec.coinsEnd = run.getCoins();
  rec.coinsSpent = Math.max(0, rec.coinsEarned - rec.coinsEnd);
  rec.perksTaken = [...run.getPerks()];
  rec.summary = {
    coins: run.getCoins(), victory: rec.victory, defeated: rec.defeated, regionsCleared: rec.regionsCleared, perfectDraws: rec.perfects,
    headshots: rec.headshots, noDamageDuels: rec.noDamageDuels, bestReactionMs: rec.bestReactionMs,
  };
  return rec;
}

function regionOfLayer(starts: readonly number[], layer: number): number {
  let r = 0;
  for (let i = 0; i < starts.length; i++) if (layer >= starts[i]) r = i;
  return r;
}

function hpWithBonus(enc: DuelEncounter, d: number): number {
  // elites: enemyHpFor(def, difficulty) + enemyHpBonus (RunSystem contract)
  return enemyHpOf(enc.enemyId, d) + enc.enemyHpBonus;
}

import { enemyHpFor, getEnemyDef } from '../../src/data/enemies';
const enemyHpOf = (id: string, d: number): number => enemyHpFor(getEnemyDef(id), d);

function bumpRarity(bag: Record<string, number>, id: string): void {
  const r = PERK_BY_ID[baseId(id)].rarity;
  bag[r] = (bag[r] ?? 0) + 1;
}

function takeReward(run: RunSystem, rec: RunRecord, policy: PerkPolicyId, rng: Rng): void {
  const rw = run.getReward();
  if (!rw) return;
  for (const p of rw.perkChoices) bumpRarity(rec.offered, p);
  const pick = pickPerk(policy, rw.perkChoices, run.getPerks(), rng);
  if (pick) { bumpRarity(rec.taken, pick); run.applyReward({ perkId: pick }); } else run.applyReward(rw.perkChoices.length ? { skip: true } : {});
}

function playShop(run: RunSystem, rec: RunRecord, policy: PerkPolicyId, rng: Rng): void {
  const hp = run.getHp(), max = run.maxHp();
  let shop = run.getShop();
  if (hp < max && run.getCoins() >= shop.healPrice) { run.shopHeal(); rec.heals.shop++; shop = run.getShop(); }
  for (let i = 0; i < 6; i++) {
    shop = run.getShop();
    const afford = shop.offers.filter((x) => !x.hidden && !x.curse && x.price <= run.getCoins());
    if (!afford.length) break;
    const perkOffers = afford.filter((x) => x.kind === 'perk' && x.perkId);
    let choice: (typeof afford)[number] | undefined;
    if (perkOffers.length && policy !== 'none') {
      const id = pickPerk(policy === 'random' ? 'smart' : policy, perkOffers.map((x) => x.perkId as string), run.getPerks(), rng);
      choice = perkOffers.find((x) => x.perkId === id);
    } else choice = afford.find((x) => x.itemId === 'tonic');
    if (!choice) break;
    if (choice.kind === 'perk') bumpRarity(rec.taken, choice.perkId as string);
    run.shopBuy(choice.id);
  }
}
