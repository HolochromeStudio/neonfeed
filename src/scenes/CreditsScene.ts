import Phaser from 'phaser';
import { FONT_KEY } from '../gfx/font';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';

const LINES = [
  '', 'B U G B Y T E', '', 'THE WORLD WAS NEVER SUPPOSED', 'TO NOTICE ITS OWN MISTAKES.', '', '',
  'DESIGN AND BUILD', 'HOLOCHROME STUDIO', '', 'ENGINE', 'PHASER 3 + TYPESCRIPT + VITE', '',
  'ART', 'ALL PIXEL ART IS ORIGINAL AND', 'GENERATED PROCEDURALLY AT BOOT', '', 'MUSIC AND SOUND', 'ORIGINAL CHIPTUNE,', 'SYNTHESISED WITH WEB AUDIO', '',
  'THE SIGNAL', 'CONNECTS WHAT REMAINS.', '', '', 'THANK YOU FOR PLAYING.', '', '', '',
];

export class CreditsScene extends Phaser.Scene {
  from = 'Title';
  constructor() { super('Credits'); }
  init(d: { from?: string }) { this.from = d?.from ?? 'Title'; }
  create() {
    this.cameras.main.setBackgroundColor('#05030c');
    Audio.play('title');
    const texts = LINES.map((l, i) => this.add.bitmapText(120, 160 + i * 14, FONT_KEY, l).setOrigin(0.5, 0).setTint(i === 1 ? 0x38e0e8 : 0xe8f0ff));
    const total = LINES.length * 14 + 170;
    this.tweens.add({ targets: texts, y: `-=${total}`, duration: total * 55, onComplete: () => this.exit() });
    Input.wait(['a', 'b', 'start']).then(() => this.exit());
  }
  done = false;
  exit() { if (this.done) return; this.done = true; Audio.stop(); this.scene.start(this.from === 'Title' ? 'Title' : 'Title'); }
}
