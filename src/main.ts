import Phaser from 'phaser';
import { audio } from './core/AudioManager';
import { haptics } from './core/HapticsManager';
import { SaveManager } from './core/SaveManager';
import { LocalStorageAdapter } from './core/storage';
import { fitZoom } from './core/zoom';
import { ChoiceScene } from './scenes/ChoiceScene';
import { DuelScene } from './scenes/DuelScene';
import { GameFlow } from './scenes/GameFlow';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PhaserFlowHost } from './scenes/PhaserFlowHost';
import { ResultsScene } from './scenes/ResultsScene';
import { RewardScene } from './scenes/RewardScene';
import { RunMapScene } from './scenes/RunMapScene';
import { SCENE_KEYS } from './scenes/sceneKeys';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';
import { services } from './services';
import { LETTERBOX_CSS } from './ui/UiTheme';

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

const SCENES: readonly [string, typeof Phaser.Scene][] = [
  [SCENE_KEYS.menu, MainMenuScene], [SCENE_KEYS.map, RunMapScene], [SCENE_KEYS.duel, DuelScene], [SCENE_KEYS.reward, RewardScene],
  [SCENE_KEYS.shop, ShopScene], [SCENE_KEYS.results, ResultsScene], [SCENE_KEYS.choice, ChoiceScene], [SCENE_KEYS.settings, SettingsScene],
];

interface NeonfeedDebug { flow: GameFlow; game: Phaser.Game; save: SaveManager }

async function boot(): Promise<void> {
  // letterbox: plank page behind the canvas, canvas centred at the largest integer zoom that fits (D2)
  document.body.setAttribute('style', `${document.body.getAttribute('style') ?? ''};${LETTERBOX_CSS}`);

  const save = new SaveManager(new LocalStorageAdapter());
  await save.load();
  const settings = save.getMeta().settings;

  // audio: events -> procedural WebAudio after the first gesture; haptics follow the same bus
  audio.setSettings({ musicVol: settings.musicVol, sfxVol: settings.sfxVol });
  haptics.setEnabled(settings.haptics);
  audio.installGestureUnlock();
  audio.connect();
  haptics.connect();

  const zoom = (): number => fitZoom(window.innerWidth, window.innerHeight, GAME_WIDTH, GAME_HEIGHT);
  let flow: GameFlow | null = null;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a0f08',
    pixelArt: true,
    scale: { mode: Phaser.Scale.NONE, zoom: zoom(), autoCenter: Phaser.Scale.NO_CENTER },
    input: { activePointers: 3 },
    scene: [],
    callbacks: {
      postBoot: (g) => {
        for (const [key, cls] of SCENES) g.scene.add(key, cls, false);
        flow = new GameFlow({
          host: new PhaserFlowHost(g, SCENES.map(([key]) => key)),
          save,
          analytics: services.analytics,
          applySettings: (s) => {
            audio.setSettings({ musicVol: s.musicVol, sfxVol: s.sfxVol });
            haptics.setEnabled(s.haptics);
          },
        });
        (window as unknown as { __neonfeed?: NeonfeedDebug }).__neonfeed = { flow, game: g, save };
        flow.start();
      },
    },
  });

  const resize = (): void => { game.scale.setZoom(zoom()); };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // never lose a run: flush when the tab hides or the page goes away
  const flush = (): void => {
    flow?.persist();
    void save.flush();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
}

void boot();
