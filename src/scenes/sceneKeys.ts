/** Scene keys the flow shows. Phaser-free so GameFlow can be unit-tested without Phaser. Each scene file exports the same string. */
export const SCENE_KEYS = {
  menu: 'MainMenu',
  map: 'RunMap',
  duel: 'Duel',
  reward: 'Reward',
  shop: 'Shop',
  results: 'Results',
  choice: 'Choice',
  settings: 'Settings',
} as const;
export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
