import { describe, it, expect } from 'vitest';
import { SaveManager, META_SCHEMA, RUN_SCHEMA, defaultMeta, validateMeta, validateRun } from '../src/core/SaveManager';
import { MemoryStorageAdapter } from '../src/core/storage';

/** Exact v1 meta shape as shipped before schema v2 (no tellAssist/captions/loadout). */
const v1Meta = () => ({
  coins: 321,
  unlocks: { weapons: ['peacemaker', 'rifle'], charms: ['luck'], characters: ['gunslinger'], regions: ['dust_creek'], cosmetics: ['hat'] },
  missions: { m1: { progress: 2, claimed: false } },
  settings: { musicVol: 0.4, sfxVol: 0.5, haptics: false, reducedShake: true, handedness: 'left' },
  stats: { saloon_level: 3, wins: 9 },
  bestReactionMs: 187,
});
const v1Run = () => ({ seed: 11, rngState: 22, nodeIndex: 4, hp: 3, perks: ['a', 'b'], coins: 40, map: { layers: [[1], [2, 3]] } });
const put = (s: MemoryStorageAdapter, key: string, v: number, data: unknown) => s.set(key, JSON.stringify({ v, data }));

describe('save schema v2 migration', () => {
  it('schemas are v2', () => {
    expect(META_SCHEMA.version).toBe(2);
    expect(RUN_SCHEMA.version).toBe(2);
  });

  it('v1 meta loads with new fields defaulted and nothing lost', async () => {
    const s = new MemoryStorageAdapter(); put(s, 'meta', 1, v1Meta());
    const sm = new SaveManager(s); await sm.load();
    const m = sm.getMeta();
    const { settings, ...rest } = v1Meta();
    expect(m).toMatchObject(rest);
    expect(m.settings).toEqual({ ...settings, tellAssist: false, captions: false });
    expect(m.loadout).toEqual({ weapon: 'peacemaker', charm: '', character: 'gunslinger', cosmetic: '' });
    expect(s.get('meta.corrupt')).toBeNull();
    // rewritten at v2 on next save
    sm.updateMeta((x) => { x.coins += 1; }); await sm.flush();
    expect(JSON.parse(s.get('meta')!).v).toBe(2);
  });

  it('v1 run keeps map/perks/coins and gains no bogus fields', async () => {
    const s = new MemoryStorageAdapter(); put(s, 'run', 1, v1Run());
    const sm = new SaveManager(s); await sm.load();
    expect(sm.getRun()).toEqual(v1Run());
    expect('extra' in sm.getRun()!).toBe(false);
  });

  it('v1 run with GameFlow top-level `flow` moves it into extra.flow', async () => {
    const s = new MemoryStorageAdapter();
    const flow = { v: 1, visited: ['n0'], defeated: ['rookie'] };
    put(s, 'run', 1, { ...v1Run(), flow });
    const sm = new SaveManager(s); await sm.load();
    const r = sm.getRun()!;
    expect(r.extra).toEqual({ flow });
    expect('flow' in r).toBe(false);
    expect(r.map).toEqual(v1Run().map);
    expect(r.perks).toEqual(['a', 'b']);
  });

  it('tolerant: v2 meta missing new fields is filled, not corrupt', async () => {
    const s = new MemoryStorageAdapter(); put(s, 'meta', 2, v1Meta());
    const sm = new SaveManager(s); await sm.load();
    expect(sm.getMeta().coins).toBe(321);
    expect(sm.getMeta().settings.captions).toBe(false);
    expect(sm.getMeta().loadout.weapon).toBe('peacemaker');
    expect(s.get('meta.corrupt')).toBeNull();
  });

  it('partial loadout is completed; wrong shapes are rejected', () => {
    const m = validateMeta({ ...defaultMeta(), loadout: { weapon: 'rifle' } })!;
    expect(m.loadout).toEqual({ weapon: 'rifle', charm: '', character: 'gunslinger', cosmetic: '' });
    expect(validateMeta({ ...defaultMeta(), loadout: 'x' })).toBeNull();
    expect(validateMeta({ ...defaultMeta(), loadout: { weapon: 5 } })).toBeNull();
    const d = defaultMeta();
    expect(validateMeta({ ...d, settings: { ...d.settings, tellAssist: 'yes' } })).toBeNull();
    expect(validateMeta({ ...d, coins: 'x' })).toBeNull();
    expect(validateRun({ ...v1Run(), extra: 5 })).toBeNull();
    expect(validateRun({ ...v1Run(), extra: { a: 1 } })?.extra).toEqual({ a: 1 });
  });

  it('settings and loadout round-trip at v2', async () => {
    const s = new MemoryStorageAdapter(); const sm = new SaveManager(s); await sm.load();
    sm.updateMeta((m) => { m.settings.tellAssist = true; m.settings.captions = true; m.loadout.charm = 'luck'; });
    sm.saveRun({ ...v1Run(), extra: { flow: { v: 1 } } }); await sm.flush();
    const sm2 = new SaveManager(s); await sm2.load();
    expect(sm2.getMeta().settings).toMatchObject({ tellAssist: true, captions: true });
    expect(sm2.getMeta().loadout.charm).toBe('luck');
    expect(sm2.getRun()?.extra).toEqual({ flow: { v: 1 } });
  });

  it('newer-than-code versions go to .corrupt and defaults', async () => {
    const s = new MemoryStorageAdapter();
    put(s, 'meta', 3, v1Meta()); put(s, 'run', 3, v1Run());
    const sm = new SaveManager(s); await sm.load();
    expect(sm.getMeta()).toEqual(defaultMeta());
    expect(sm.getRun()).toBeNull();
    expect(s.get('meta.corrupt')).not.toBeNull();
    expect(s.get('run.corrupt')).not.toBeNull();
  });

  it('async adapter loads and migrates v1', async () => {
    const m = new Map<string, string>([['meta', JSON.stringify({ v: 1, data: v1Meta() })], ['run', JSON.stringify({ v: 1, data: v1Run() })]]);
    const a = { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => { m.set(k, v); }, remove: async (k: string) => { m.delete(k); } };
    const sm = new SaveManager(a); await sm.load();
    expect(sm.getMeta().loadout.character).toBe('gunslinger');
    expect(sm.getRun()?.coins).toBe(40);
  });

  it('throwing storage never throws and flushNow never throws', async () => {
    const bad = { get: () => { throw new Error('x'); }, set: () => { throw new Error('y'); }, remove: () => { throw new Error('z'); } };
    const sm = new SaveManager(bad); await expect(sm.load()).resolves.toBeUndefined();
    sm.updateMeta((x) => { x.coins = 2; }); sm.saveRun(v1Run()); sm.clearRun();
    expect(() => sm.flushNow()).not.toThrow();
    await expect(sm.flush()).resolves.toBeUndefined();
    expect(sm.getMeta().coins).toBe(2);
  });

  it('async adapter rejecting in flushNow is swallowed', async () => {
    const bad = { get: async () => null, set: async () => { throw new Error('q'); }, remove: async () => { throw new Error('q'); } };
    const sm = new SaveManager(bad); await sm.load();
    sm.updateMeta((x) => { x.coins = 1; });
    expect(() => sm.flushNow()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('flushNow', () => {
  it('writes synchronously on a sync adapter, before any microtask runs', async () => {
    const s = new MemoryStorageAdapter(); const sm = new SaveManager(s); await sm.load();
    sm.updateMeta((m) => { m.coins = 77; });
    sm.saveRun(v1Run());
    expect(s.get('meta')).toBeNull(); // queued writes have not run yet
    sm.flushNow();
    expect(JSON.parse(s.get('meta')!).data.coins).toBe(77);
    expect(JSON.parse(s.get('run')!).data.seed).toBe(11);
    await sm.flush();
    expect(JSON.parse(s.get('meta')!).data.coins).toBe(77);
    expect(s.get('meta.tmp')).toBeNull();
  });

  it('reflects clearRun', async () => {
    const s = new MemoryStorageAdapter(); const sm = new SaveManager(s); await sm.load();
    sm.saveRun(v1Run()); await sm.flush();
    sm.clearRun(); sm.flushNow();
    expect(s.get('run')).toBeNull();
  });
});
