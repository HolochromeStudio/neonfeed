import type { CharacterState } from './types';

/**
 * Pure, Phaser-free state graph for character animation states.
 * `dead` is terminal. `hit` can interrupt every live state.
 */

const LIVE: readonly CharacterState[] = ['idle', 'draw', 'aim', 'shoot', 'hit'];

export const ALLOWED_TRANSITIONS: Readonly<Record<CharacterState, readonly CharacterState[]>> = {
  idle: ['draw', 'hit', 'dead'],
  draw: ['aim', 'shoot', 'idle', 'hit', 'dead'], // idle = flinch/cancel
  aim: ['shoot', 'idle', 'hit', 'dead'],
  shoot: ['aim', 'idle', 'hit', 'dead'],
  hit: ['idle', 'aim', 'draw', 'shoot', 'dead'], // resume after stagger
  dead: [],
};

/** State entered automatically when a one-shot state's animation completes. */
export const AUTO_NEXT: Readonly<Partial<Record<CharacterState, CharacterState>>> = {
  draw: 'aim',
  shoot: 'aim',
  hit: 'idle',
};

export class AnimationStateGraph {
  private current: CharacterState;

  constructor(initial: CharacterState = 'idle') {
    this.current = initial;
  }

  get state(): CharacterState {
    return this.current;
  }

  get isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.current].length === 0;
  }

  can(to: CharacterState): boolean {
    return ALLOWED_TRANSITIONS[this.current].includes(to);
  }

  /** Moves to `to` if allowed. Returns true when the state changed. */
  transition(to: CharacterState): boolean {
    if (!this.can(to)) return false;
    this.current = to;
    return true;
  }

  /** Call when the current animation finishes; follows AUTO_NEXT. Returns the new state or null. */
  complete(): CharacterState | null {
    const next = AUTO_NEXT[this.current];
    if (next && this.transition(next)) return next;
    return null;
  }

  reset(to: CharacterState = 'idle'): void {
    this.current = to;
  }
}

export function isLiveState(s: CharacterState): boolean {
  return LIVE.includes(s);
}
