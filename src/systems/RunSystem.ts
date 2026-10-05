/**
 * RunSystem (A08): seeded branching run map, node resolution, difficulty ramp, hp/coin carry-over.
 * No Phaser. All randomness from Rng (D4): the map comes from a map-only Rng derived from the seed, so the
 * same seed + options give an identical map no matter how the run is played; everything else (offers, events,
 * duel seeds) comes from the saved run Rng. State serialises to RunSave (map field is opaque to SaveManager).
 */
import { Rng } from '../core/rng';
import type { RunSave } from '../core/SaveManager';
import type { RandomEvent, RegionId } from '../data/dialogue';
import type { DuelConfig, DrawTier } from '../data/duelConfig';
import { ARENAS } from '../data/arenas';
import {
  ITEM_DEFS, ITEM_IDS, getEffectCost, getEventDef, pickEvent, previewEffect, resolveEffect,
  type EventOutcome, type EventState,
} from '../data/events';
import { PERK_BY_ID, RARITY_PRICE, type DuelModifiers, type RunRules } from '../data/perks';
import {
  FIRST_RELEASE_REGIONS, getRegionDef, poolBandForLayer, resolveArenaId, type RegionDef,
} from '../data/regions';
import {
  baseId, canUpgrade, composePerks, duelConfigFor, hasPerk, heroHpFor, perkPrice, perkSellValue,
  rollPerkChoices, upgradePerk, type ComposedPerks, type RollOptions,
} from './PerkSystem';

export type NodeType = 'duel' | 'elite' | 'shop' | 'event' | 'rest' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  /** Index into RunMap.regions. */
  region: number;
  /** Layer inside the region (0 = first duel, nodeCount-1 = boss). */
  local: number;
  /** Global layer = how many nodes a player has completed on any route to reach it. */
  layer: number;
  lane: number;
  type: NodeType;
  next: string[];
  /** Pre-rolled enemy for duel / elite / boss nodes. */
  enemyId?: string;
}

export interface RunMap {
  regions: RegionId[];
  layers: MapNode[][];
}

// ---------------------------------------------------------------- map generation

const mapSeed = (seed: number) => (seed ^ 0x9e3779b9) >>> 0;

function layerWidths(n: number, rng: Rng): number[] {
  if (n < 5) throw new Error('Region needs at least 5 layers (duel, branch, shop, rest, boss)');
  const shop = n - 4, rest = n - 2;
  const w: number[] = [];
  for (let l = 0; l < n; l++) w.push(l === 0 || l === shop || l === rest || l === n - 1 ? 1 : rng.int(2, 3));
  return w;
}

function connect(from: MapNode[], to: MapNode[], rng: Rng): void {
  const a = from.length, b = to.length;
  const incoming = new Set<string>();
  for (const f of from) {
    const targets = new Set<number>();
    if (a === 1) for (let j = 0; j < b; j++) targets.add(j);
    else if (b === 1) targets.add(0);
    else {
      const j = Math.round((f.lane * (b - 1)) / (a - 1));
      targets.add(j);
      if (rng.next() < 0.4) targets.add(Math.max(0, Math.min(b - 1, j + (rng.next() < 0.5 ? -1 : 1))));
    }
    for (const j of targets) { f.next.push(to[j].id); incoming.add(to[j].id); }
  }
  for (const t of to) {
    if (incoming.has(t.id)) continue;
    const src = from.reduce((best, f) => (Math.abs(f.lane - t.lane) < Math.abs(best.lane - t.lane) ? f : best), from[0]);
    src.next.push(t.id);
  }
  for (const f of from) f.next = [...new Set(f.next)].sort();
}

function buildRegionLayers(region: RegionDef, ri: number, layerOffset: number, rng: Rng): MapNode[][] {
  const n = region.nodeCount;
  const widths = layerWidths(n, rng);
  const shop = n - 4, rest = n - 2;
  const layers: MapNode[][] = widths.map((w, l) =>
    Array.from({ length: w }, (_, lane) => ({
      id: `r${ri}-l${l}-n${lane}`, region: ri, local: l, layer: layerOffset + l, lane, type: 'duel' as NodeType, next: [],
    })));
  layers[shop].forEach((nd) => { nd.type = 'shop'; });
  layers[rest].forEach((nd) => { nd.type = 'rest'; });
  layers[n - 1][0].type = 'boss';

  let eliteLeft = 1, treasureLeft = 1, eventPlaced = 0;
  const branch: number[] = [];
  for (let l = 1; l < n - 1; l++) if (l !== shop && l !== rest) branch.push(l);
  for (const l of branch) {
    const row = layers[l];
    const types: NodeType[] = row.map(() => {
      const wDuel = 6, wEv = region.mix.event, wTr = treasureLeft > 0 ? region.mix.treasure : 0;
      const wEl = eliteLeft > 0 && l >= 2 ? region.mix.elite : 0;
      let r = rng.next() * (wDuel + wEv + wTr + wEl);
      if ((r -= wDuel) < 0) return 'duel';
      if ((r -= wEv) < 0) return 'event';
      if ((r -= wTr) < 0) return 'treasure';
      return 'elite';
    });
    // every branch layer keeps at least one fair-fight lane
    if (!types.includes('duel')) types[rng.int(0, types.length - 1)] = 'duel';
    types.forEach((t, i) => {
      if (t === 'elite') { if (eliteLeft > 0) eliteLeft--; else types[i] = 'duel'; }
      if (t === 'treasure') { if (treasureLeft > 0) treasureLeft--; else types[i] = 'duel'; }
      if (types[i] === 'event') eventPlaced++;
    });
    if (!types.includes('duel')) types[0] = 'duel';
    row.forEach((nd, i) => { nd.type = types[i]; });
  }
  // Goldspire is shop-heavy: one shop lane on the first branch layer (never adjacent to the shop layer),
  // only where that row keeps a fair-fight lane
  if (region.gimmick === 'coin_heavy' && layers[1].length > 1 && shop > 2) {
    const row = layers[1];
    const lane = row.length - 1;
    if (row.some((nd, i) => i !== lane && nd.type === 'duel')) row[lane].type = 'shop';
  }
  eventPlaced = layers.flat().filter((nd) => nd.type === 'event').length;
  // guarantee an event exists in the region
  if (eventPlaced === 0) {
    // branch rows are 2-3 wide and always hold a duel, so some row has a lane that can safely become an event
    for (const l of rng.shuffle(branch)) {
      const row = layers[l];
      const lane = row.findIndex((nd, i) => nd.type !== 'shop' && (nd.type !== 'duel' || row.some((o, j) => j !== i && o.type === 'duel')));
      if (lane >= 0) { row[lane].type = 'event'; break; }
    }
  }
  // enemies
  for (let l = 0; l < n; l++) {
    const band = poolBandForLayer(l, n);
    const used = new Set<string>();
    for (const nd of layers[l]) {
      if (nd.type === 'duel') {
        const pool = region.pools[band].filter((e) => !used.has(e));
        nd.enemyId = rng.pick(pool.length ? pool : region.pools[band]);
        used.add(nd.enemyId);
      } else if (nd.type === 'elite') nd.enemyId = region.elite;
      else if (nd.type === 'boss') nd.enemyId = region.bossFallback; // the enemy to fight until BossSystem maps bossId
    }
  }
  for (let l = 0; l < n - 1; l++) connect(layers[l], layers[l + 1], rng);
  return layers;
}

export function generateMap(seed: number, regions: readonly RegionId[]): RunMap {
  if (regions.length === 0) throw new Error('generateMap: no regions');
  const rng = new Rng(mapSeed(seed));
  const layers: MapNode[][] = [];
  let offset = 0;
  regions.forEach((rid, ri) => {
    const def = getRegionDef(rid);
    const rl = buildRegionLayers(def, ri, offset, rng);
    if (layers.length) for (const b of layers[layers.length - 1]) b.next = rl[0].map((nd) => nd.id);
    layers.push(...rl);
    offset += rl.length;
  });
  return { regions: [...regions], layers };
}

// ---------------------------------------------------------------- state types

export type RunPhase = 'map' | 'node' | 'reward' | 'over';

export interface RunOptions {
  regions?: readonly RegionId[];
  /** Loadout perks (ids, optional `+` tier). */
  startPerks?: readonly string[];
  startCoins?: number;
  startItems?: readonly string[];
  /** Arena registry check; defaults to the real arenas. */
  hasArena?: (id: string) => boolean;
}

export interface RunDuelResult {
  outcome: 'WIN' | 'LOSE';
  /** Hero lives left at the end of the attempt. */
  heroHp: number;
  tier?: DrawTier | null;
  reactionMs?: number | null;
  headshots?: number;
  /** Successful dodges (Slip Away). */
  dodges?: number;
  /** Once-per-run perks the duel used (Revive Flask). */
  consumedPerks?: readonly string[];
}

export interface DuelEncounter {
  kind: 'duel';
  nodeId: string;
  nodeType: NodeType;
  /** Always a real EnemyId for createOpponent. */
  enemyId: string;
  /** Boss id (may be a boss that A07 has not built; enemyId is the fallback to fight). */
  bossId: string | null;
  difficulty: number;
  arenaId: string;
  region: RegionId;
  gimmick: string;
  /** Per-node duel seed: retries reuse it (RULE F5). */
  seed: number;
  elite: boolean;
  boss: boolean;
  /** Extra enemy hp for elites (+1). */
  enemyHpBonus: number;
  /** Lives the hero starts the duel with (carry-over). */
  heroHp: number;
  modifiers: DuelModifiers;
  /** DUEL_CONFIG patched with the modifiers that work today. */
  config: DuelConfig;
  retryCost: number;
  retryUsed: boolean;
  wager: number;
  /** Event ambush or gunsmith duel: extra coins on win, no perk reward. */
  eventDuel: boolean;
}

export interface ShopOfferView {
  id: string;
  kind: 'perk' | 'item';
  /** null when hidden (an unrevealed curse). */
  perkId: string | null;
  itemId: string | null;
  name: string;
  price: number;
  curse: boolean;
  hidden: boolean;
}

export interface RewardView {
  coins: number;
  perkChoices: string[];
  rare: boolean;
  skipBonus: number;
  rerollCost: number;
}

interface ShopOfferState { id: string; kind: 'perk' | 'item'; ref: string; curse: boolean; sold: boolean }

type NodeState =
  | { kind: 'duel'; enemyId: string; bossId: string | null; difficulty: number; seed: number; entryHp: number;
      retryUsed: boolean; lost: boolean; wager: number; eventDuel: boolean; bonusCoins: number; ambush: boolean }
  | { kind: 'shop'; offers: ShopOfferState[]; rerolls: number; healBought: boolean; pawnPending: boolean }
  | { kind: 'event'; eventId: string; chosen: number | null; outcome: EventOutcome | null; snapshot: Snapshot | null;
      rerolls: number; resolved: boolean; fromDuel: boolean }
  | { kind: 'rest'; usesLeft: number; gaveItem: boolean }
  | { kind: 'treasure'; coins: number; perk: string | null; trapped: boolean; opened: boolean };

interface Snapshot {
  hp: number; coins: number; perks: string[]; items: string[]; buffs: Record<string, number>;
  flags: string[]; reputation: number;
}

interface Pending { coins: number; perkChoices: string[]; rare: boolean; boss: boolean; rerolls: number; nodeType: NodeType; heal: number }

interface RunState {
  phase: RunPhase;
  outcome: 'victory' | 'defeat' | null;
  currentNodeId: string | null;
  prevNodeId: string | null;
  items: string[];
  buffs: Record<string, number>;
  consumed: string[];
  reputation: number;
  flags: string[];
  visited: string[];
  nodeState: NodeState | null;
  pending: Pending | null;
  seenEvents: string[];
  regionDuels: number;
  eventPreviewsUsed: number;
  posterUsed: number;
  whiskeyUsed: number;
  perfectStreak: number;
  stats: { duelsWon: number; perfects: number; bestReactionMs: number | null; coinsEarned: number; deaths: number };
}

interface MapBlob { v: 1; graph: RunMap; state: RunState; hasArenaDefault?: never }

const defaultHasArena = (id: string) => Object.prototype.hasOwnProperty.call(ARENAS, id);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class RunError extends Error {}
function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new RunError(msg);
}

/** Shop / reward tuning (A18). */
export const RUN_TUNING = {
  startPerfectBonus: 5, headshotBonus: 3, noDamageBonus: 4,
  baseCoins: 10, difficultyCoins: 20, eliteCoinMult: 2, bossCoinMult: 3, skipBonus: 5,
  healPrice: 20, rerollBase: 10, rerollStep: 5, removeCursePrice: 25, retryBase: 10, retryPerLayer: 3,
  wagerMax: 100, treasureCoins: [20, 45] as const, treasureTrapChance: 0.35, disarmCost: 5,
  reputationStep: 0.1, pawnDiscount: 0.25, bossHeal: 1,
  shopPerks: 3,
} as const;

export class RunSystem {
  readonly seed: number;
  readonly map: RunMap;
  private rng: Rng;
  private hasArena: (id: string) => boolean;
  /** Next layer to choose from (RunSave.nodeIndex). */
  private layer = 0;
  private hp = 0;
  private coins = 0;
  private perks: string[] = [];
  private st: RunState;
  private totalLayers: number;

  private constructor(seed: number, map: RunMap, rng: Rng, hasArena: (id: string) => boolean, st: RunState) {
    this.seed = seed; this.map = map; this.rng = rng; this.hasArena = hasArena; this.st = st;
    this.totalLayers = map.layers.length;
  }

  // ------------------------------------------------------------ construction

  static start(seed: number, opts: RunOptions = {}): RunSystem {
    const regions = opts.regions ?? FIRST_RELEASE_REGIONS;
    const map = generateMap(seed, regions);
    const st: RunState = {
      phase: 'map', outcome: null, currentNodeId: null, prevNodeId: null, items: [...(opts.startItems ?? [])],
      buffs: {}, consumed: [], reputation: 0, flags: [], visited: [], nodeState: null, pending: null, seenEvents: [],
      regionDuels: 0, eventPreviewsUsed: 0, posterUsed: 0, whiskeyUsed: 0, perfectStreak: 0,
      stats: { duelsWon: 0, perfects: 0, bestReactionMs: null, coinsEarned: 0, deaths: 0 },
    };
    const run = new RunSystem(seed, map, new Rng(seed), opts.hasArena ?? defaultHasArena, st);
    run.perks = [...(opts.startPerks ?? [])];
    for (const p of run.perks) if (!PERK_BY_ID[baseId(p)]) throw new RunError(`Unknown start perk: ${p}`);
    run.coins = opts.startCoins ?? 0;
    run.hp = run.maxHp();
    return run;
  }

  static restore(save: RunSave, hasArena: (id: string) => boolean = defaultHasArena): RunSystem {
    const blob = save.map as MapBlob | null;
    if (!blob || blob.v !== 1 || !blob.graph || !blob.state) throw new RunError('RunSystem.restore: bad map blob');
    const st: RunState = JSON.parse(JSON.stringify(blob.state));
    const graph: RunMap = JSON.parse(JSON.stringify(blob.graph));
    const rng = new Rng(save.seed);
    rng.setState(save.rngState);
    const run = new RunSystem(save.seed, graph, rng, hasArena, st);
    run.layer = save.nodeIndex; run.hp = save.hp; run.coins = save.coins; run.perks = [...save.perks];
    return run;
  }

  serialize(): RunSave {
    const blob: MapBlob = { v: 1, graph: this.map, state: this.st };
    return JSON.parse(JSON.stringify({
      seed: this.seed, rngState: this.rng.getState(), nodeIndex: this.layer, hp: this.hp, perks: this.perks,
      coins: this.coins, map: blob,
    })) as RunSave;
  }

  // ------------------------------------------------------------ read-only views

  get phase(): RunPhase { return this.st.phase; }
  get outcome(): 'victory' | 'defeat' | null { return this.st.outcome; }
  get nodeIndex(): number { return this.layer; }
  getHp(): number { return this.hp; }
  getCoins(): number { return this.coins; }
  getPerks(): readonly string[] { return this.perks; }
  getItems(): readonly string[] { return this.st.items; }
  getBuffs(): Readonly<Record<string, number>> { return this.st.buffs; }
  getReputation(): number { return this.st.reputation; }
  getStats() { return { ...this.st.stats }; }
  getFlags(): readonly string[] { return this.st.flags; }
  currentNode(): MapNode | null { return this.st.currentNodeId ? this.node(this.st.currentNodeId) : null; }
  currentRegion(): RegionDef {
    const nd = this.currentNode() ?? this.map.layers[Math.min(this.layer, this.totalLayers - 1)][0];
    return getRegionDef(this.map.regions[nd.region]);
  }

  maxHp(): number { return heroHpFor(this.compose().duel); }
  private compose(ctx: Parameters<typeof composePerks>[1] = {}): ComposedPerks {
    return composePerks(this.perks, { consumed: this.st.consumed, buffs: this.st.buffs, ...ctx });
  }
  rules(): RunRules { return this.compose().run; }

  private node(id: string): MapNode {
    for (const row of this.map.layers) for (const n of row) if (n.id === id) return n;
    throw new RunError(`Unknown node: ${id}`);
  }

  /** Nodes the player may enter now. */
  getChoices(): MapNode[] {
    if (this.st.phase !== 'map') return [];
    if (this.layer >= this.totalLayers) return [];
    if (!this.st.prevNodeId) return this.map.layers[this.layer].slice();
    return this.node(this.st.prevNodeId).next.map((id) => this.node(id));
  }

  /** Map as the player sees it: node types beyond the lookahead are 'unknown' (Pathfinder widens it). */
  getVisibleMap(): { id: string; layer: number; lane: number; type: NodeType | 'unknown'; next: string[]; enemyId?: string }[][] {
    const look = 1 + this.rules().mapLookaheadDelta;
    return this.map.layers.map((row) => row.map((n) => {
      const show = n.layer < this.layer || n.layer - this.layer < look;
      return { id: n.id, layer: n.layer, lane: n.lane, type: show ? n.type : 'unknown' as const, next: n.next,
        enemyId: show && n.type === 'elite' ? n.enemyId : undefined };
    }));
  }

  /** 0..1 difficulty for createOpponent, ramping over the whole run. */
  difficultyAt(n: MapNode): number {
    const base = 0.05 + 0.9 * (n.layer / Math.max(1, this.totalLayers - 1));
    const bump = n.type === 'elite' ? 0.08 : n.type === 'boss' ? 0.1 : 0;
    return clamp(base + bump, 0, 1);
  }

  retryCost(): number {
    const nd = this.currentNode();
    const layer = nd ? nd.layer : this.layer;
    return Math.max(0, Math.round((RUN_TUNING.retryBase + RUN_TUNING.retryPerLayer * layer) * this.rules().retryCostMult));
  }

  private priceMult(): number {
    const r = this.rules();
    const rep = 1 - RUN_TUNING.reputationStep * clamp(this.st.reputation, -2, 2);
    return r.shopPriceMult * (1 - r.shopDiscount) * rep;
  }

  private luck(): number { return this.compose().buffLuck; }

  // ------------------------------------------------------------ node entry

  enterNode(id: string): DuelEncounter | NodeState['kind'] {
    need(this.st.phase === 'map', `enterNode: phase is ${this.st.phase}`);
    const nd = this.getChoices().find((c) => c.id === id);
    need(nd, `enterNode: ${id} is not reachable`);
    this.st.currentNodeId = nd.id;
    this.st.phase = 'node';
    switch (nd.type) {
      case 'duel': case 'elite': case 'boss': this.st.nodeState = this.makeDuelState(nd); break;
      case 'shop': this.st.nodeState = this.makeShop(); break;
      case 'event': this.st.nodeState = {
        kind: 'event', eventId: pickEvent(this.rng, this.st.seenEvents).id, chosen: null, outcome: null, snapshot: null,
        rerolls: 0, resolved: false, fromDuel: false };
        this.st.seenEvents.push((this.st.nodeState as { eventId: string }).eventId); break;
      case 'rest': {
        const r = this.rules();
        this.st.nodeState = { kind: 'rest', usesLeft: 1 + r.restUsesDelta, gaveItem: false };
        if (r.restFreeItem) { this.st.items.push('tonic'); this.st.nodeState.gaveItem = true; }
        break;
      }
      case 'treasure': this.st.nodeState = this.makeTreasure(); break;
    }
    return this.st.nodeState.kind === 'duel' ? this.getDuel() : this.st.nodeState.kind;
  }

  private makeDuelState(nd: MapNode): NodeState {
    let enemyId = nd.enemyId as string;
    let difficulty = this.difficultyAt(nd);
    let ambush = false;
    if (nd.type === 'duel' && this.st.flags.includes('ambush_next')) {
      this.st.flags = this.st.flags.filter((f) => f !== 'ambush_next');
      enemyId = 'bounty_hunter'; difficulty = clamp(difficulty + 0.1, 0, 1); ambush = true;
    }
    const region = getRegionDef(this.map.regions[nd.region]);
    return {
      kind: 'duel', enemyId, bossId: nd.type === 'boss' ? region.bossId : null, difficulty,
      seed: this.rng.int(1, 0x7fffffff), entryHp: this.hp, retryUsed: false, lost: false, wager: 0,
      eventDuel: false, bonusCoins: 0, ambush,
    };
  }

  // ------------------------------------------------------------ duel

  private duelState(): Extract<NodeState, { kind: 'duel' }> {
    const s = this.st.nodeState;
    need(s && s.kind === 'duel', 'not in a duel node');
    return s;
  }

  getDuel(): DuelEncounter {
    const s = this.duelState();
    const nd = this.currentNode() as MapNode;
    const region = getRegionDef(this.map.regions[nd.region]);
    const elite = nd.type === 'elite', boss = nd.type === 'boss';
    const composed = this.compose({ enemyId: s.enemyId, elite, boss, firstDuelOfRegion: this.st.regionDuels === 0 && nd.type === 'duel' });
    const modifiers = composed.duel;
    const hp = clamp(s.entryHp, 1, heroHpFor(modifiers));
    const config = duelConfigFor(modifiers);
    return {
      kind: 'duel', nodeId: nd.id, nodeType: nd.type, enemyId: s.enemyId, bossId: s.bossId, difficulty: s.difficulty,
      arenaId: resolveArenaId(region, this.hasArena), region: region.id, gimmick: region.gimmick, seed: s.seed,
      elite, boss, enemyHpBonus: elite ? 1 : 0, heroHp: hp, modifiers, config, retryCost: this.retryCost(),
      retryUsed: s.retryUsed, wager: s.wager, eventDuel: s.eventDuel,
    };
  }

  /** Wanted Poster: pick the standard-duel enemy from the region pools. */
  choosePosterEnemy(enemyId: string): void {
    const s = this.duelState();
    const nd = this.currentNode() as MapNode;
    need(nd.type === 'duel' && !s.eventDuel && !s.lost, 'poster only applies to a fresh standard duel');
    const r = this.rules();
    need(r.posterCharges - this.st.posterUsed > 0, 'no Wanted Poster charges left');
    const region = getRegionDef(this.map.regions[nd.region]);
    const all = new Set<string>([...region.pools.early, ...region.pools.mid, ...region.pools.late]);
    need(all.has(enemyId), `poster: ${enemyId} is not in this region`);
    s.enemyId = enemyId; this.st.posterUsed++;
  }
  posterChargesLeft(): number { return Math.max(0, this.rules().posterCharges - this.st.posterUsed); }

  /** Widow's Wager: stake coins before the duel. */
  placeWager(amount: number): void {
    const s = this.duelState();
    need(this.compose().duel.wagerEnabled, "Widow's Wager not owned");
    need(s.wager === 0 && !s.lost, 'wager already placed');
    need(Number.isInteger(amount) && amount > 0 && amount <= this.coins && amount <= RUN_TUNING.wagerMax, 'bad wager');
    this.coins -= amount; s.wager = amount;
  }

  /** Pay to restart the same duel (same seed) after a loss. Once per node. */
  retryDuel(): DuelEncounter {
    const s = this.duelState();
    need(s.lost, 'retry only after a loss');
    need(!s.retryUsed, 'retry already used on this node');
    const cost = this.retryCost();
    need(this.coins >= cost, 'cannot afford retry');
    this.coins -= cost; s.retryUsed = true; s.lost = false; this.hp = Math.max(1, s.entryHp);
    return this.getDuel();
  }

  canRetry(): boolean {
    const s = this.st.nodeState;
    return !!s && s.kind === 'duel' && s.lost && !s.retryUsed && this.coins >= this.retryCost();
  }

  completeDuel(res: RunDuelResult): { status: 'won' | 'refight' | 'dead'; canRetry: boolean; retryCost: number } {
    const s = this.duelState();
    const nd = this.currentNode() as MapNode;
    need(!s.lost, 'duel already lost; retry or abandon');
    for (const c of res.consumedPerks ?? []) if (!this.st.consumed.includes(c)) this.st.consumed.push(c);

    if (res.outcome === 'LOSE') {
      this.st.perfectStreak = 0;
      if (res.heroHp > 0) { this.hp = Math.min(res.heroHp, this.maxHp()); return { status: 'refight', canRetry: false, retryCost: this.retryCost() }; }
      s.lost = true; this.hp = 0; this.st.stats.deaths++;
      return { status: 'dead', canRetry: this.canRetry(), retryCost: this.retryCost() };
    }

    // ---- win
    const composed = this.compose({ enemyId: s.enemyId, elite: nd.type === 'elite', boss: nd.type === 'boss',
      firstDuelOfRegion: this.st.regionDuels === 0 && nd.type === 'duel' });
    const m = composed.duel;
    this.hp = clamp(res.heroHp, 1, this.maxHp());
    const noDamage = res.heroHp >= s.entryHp;
    const perfect = res.tier === 'perfect';
    this.st.stats.duelsWon++;
    if (perfect) { this.st.stats.perfects++; this.st.perfectStreak++; } else this.st.perfectStreak = 0;
    if (typeof res.reactionMs === 'number') {
      const b = this.st.stats.bestReactionMs;
      this.st.stats.bestReactionMs = b === null ? res.reactionMs : Math.min(b, res.reactionMs);
    }
    // Showman: streak of N Perfect Draws grants a free life, once per run
    if (m.perfectStreakLifeAt > 0 && this.st.perfectStreak >= m.perfectStreakLifeAt && !this.st.consumed.includes('showman')) {
      this.st.consumed.push('showman'); this.hp = Math.min(this.maxHp(), this.hp + 1);
    }

    const region = getRegionDef(this.map.regions[nd.region]);
    const rules = composed.run;
    let coins = 0;
    const eventDuel = s.eventDuel;
    const wasRetried = s.retryUsed && rules.retryNoReward;
    if (!wasRetried) {
      const mult = nd.type === 'duel' ? m.coinMultDuel : m.coinMultElite;
      let base = (RUN_TUNING.baseCoins + RUN_TUNING.difficultyCoins * s.difficulty) * region.coinMult;
      if (nd.type === 'elite') base *= RUN_TUNING.eliteCoinMult;
      if (nd.type === 'boss') base *= RUN_TUNING.bossCoinMult;
      if (eventDuel) base *= 0.75;
      coins = Math.round(base * mult);
      if (perfect) coins += RUN_TUNING.startPerfectBonus;
      if ((res.headshots ?? 0) > 0) coins += RUN_TUNING.headshotBonus;
      if (noDamage) coins += RUN_TUNING.noDamageBonus;
      coins += (res.dodges ?? 0) * m.coinPerDodge;
      if (perfect && noDamage) coins += m.pickpocketPerPerfect;
      coins += s.bonusCoins;
    }
    coins = Math.max(0, coins - m.coinLossPerDuel);
    if (s.wager > 0) coins += s.wager * 2;
    if (nd.type === 'boss' && rules.bossInterestPct > 0) coins += Math.floor(this.coins * rules.bossInterestPct);

    // perk offers
    let perkChoices: string[] = [];
    let rare = false;
    if (!wasRetried && !eventDuel) {
      const opts: RollOptions = nd.type === 'elite' ? { minRarity: 'rare' } : nd.type === 'boss' ? { minRarity: 'rare', bossBoost: true } : {};
      perkChoices = rollPerkChoices(this.rng, this.perks, this.luck(), 3, opts);
      rare = nd.type !== 'duel';
    }
    this.st.regionDuels += nd.type === 'duel' ? 1 : 0;
    this.tickBuffs();
    this.st.pending = { coins, perkChoices, rare, boss: nd.type === 'boss', rerolls: 0, nodeType: nd.type, heal: nd.type === 'boss' ? RUN_TUNING.bossHeal : 0 };
    this.st.phase = 'reward';
    return { status: 'won', canRetry: false, retryCost: 0 };
  }

  private tickBuffs(): void {
    for (const k of Object.keys(this.st.buffs)) {
      if (this.st.buffs[k] >= 99) continue;
      this.st.buffs[k]--;
      if (this.st.buffs[k] <= 0) delete this.st.buffs[k];
    }
  }

  getReward(): RewardView | null {
    const p = this.st.pending;
    if (!p) return null;
    return { coins: p.coins, perkChoices: p.perkChoices.slice(), rare: p.rare, skipBonus: RUN_TUNING.skipBonus, rerollCost: this.rewardRerollCost() };
  }

  private rewardRerollCost(): number {
    const p = this.st.pending;
    if (!p) return 0;
    if (p.rerolls === 0 && this.rules().rerollFreeFirstPerNode) return 0;
    return RUN_TUNING.rerollBase + RUN_TUNING.rerollStep * p.rerolls;
  }

  rerollReward(): string[] {
    const p = this.st.pending;
    need(p && p.perkChoices.length > 0, 'nothing to reroll');
    const cost = this.rewardRerollCost();
    need(this.coins + p.coins >= cost, 'cannot afford reroll');
    // paid from the run purse (reward coins are not yet banked)
    this.coins -= cost; p.rerolls++;
    const opts: RollOptions = p.nodeType === 'elite' ? { minRarity: 'rare' } : p.boss ? { minRarity: 'rare', bossBoost: true } : {};
    p.perkChoices = rollPerkChoices(this.rng, this.perks, this.luck(), 3, { ...opts, exclude: p.perkChoices });
    return p.perkChoices.slice();
  }

  /** Bank the coins and take one offered perk (or `skip` for a small coin bonus), then advance the map. */
  applyReward(choice: { perkId?: string; skip?: boolean } = {}): void {
    const p = this.st.pending;
    need(this.st.phase === 'reward' && p, 'no reward pending');
    if (choice.perkId) {
      need(p.perkChoices.includes(choice.perkId), 'perk not offered');
      this.givePerk(choice.perkId);
    } else if (p.perkChoices.length > 0) {
      need(choice.skip, 'choose a perk or skip');
      p.coins += RUN_TUNING.skipBonus;
    }
    this.addCoins(p.coins);
    if (p.heal) this.hp = clamp(this.hp + p.heal, 1, this.maxHp());
    this.st.pending = null;
    this.advance();
  }

  // ------------------------------------------------------------ shared mutation helpers

  private addCoins(n: number): void {
    this.coins = Math.max(0, this.coins + n);
    if (n > 0) this.st.stats.coinsEarned += n;
  }

  /** Adds a perk; extra max-hp from the perk is granted as current hp too. */
  private givePerk(id: string): void {
    need(!hasPerk(this.perks, id), `already own ${id}`);
    const before = this.maxHp();
    this.perks.push(id);
    const after = this.maxHp();
    if (after > before) this.hp += after - before;
    this.hp = clamp(this.hp, 1, after);
  }

  private removePerk(id: string): void {
    const i = this.perks.findIndex((p) => baseId(p) === id);
    need(i >= 0, `do not own ${id}`);
    this.perks.splice(i, 1);
    this.hp = clamp(this.hp, 1, this.maxHp());
  }

  private advance(): void {
    const nd = this.currentNode();
    need(nd, 'advance without a node');
    this.st.visited.push(nd.id);
    this.st.prevNodeId = nd.id;
    this.st.currentNodeId = null;
    this.st.nodeState = null;
    this.layer = nd.layer + 1;
    if (nd.type === 'boss') {
      for (const k of Object.keys(this.st.buffs)) if (this.st.buffs[k] >= 99) delete this.st.buffs[k];
      this.st.regionDuels = 0; this.st.eventPreviewsUsed = 0;
    }
    if (this.layer >= this.totalLayers) { this.st.phase = 'over'; this.st.outcome = 'victory'; return; }
    this.st.phase = 'map';
  }

  /** Leave a non-duel node (shop, rest, treasure, resolved event). */
  leaveNode(): void {
    const s = this.st.nodeState;
    need(this.st.phase === 'node' && s, 'no node to leave');
    need(s.kind !== 'duel', 'finish the duel first');
    if (s.kind === 'event') need(s.resolved, 'choose an option first');
    if (s.kind === 'treasure') need(s.opened, 'open the treasure first');
    this.advance();
  }

  abandon(): void {
    this.st.phase = 'over'; this.st.outcome = 'defeat'; this.st.nodeState = null; this.st.pending = null;
  }

  // ------------------------------------------------------------ shop

  private makeShop(): NodeState {
    const r = this.rules();
    const offers: ShopOfferState[] = [];
    const n = RUN_TUNING.shopPerks + r.shopExtraItems;
    const perks = rollPerkChoices(this.rng, this.perks, this.luck(), n);
    perks.forEach((p, i) => offers.push({ id: `p${i}`, kind: 'perk', ref: p, curse: false, sold: false }));
    if (r.shopCurseSlot && offers.length > 0) {
      const curse = rollPerkChoices(this.rng, this.perks, 0, 1, { allowCursed: true, onlyRarity: 'cursed', exclude: perks });
      if (curse.length) {
        const slot = this.rng.int(0, offers.length - 1);
        offers[slot] = { id: `p${slot}`, kind: 'perk', ref: curse[0], curse: true, sold: false };
      }
    }
    offers.push({ id: 'i0', kind: 'item', ref: this.rng.pick(ITEM_IDS), curse: false, sold: false });
    return { kind: 'shop', offers, rerolls: 0, healBought: false, pawnPending: false };
  }

  private shop(): Extract<NodeState, { kind: 'shop' }> {
    const s = this.st.nodeState;
    need(s && s.kind === 'shop', 'not in a shop');
    return s;
  }

  private offerPrice(o: ShopOfferState, pawn: boolean): number {
    const raw = o.kind === 'perk' ? perkPrice(o.ref) : ITEM_DEFS[o.ref].price;
    const pm = pawn ? 1 - RUN_TUNING.pawnDiscount : 1;
    return Math.max(1, Math.round(raw * this.priceMult() * pm));
  }

  getShop(): { offers: ShopOfferView[]; rerollCost: number; healPrice: number; removeCursePrice: number; sellable: { perkId: string; value: number }[] } {
    const s = this.shop();
    const r = this.rules();
    const offers: ShopOfferView[] = s.offers.filter((o) => !o.sold).map((o) => {
      const hidden = o.curse && !r.curseVisible;
      return {
        id: o.id, kind: o.kind, perkId: o.kind === 'perk' && !hidden ? o.ref : null, itemId: o.kind === 'item' ? o.ref : null,
        name: hidden ? '???' : o.kind === 'perk' ? PERK_BY_ID[o.ref].name : ITEM_DEFS[o.ref].name,
        price: this.offerPrice(o, s.pawnPending), curse: o.curse && !hidden, hidden,
      };
    });
    return {
      offers, rerollCost: this.shopRerollCost(), healPrice: this.healPriceNow(), removeCursePrice: RUN_TUNING.removeCursePrice,
      sellable: r.pawnShop ? this.perks.map((p) => ({ perkId: baseId(p), value: this.sellValue(p) })) : [],
    };
  }

  private healPriceNow(): number { return Math.max(1, Math.round(RUN_TUNING.healPrice * this.priceMult())); }
  private shopRerollCost(): number {
    const s = this.shop();
    if (s.rerolls === 0 && this.rules().rerollFreeFirstPerNode) return 0;
    return RUN_TUNING.rerollBase + RUN_TUNING.rerollStep * s.rerolls;
  }
  private sellValue(p: string): number {
    const def = PERK_BY_ID[baseId(p)];
    const v = perkSellValue(baseId(p));
    return def.rarity === 'cursed' && p.endsWith('+') ? v * 2 : v;
  }

  shopBuy(offerId: string): void {
    const s = this.shop();
    const o = s.offers.find((x) => x.id === offerId && !x.sold);
    need(o, `no such offer ${offerId}`);
    const price = this.offerPrice(o, s.pawnPending);
    need(this.coins >= price, 'cannot afford');
    if (o.kind === 'perk') {
      need(!hasPerk(this.perks, o.ref), 'already owned');
      this.coins -= price;
      this.givePerk(o.ref);
    } else {
      this.coins -= price;
      this.st.items.push(o.ref);
    }
    o.sold = true; s.pawnPending = false;
  }

  shopReroll(): void {
    const s = this.shop();
    const cost = this.shopRerollCost();
    need(this.coins >= cost, 'cannot afford reroll');
    this.coins -= cost; s.rerolls++;
    const keep = s.offers.filter((o) => o.kind === 'item' || o.curse || o.sold);
    const taken = s.offers.filter((o) => o.kind === 'perk' && !o.curse && !o.sold).length;
    const fresh = rollPerkChoices(this.rng, this.perks, this.luck(), taken, { exclude: s.offers.filter((o) => o.kind === 'perk').map((o) => o.ref) });
    const used = new Set(keep.map((o) => o.id));
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'].filter((i) => !used.has(i));
    const added: ShopOfferState[] = fresh.map((p, i) => ({ id: ids[i], kind: 'perk', ref: p, curse: false, sold: false }));
    s.offers = [...keep.filter((o) => !o.sold), ...added].sort((a, b) => a.id.localeCompare(b.id));
  }

  shopHeal(): void {
    const s = this.shop();
    need(!s.healBought, 'heal already bought');
    const price = this.healPriceNow();
    need(this.coins >= price, 'cannot afford');
    need(this.hp < this.maxHp(), 'already at full lives');
    this.coins -= price; this.hp += 1; s.healBought = true;
  }

  shopRemoveCurse(perkId: string): void {
    this.shop();
    need(PERK_BY_ID[baseId(perkId)]?.rarity === 'cursed' && hasPerk(this.perks, baseId(perkId)), 'not an owned curse');
    need(this.coins >= RUN_TUNING.removeCursePrice, 'cannot afford');
    this.coins -= RUN_TUNING.removeCursePrice;
    this.removePerk(baseId(perkId));
  }

  /** Pawn Shop: sell a perk; the next purchase this visit is 25% cheaper. */
  shopSell(perkId: string): void {
    const s = this.shop();
    need(this.rules().pawnShop, 'Pawn Shop not owned');
    const owned = this.perks.find((p) => baseId(p) === perkId);
    need(owned, 'not owned');
    this.addCoins(this.sellValue(owned));
    this.removePerk(perkId);
    s.pawnPending = true;
  }

  /** Use a consumable from the pack (any time on the map or at a node). */
  useItem(itemId: string): void {
    const i = this.st.items.indexOf(itemId);
    need(i >= 0, 'item not owned');
    const def = ITEM_DEFS[itemId];
    need(def, `unknown item ${itemId}`);
    if (def.heal) { need(this.hp < this.maxHp(), 'already at full lives'); this.hp = Math.min(this.maxHp(), this.hp + def.heal); }
    if (def.buff) this.st.buffs[def.buff] = Math.max(this.st.buffs[def.buff] ?? 0, 1);
    this.st.items.splice(i, 1);
  }

  // ------------------------------------------------------------ rest

  private rest(): Extract<NodeState, { kind: 'rest' }> {
    const s = this.st.nodeState;
    need(s && s.kind === 'rest', 'not at a rest node');
    return s;
  }

  getRest(): { usesLeft: number; canHeal: boolean; healsFully: boolean; upgradable: string[]; droppable: { perkId: string; value: number }[] } {
    const s = this.rest();
    const r = this.rules();
    return {
      usesLeft: s.usesLeft, canHeal: this.hp < this.maxHp(), healsFully: r.restHealFull,
      upgradable: r.restNoUpgrade ? [] : this.perks.filter((p) => canUpgrade(this.perks, baseId(p))).map(baseId),
      droppable: r.restNoUpgrade ? [] : this.perks.map((p) => ({ perkId: baseId(p), value: this.sellValue(p) })),
    };
  }

  doRest(action: { type: 'heal' } | { type: 'upgrade'; perkId: string } | { type: 'drop'; perkId: string }): void {
    const s = this.rest();
    const r = this.rules();
    need(s.usesLeft > 0, 'rest used up');
    if (action.type === 'heal') {
      need(this.hp < this.maxHp(), 'already at full lives');
      this.hp = r.restHealFull ? this.maxHp() : this.hp + 1;
    } else {
      need(!r.restNoUpgrade, "Healer's Touch: no upgrading or dropping at rest");
      if (action.type === 'upgrade') this.perks = upgradePerk(this.perks, action.perkId);
      else {
        const owned = this.perks.find((p) => baseId(p) === action.perkId);
        need(owned, 'not owned');
        this.addCoins(this.sellValue(owned));
        this.removePerk(action.perkId);
      }
    }
    s.usesLeft--;
  }

  // ------------------------------------------------------------ treasure

  private makeTreasure(): NodeState {
    const trapped = this.rng.next() < RUN_TUNING.treasureTrapChance;
    const perkRoll = this.rng.next() < 0.5;
    const coins = Math.round(this.rng.int(RUN_TUNING.treasureCoins[0], RUN_TUNING.treasureCoins[1]) * this.currentRegionMult());
    const perk = perkRoll ? (rollPerkChoices(this.rng, this.perks, this.luck(), 1)[0] ?? null) : null;
    return { kind: 'treasure', coins, perk, trapped, opened: false };
  }
  private currentRegionMult(): number { return this.currentRegion().coinMult; }

  getTreasure(): { coins: number; perkId: string | null; trapped: boolean; disarmCost: number; opened: boolean } {
    const s = this.st.nodeState;
    need(s && s.kind === 'treasure', 'not at a treasure');
    return { coins: s.coins, perkId: s.perk, trapped: s.trapped, disarmCost: RUN_TUNING.disarmCost, opened: s.opened };
  }

  openTreasure(disarm = false): void {
    const s = this.st.nodeState;
    need(s && s.kind === 'treasure' && !s.opened, 'nothing to open');
    if (s.trapped) {
      if (disarm) { need(this.coins >= RUN_TUNING.disarmCost, 'cannot afford to disarm'); this.coins -= RUN_TUNING.disarmCost; }
      else this.hp = Math.max(1, this.hp - Math.max(0, 1 - this.rules().eventHpLossBlock));
    }
    if (s.perk) this.givePerk(s.perk); else this.addCoins(s.coins);
    s.opened = true;
  }

  // ------------------------------------------------------------ events

  private ev(): Extract<NodeState, { kind: 'event' }> {
    const s = this.st.nodeState;
    need(s && s.kind === 'event', 'not at an event');
    return s;
  }

  getEvent(): { event: RandomEvent; chosen: number | null; outcome: EventOutcome | null; costs: number[]; previewsLeft: number; whiskeyLeft: number } {
    const s = this.ev();
    const event = getEventDef(s.eventId);
    return {
      event, chosen: s.chosen, outcome: s.outcome, costs: event.choices.map((c) => getEffectCost(c.effectKey)),
      previewsLeft: Math.max(0, this.rules().eventPreviewPerRegion - this.st.eventPreviewsUsed),
      whiskeyLeft: Math.max(0, this.rules().whiskeyEventRerolls - this.st.whiskeyUsed),
    };
  }

  private eventState(): EventState {
    const r = this.rules();
    return {
      hp: this.hp, maxHp: this.maxHp(), coins: this.coins, perks: this.perks,
      upgradable: this.perks.filter((p) => canUpgrade(this.perks, baseId(p))).map(baseId),
      coinScale: this.currentRegionMult(), eventHpLossBlock: r.eventHpLossBlock,
    };
  }

  /** Lucky Charm: the exact outcome of a choice without committing (does not advance the rng). */
  previewEventChoice(index: number): EventOutcome {
    const s = this.ev();
    need(s.chosen === null, 'already chosen');
    need(this.rules().eventPreviewPerRegion - this.st.eventPreviewsUsed > 0, 'no previews left in this region');
    const choice = getEventDef(s.eventId).choices[index];
    need(choice, 'bad choice index');
    this.st.eventPreviewsUsed++;
    return previewEffect(choice.effectKey, { rng: this.rng, state: this.eventState() });
  }

  chooseEvent(index: number): EventOutcome {
    const s = this.ev();
    need(s.chosen === null, 'already chosen');
    const choice = getEventDef(s.eventId).choices[index];
    need(choice, 'bad choice index');
    need(getEffectCost(choice.effectKey) <= this.coins, 'cannot afford this choice');
    s.snapshot = this.snapshot();
    const out = resolveEffect(choice.effectKey, { rng: this.rng, state: this.eventState() });
    this.applyEventOutcome(out);
    s.chosen = index; s.outcome = out;
    if (out.startDuel) this.beginEventDuel(out.startDuel);
    else s.resolved = true;
    return out;
  }

  /** Whiskey Luck: undo the outcome and roll again; the next duel's aim budget suffers (blurry). */
  whiskeyReroll(): EventOutcome {
    const s = this.ev();
    need(s.chosen !== null && s.outcome && s.snapshot && !s.outcome.startDuel, 'nothing to reroll');
    need(this.rules().whiskeyEventRerolls - this.st.whiskeyUsed > 0, 'no whiskey left');
    this.restoreSnapshot(s.snapshot);
    this.st.whiskeyUsed++;
    this.st.buffs.blurry = Math.max(this.st.buffs.blurry ?? 0, 1);
    const choice = getEventDef(s.eventId).choices[s.chosen as number];
    const out = resolveEffect(choice.effectKey, { rng: this.rng, state: this.eventState() });
    this.applyEventOutcome(out);
    s.outcome = out;
    if (out.startDuel) this.beginEventDuel(out.startDuel);
    return out;
  }

  private snapshot(): Snapshot {
    return JSON.parse(JSON.stringify({
      hp: this.hp, coins: this.coins, perks: this.perks, items: this.st.items, buffs: this.st.buffs, flags: this.st.flags,
      reputation: this.st.reputation,
    }));
  }
  private restoreSnapshot(s: Snapshot): void {
    this.hp = s.hp; this.coins = s.coins; this.perks = [...s.perks]; this.st.items = [...s.items];
    this.st.buffs = { ...s.buffs }; this.st.flags = [...s.flags]; this.st.reputation = s.reputation;
  }

  private applyEventOutcome(o: EventOutcome): void {
    if (o.blocked) return;
    this.addCoins(o.coinsDelta);
    this.st.reputation = clamp(this.st.reputation + o.reputationDelta, -5, 5);
    for (const [k, v] of Object.entries(o.buffs)) this.st.buffs[k] = Math.max(this.st.buffs[k] ?? 0, v);
    for (const p of o.grantPerks) if (!hasPerk(this.perks, p)) this.givePerk(p);
    this.st.items.push(...o.grantItems);
    if (o.upgradePerk) this.perks = upgradePerk(this.perks, o.upgradePerk);
    this.st.flags.push(...o.flags.filter((f) => f === 'ambush_next' || f === 'gunsmith_quest'));
    // events can wound but never kill: floor at 1 life
    this.hp = clamp(this.hp + o.hpDelta, 1, this.maxHp());
  }

  private beginEventDuel(d: { enemyId: string; bonusCoins: number }): void {
    const nd = this.currentNode() as MapNode;
    this.st.nodeState = {
      kind: 'duel', enemyId: d.enemyId, bossId: null, difficulty: clamp(this.difficultyAt(nd) + 0.05, 0, 1),
      seed: this.rng.int(1, 0x7fffffff), entryHp: this.hp, retryUsed: false, lost: false, wager: 0, eventDuel: true,
      bonusCoins: d.bonusCoins, ambush: false,
    };
  }
}

/** Convenience factory matching the design API: `startRun(seed, opts)`. */
export function startRun(seed: number, opts: RunOptions = {}): RunSystem {
  return RunSystem.start(seed, opts);
}
export function restoreRun(save: RunSave, hasArena?: (id: string) => boolean): RunSystem {
  return RunSystem.restore(save, hasArena);
}
export { RARITY_PRICE };
