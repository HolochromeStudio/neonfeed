import { describe, it, expect, vi } from 'vitest';
import { SaveManager, META_SCHEMA, defaultMeta, type MetaSave, type SaveSchema } from '../src/core/SaveManager';
import { MemoryStorageAdapter } from '../src/core/storage';
import { services, NoOpAdService } from '../src/services';

const mk = (s = new MemoryStorageAdapter(), opts = {}) => ({ s, sm: new SaveManager(s, opts) });

describe('SaveManager', () => {
  it('returns defaults on empty storage and round-trips', async () => {
    const { s, sm } = mk();
    await sm.load();
    expect(sm.getMeta()).toEqual(defaultMeta());
    sm.updateMeta((m) => { m.coins = 50; m.unlocks.weapons.push('pistol'); });
    await sm.flush();
    expect(s.get('meta.tmp')).toBeNull();
    const sm2 = new SaveManager(s); await sm2.load();
    expect(sm2.getMeta().coins).toBe(50);
    expect(sm2.getMeta().unlocks.weapons).toEqual(['pistol']);
  });

  it('deep-clones on read', async () => {
    const { sm } = mk(); await sm.load();
    const m = sm.getMeta(); m.unlocks.charms.push('x'); m.coins = 999;
    expect(sm.getMeta().coins).toBe(0);
    expect(sm.getMeta().unlocks.charms).toEqual([]);
  });

  it('notifies onChange and unsubscribes', async () => {
    const { sm } = mk(); await sm.load();
    const fn = vi.fn(); const off = sm.onChange(fn);
    sm.updateMeta((m) => { m.coins = 1; });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].coins).toBe(1);
    off(); sm.updateMeta((m) => { m.coins = 2; });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('saves and clears a run', async () => {
    const { s, sm } = mk(); await sm.load();
    sm.saveRun({ seed: 1, rngState: 2, nodeIndex: 3, hp: 4, perks: ['a'], coins: 5, map: { n: [1] } });
    await sm.flush();
    const sm2 = new SaveManager(s); await sm2.load();
    expect(sm2.getRun()?.nodeIndex).toBe(3);
    sm2.clearRun(); await sm2.flush();
    const sm3 = new SaveManager(s); await sm3.load();
    expect(sm3.getRun()).toBeNull();
  });

  describe('migration', () => {
    const v2: SaveSchema<MetaSave & { gems?: number }> = {
      ...META_SCHEMA, version: 2,
      migrations: { 1: (d) => ({ ...d, gems: d.coins * 2 }) },
      validate: (d) => (META_SCHEMA.validate(d) ? (d as any) : null),
    };
    it('upgrades v1 data to v2', async () => {
      const s = new MemoryStorageAdapter();
      const old = { ...defaultMeta(), coins: 7 };
      s.set('meta', JSON.stringify({ v: 1, data: old }));
      const sm = new SaveManager(s, { metaSchema: v2 }); await sm.load();
      expect((sm.getMeta() as any).gems).toBe(14);
      expect(sm.getMeta().coins).toBe(7);
      expect(s.get('meta.corrupt')).toBeNull();
    });
    it('treats a missing migration step as corruption', async () => {
      const s = new MemoryStorageAdapter();
      s.set('meta', JSON.stringify({ v: 1, data: defaultMeta() }));
      const sm = new SaveManager(s, { metaSchema: { ...v2, migrations: {} } }); await sm.load();
      expect(sm.getMeta().coins).toBe(0);
      expect(s.get('meta.corrupt')).not.toBeNull();
    });
    it('rejects data from a newer version', async () => {
      const s = new MemoryStorageAdapter();
      s.set('meta', JSON.stringify({ v: 5, data: defaultMeta() }));
      const sm = new SaveManager(s); await sm.load();
      expect(s.get('meta.corrupt')).not.toBeNull();
    });
  });

  describe('corruption', () => {
    it('invalid JSON -> defaults + backup, no throw', async () => {
      const s = new MemoryStorageAdapter(); s.set('meta', '{not json');
      const sm = new SaveManager(s);
      await expect(sm.load()).resolves.toBeUndefined();
      expect(sm.getMeta()).toEqual(defaultMeta());
      expect(s.get('meta.corrupt')).toBe('{not json');
    });
    it('wrong shape -> defaults + backup', async () => {
      const s = new MemoryStorageAdapter();
      const bad = JSON.stringify({ v: 1, data: { coins: 'lots' } });
      s.set('meta', bad);
      const sm = new SaveManager(s); await sm.load();
      expect(sm.getMeta()).toEqual(defaultMeta());
      expect(s.get('meta.corrupt')).toBe(bad);
    });
    it('corrupt run is dropped, meta unaffected', async () => {
      const s = new MemoryStorageAdapter();
      s.set('run', JSON.stringify({ v: 1, data: { seed: 'x' } }));
      const sm = new SaveManager(s); await sm.load();
      expect(sm.getRun()).toBeNull();
      expect(s.get('run.corrupt')).not.toBeNull();
    });
    it('recovers from an interrupted swap via temp key', async () => {
      const s = new MemoryStorageAdapter();
      s.set('meta.tmp', JSON.stringify({ v: 1, data: { ...defaultMeta(), coins: 9 } }));
      const sm = new SaveManager(s); await sm.load();
      expect(sm.getMeta().coins).toBe(9);
    });
    it('storage that throws never throws out of load', async () => {
      const bad = { get: () => { throw new Error('x'); }, set: () => {}, remove: () => {} };
      const sm = new SaveManager(bad); await expect(sm.load()).resolves.toBeUndefined();
      expect(sm.getMeta()).toEqual(defaultMeta());
    });
  });

  it('works with an async adapter', async () => {
    const m = new Map<string, string>();
    const a = { get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => { m.set(k, v); }, remove: async (k: string) => { m.delete(k); } };
    const sm = new SaveManager(a); await sm.load();
    sm.updateMeta((x) => { x.coins = 3; }); await sm.flush();
    expect(JSON.parse(m.get('meta')!).data.coins).toBe(3);
  });
});

describe('services', () => {
  it('defaults are no-ops and can be overridden', async () => {
    expect(services.ads.isRewardedReady()).toBe(false);
    expect(await services.ads.showRewarded('x')).toBe(false);
    services.register({ ads: { isRewardedReady: () => true, showRewarded: async () => true } });
    expect(services.ads.isRewardedReady()).toBe(true);
    services.reset();
    expect(services.ads).toBeInstanceOf(NoOpAdService);
  });
});
