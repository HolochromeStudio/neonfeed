import { describe, it, expect } from 'vitest';
import { PointerOwner } from '../src/core/PointerOwner';

const down = (...ids: number[]) => (id: number) => ids.includes(id);

describe('PointerOwner', () => {
  it('the first pointer becomes the owner', () => {
    const o = new PointerOwner();
    expect(o.down(1, down())).toBe(true);
    expect(o.activeId).toBe(1);
    expect(o.owns(1)).toBe(true);
    expect(o.owns(2)).toBe(false);
  });

  it('a second finger is ignored while the first is still down', () => {
    const o = new PointerOwner();
    o.down(1, down());
    expect(o.down(2, down(1))).toBe(false);
    expect(o.activeId).toBe(1);
  });

  it('the same pointer pressing again is accepted', () => {
    const o = new PointerOwner();
    o.down(1, down());
    expect(o.down(1, down(1))).toBe(true);
  });

  it('a lost up cannot wedge it: a new pointer takes over when the owner is no longer down', () => {
    const o = new PointerOwner();
    o.down(1, down());
    expect(o.down(2, down())).toBe(true); // pointer 1 is not down any more
    expect(o.activeId).toBe(2);
    expect(o.owns(1)).toBe(false);
  });

  it('up of the owner releases ownership', () => {
    const o = new PointerOwner();
    o.down(1, down());
    expect(o.up(1)).toBe('owner');
    expect(o.activeId).toBeNull();
    expect(o.down(2, down())).toBe(true);
  });

  it('up of a non-owner is a no-op', () => {
    const o = new PointerOwner();
    o.down(1, down());
    expect(o.up(2)).toBe('ignored');
    expect(o.activeId).toBe(1);
    expect(o.up(9)).toBe('ignored');
  });

  it('up with nobody owning is ignored', () => {
    const o = new PointerOwner();
    expect(o.up(1)).toBe('ignored');
  });

  it('the retry-press finger never flinches on lift', () => {
    const o = new PointerOwner();
    o.down(1, down()); // finger still down from the duel
    o.pressRetry(3);
    expect(o.activeId).toBeNull(); // old gesture is dead
    expect(o.retryId).toBe(3);
    expect(o.up(3)).toBe('retry');
    expect(o.retryId).toBeNull();
    expect(o.up(3)).toBe('ignored'); // only once
  });

  it('the old duel finger lifting after a retry press is ignored', () => {
    const o = new PointerOwner();
    o.down(1, down());
    o.pressRetry(3);
    expect(o.up(1)).toBe('ignored');
  });

  it('cancel drops the gesture but keeps the retry id', () => {
    const o = new PointerOwner();
    o.down(1, down());
    o.pressRetry(2);
    o.down(4, down());
    o.cancel();
    expect(o.activeId).toBeNull();
    expect(o.retryId).toBe(2);
    expect(o.up(4)).toBe('ignored');
    expect(o.up(2)).toBe('retry');
  });
});
