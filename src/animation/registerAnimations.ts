import { ALL_ANIMATION_DEFS } from '../data/animations';
import type { AnimationDef } from './types';

interface AnimCreateConfig {
  key: string;
  frames: { key: string; frame: string }[];
  frameRate: number;
  repeat: number;
}

/** Structural subset of Phaser.Scene so this can be stubbed in tests. */
export interface AnimsHost {
  anims: {
    exists(key: string): boolean;
    create(config: AnimCreateConfig): unknown;
  };
}

/**
 * Registers every def with the (global) animation manager. Safe to call from
 * every scene: keys that already exist are skipped. Returns the keys created.
 */
export function registerAnimations(scene: AnimsHost, defs: readonly AnimationDef[] = ALL_ANIMATION_DEFS): string[] {
  const created: string[] = [];
  for (const def of defs) {
    if (scene.anims.exists(def.key)) continue;
    scene.anims.create({
      key: def.key,
      frames: def.frames.map((frame) => ({ key: def.atlas, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
    created.push(def.key);
  }
  return created;
}

/** Minimal sprite surface needed to play a def (Phaser.GameObjects.Sprite satisfies it). */
export interface PlayableSprite {
  play(key: string, ignoreIfPlaying?: boolean): unknown;
}

/**
 * Plays `<prefix>_<state>`. Chaining of `next` is done here via the def table
 * so callers never hard-code it; the sprite is expected to expose Phaser's `chain`.
 */
export function playCharacterState(
  sprite: PlayableSprite & { chain?: (key: string) => unknown },
  prefix: string,
  state: string,
  defs: readonly AnimationDef[] = ALL_ANIMATION_DEFS,
): void {
  const key = `${prefix}_${state}`;
  sprite.play(key);
  const def = defs.find((d) => d.key === key);
  if (def?.next && sprite.chain) sprite.chain(def.next);
}
