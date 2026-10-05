import type Phaser from 'phaser';
import { pairSlots } from './layout';
import { ParchmentPanel } from './ParchmentPanel';
import { PlankButton } from './PlankButton';
import { pixelText } from './PixelText';
import { C } from './UiTheme';

export interface ConfirmConfig {
  title: string;
  body: string;
  yes: string;
  no: string;
  leftHanded?: boolean;
  onYes: () => void;
  onNo?: () => void;
}

export interface ConfirmHandle { close: () => void }

const DEPTH = 100;

/** Modal parchment confirmation with two planks in the thumb zone. A full-screen zone swallows taps. */
export function showConfirm(scene: Phaser.Scene, cfg: ConfirmConfig): ConfirmHandle {
  const shade = scene.add.rectangle(180, 320, 360, 640, C.ink, 0.72).setDepth(DEPTH);
  const block = scene.add.zone(180, 320, 360, 640).setDepth(DEPTH).setInteractive();
  const panel = new ParchmentPanel(scene, { x: 24, y: 300, w: 312, h: 236, title: cfg.title, depth: DEPTH + 1, seed: 11 });
  const body = pixelText(scene, 180, 348, cfg.body, { scale: 2, color: C.ink, shadow: null, align: 'center', originX: 0.5, maxWidth: 270, maxLines: 3 }).setDepth(DEPTH + 2);
  const [a, b] = pairSlots(36, 288, 8, cfg.leftHanded);
  const by = 536 - 12 - 48 - 4;
  let closed = false;
  const items: Array<{ destroy(): void }> = [shade, block, panel, body];
  const close = (): void => {
    if (closed) return;
    closed = true;
    for (const i of items) i.destroy();
  };
  const yes = new PlankButton(scene, { x: a.x, y: by, w: a.w, h: 48, label: cfg.yes, variant: 'danger', sound: 'confirm', name: 'confirm-yes', onTap: () => { close(); cfg.onYes(); } });
  const no = new PlankButton(scene, { x: b.x, y: by, w: b.w, h: 48, label: cfg.no, variant: 'secondary', name: 'confirm-no', onTap: () => { close(); cfg.onNo?.(); } });
  yes.setDepth(DEPTH + 3);
  no.setDepth(DEPTH + 3);
  items.push(yes, no);
  return { close };
}
