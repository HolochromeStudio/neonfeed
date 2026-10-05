import type { Rng } from '../core/rng';
import { enemyHpFor, getEnemyDef, resolveSpritePrefix, type EnemyDef } from '../data/enemies';
import { createOpponent, type EnemyOpponent, type OpponentOptions } from '../systems/EnemyAISystem';

/** Phaser-free enemy bundle: definition, resolved hp, sprite prefix and controller. */
export class Enemy {
  readonly def: EnemyDef;
  readonly hp: number;
  readonly spritePrefix: string;
  readonly opponent: EnemyOpponent;

  constructor(enemyId: string, rng: Rng, difficulty = 0, atlasHas: (prefix: string) => boolean = () => false, options: OpponentOptions = {}) {
    this.def = getEnemyDef(enemyId);
    this.hp = enemyHpFor(this.def, difficulty);
    this.spritePrefix = resolveSpritePrefix(this.def, atlasHas);
    this.opponent = createOpponent(enemyId, rng, difficulty, options);
  }
}
