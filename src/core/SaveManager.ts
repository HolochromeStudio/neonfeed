import type { StorageAdapter } from './storage';

export type Handedness = 'left' | 'right';

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
  };
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
}

export const defaultMeta = (): MetaSave => ({
  coins: 0,
  unlocks: { weapons: [], charms: [], characters: [], regions: [], cosmetics: [] },
  missions: {},
  settings: { musicVol: 0.7, sfxVol: 0.8, haptics: true, reducedShake: false, handedness: 'right' },
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
  return d as unknown as MetaSave;
}

export function validateRun(d: unknown): RunSave | null {
  if (!isObj(d)) return null;
  if (!isNum(d.seed) || !isNum(d.rngState) || !isNum(d.nodeIndex) || !isNum(d.hp) ||
      !isNum(d.coins) || !isStrArr(d.perks) || !('map' in d)) return null;
  return d as unknown as RunSave;
}

export const META_SCHEMA: SaveSchema<MetaSave> = {
  key: 'meta', version: 1, defaults: defaultMeta, migrations: {}, validate: validateMeta,
};

export const RUN_SCHEMA: SaveSchema<RunSave | null> = {
  key: 'run', version: 1, defaults: () => null, migrations: {},
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
    this.persist(this.metaSchema, this.meta);
    this.emit();
    return this.getMeta();
  }

  setMeta(meta: MetaSave): void { this.updateMeta((m) => Object.assign(m, clone(meta))); }

  saveRun(run: RunSave): void {
    const ok = this.runSchema.validate(run);
    if (!ok) throw new Error('SaveManager.saveRun: invalid run');
    this.run = clone(ok);
    this.persist(this.runSchema, this.run);
  }

  clearRun(): void {
    this.run = null;
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
