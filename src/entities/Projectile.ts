import Phaser from 'phaser';

/**
 * Visual-only tracer. Hit resolution is instant in DuelSystem; this just shows
 * the bullet crossing the arena (A03 may replace or decorate it).
 */
export class Projectile {
  private obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

  constructor(
    scene: Phaser.Scene,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs = 45,
    colour = 0xffe08a,
  ) {
    const useSprite = scene.textures.exists('placeholder') && scene.textures.get('placeholder').has('bullet');
    const o = useSprite
      ? scene.add.sprite(from.x, from.y, 'placeholder', 'bullet')
      : scene.add.rectangle(from.x, from.y, 8, 3, colour);
    this.obj = o;
    o.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    scene.tweens.add({ targets: o, x: to.x, y: to.y, duration: durationMs, onComplete: () => this.destroy() });
  }

  destroy(): void {
    if (this.obj.active) this.obj.destroy();
  }
}
