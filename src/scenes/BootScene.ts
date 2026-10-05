import Phaser from 'phaser';
import { buildCoreTextures } from '../gfx/textures';
import { registerFont } from '../gfx/font';
import { Audio } from '../audio/audio';
import { G } from '../core/state';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    buildCoreTextures(this);
    registerFont(this);
    Audio.setVolumes(G.s.settings.musicVol, G.s.settings.sfxVol);
    this.scene.start('Title');
  }
}
