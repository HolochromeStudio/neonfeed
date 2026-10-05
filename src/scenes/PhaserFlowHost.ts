import type Phaser from 'phaser';
import type { FlowHost } from './GameFlow';

/** FlowHost over a Phaser game: one flow scene is running at a time (stop the others, restart the target). */
export class PhaserFlowHost implements FlowHost {
  constructor(private readonly game: Phaser.Game, private readonly keys: readonly string[]) {}

  show(key: string, data?: unknown): void {
    const sm = this.game.scene;
    for (const k of this.keys) {
      if (sm.isActive(k) || sm.isPaused(k) || sm.isSleeping(k)) sm.stop(k);
    }
    sm.start(key, data as object | undefined);
  }

  scene<T = unknown>(key: string): T | undefined {
    return this.game.scene.getScene(key) as unknown as T | undefined;
  }
}
