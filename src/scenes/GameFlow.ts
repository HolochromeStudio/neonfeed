/**
 * GameFlow: the controller that makes the whole loop playable (docs/UX_FLOW.md section 4):
 * MainMenu -> (new run | continue | practice duel) -> RunMap -> Duel / Shop / Rest / Event / Treasure -> Reward -> RunMap ...
 * -> boss -> Results (settle + persist) -> MainMenu.
 *
 * Phaser-free on purpose: it talks to a `FlowHost` (show a scene with init data) and to the pure systems (RunSystem,
 * EconomySystem, BountySystem, SaveManager), so the whole loop is unit-tested with a fake host (tests/flow*.test.ts).
 * main.ts supplies the Phaser host. The UI scenes keep owning their own widgets; the flow only maps state into the
 * view models of src/ui/types.ts and listens to their callbacks (D7: analytics through the service interfaces).
 *
 * Persistence: after every state change the run is saved (RunSave + a small `flow` log: path walked, enemies defeated,
 * headshots...). `restoreRun` resumes mid-node (even mid-shop); a duel that was in progress restarts from the
 * same seed (RULE F5). Settlement happens exactly once, when the run ends: `settleRunWithBounties`, then `clearRun`.
 */
import { Rng } from '../core/rng';
import type { MetaSave, RunSave, SaveManager } from '../core/SaveManager';
import { getBossDef, isBossId } from '../data/bosses';
import { getEnemyDef } from '../data/enemies';
import { PERK_BY_ID } from '../data/perks';
import { getWanted } from '../data/wanted';
import type { AnalyticsService } from '../services';
import { getBoard, settleRunWithBounties } from '../systems/BountySystem';
import { describeLoss } from '../systems/DuelSystem';
import type { DuelResult } from '../systems/DuelSystem';
import { computeSettlement } from '../systems/EconomySystem';
import type { RunSummary as EconomySummary } from '../systems/EconomySystem';
import { baseId } from '../systems/PerkSystem';
import { RunError, restoreRun, startRun } from '../systems/RunSystem';
import type { DuelEncounter, MapNode, RunDuelResult, RunSystem } from '../systems/RunSystem';
import type { ChoiceData, ChoiceOption } from './ChoiceScene';
import type { DuelSceneData } from './DuelScene';
import { blurb, choiceLabel, outcomeLines, perkCard, perkChip, shopItems, SERVICE_CURSE_PREFIX, SERVICE_HEAL } from './flowViewModels';
import type { RunMapData, RunMapNodeVM } from './RunMapScene';
import { SCENE_KEYS } from './sceneKeys';
import type { GameSettings, MainMenuData, MenuAction, ResultsAction, ResultsData, RewardData, RunSummaryVM, SettingsData, ShopData } from '../ui/types';

// ---------------------------------------------------------------------------------------------------------------------

/** What the flow needs from the screen layer. */
export interface FlowHost {
  /** Stops whatever scene is showing and starts `key` with `data` as its init data. */
  show(key: string, data?: unknown): void;
  /** The running scene instance (to push canonical state back, e.g. ShopScene.setCoins). */
  scene?<T = unknown>(key: string): T | undefined;
}

export interface FlowDeps {
  host: FlowHost;
  save: SaveManager;
  analytics?: AnalyticsService;
  /** Fresh run/practice seed. Default: wall clock mixed with performance.now (flow layer, not game logic: D4). */
  seed?: () => number;
  /** "YYYY-MM-DD" for the bounty board. Default: today (UTC). */
  dayKey?: () => string;
  /** Applies saved settings to audio/haptics (called at boot and after every settings change). */
  applySettings?: (s: GameSettings) => void;
}

/** Small log the flow keeps next to the RunSave (RunSystem does not track these for the economy). */
export interface RunLog {
  v: 1;
  /** Node ids entered, in order. */
  visited: string[];
  /** Wanted ids of the enemies/bosses beaten, one per duel won. */
  defeated: string[];
  headshots: number;
  noDamageDuels: number;
  regionsCleared: string[];
  /** Who killed the hero (wanted id) and the F4 cause line. */
  killer: { id: string; cause: string } | null;
  lastBoss: string | null;
  /** A paid retry is on offer (survives a reload). */
  pendingRetry: { cost: number; cause: string } | null;
}

export const newRunLog = (): RunLog => ({ v: 1, visited: [], defeated: [], headshots: 0, noDamageDuels: 0, regionsCleared: [], killer: null, lastBoss: null, pendingRetry: null });

type FlowRunSave = RunSave & { flow?: RunLog };

const PRACTICE_ENEMIES = ['rookie', 'bandit', 'gunslinger', 'coward', 'drunk', 'sheriff'] as const;

type NodeKind = 'duel' | 'shop' | 'rest' | 'treasure' | 'event';

export const defaultSeed = (): number => {
  const t = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0;
  return ((Date.now() ^ t) >>> 0) % 0x7fffffff || 1;
};
export const defaultDayKey = (): string => new Date().toISOString().slice(0, 10);

const RETRY_CHOICE = 'RETRY';

export class GameFlow {
  private run: RunSystem | null = null;
  private log: RunLog = newRunLog();
  private enc: DuelEncounter | null = null;
  private lastKey = '';
  private healBought = new Set<string>();
  private treasureNote: string[] | null = null;

  constructor(private readonly deps: FlowDeps) {}

  // ---- public ---------------------------------------------------------------------------------

  /** Boot: applies saved settings and shows the main menu. */
  start(): void {
    this.deps.applySettings?.(this.deps.save.getMeta().settings);
    this.menu();
  }

  /** Scene key currently shown (debug / tests). */
  get current(): string {
    return this.lastKey;
  }
  get activeRun(): RunSystem | null {
    return this.run;
  }

  /** Writes the run to the SaveManager (queued). Called after every state change and on visibilitychange/pagehide. */
  persist(): void {
    const run = this.run;
    if (!run || run.phase === 'over') return;
    try {
      this.deps.save.saveRun({ ...run.serialize(), flow: this.log } as FlowRunSave);
    } catch {
      /* a failed save must never break play */
    }
  }

  flush(): Promise<void> {
    return this.deps.save.flush();
  }

  // ---- plumbing -------------------------------------------------------------------------------

  private show(key: string, data?: unknown): void {
    this.lastKey = key;
    this.deps.host.show(key, data);
  }

  private track(event: string, params?: Record<string, string | number | boolean>): void {
    try {
      this.deps.analytics?.track(event, params);
    } catch {
      /* analytics must never break play */
    }
  }

  private meta(): MetaSave {
    return this.deps.save.getMeta();
  }

  private ui(): { leftHanded: boolean; reduceMotion: boolean } {
    const s = this.meta().settings;
    return { leftHanded: s.handedness === 'left', reduceMotion: s.reducedShake };
  }

  private get r(): RunSystem {
    if (!this.run) throw new RunError('no active run');
    return this.run;
  }

  /** Runs a RunSystem mutation; a refused call (RunError) is reported to the caller as false and never throws into the UI. */
  private attempt(fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (e) {
      if (e instanceof RunError) return false;
      throw e;
    }
  }

  // ---- main menu ------------------------------------------------------------------------------

  private savedRun(): { run: RunSystem; log: RunLog } | null {
    const rs = this.deps.save.getRun() as FlowRunSave | null;
    if (!rs) return null;
    try {
      return { run: restoreRun(rs), log: rs.flow && rs.flow.v === 1 ? { ...newRunLog(), ...rs.flow } : newRunLog() };
    } catch {
      this.deps.save.clearRun(); // a save that no longer restores is dropped, never loops the menu
      return null;
    }
  }

  menu(): void {
    this.run = null;
    this.enc = null;
    const saved = this.savedRun();
    const data: MainMenuData = {
      ...this.ui(),
      coins: this.meta().coins,
      hasRun: saved !== null,
      runLabel: saved ? this.progressLabel(saved.run) : undefined,
      onAction: (a) => this.onMenuAction(a, saved !== null),
    };
    this.show(SCENE_KEYS.menu, data);
  }

  private onMenuAction(a: MenuAction, hadRun: boolean): void {
    switch (a) {
      case 'duel':
      case 'new_run':
        if (hadRun) this.deps.save.clearRun(); // the scene already asked "abandon?"
        this.newRun();
        break;
      case 'continue':
        this.resume();
        break;
      case 'practice':
        this.practice();
        break;
      case 'settings':
        this.settings();
        break;
      case 'saloon':
      case 'bounties':
        this.notice(a === 'saloon' ? 'SALOON' : 'BOUNTIES', ['COMING SOON.', 'THE DOORS ARE STILL BEING NAILED.'], () => this.menu());
        break;
    }
  }

  /** A single-button notice board. */
  private notice(title: string, body: string[], back: () => void, label = 'BACK'): void {
    this.show(SCENE_KEYS.choice, { ...this.ui(), title, body, options: [{ label, onTap: back }] } satisfies ChoiceData);
  }

  private settings(): void {
    const data: SettingsData = {
      ...this.ui(),
      settings: this.meta().settings,
      onChange: (s) => {
        this.deps.save.updateMeta((m) => { m.settings = { ...m.settings, ...s }; });
        this.deps.applySettings?.(s);
      },
      onClose: () => this.menu(),
    };
    this.show(SCENE_KEYS.settings, data);
  }

  // ---- practice -------------------------------------------------------------------------------

  practice(): void {
    const seed = (this.deps.seed ?? defaultSeed)();
    const enemyId = new Rng(seed).pick(PRACTICE_ENEMIES);
    const data: DuelSceneData = {
      mode: 'practice', seed, arenaId: 'dust_creek', enemyId, difficulty: 0.35,
      onExit: () => this.menu(),
    };
    this.track('practice_start', { enemy: enemyId });
    this.show(SCENE_KEYS.duel, data);
  }

  // ---- run lifecycle --------------------------------------------------------------------------

  newRun(): void {
    const seed = (this.deps.seed ?? defaultSeed)();
    this.run = startRun(seed);
    this.log = newRunLog();
    this.enc = null;
    this.healBought.clear();
    this.track('run_start', { seed });
    this.persist();
    this.route();
  }

  resume(): void {
    const saved = this.savedRun();
    if (!saved) {
      this.menu();
      return;
    }
    this.run = saved.run;
    this.log = saved.log;
    this.enc = null;
    this.track('run_resume', { layer: saved.run.nodeIndex });
    this.route();
  }

  /** Shows the screen the run state calls for. Used after every transition and when resuming. */
  private route(): void {
    const run = this.r;
    switch (run.phase) {
      case 'over':
        this.finishRun();
        return;
      case 'reward':
        this.showReward();
        return;
      case 'map':
        this.showMap();
        return;
      case 'node':
        this.showNode();
        return;
    }
  }

  private nodeKind(): NodeKind {
    const run = this.r;
    const probes: [NodeKind, () => unknown][] = [
      ['duel', () => run.getDuel()], ['shop', () => run.getShop()], ['rest', () => run.getRest()],
      ['treasure', () => run.getTreasure()], ['event', () => run.getEvent()],
    ];
    for (const [kind, probe] of probes) {
      try {
        probe();
        return kind;
      } catch (e) {
        if (!(e instanceof RunError)) throw e;
      }
    }
    throw new RunError('node has no screen');
  }

  private showNode(): void {
    switch (this.nodeKind()) {
      case 'duel':
        if (this.log.pendingRetry) this.showRetryOffer(this.log.pendingRetry.cost, this.log.pendingRetry.cause);
        else this.showDuel();
        break;
      case 'shop':
        this.showShop();
        break;
      case 'rest':
        this.showRest();
        break;
      case 'treasure':
        this.showTreasure();
        break;
      case 'event':
        this.showEvent();
        break;
    }
  }

  // ---- map ------------------------------------------------------------------------------------

  /** "DUST CREEK 3/7": the layer the player is about to play inside the current region. */
  private progressLabel(run: RunSystem): string {
    const region = run.currentRegion();
    const row = run.map.layers[Math.min(run.nodeIndex, run.map.layers.length - 1)] ?? [];
    const local = (row[0]?.local ?? 0) + 1;
    return `${region.name.toUpperCase()} ${local}/${region.nodeCount}`;
  }

  private enemyName(id: string | undefined): string | undefined {
    if (!id) return undefined;
    try {
      return getEnemyDef(id).name;
    } catch {
      return undefined;
    }
  }

  private nodeLabel(n: MapNode): string {
    if (n.type === 'boss') {
      const bossId = this.r.currentRegion().bossId;
      return choiceLabel('boss', isBossId(bossId) ? getBossDef(bossId).name : this.enemyName(n.enemyId));
    }
    return choiceLabel(n.type, this.enemyName(n.enemyId));
  }

  private showMap(): void {
    const run = this.r;
    const choices = run.getChoices();
    if (choices.length === 0) {
      this.finishRun();
      return;
    }
    const vis = run.getVisibleMap();
    const regionIdx = choices[0]!.region;
    const choiceIds = new Set(choices.map((c) => c.id));
    const rows: RunMapNodeVM[][] = run.map.layers
      .filter((row) => row[0]?.region === regionIdx)
      .map((row) => row.map((n) => {
        const v = vis[n.layer]?.find((x) => x.id === n.id);
        return {
          id: n.id, type: v?.type ?? 'unknown', lane: n.lane, lanes: row.length, next: n.next,
          state: n.layer < run.nodeIndex ? 'done' : choiceIds.has(n.id) ? 'choice' : 'future',
          visited: this.log.visited.includes(n.id),
        } satisfies RunMapNodeVM;
      }));
    const data: RunMapData = {
      ...this.ui(),
      progressLabel: this.progressLabel(run),
      hp: run.getHp(), maxHp: run.maxHp(), coins: run.getCoins(), perkCount: run.getPerks().length,
      rows,
      choices: choices.map((c) => ({ id: c.id, type: c.type, label: this.nodeLabel(c) })),
      onChoose: (id) => this.enterNode(id),
      onPerks: () => this.showPerks(),
      onMenu: () => {
        this.persist();
        this.menu();
      },
    };
    this.show(SCENE_KEYS.map, data);
  }

  private showPerks(): void {
    const run = this.r;
    const perks = run.getPerks();
    const lines = perks.length === 0
      ? ['NO PERKS YET.', 'WIN DUELS TO EARN THEM.']
      : [...perks.slice(0, 7).map((p) => `${PERK_BY_ID[baseId(p)]?.name ?? p}${p.endsWith('+') ? ' +' : ''}`.toUpperCase()), ...(perks.length > 7 ? [`AND ${perks.length - 7} MORE`] : [])];
    const items = run.getItems();
    if (items.length) lines.push(`PACK: ${items.join(', ').toUpperCase()}`);
    this.show(SCENE_KEYS.choice, { ...this.ui(), title: 'YOUR PERKS', body: lines, hp: { current: run.getHp(), max: run.maxHp() }, coins: run.getCoins(), options: [{ label: 'BACK', onTap: () => this.route() }] } satisfies ChoiceData);
  }

  private enterNode(id: string): void {
    if (!this.attempt(() => this.r.enterNode(id))) {
      this.route();
      return;
    }
    this.log.visited.push(id);
    this.persist();
    this.route();
  }

  // ---- duel -----------------------------------------------------------------------------------

  private showDuel(): void {
    const run = this.r;
    const enc = run.getDuel();
    this.enc = enc;
    let enemyName: string | undefined;
    if (enc.bossId && isBossId(enc.bossId)) enemyName = getBossDef(enc.bossId).name;
    const data: DuelSceneData = {
      mode: 'run', seed: enc.seed, arenaId: enc.arenaId, enemyId: enc.enemyId, difficulty: enc.difficulty,
      heroHp: enc.heroHp, heroMaxHp: run.maxHp(), config: enc.config, modifiers: enc.modifiers, bossId: enc.bossId,
      kind: enc.boss ? 'boss' : enc.elite ? 'elite' : 'normal', // D14: elites and bosses hit for 2
      enemyHpBonus: enc.enemyHpBonus, enemyName,
      finishLabel: () => 'CONTINUE',
      onFinish: (res) => this.onDuelDone(res),
      onExit: () => {
        this.persist();
        this.menu();
      },
    };
    this.track('duel_start', { enemy: enc.enemyId, boss: enc.boss, elite: enc.elite, layer: run.nodeIndex });
    this.show(SCENE_KEYS.duel, data);
  }

  private consumedPerks(res: DuelResult): string[] {
    if (res.revivesUsed <= 0) return [];
    return this.r.getPerks().map(baseId).filter((id) => PERK_BY_ID[id]?.oncePerRun && (PERK_BY_ID[id]?.duel?.reviveCharges ?? 0) > 0);
  }

  /** Wanted-poster id for an encounter (boss ids the roster does not know fall back to the roster enemy). */
  private wantedId(enc: DuelEncounter): string {
    return enc.bossId && getWanted(enc.bossId) ? enc.bossId : enc.enemyId;
  }

  /** The Continue plank of the duel scene was tapped. */
  onDuelDone(res: DuelResult): void {
    const run = this.r;
    const enc = this.enc ?? run.getDuel();
    const rd: RunDuelResult = {
      outcome: res.outcome, heroHp: res.heroHp, tier: res.tier, reactionMs: res.reactionMs, headshots: res.headshots, dodges: res.dodges, hitsIgnored: res.hitsIgnored,
      consumedPerks: this.consumedPerks(res),
    };
    let out: ReturnType<RunSystem['completeDuel']>;
    try {
      out = run.completeDuel(rd);
    } catch (e) {
      if (e instanceof RunError) {
        this.route();
        return;
      }
      throw e;
    }
    this.track('duel_end', { enemy: enc.enemyId, outcome: res.outcome, status: out.status, tier: res.tier ?? 'none', layer: run.nodeIndex });
    if (out.status === 'won') {
      this.log.defeated.push(this.wantedId(enc));
      this.log.headshots += res.headshots;
      if (res.heroHp >= enc.heroHp) this.log.noDamageDuels++;
      if (enc.boss) {
        this.log.regionsCleared.push(enc.region);
        this.log.lastBoss = this.wantedId(enc);
      }
      this.persist();
      this.showReward();
      return;
    }
    const cause = describeLoss(res) || 'SHOT DOWN';
    this.log.killer = { id: this.wantedId(enc), cause };
    if (out.status === 'refight') {
      this.persist();
      this.showDuel();
      return;
    }
    if (out.canRetry) {
      this.log.pendingRetry = { cost: out.retryCost, cause };
      this.persist();
      this.showRetryOffer(out.retryCost, cause);
      return;
    }
    this.giveUp();
  }

  private showRetryOffer(cost: number, cause: string): void {
    const run = this.r;
    const options: ChoiceOption[] = [
      {
        label: `${RETRY_CHOICE} $${cost}`, enabled: run.canRetry(),
        onTap: () => {
          if (!this.attempt(() => run.retryDuel())) {
            this.giveUp();
            return;
          }
          this.log.pendingRetry = null;
          this.persist();
          this.showDuel();
        },
      },
      { label: 'GIVE UP', variant: 'danger', onTap: () => this.giveUp() },
    ];
    this.show(SCENE_KEYS.choice, { ...this.ui(), title: 'YOU DIED', body: [cause.toUpperCase(), `ONE MORE TRY COSTS $${cost}.`, 'SAME DUEL, SAME DRAW.'], coins: run.getCoins(), stamp: 'DEAD', options, wall: 4 } satisfies ChoiceData);
  }

  private giveUp(): void {
    this.log.pendingRetry = null;
    if (this.r.phase !== 'over') this.r.abandon();
    this.finishRun();
  }

  // ---- reward ---------------------------------------------------------------------------------

  private showReward(): void {
    const run = this.r;
    const view = run.getReward();
    if (!view) {
      this.route();
      return;
    }
    const done = (): void => {
      this.persist();
      this.route();
    };
    if (view.perkChoices.length === 0) {
      this.show(SCENE_KEYS.choice, {
        ...this.ui(), title: 'SPOILS', body: [`+$${view.coins}`, 'THE DUEL PAYS OUT.'], coins: run.getCoins(), hp: { current: run.getHp(), max: run.maxHp() },
        options: [{ label: 'CONTINUE', onTap: () => { this.attempt(() => run.applyReward({})); done(); } }], wall: 9,
      } satisfies ChoiceData);
      return;
    }
    const data: RewardData = {
      ...this.ui(),
      subtitle: `+$${view.coins}`,
      coins: run.getCoins(),
      cards: view.perkChoices.map((id) => perkCard(id)),
      rerollCost: view.rerollCost,
      skipCoins: view.skipBonus,
      onPick: (id) => {
        this.attempt(() => run.applyReward({ perkId: id }));
        done();
      },
      onReroll: () => {
        this.attempt(() => run.rerollReward());
        this.persist();
        this.showReward();
      },
      onSkip: () => {
        this.attempt(() => run.applyReward({ skip: true }));
        done();
      },
    };
    this.show(SCENE_KEYS.reward, data);
  }

  // ---- shop -----------------------------------------------------------------------------------

  private showShop(): void {
    const run = this.r;
    const shop = run.getShop();
    const nodeId = run.currentNode()?.id ?? '';
    const curses = run.getPerks().map(baseId).filter((id) => PERK_BY_ID[id]?.rarity === 'cursed');
    const items = shopItems(shop.offers, {
      healPrice: shop.healPrice, canHeal: run.getHp() < run.maxHp() && !this.healBought.has(nodeId), curses, removeCursePrice: shop.removeCursePrice,
    });
    const data: ShopData = {
      ...this.ui(),
      coins: run.getCoins(),
      items,
      rerollCost: shop.rerollCost,
      onBuy: (id) => {
        let ok: boolean;
        if (id === SERVICE_HEAL) {
          ok = this.attempt(() => run.shopHeal());
          if (ok) this.healBought.add(nodeId);
        } else if (id.startsWith(SERVICE_CURSE_PREFIX)) {
          ok = this.attempt(() => run.shopRemoveCurse(id.slice(SERVICE_CURSE_PREFIX.length)));
        } else {
          ok = this.attempt(() => run.shopBuy(id));
        }
        if (ok) this.persist();
        return ok;
      },
      onReroll: () => {
        if (this.attempt(() => run.shopReroll())) {
          this.persist();
          this.showShop();
        }
      },
      onLeave: () => {
        this.attempt(() => run.leaveNode());
        this.persist();
        this.route();
      },
    };
    this.show(SCENE_KEYS.shop, data);
  }

  // ---- rest -----------------------------------------------------------------------------------

  private showRest(note?: string): void {
    const run = this.r;
    const rest = run.getRest();
    const options: ChoiceOption[] = [];
    if (rest.usesLeft > 0 && rest.canHeal) {
      options.push({ label: rest.healsFully ? 'HEAL TO FULL' : 'HEAL 1 LIFE', onTap: () => { this.attempt(() => run.doRest({ type: 'heal' })); this.persist(); this.showRest('YOU FEEL BETTER.'); } });
    }
    if (rest.usesLeft > 0 && rest.upgradable.length > 0) {
      options.push({ label: 'UPGRADE A PERK', onTap: () => this.showRestUpgrade() });
    }
    options.push({ label: 'RIDE ON', variant: options.length === 0 ? 'primary' : 'secondary', onTap: () => { this.attempt(() => run.leaveNode()); this.persist(); this.route(); } });
    const body = [note ?? 'A QUIET CAMP BY THE TRAIL.', rest.usesLeft > 0 ? 'YOU CAN DO ONE THING HERE.' : 'YOU HAVE RESTED ENOUGH.'];
    this.show(SCENE_KEYS.choice, { ...this.ui(), title: 'CAMPFIRE', body, hp: { current: run.getHp(), max: run.maxHp() }, coins: run.getCoins(), options, wall: 6 } satisfies ChoiceData);
  }

  private showRestUpgrade(): void {
    const run = this.r;
    const rest = run.getRest();
    const options: ChoiceOption[] = rest.upgradable.slice(0, 4).map((id) => ({
      label: (PERK_BY_ID[id]?.name ?? id).toUpperCase(),
      onTap: () => { this.attempt(() => run.doRest({ type: 'upgrade', perkId: id })); this.persist(); this.showRest(`${PERK_BY_ID[id]?.name ?? id} GROWS STRONGER.`.toUpperCase()); },
    }));
    options.push({ label: 'BACK', onTap: () => this.showRest() });
    this.show(SCENE_KEYS.choice, { ...this.ui(), title: 'UPGRADE', body: ['PICK A PERK TO IMPROVE.'], hp: { current: run.getHp(), max: run.maxHp() }, coins: run.getCoins(), options, wall: 6 } satisfies ChoiceData);
  }

  // ---- event ----------------------------------------------------------------------------------

  private showEvent(): void {
    const run = this.r;
    const ev = run.getEvent();
    const hud = { hp: { current: run.getHp(), max: run.maxHp() }, coins: run.getCoins() };
    if (ev.chosen !== null && ev.outcome) {
      const choice = ev.event.choices[ev.chosen]!;
      const body = [choice.outcomeText, ...outcomeLines(ev.outcome)];
      this.show(SCENE_KEYS.choice, { ...this.ui(), title: ev.event.title.toUpperCase(), body, ...hud, options: [{ label: 'CONTINUE', onTap: () => { this.attempt(() => run.leaveNode()); this.persist(); this.route(); } }], wall: 8 } satisfies ChoiceData);
      return;
    }
    const options: ChoiceOption[] = ev.event.choices.map((c, i) => ({
      label: c.label.toUpperCase(), enabled: (ev.costs[i] ?? 0) <= run.getCoins(),
      onTap: () => {
        if (!this.attempt(() => run.chooseEvent(i))) {
          this.showEvent();
          return;
        }
        this.persist();
        this.route(); // an ambush starts a duel node, anything else shows the outcome
      },
    }));
    this.show(SCENE_KEYS.choice, { ...this.ui(), title: ev.event.title.toUpperCase(), body: [ev.event.text], ...hud, options, wall: 8 } satisfies ChoiceData);
  }

  // ---- treasure -------------------------------------------------------------------------------

  private showTreasure(): void {
    const run = this.r;
    const t = run.getTreasure();
    const hud = { hp: { current: run.getHp(), max: run.maxHp() }, coins: run.getCoins() };
    if (t.opened) {
      this.show(SCENE_KEYS.choice, {
        ...this.ui(), title: 'TREASURE', body: this.treasureNote ?? ['THE CHEST IS EMPTY NOW.'], ...hud, stamp: 'OPEN',
        options: [{ label: 'CONTINUE', onTap: () => { this.treasureNote = null; this.attempt(() => run.leaveNode()); this.persist(); this.route(); } }], wall: 10,
      } satisfies ChoiceData);
      return;
    }
    const open = (disarm: boolean): void => {
      const hpBefore = run.getHp();
      const coinsBefore = run.getCoins();
      if (!this.attempt(() => run.openTreasure(disarm))) {
        this.showTreasure();
        return;
      }
      const lines: string[] = [];
      if (t.perkId) lines.push(`FOUND ${(PERK_BY_ID[t.perkId]?.name ?? t.perkId).toUpperCase()}`);
      else lines.push(`+$${t.coins}`);
      if (run.getHp() < hpBefore) lines.push('IT WAS TRAPPED! -1 LIFE');
      else if (disarm && run.getCoins() < coinsBefore + (t.perkId ? 0 : t.coins)) lines.push(`DISARMED FOR $${t.disarmCost}`);
      this.treasureNote = lines;
      this.persist();
      this.showTreasure();
    };
    this.show(SCENE_KEYS.choice, {
      ...this.ui(), title: 'TREASURE', body: ['A LOCKED CHEST SITS IN THE DUST.', 'IT MAY BE TRAPPED.'], ...hud,
      options: [
        { label: 'OPEN IT', onTap: () => open(false) },
        { label: `DISARM FIRST $${t.disarmCost}`, enabled: run.getCoins() >= t.disarmCost, onTap: () => open(true) },
      ],
      wall: 10,
    } satisfies ChoiceData);
  }

  // ---- run end --------------------------------------------------------------------------------

  /** Settles the run once (EconomySystem + bounties), clears the run save and shows the results. */
  private finishRun(): void {
    const run = this.r;
    if (run.phase !== 'over') run.abandon();
    const victory = run.outcome === 'victory';
    const stats = run.getStats();
    const summary: EconomySummary = {
      coins: run.getCoins(), victory, defeated: [...this.log.defeated], regionsCleared: [...this.log.regionsCleared],
      perfectDraws: stats.perfects, headshots: this.log.headshots, noDamageDuels: this.log.noDamageDuels, bestReactionMs: stats.bestReactionMs, mode: 'run',
    };
    const dayKey = (this.deps.dayKey ?? defaultDayKey)();
    const before = this.meta();
    const settlement = computeSettlement(before, summary);
    const after = settleRunWithBounties(before, summary, dayKey);
    this.deps.save.setMeta(after);
    this.deps.save.clearRun();
    this.track('run_end', { outcome: victory ? 'victory' : 'death', duels_won: stats.duelsWon, coins_banked: settlement.total, layer: run.nodeIndex, deaths: stats.deaths });

    const targetId = victory
      ? this.log.lastBoss ?? this.log.defeated[this.log.defeated.length - 1] ?? 'bandit'
      : this.log.killer?.id ?? this.enc?.enemyId ?? 'bandit';
    const board = getBoard(after, dayKey);
    const vm: RunSummaryVM = {
      outcome: victory ? 'victory' : 'death',
      targetId: getWanted(targetId) ? targetId : 'bandit',
      duelsWon: stats.duelsWon,
      bestReactionMs: stats.bestReactionMs,
      perfectDraws: stats.perfects,
      regionName: run.currentRegion().name,
      causeLine: victory ? undefined : this.log.killer ? blurb(this.log.killer.cause.toUpperCase(), 40) : undefined,
      coinsEarned: settlement.total,
      perks: run.getPerks().map(perkChip),
      bounties: board.daily.slice(0, 2).map((m) => ({ label: m.title, progress: m.progress, goal: m.target })),
    };
    const data: ResultsData = {
      ...this.ui(), summary: vm, canContinue: false,
      onAction: (a: ResultsAction) => {
        if (a === 'retry') this.newRun();
        else if (a === 'saloon') this.notice('SALOON', ['COMING SOON.', 'THE DOORS ARE STILL BEING NAILED.'], () => this.menu());
        else this.menu();
      },
    };
    this.run = null;
    this.enc = null;
    this.log = newRunLog();
    this.show(SCENE_KEYS.results, data);
  }
}
