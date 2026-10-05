export type MaybePromise<T> = T | Promise<T>;

/** Key/value storage. Sync or async so Capacitor Preferences can be swapped in. */
export interface StorageAdapter {
  get(key: string): MaybePromise<string | null>;
  set(key: string, value: string): MaybePromise<void>;
  remove(key: string): MaybePromise<void>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly prefix = 'neonfeed:') {}
  private store(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }
  get(key: string): string | null {
    try {
      return this.store()?.getItem(this.prefix + key) ?? null;
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    this.store()?.setItem(this.prefix + key, value);
  }
  remove(key: string): void {
    try {
      this.store()?.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }
}
