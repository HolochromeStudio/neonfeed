/**
 * Persistence guarantees (read before relying on them)
 * - Reads are synchronous from an in-memory cache after `await load()`.
 * - Writes are fire-and-forget: they are queued and applied in order, each as tmp-write -> main-write -> tmp-remove,
 *   so a crash mid-write leaves either the old blob or a complete tmp blob that `load()` rescues.
 * - `flush()` resolves when everything queued so far has hit storage. Queued jobs run as microtasks, i.e. right after
 *   the current task, so with a synchronous adapter (LocalStorageAdapter) they complete before a pagehide /
 *   visibilitychange handler's task is torn down in practice, but that is not formally guaranteed by browsers.
 * - `flushNow()` is the pagehide-safe path: it writes the latest cached meta/run synchronously, in the calling task,
 *   when the adapter is synchronous (localStorage is). With an async adapter (Capacitor Preferences) it can only
 *   START the writes; the OS may still kill the process before they land. The in-order queue replays the same
 *   (latest) blobs afterwards, which is idempotent.
 * - Limits: no cross-tab locking (last writer wins), setItem can throw on quota/private mode (swallowed: the cache
 *   stays correct for the session but the write is lost), and a hard kill between mutation and write loses that mutation.
 */
import type { StorageAdapter } from './storage';

export type Handedness = 'left' | 'right';

export interface Loadout {
  weapon: string;
  charm: string;
  character: string;
  cosmetic: string;
}

export const defaultLoadout = (): Loadout => ({ weapon: 'peacemaker', charm: '', character: 'gunslinger', cosmetic: '' });

export interface MetaSave {
  coins: number;
  unlocks: {
    weapons: string[];
    charms: string[];
    characters: string[];
    regions: string[];
    cosmetics: string[];
  };
  missions: Record<string, { progress: number; claimed: boolean }>;
  settings: {
    musicVol: number;
    sfxVol: number;
    haptics: boolean;
    reducedShake: boolean;
    handedness: Handedness;
    /** v2: tell assist lever. Optional in the type so UI literals still compile; always present after load. */
    tellAssist?: boolean;
    /** v2: caption sound cues. */
    captions?: boolean;
  };
  /** v2: equipped item ids (empty string = nothing equipped). Defaults to starters. */
  loadout: Loadout;
  stats: Record<string, number>;
  /** Best (lowest) reaction time in ms; null if none yet. */
  bestReactionMs: number | null;
}

export interface RunSave {
  seed: number;
  rngState: number;
  nodeIndex: number;
  hp: number;
  perks: string[];
  coins: number;
  /** Opaque map data owned by the map system. */
  map: unknown;
  /** v2: open extension bag for owners outside the save layer (GameFlow stores its run log as `extra.flow`). */
  extra?: Record<string, unknown>;
}

export const defaultMeta = (): MetaSave => ({
  coins: 0,
  unlocks: { weapons: [], charms: [], characters: [], regions: [], cosmetics: [] },
  missions: {},
  settings: { musicVol: 0.7, sfxVol: 0.8, haptics: true, reducedShake: false, handedness: 'right', tellAssist: false, captions: false },
  loadout: defaultLoadout(),
  stats: {},
  bestReactionMs: null,
});

export type Migration = (data: any) => any;

export interface SaveSchema<T> {
  key: string;
  version: number;
  defaults: () => T;
  /** migrations[n] upgrades data from version n to n+1. */
  migrations: Record<number, Migration>;
  /** Return normalized value or null when shape is invalid. */
  validate: (data: unknown) => T | null;
}

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validateMeta(d: unknown): MetaSave | null {
  if (!isObj(d)) return null;
  const def = defaultMeta();
  const u = isObj(d.unlocks) ? d.unlocks : null;
  const s = isObj(d.settings) ? d.settings : null;
  if (!isNum(d.coins) || !u || !s || !isObj(d.missions) || !isObj(d.stats)) return null;
  for (const k of Object.keys(def.unlocks)) if (!isStrArr(u[k])) return null;
  if (!isNum(s.musicVol) || !isNum(s.sfxVol) || typeof s.haptics !== 'boolean' ||
      typeof s.reducedShake !== 'boolean' || (s.handedness !== 'left' && s.handedness !== 'right')) return null;
  if (d.bestReactionMs !== null && !isNum(d.bestReactionMs)) return null;
  // v2 fields: absent -> default; present but wrong type -> invalid
  for (const k of ['tellAssist', 'captions'] as const) {
    if (s[k] !== undefined && typeof s[k] !== 'boolean') return null;
  }
  let loadout = defaultLoadout();
  if (d.loadout !== undefined) {
    const l = d.loadout;
    if (!isObj(l)) return null;
    for (const k of Object.keys(loadout) as (keyof Loadout)[]) {
      if (l[k] === undefined) continue;
      if (typeof l[k] !== 'string') return null;
      loadout[k] = l[k];
    }
    loadout = { ...l, ...loadout } as Loadout;
  }
  return {
    ...(d as object),
    settings: { ...s, tellAssist: s.tellAssist ?? def.settings.tellAssist, captions: s.captions ?? def.settings.captions },
    loadout,
  } as unknown as MetaSave;
}

export function validateRun(d: unknown): RunSave | null {
  if (!isObj(d)) return null;
  if (!isNum(d.seed) || !isNum(d.rngState) || !isNum(d.nodeIndex) || !isNum(d.hp) ||
      !isNum(d.coins) || !isStrArr(d.perks) || !('map' in d)) return null;
  if (d.extra !== undefined && !isObj(d.extra)) return null;
  return d as unknown as RunSave;
}

export const META_SCHEMA: SaveSchema<MetaSave> = {
  key: 'meta', version: 2, defaults: defaultMeta,
  migrations: {
    // v1 -> v2: add settings.tellAssist/captions and the starter loadout; everything else is carried over untouched
    1: (d) => {
      const o = isObj(d) ? d : {};
      const st = isObj(o.settings) ? o.settings : o.settings;
      return {
        ...o,
        settings: isObj(st) ? { ...st, tellAssist: st.tellAssist ?? false, captions: st.captions ?? false } : st,
        loadout: o.loadout ?? defaultLoadout(),
      };
    },
  },
  validate: validateMeta,
};

export const RUN_SCHEMA: SaveSchema<RunSave | null> = {
  key: 'run', version: 2, defaults: () => null,
  migrations: {
    // v1 -> v2: GameFlow used to attach a top-level `flow` log (via a cast); it now lives in `extra.flow`.
    // No `extra` is created when there was no `flow`.
    1: (d) => {
      if (!isObj(d) || !('flow' in d)) return d;
      const { flow, ...rest } = d;
      if (flow === undefined) return rest;
      return { ...rest, extra: { ...(isObj(rest.extra) ? rest.extra : {}), flow } };
    },
  },
  validate: (d) => validateRun(d),
};

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

interface Envelope { v: number; data: unknown }

type Listener = (meta: MetaSave) => void;

export interface SaveManagerOptions {
  metaSchema?: SaveSchema<MetaSave>;
  runSchema?: SaveSchema<RunSave | null>;
}

/**
 * Call `await load()` once at boot; afterwards reads are synchronous from an
 * in-memory cache and writes persist through the adapter (queued, in order).
 */
export class SaveManager {
  private meta: MetaSave;
  private run: RunSave | null = null;
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();
  private dirtyMeta = false;
  private dirtyRun = false;
  private readonly metaSchema: SaveSchema<MetaSave>;
  private readonly runSchema: SaveSchema<RunSave | null>;

  constructor(private readonly storage: StorageAdapter, opts: SaveManagerOptions = {}) {
    this.metaSchema = opts.metaSchema ?? META_SCHEMA;
    this.runSchema = opts.runSchema ?? RUN_SCHEMA;
    this.meta = this.metaSchema.defaults();
  }

  async load(): Promise<void> {
    this.meta = await this.readSchema(this.metaSchema);
    this.run = await this.readSchema(this.runSchema);
    this.emit();
  }

  getMeta(): MetaSave { return clone(this.meta); }
  getRun(): RunSave | null { return clone(this.run); }

  /** Mutate a copy of meta; the result is validated and persisted. */
  updateMeta(fn: (m: MetaSave) => void): MetaSave {
    const draft = clone(this.meta);
    fn(draft);
    const ok = this.metaSchema.validate(draft);
    if (!ok) throw new Error('SaveManager.updateMeta: invalid meta produced');
    this.meta = clone(ok);
    this.dirtyMeta = true;
    this.persist(this.metaSchema, this.meta);
    this.emit();
    return this.getMeta();
  }

  setMeta(meta: MetaSave): void { this.updateMeta((m) => Object.assign(m, clone(meta))); }

  saveRun(run: RunSave): void {
    const ok = this.runSchema.validate(run);
    if (!ok) throw new Error('SaveManager.saveRun: invalid run');
    this.run = clone(ok);
    this.dirtyRun = true;
    this.persist(this.runSchema, this.run);
  }

  clearRun(): void {
    this.run = null;
    this.dirtyRun = true;
    this.enqueue(async () => {
      await this.storage.remove(this.runSchema.key);
      await this.storage.remove(this.runSchema.key + '.tmp');
    });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Resolves when all pending writes have hit storage. */
  flush(): Promise<void> { return this.queue; }

  /**
   * Synchronously write whatever changed since the last flushNow (for pagehide / visibilitychange). Never throws.
   * Sync adapters finish inside this call; async adapters are only started (see header). Safe to call repeatedly.
   */
  flushNow(): void {
    const run = (fn: () => unknown): void => {
      try { const r = fn(); if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(() => undefined); } catch { /* ignore */ }
    };
    const write = <T>(schema: SaveSchema<T>, value: T): void => {
      const blob = JSON.stringify({ v: schema.version, data: value } satisfies Envelope);
      run(() => this.storage.set(schema.key, blob));
    };
    if (this.dirtyMeta) { this.dirtyMeta = false; write(this.metaSchema, this.meta); }
    if (this.dirtyRun) {
      this.dirtyRun = false;
      if (this.run) write(this.runSchema, this.run);
      else {
        run(() => this.storage.remove(this.runSchema.key));
        run(() => this.storage.remove(this.runSchema.key + '.tmp'));
      }
    }
  }

  // --- internals ---

  private emit(): void {
    for (const l of [...this.listeners]) {
      try { l(this.getMeta()); } catch { /* listener errors must not break saves */ }
    }
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue = this.queue.then(job).catch(() => undefined);
  }

  /** Atomic-ish: write temp key, then swap into place, then drop temp. */
  private persist<T>(schema: SaveSchema<T>, value: T): void {
    const blob = JSON.stringify({ v: schema.version, data: value } satisfies Envelope);
    this.enqueue(async () => {
      const tmp = schema.key + '.tmp';
      await this.storage.set(tmp, blob);
      await this.storage.set(schema.key, blob);
      await this.storage.remove(tmp);
    });
  }

  private parse<T>(raw: string | null, schema: SaveSchema<T>): { ok: true; value: T } | { ok: false } {
    if (raw === null) return { ok: false };
    try {
      const env = JSON.parse(raw) as Envelope;
      if (!isObj(env) || !isNum(env.v) || !('data' in env) || env.v < 1 || env.v > schema.version) {
        return { ok: false };
      }
      let data: unknown = env.data;
      for (let v = env.v; v < schema.version; v++) {
        const m = schema.migrations[v];
        if (!m) return { ok: false };
        data = m(clone(data));
      }
      const valid = schema.validate(data);
      return valid === null ? { ok: false } : { ok: true, value: clone(valid) };
    } catch {
      return { ok: false };
    }
  }

  private async readSchema<T>(schema: SaveSchema<T>): Promise<T> {
    try {
      const raw = await this.storage.get(schema.key);
      const tmpRaw = await this.storage.get(schema.key + '.tmp');
      if (raw === null && tmpRaw === null) return schema.defaults();
      if (raw !== null) {
        const r = this.parse(raw, schema);
        if (r.ok) return r.value;
      }
      // main missing or bad: a complete temp write (interrupted swap) may rescue it
      const t = this.parse(tmpRaw, schema);
      if (t.ok) return t.value;
      if (raw !== null) await this.storage.set(schema.key + '.corrupt', raw);
      else if (tmpRaw !== null) await this.storage.set(schema.key + '.corrupt', tmpRaw);
    } catch {
      /* fall through to defaults */
    }
    return schema.defaults();
  }
}
