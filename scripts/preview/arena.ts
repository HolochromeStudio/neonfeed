// Standalone arena preview (A11). Not part of the game bundle; DuelScene is not needed.
import Phaser from 'phaser';
import townPng from '../../assets/generated/town_atlas.png?url';
import townJson from '../../assets/generated/town_atlas.json?url';
import phPng from '../../assets/generated/placeholder_atlas.png?url';
import phJson from '../../assets/generated/placeholder_atlas.json?url';
import { ARENAS, ZONE_H, ZONE_W } from '../../src/data/arenas';
import { buildArena } from '../../src/scenes/ArenaBuilder';

const params = new URLSearchParams(location.search);
const id = params.get('arena') ?? 'dust_creek';
const overlay = params.get('overlay') === '1';

class Preview extends Phaser.Scene {
  constructor() { super('preview'); }
  preload(): void {
    this.load.atlas('town', townPng, townJson);
    this.load.atlas('placeholder', phPng, phJson);
  }
  create(): void {
    const def = ARENAS[id]!;
    const handle = buildArena(this, def);
    // stand-in duellists at 2x (hero faces right, enemy faces left)
    this.add.sprite(handle.heroPos.x, handle.heroPos.y, 'placeholder', 'hero_idle_0').setOrigin(0.5, 1).setScale(2);
    this.add.sprite(handle.enemyPos.x, handle.enemyPos.y, 'placeholder', 'enemy_idle_0').setOrigin(0.5, 1).setScale(2);
    if (overlay) {
      const g = this.add.graphics().setDepth(50).lineStyle(1, 0x00ff00, 1);
      g.strokeRect(handle.heroPos.x - ZONE_W / 2, handle.heroPos.y - ZONE_H, ZONE_W, ZONE_H);
      g.strokeRect(handle.enemyPos.x - ZONE_W / 2, handle.enemyPos.y - ZONE_H, ZONE_W, ZONE_H);
      g.lineStyle(1, 0xff00ff, 1);
      for (const t of handle.targetZones) g.strokeRect(t.x, t.y, t.w, t.h);
      g.lineStyle(1, 0xffffff, 0.6).strokeRect(40, 520, 280, 96); // holster band
    }
    (window as unknown as { __arenaReady: boolean }).__arenaReady = true;
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: 360,
  height: 640,
  backgroundColor: '#000000',
  pixelArt: true,
  scene: Preview,
  banner: false,
});
