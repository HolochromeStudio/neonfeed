// Standalone UI scene preview (A10). Not part of the game bundle.
// ?v=<variant>&inset=t,r,b,l&left=1&reduce=1&overlay=1
import Phaser from 'phaser';
import { MainMenuScene } from '../../src/scenes/MainMenuScene';
import { RewardScene } from '../../src/scenes/RewardScene';
import { ResultsScene } from '../../src/scenes/ResultsScene';
import { SettingsScene } from '../../src/scenes/SettingsScene';
import { ShopScene } from '../../src/scenes/ShopScene';
import { parseInsetOverride } from '../../src/ui/safeArea';
import { LETTERBOX_CSS } from '../../src/ui/UiTheme';
import type { UiScene } from '../../src/ui/UiScene';
import { VARIANTS } from './sampleVms';
import type { VariantName } from './sampleVms';

const q = new URLSearchParams(location.search);
const variant = (q.get('v') ?? 'menu') as VariantName;
const overlay = q.get('overlay') === '1';
document.body.style.cssText += LETTERBOX_CSS;

interface Win {
  __uiReady?: boolean;
  __events: Array<{ name: string; payload?: unknown }>;
  __ui?: { game: Phaser.Game; scene: UiScene };
}
const w = window as unknown as Win;
w.__events = [];
const rec = (name: string) => (payload?: unknown) => { w.__events.push({ name, payload }); };

const v = VARIANTS[variant]!;
const data = {
  ...v.data,
  leftHanded: q.get('left') === '1',
  reduceMotion: q.get('reduce') === '1',
  insetOverride: parseInsetOverride(q.get('inset')) ?? undefined,
  onAction: rec('action'), onPick: rec('pick'), onReroll: rec('reroll'), onSkip: rec('skip'),
  onBuy: (id: string) => { rec('buy')(id); return true; }, onLeave: rec('leave'), onChange: rec('change'), onClose: rec('close'),
};

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  create(): void {
    this.scene.start(v.scene, data);
    const s = this.scene.get(v.scene) as UiScene;
    s.events.once('create', () => {
      if (v.open !== undefined) (s as unknown as ShopScene).selectIndex(v.open);
      if (overlay) {
        const g = s.add.graphics().setDepth(1000);
        g.lineStyle(1, 0x00ff00, 1).strokeRect(s.safe.x, s.safe.y, s.safe.w, s.safe.h);
        g.lineStyle(1, 0xff00ff, 1);
        for (const h of s.hits) g.strokeRect(h.rect.x + 0.5, h.rect.y + 0.5, h.rect.w - 1, h.rect.h - 1);
        g.lineStyle(1, 0xffffff, 0.5);
        for (const y of [96, 288, 432, 616]) g.lineBetween(0, y, 360, y);
      }
      w.__ui = { game: this.game, scene: s };
      setTimeout(() => { w.__uiReady = true; }, 450);
    });
  }
}

new Phaser.Game({
  type: q.get('renderer') === 'webgl' ? Phaser.AUTO : Phaser.CANVAS,
  parent: 'game',
  width: 360,
  height: 640,
  backgroundColor: '#1a0f08',
  transparent: false,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, MainMenuScene, RewardScene, ShopScene, ResultsScene, SettingsScene],
  banner: false,
});
