import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharScene } from './scenes/CharScene';
import { WorldScene } from './scenes/WorldScene';
import { BattleScene } from './scenes/BattleScene';
import { CreditsScene } from './scenes/CreditsScene';
import { Input } from './core/input';
import { Audio } from './audio/audio';
import { G, loadGlobalSettings } from './core/state';

export const W = 240, H = 160;

const params = new URLSearchParams(location.search);
const game = new Phaser.Game({
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game', width: W, height: H, backgroundColor: '#000000',
  pixelArt: true, roundPixels: true, antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  fps: { target: 60, smoothStep: false },
  scene: [BootScene, TitleScene, CharScene, WorldScene, BattleScene, CreditsScene],
  input: { keyboard: false, gamepad: true },
  render: { pixelArt: true, antialias: false, roundPixels: true },
});

// ---- integer-safe nearest-neighbour scaling, gameplay frame stays 3:2 and centred ----
function applyScale() {
  const canvas = game.canvas; if (!canvas) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const landscape = vw > vh;
  const padReserve = landscape ? 0 : 190; // portrait: controls sit below the frame
  const availW = vw, availH = vh - padReserve;
  let scale = Math.min(availW / W, availH / H);
  if (scale >= 2) scale = Math.floor(scale * 2) / 2 >= Math.floor(scale) + 0.5 && scale - Math.floor(scale) > 0.75 ? Math.floor(scale) + 0.5 : Math.floor(scale);
  scale = Math.max(1, scale);
  canvas.style.width = `${Math.floor(W * scale)}px`; canvas.style.height = `${Math.floor(H * scale)}px`;
  const stage = document.getElementById('stage')!; stage.style.marginBottom = landscape ? '0' : `${padReserve}px`;
  const pad = document.getElementById('pad')!; pad.style.setProperty('--op', String(G.s.settings.touchOpacity / 10));
  pad.classList.toggle('swap', G.s.settings.swapPad);
  const crt = document.getElementById('crt')!; crt.style.display = G.s.settings.crt ? 'block' : 'none';
}
window.addEventListener('resize', applyScale);
(window as any).__applyScale = applyScale;
game.events.once('ready', () => { applyScale(); });
setTimeout(applyScale, 50);

Input.init();
Audio.init();
G.s.settings = loadGlobalSettings();
(window as any).__game = game;
(window as any).G = G;
(window as any).__input = Input;

// Prevent browser gestures from hijacking the game on touch devices
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
