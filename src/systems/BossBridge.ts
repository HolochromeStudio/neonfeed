import type { BossSystem } from './BossSystem';
import type { DuelSystem } from './DuelSystem';

/**
 * Wires a boss encounter into a duel (docs/BOSSES.md "Proposed additions" 2 and 3):
 *  - `boss.attachDuel`: hp -> phases (`opponent.setPhase`), defeat/failure/retry, prop hits;
 *  - environment payoffs (`onEnvironment`, e.g. McGraw's sign and barrel) stagger the pending enemy shot NOW
 *    (`DuelSystem.staggerEnemy`, adds time only); `BossSystem` itself already delays shots planned afterwards;
 *  - the boss opponent's `aimBudgetScale` is read by DuelSystem on every aim start (clamped to [0.7, 1]).
 * Invulnerability windows (proposal 1) stay cosmetic. Returns a disposer. Call `boss.start(t)` after the scene has
 * subscribed to `boss.events` to get the entrance banner.
 */
export function attachBossToDuel(boss: BossSystem, duel: DuelSystem): () => void {
  const offAttach = boss.attachDuel(duel);
  const offEnv = boss.events.on('onEnvironment', (e) => duel.staggerEnemy(e.staggerMs, 'prop'));
  return () => {
    offAttach();
    offEnv();
  };
}
