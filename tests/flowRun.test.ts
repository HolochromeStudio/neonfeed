import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../src/core/storage';
import { SaveManager } from '../src/core/SaveManager';
import type { DuelSceneData } from '../src/scenes/DuelScene';
import type { ChoiceData } from '../src/scenes/ChoiceScene';
import { GameFlow } from '../src/scenes/GameFlow';
import type { RunMapData } from '../src/scenes/RunMapScene';
import type { MainMenuData, SettingsData } from '../src/ui/types';
import { act, FakeHost, makeFlow, playToEnd, preferDuel, resultsOf } from './flowBot';

describe('GameFlow: menu', () => {
  it('start shows the main menu with the saved coins and applies saved settings', async () => {
    const { flow, host, applied } = await makeFlow();
    flow.start();
    expect(host.last.key).toBe('MainMenu');
    const d = host.last.data as MainMenuData;
    expect(d.coins).toBe(0);
    expect(d.hasRun).toBe(false);
    expect(applied.length).toBe(1);
  });

  it('DUEL starts a new run: map first, run_start tracked, run saved', async () => {
    const { flow, host, save, analytics } = await makeFlow();
    flow.start();
    (host.last.data as MainMenuData).onAction?.('duel');
    expect(host.last.key).toBe('RunMap');
    const map = host.last.data as RunMapData;
    expect(map.choices.length).toBeGreaterThan(0);
    expect(map.choices[0]!.label).toMatch(/^DUEL: /); // the first node is always a duel
    expect(map.progressLabel).toBe('DUST CREEK 1/7');
    expect(map.hp).toBe(map.maxHp);
    expect(save.getRun()).not.toBeNull();
    expect(analytics.names()).toContain('run_start');
  });

  it('practice starts a free-retry duel with an exit and no run', async () => {
    const { flow, host, save } = await makeFlow();
    flow.start();
    (host.last.data as MainMenuData).onAction?.('practice');
    expect(host.last.key).toBe('Duel');
    const d = host.last.data as DuelSceneData;
    expect(d.mode).toBe('practice');
    expect(typeof d.seed).toBe('number');
    expect(save.getRun()).toBeNull();
    d.onExit?.();
    expect(host.last.key).toBe('MainMenu');
  });

  it('settings: open, change (persisted + applied), close back to the menu', async () => {
    const { flow, host, save, applied } = await makeFlow();
    flow.start();
    (host.last.data as MainMenuData).onAction?.('settings');
    expect(host.last.key).toBe('Settings');
    const d = host.last.data as SettingsData;
    d.onChange?.({ ...d.settings, musicVol: 0.2, haptics: false });
    expect(save.getMeta().settings.musicVol).toBe(0.2);
    expect(save.getMeta().settings.haptics).toBe(false);
    expect((applied[applied.length - 1] as { musicVol: number }).musicVol).toBe(0.2);
    d.onClose?.();
    expect(host.last.key).toBe('MainMenu');
  });

  it('saloon and bounties show a notice that goes back', async () => {
    const { flow, host } = await makeFlow();
    flow.start();
    (host.last.data as MainMenuData).onAction?.('saloon');
    expect(host.last.key).toBe('Choice');
    (host.last.data as ChoiceData).options[0]!.onTap();
    expect(host.last.key).toBe('MainMenu');
  });

  it('NEW RUN while a run exists abandons it and starts another', async () => {
    const { flow, host, save } = await makeFlow({ seeds: [11, 12] });
    flow.start();
    (host.last.data as MainMenuData).onAction?.('duel');
    const firstSeed = save.getRun()!.seed;
    flow.menu();
    expect((host.last.data as MainMenuData).hasRun).toBe(true);
    (host.last.data as MainMenuData).onAction?.('new_run');
    expect(host.last.key).toBe('RunMap');
    expect(save.getRun()!.seed).not.toBe(firstSeed);
  });
});

describe('GameFlow: a full run', () => {
  it('always winning reaches VICTORY: boss duels, rewards, shops, settlement, run save cleared', async () => {
    const { flow, host, save, analytics } = await makeFlow({ seed: 777 });
    flow.start();
    const bosses: (string | null | undefined)[] = [];
    const steps = playToEnd(host, {
      duel: (d) => { if (d.bossId) bosses.push(d.bossId); return 'WIN'; },
    });
    expect(steps).toBeGreaterThan(30);
    expect(host.last.key).toBe('Results');
    const r = resultsOf(host);
    expect(r.summary.outcome).toBe('victory');
    expect(r.summary.duelsWon).toBeGreaterThanOrEqual(10);
    expect(r.summary.perks.length).toBeGreaterThan(0);
    expect(bosses[0]).toBe('mad_dog_mcgraw');
    expect(bosses.length).toBe(3); // three regions, three bosses
    expect(save.getRun()).toBeNull();
    expect(save.getMeta().stats.runs).toBe(1);
    expect(save.getMeta().stats.wins).toBe(1);
    expect(save.getMeta().coins).toBeGreaterThan(0);
    expect(analytics.names()).toContain('run_end');
    expect(analytics.names().filter((n) => n === 'duel_end').length).toBe(r.summary.duelsWon);
    // menu afterwards shows the banked coins and no run
    r.onAction?.('menu');
    const m = host.last.data as MainMenuData;
    expect(m.hasRun).toBe(false);
    expect(m.coins).toBe(save.getMeta().coins);
  });

  it('wins across many seeds without a stall or an exception (all node kinds are reachable)', async () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const { flow, host } = await makeFlow({ seed });
      flow.start();
      const policy = { map: (d: RunMapData) => (seed + d.rows.length) % d.choices.length };
      for (let i = 0; i < 4000; i++) {
        kinds.add(host.last.key + (host.last.key === 'Choice' ? `:${(host.last.data as ChoiceData).title}` : ''));
        if (!act(host, policy)) break;
      }
      expect(host.last.key, `seed ${seed}`).toBe('Results');
    }
    for (const k of ['RunMap', 'Duel', 'Reward', 'Shop', 'Choice:CAMPFIRE']) expect(kinds.has(k), k).toBe(true);
    expect([...kinds].some((k) => k.startsWith('Choice:TREASURE') || k.startsWith('Choice:') && !['Choice:CAMPFIRE', 'Choice:SPOILS'].includes(k))).toBe(true);
  });

  it('losing the first duel with no coins ends the run: Results (death) with the killer and cause', async () => {
    const { flow, host, save, analytics } = await makeFlow({ seed: 5 });
    flow.start();
    playToEnd(host, { duel: () => 'LOSE' });
    const r = resultsOf(host);
    expect(r.summary.outcome).toBe('death');
    expect(r.summary.duelsWon).toBe(0);
    expect(r.summary.causeLine).toBeTruthy();
    expect(r.summary.targetId).toBeTruthy();
    expect(save.getRun()).toBeNull();
    expect(save.getMeta().stats.runs).toBe(1);
    expect(analytics.events.find((e) => e.event === 'run_end')!.params!.outcome).toBe('death');
  });

  it('RIDE AGAIN from Results starts a fresh run', async () => {
    const { flow, host } = await makeFlow({ seeds: [5, 6] });
    flow.start();
    playToEnd(host, { duel: () => 'LOSE' });
    resultsOf(host).onAction?.('retry');
    expect(host.last.key).toBe('RunMap');
    expect((host.last.data as RunMapData).progressLabel).toBe('DUST CREEK 1/7');
  });

  it('a lethal loss with coins offers a paid retry of the same duel (same seed), once', async () => {
    const { flow, host, save } = await makeFlow({ seed: 99 });
    flow.start();
    let n = 0;
    let seedBefore = 0;
    const policy = {
      buy: false,
      map: preferDuel,
      duel: (d: DuelSceneData) => {
        n++;
        if (n === 2) seedBefore = d.seed as number;
        return n === 2 ? ('LOSE' as const) : ('WIN' as const);
      },
    };
    // play until the retry offer shows
    for (let i = 0; i < 200 && !(host.last.key === 'Choice' && (host.last.data as ChoiceData).title === 'YOU DIED'); i++) act(host, policy);
    expect(host.last.key).toBe('Choice');
    const offer = host.last.data as ChoiceData;
    expect(offer.title).toBe('YOU DIED');
    expect(offer.options[0]!.label).toMatch(/^RETRY \$\d+/);
    expect(offer.options[0]!.enabled).toBe(true);
    const coins = save.getRun()!.coins;
    offer.options[0]!.onTap();
    expect(host.last.key).toBe('Duel');
    expect((host.last.data as DuelSceneData).seed).toBe(seedBefore); // RULE F5
    expect(save.getRun()!.coins).toBeLessThan(coins);
    // dying again: no second retry on this node
    (host.last.data as DuelSceneData).onFinish?.({ ...(await import('./flowBot')).duelResult(host.last.data as DuelSceneData, 'LOSE') });
    expect(host.last.key).toBe('Results');
  });

  it('GIVE UP on the retry offer ends the run', async () => {
    const { flow, host } = await makeFlow({ seed: 99 });
    flow.start();
    let n = 0;
    for (let i = 0; i < 200 && !(host.last.key === 'Choice' && (host.last.data as ChoiceData).title === 'YOU DIED'); i++) {
      act(host, { buy: false, map: preferDuel, duel: () => (++n === 2 ? 'LOSE' : 'WIN') });
    }
    const offer = host.last.data as ChoiceData;
    offer.options.find((o) => o.label === 'GIVE UP')!.onTap();
    expect(host.last.key).toBe('Results');
    expect(resultsOf(host).summary.outcome).toBe('death');
  });

  it('an invalid choice from a stale screen never throws', async () => {
    const { flow, host } = await makeFlow();
    flow.start();
    (host.last.data as MainMenuData).onAction?.('duel');
    const map = host.last.data as RunMapData;
    expect(() => map.onChoose?.('nope')).not.toThrow();
    expect(host.last.key).toBe('RunMap');
  });
});

describe('GameFlow: reload and resume', () => {
  it('after every step of a run, a freshly booted flow resumes on the same screen', async () => {
    const storage = new MemoryStorageAdapter();
    const { flow, host, save } = await makeFlow({ storage, seed: 31337 });
    flow.start();
    const state = { duels: 0 };
    let resumed = 0;
    for (let i = 0; i < 3000; i++) {
      const key = host.last.key;
      // simulate a reload at this exact moment (only while a run is active)
      if (key !== 'MainMenu' && key !== 'Results' && key !== 'Settings' && save.getRun()) {
        await save.flush();
        const save2 = new SaveManager(storage);
        await save2.load();
        const host2 = new FakeHost();
        const flow2 = new GameFlow({ host: host2, save: save2, dayKey: () => '2026-10-05' });
        flow2.start();
        expect((host2.last.data as MainMenuData).hasRun).toBe(true);
        (host2.last.data as MainMenuData).onAction?.('continue');
        expect(host2.last.key, `step ${i}`).toBe(key);
        const a = host.last.data as Record<string, unknown>;
        const b = host2.last.data as Record<string, unknown>;
        if (key === 'Duel') {
          const da = a as unknown as DuelSceneData, db = b as unknown as DuelSceneData;
          expect([db.seed, db.enemyId, db.arenaId, db.heroHp, db.bossId]).toEqual([da.seed, da.enemyId, da.arenaId, da.heroHp, da.bossId]);
        } else if (key === 'Reward') {
          expect((b.cards as { id: string }[]).map((c) => c.id)).toEqual((a.cards as { id: string }[]).map((c) => c.id));
        } else if (key === 'Shop') {
          expect((b.items as { id: string; price: number }[]).map((c) => [c.id, c.price])).toEqual((a.items as { id: string; price: number }[]).map((c) => [c.id, c.price]));
        } else if (key === 'RunMap') {
          expect((b.choices as { id: string }[]).map((c) => c.id)).toEqual((a.choices as { id: string }[]).map((c) => c.id));
          expect([b.hp, b.coins]).toEqual([a.hp, a.coins]);
        } else if (key === 'Choice') {
          expect((b as unknown as ChoiceData).title).toBe((a as unknown as ChoiceData).title);
        }
        resumed++;
      }
      if (!act(host, {}, state)) break;
    }
    expect(resumed).toBeGreaterThan(40);
    expect(host.last.key).toBe('Results');
  });

  it('a reload while the paid-retry offer is open shows the offer again (and the retry still works)', async () => {
    const storage = new MemoryStorageAdapter();
    const { flow, host, save } = await makeFlow({ storage, seed: 99 });
    flow.start();
    let n = 0;
    for (let i = 0; i < 200 && !(host.last.key === 'Choice' && (host.last.data as ChoiceData).title === 'YOU DIED'); i++) {
      act(host, { buy: false, map: preferDuel, duel: () => (++n === 2 ? 'LOSE' : 'WIN') });
    }
    await save.flush();
    const save2 = new SaveManager(storage);
    await save2.load();
    const host2 = new FakeHost();
    const flow2 = new GameFlow({ host: host2, save: save2, dayKey: () => '2026-10-05' });
    flow2.start();
    (host2.last.data as MainMenuData).onAction?.('continue');
    expect(host2.last.key).toBe('Choice');
    const offer = host2.last.data as ChoiceData;
    expect(offer.title).toBe('YOU DIED');
    offer.options[0]!.onTap();
    expect(host2.last.key).toBe('Duel');
  });

  it('a corrupted run save is dropped instead of looping the menu', async () => {
    const storage = new MemoryStorageAdapter();
    storage.set('run', JSON.stringify({ v: 1, data: { seed: 1, rngState: 1, nodeIndex: 0, hp: 3, perks: [], coins: 0, map: { v: 1 } } }));
    const { flow, host } = await makeFlow({ storage });
    flow.start();
    expect((host.last.data as MainMenuData).hasRun).toBe(false);
  });
});
