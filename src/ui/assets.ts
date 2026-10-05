// Atlas loading for UI scenes (same approach as DuelScene: Vite-resolved URLs, loaded only if missing).
import type Phaser from 'phaser';

const glob = (g: Record<string, string>): { png?: string; json?: string } => ({
  png: Object.entries(g).find(([k]) => k.endsWith('.png'))?.[1],
  json: Object.entries(g).find(([k]) => k.endsWith('.json'))?.[1],
});
const TOWN = glob(import.meta.glob('../../assets/generated/town_atlas.*', { query: '?url', import: 'default', eager: true }) as Record<string, string>);
const PLACEHOLDER = glob(import.meta.glob('../../assets/generated/placeholder_atlas.*', { query: '?url', import: 'default', eager: true }) as Record<string, string>);

export const TOWN_KEY = 'town';
export const PLACEHOLDER_KEY = 'placeholder';

export function loadUiAtlases(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TOWN_KEY) && TOWN.png && TOWN.json) scene.load.atlas(TOWN_KEY, TOWN.png, TOWN.json);
  if (!scene.textures.exists(PLACEHOLDER_KEY) && PLACEHOLDER.png && PLACEHOLDER.json) scene.load.atlas(PLACEHOLDER_KEY, PLACEHOLDER.png, PLACEHOLDER.json);
}

export function hasFrame(scene: Phaser.Scene, key: string, frame: string): boolean {
  return scene.textures.exists(key) && scene.textures.get(key).has(frame);
}
