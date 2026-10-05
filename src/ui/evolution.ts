import Phaser from 'phaser';
import { Ui, wait } from './ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { SPECIES } from '../data';
import { creatureTex } from '../gfx/textures';
import { silhouette } from '../gfx/creatures';
import { evolveMon, displayName } from '../core/mon';
import { markDex } from '../core/state';
import type { Bytekin } from '../types';

export async function playEvolution(scene: Phaser.Scene, ui: Ui, mon: Bytekin, to: string): Promise<boolean> {
  const from = mon.species;
  const L = ui.layer();
  ui.rect(L, 0, 0, 240, 160, '#000000');
  const fk = creatureTex(scene, from, 'front', mon.anomalous), tk = creatureTex(scene, to, 'front', mon.anomalous);
  const wk = `evo_w_${from}`, wk2 = `evo_w_${to}`;
  for (const [k, src] of [[wk, fk], [wk2, tk]] as const) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, silhouette(scene.textures.get(src).getSourceImage() as HTMLCanvasElement, '#ffffff'));
  const img = L.add(scene.add.image(120, 52, fk).setOrigin(0.5, 0.5).setScale(1.5));
  const name = displayName(mon);
  const prevBgm = Audio.current;
  Audio.play('relay'); // eerie shimmer while it changes
  await ui.say(`What? ${name} is changing!`, { noWait: true }).then((l) => l && l.destroy());
  let cancelled = false;
  const cancelWatch = Input.wait(['b']).then(() => { cancelled = true; });
  Audio.cry(from);
  for (let i = 0; i < 22 && !cancelled; i++) {
    const t = i / 22;
    const useNew = i % 2 === 1 && t > 0.2;
    img.setTexture(i % 2 === 0 ? wk : (useNew ? wk2 : fk));
    img.setScale(1.5 + Math.sin(i) * 0.08);
    if (i % 4 === 0) Audio.sfx('glitch');
    await wait(scene, Math.max(60, 260 - i * 10));
  }
  Input.cancelWaiters(); void cancelWatch;
  if (cancelled) { img.setTexture(fk); await ui.say(`${name} stopped evolving.`); L.destroy(); if (prevBgm) Audio.play(prevBgm); return false; }
  img.setTexture(wk2); await wait(scene, 250); img.setTexture(tk); scene.cameras.main.flash(300, 255, 255, 255);
  Audio.cry(to); Audio.jingle('jingle_levelup', prevBgm ?? undefined);
  evolveMon(mon, to); markDex(to, 2);
  await wait(scene, 500);
  await ui.say(`Congratulations! ${name} evolved into ${SPECIES[to].name}!`);
  L.destroy();
  return true;
}
