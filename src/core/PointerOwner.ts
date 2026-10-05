/**
 * PointerOwner: single-pointer ownership for the duel gesture (QA-07b; QA_REPORT extraction 3).
 * Pure, no Phaser. `isDown(id)` is a callback so the class never sees a Phaser pointer.
 *
 * Rules (all tested):
 *  - the first finger owns the gesture; a second finger is ignored while the first is still down;
 *  - a lost 'up' cannot wedge it: if the owner is no longer down, a new pointer takes over;
 *  - the finger that pressed Retry never flinches when it lifts (`retryId`);
 *  - `up` of a non-owner is a no-op.
 */
export type PointerUp = 'retry' | 'owner' | 'ignored';

export class PointerOwner {
  private active: number | null = null;
  private retry: number | null = null;

  get activeId(): number | null {
    return this.active;
  }
  get retryId(): number | null {
    return this.retry;
  }

  owns(id: number): boolean {
    return this.active !== null && id === this.active;
  }

  /** Pointer pressed in a gameplay phase. Returns true when it becomes (or already is) the owner. */
  down(id: number, isDown: (id: number) => boolean): boolean {
    if (this.active !== null && id !== this.active && isDown(this.active)) return false;
    this.active = id;
    return true;
  }

  /** Pointer pressed on the Retry/Continue button: it is remembered so its lift is swallowed, and any gesture is dropped. */
  pressRetry(id: number): void {
    this.retry = id;
    this.active = null;
  }

  /** Pointer lifted: says whose lift it was. The owner's lift releases ownership. */
  up(id: number): PointerUp {
    if (id === this.retry) {
      this.retry = null;
      return 'retry';
    }
    if (id !== this.active) return 'ignored';
    this.active = null;
    return 'owner';
  }

  /** Drops the current gesture (tab hidden, retry). The retry id stays so its lift is still swallowed. */
  cancel(): void {
    this.active = null;
  }
}
