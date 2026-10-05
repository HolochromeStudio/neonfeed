import Phaser from 'phaser';
import { playCharacterState } from '../animation';

export type DuelistState = 'idle' | 'draw' | 'aim' | 'shoot' | 'hit' | 'dead';

const FALLBACK_COLOURS: Record<DuelistState, number> = {
  idle: 0x5b86c9,
  draw: 0x7aa5ea,
  aim: 0x7aa5ea,
  shoot: 0xffe08a,
  hit: 0xff6a5a,
  dead: 0x444444,
};

/**
 * A character on the duel stage. Uses atlas 'placeholder' frames/anims
 * `<prefix>_<state>` (A05 contract) and falls back to a coloured rectangle
 * when the texture is missing. Feet are at (x, y), origin bottom-centre.
 */
export class Duelist {
  readonly prefix: string;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private rect: Phaser.GameObjects.Rectangle | null = null;
  private readonly baseColour: number;
  state: DuelistState = 'idle';

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    prefix: string,
    width = 64,
    height = 96,
    baseColour = prefix === 'hero' ? 0x5b86c9 : 0xa0623a,
  ) {
    this.prefix = prefix;
    this.baseColour = baseColour;
    const frame = `${prefix}_idle_0`;
    if (scene.textures.exists('placeholder') && scene.textures.get('placeholder').has(frame)) {
      this.sprite = scene.add.sprite(x, y, 'placeholder', frame).setOrigin(0.5, 1).setScale(width / 32);
    } else {
      this.rect = scene.add.rectangle(x, y, width, height, baseColour).setOrigin(0.5, 1).setStrokeStyle(2, 0x1a0f08);
    }
    this.setState('idle');
  }

  /** The display object (sprite or fallback rectangle), e.g. for the feel layer. */
  get display(): Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle {
    return (this.sprite ?? this.rect) as Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  }

  get usesSprite(): boolean {
    return this.sprite !== null;
  }

  setState(state: DuelistState): void {
    this.state = state;
    if (this.sprite) {
      const key = `${this.prefix}_${state}`;
      if (this.scene.anims.exists(key)) playCharacterState(this.sprite, this.prefix, state);
      else if (this.scene.textures.get('placeholder').has(key)) this.sprite.setFrame(key);
    } else if (this.rect) {
      this.rect.setFillStyle(state === 'idle' ? this.baseColour : FALLBACK_COLOURS[state]);
      if (state === 'dead') this.rect.setAngle(this.prefix === 'hero' ? -90 : 90);
      else this.rect.setAngle(0);
    }
  }

  setVisible(v: boolean): void {
    this.sprite?.setVisible(v);
    this.rect?.setVisible(v);
  }

  destroy(): void {
    this.sprite?.destroy();
    this.rect?.destroy();
  }
}

/** The player's character. */
export class Hero extends Duelist {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero');
  }
}
