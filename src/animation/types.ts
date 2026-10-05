/** Pure animation types. No Phaser import: usable in vitest without a DOM. */

export interface AnimationDef {
  /** Global Phaser animation key, e.g. `hero_idle`. */
  key: string;
  /** Texture/atlas key the frames belong to. */
  atlas: string;
  /** Atlas frame names, in play order. */
  frames: readonly string[];
  frameRate: number;
  /** Phaser repeat: -1 loops forever, 0 plays once. */
  repeat: number;
  /** One-shot animations play once and hold their last frame (or chain to `next`). */
  oneShot: boolean;
  /** Animation key to chain after completion. */
  next?: string;
}

export type CharacterState = 'idle' | 'draw' | 'aim' | 'shoot' | 'hit' | 'dead';

export const CHARACTER_STATES: readonly CharacterState[] = ['idle', 'draw', 'aim', 'shoot', 'hit', 'dead'];

export type AnchorKind = 'bottom-centre' | 'top-left' | 'centre' | 'top-centre';

export interface SpriteAnchor {
  /** Phaser origin x (0..1). */
  x: number;
  /** Phaser origin y (0..1). */
  y: number;
  kind: AnchorKind;
}
