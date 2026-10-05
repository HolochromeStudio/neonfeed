import Phaser from 'phaser';
import { loadUiAtlases } from './assets';
import { auditHits, LOGICAL_H, LOGICAL_W, MIN_INSETS, safeRect } from './layout';
import type { HitInfo, Insets, Rect } from './layout';
import { logicalInsets, readCssInsets } from './safeArea';
import type { UiSceneOptions } from './types';

/** Base class for UI scenes: safe insets, atlas loading and an interactive-rect registry for audits. */
export abstract class UiScene extends Phaser.Scene {
  protected opts: UiSceneOptions = {};
  insets: Insets = { ...MIN_INSETS };
  safe: Rect = safeRect();
  readonly hits: HitInfo[] = [];

  preload(): void {
    loadUiAtlases(this);
  }

  protected setupUi(opts: UiSceneOptions | undefined): void {
    this.opts = opts ?? {};
    this.hits.length = 0;
    this.insets = this.computeInsets();
    this.safe = safeRect(this.insets);
  }

  get leftHanded(): boolean { return this.opts.leftHanded === true; }
  get reduceMotion(): boolean { return this.opts.reduceMotion === true; }

  private computeInsets(): Insets {
    try {
      const canvas = this.scale.canvas;
      const box = canvas.getBoundingClientRect();
      const css = this.opts.insetOverride ?? readCssInsets();
      return logicalInsets({
        css,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        canvas: { left: box.left, top: box.top, width: box.width, height: box.height },
        logical: { w: LOGICAL_W, h: LOGICAL_H },
      });
    } catch {
      return { ...MIN_INSETS };
    }
  }

  registerHit(label: string, rect: Rect, group?: string): void {
    this.hits.push({ label, rect, group });
  }

  unregisterHit(label: string): void {
    for (let i = this.hits.length - 1; i >= 0; i--) if (this.hits[i]!.label === label) this.hits.splice(i, 1);
  }

  /** UX_FLOW 5 test checklist: every target >=44, inside safe insets, >=8px apart. */
  auditUi(): string[] {
    return auditHits(this.hits, this.safe);
  }
}
