// Test harness for GameFlow: a fake screen host plus a bot that plays the scenes through their callbacks.
import { MemoryStorageAdapter, type StorageAdapter } from '../src/core/storage';
import { SaveManager } from '../src/core/SaveManager';
import type { AnalyticsService } from '../src/services';
import type { ChoiceData } from '../src/scenes/ChoiceScene';
import type { DuelSceneData } from '../src/scenes/DuelScene';
import { GameFlow } from '../src/scenes/GameFlow';
import type { FlowHost } from '../src/scenes/GameFlow';
import type { RunMapData } from '../src/scenes/RunMapScene';
import type { DuelResult } from '../src/systems/DuelSystem';
import type { MainMenuData, ResultsData, RewardData, SettingsData, ShopData } from '../src/ui/types';

export interface Shown { key: string; data: unknown }

export class FakeHost implements FlowHost {
  shows: Shown[] = [];
  show(key: string, data?: unknown): void {
    this.shows.push({ key, data });
  }
  get last(): Shown {
    return this.shows[this.shows.length - 1] as Shown;
  }
  keys(): string[] {
    return this.shows.map((s) => s.key);
  }
}

export class Recorder implements AnalyticsService {
  events: { event: string; params?: Record<string, unknown> }[] = [];
  track(event: string, params?: Record<string, string | number | boolean>): void {
    this.events.push({ event, params });
  }
  names(): string[] {
    return this.events.map((e) => e.event);
  }
}

export async function makeFlow(opts: { storage?: StorageAdapter; seed?: number; seeds?: number[] } = {}) {
  const storage = opts.storage ?? new MemoryStorageAdapter();
  const save = new SaveManager(storage);
  await save.load();
  const host = new FakeHost();
  const analytics = new Recorder();
  const seeds = [...(opts.seeds ?? [opts.seed ?? 4242])];
  const applied: unknown[] = [];
  const flow = new GameFlow({
    host, save, analytics, seed: () => seeds.length > 1 ? (seeds.shift() as number) : (seeds[0] as number), dayKey: () => '2026-10-05',
    applySettings: (s) => applied.push(s),
  });
  return { flow, host, save, storage, analytics, applied };
}

export interface BotPolicy {
  /** Outcome of each run duel: default always WIN. */
  duel?: (data: DuelSceneData, index: number) => 'WIN' | 'LOSE';
  /** Index into the map choices. */
  map?: (data: RunMapData) => number;
  /** Retry offers: take the paid retry? */
  retry?: boolean;
  /** Buy the first affordable perk in shops (default true). */
  buy?: boolean;
}

export function duelResult(data: DuelSceneData, outcome: 'WIN' | 'LOSE', over: Partial<DuelResult> = {}): DuelResult {
  const hp = data.heroHp ?? 3;
  return {
    outcome, cause: outcome === 'LOSE' ? 'shot_while_aiming' : null, flinched: false, rawReactionMs: 180, reactionMs: 180,
    tier: 'perfect', enemyShotMs: 600, shotsFired: 1, hits: 1, heroHp: outcome === 'WIN' ? hp : 0, enemyHp: outcome === 'WIN' ? 0 : 1,
    durationMs: 1500, attempt: 1, headshots: 1, hitsIgnored: 0, revivesUsed: 0, staggers: 0, ...over,
  };
}

/** Acts once on whatever the host showed last. Returns false when the flow is waiting for the player (Results/practice). */
export function act(h: FakeHost, policy: BotPolicy = {}, state = { duels: 0 }): boolean {
  const { key, data } = h.last;
  switch (key) {
    case 'MainMenu': {
      const d = data as MainMenuData;
      d.onAction?.(d.hasRun ? 'continue' : 'duel');
      return true;
    }
    case 'RunMap': {
      const d = data as RunMapData;
      const i = Math.max(0, policy.map?.(d) ?? 0);
      d.onChoose?.(d.choices[Math.min(i, d.choices.length - 1)]!.id);
      return true;
    }
    case 'Duel': {
      const d = data as DuelSceneData;
      if (d.mode !== 'run') return false;
      const outcome = policy.duel?.(d, state.duels) ?? 'WIN';
      state.duels++;
      d.onFinish?.(duelResult(d, outcome));
      return true;
    }
    case 'Reward': {
      const d = data as RewardData;
      d.onPick?.(d.cards[0]!.id);
      return true;
    }
    case 'Shop': {
      const d = data as ShopData;
      if (policy.buy !== false) for (const it of d.items) if (!it.sold && it.price <= d.coins && it.kind === 'perk') { d.onBuy?.(it.id); break; }
      d.onLeave?.();
      return true;
    }
    case 'Choice': {
      const d = data as ChoiceData;
      const wantsRetry = policy.retry === true;
      const pick = d.options.find((o) => (wantsRetry ? o.label.startsWith('RETRY') : o.label === 'GIVE UP') && o.enabled !== false)
        ?? d.options.find((o) => o.enabled !== false && o.label !== 'GIVE UP')
        ?? d.options[0]!;
      pick.onTap();
      return true;
    }
    case 'Settings': {
      (data as SettingsData).onClose?.();
      return true;
    }
    case 'Results':
      return false;
    default:
      throw new Error(`unexpected scene ${key}`);
  }
}

/** Plays until Results (or a practice duel) is shown. Returns the number of actions. */
export function playToEnd(h: FakeHost, policy: BotPolicy = {}, maxSteps = 4000): number {
  const state = { duels: 0 };
  for (let i = 0; i < maxSteps; i++) {
    if (!act(h, policy, state)) return i;
  }
  throw new Error(`run did not finish in ${maxSteps} steps; last scene ${h.last.key}`);
}

export const resultsOf = (h: FakeHost): ResultsData => h.last.data as ResultsData;

/** Map policy: take a duel whenever one is on offer (keeps coins for retry tests). */
export const preferDuel = (d: RunMapData): number => d.choices.findIndex((c) => c.type === 'duel');
