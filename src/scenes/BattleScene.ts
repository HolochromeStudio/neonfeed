import Phaser from 'phaser';
import { Ui, Layer, wait, INK, DIM, BLUE, WHITE, RED, GREEN, MAG } from '../ui/ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, itemCount, takeItem, flag } from '../core/state';
import { Battle, BEvent, Side, Action } from '../battle/engine';
import { SPECIES, MOVES, TYPE_COLORS, STATUS, ITEMS } from '../data';
import { creatureTex, bgTex, ensureCharSheet } from '../gfx/textures';
import { maxHp, displayName, expBar, learnMove } from '../core/mon';
import { bagMenu } from '../ui/bag';
import { partyMenu } from '../ui/party';
import { hpColor } from '../ui/party';
import type { Bytekin } from '../types';

interface Data { cfg: any; bg: string; bgm: string; trainer?: { name: string; look: string; cls: string }; boss?: { intro: string; title: string } | null; tutorial?: boolean; resolve: (r: any) => void }
const num = (c: string) => parseInt(c.slice(1), 16);

export class BattleScene extends Phaser.Scene {
  ui!: Ui; b!: Battle; bd!: Data;
  eSpr!: Phaser.GameObjects.Image; pSpr!: Phaser.GameObjects.Image;
  eHud!: Layer; pHud!: Layer; base!: Layer;
  hpE!: Phaser.GameObjects.Rectangle; hpP!: Phaser.GameObjects.Rectangle; stabE?: Phaser.GameObjects.Rectangle; expP?: Phaser.GameObjects.Rectangle;
  txtE!: Phaser.GameObjects.BitmapText; txtP!: Phaser.GameObjects.BitmapText; hpTxt!: Phaser.GameObjects.BitmapText; stP?: Phaser.GameObjects.BitmapText; stE?: Phaser.GameObjects.BitmapText;
  boxLayer?: Layer; msgText?: Phaser.GameObjects.BitmapText[]; msgLayer?: Layer;
  shown: { p: { hp: number; max: number }; e: { hp: number; max: number } } = { p: { hp: 0, max: 1 }, e: { hp: 0, max: 1 } };
  eSpecies = ''; pSpecies = ''; leveled = false; fieldTxt?: Phaser.GameObjects.BitmapText; ruleTxt?: Phaser.GameObjects.BitmapText;
  tutorialStep = 0; dbg?: Phaser.GameObjects.Image;

  constructor() { super('Battle'); }

  async create(data: Data) {
    this.bd = data; this.ui = new Ui(this); (window as any).__battle = this;
    this.cameras.main.setBackgroundColor('#000000'); this.cameras.main.roundPixels = true;
    Audio.glitch = false; Audio.play(data.bgm);
    this.b = new Battle(data.cfg);
    if (data.tutorial) { (this.b as any).tutorial = true; this.b.e.mon.moves = [{ id: 'tackle_sync', pp: 30, maxPp: 30 }]; this.b.e.stab = 45; this.b.e.mon.hp = Math.max(1, Math.floor(maxHp(this.b.e.mon) * 0.6)); }
    const wildStab = (this.b.e.mon as any)._stab; if (wildStab) this.b.e.stab = wildStab;
    if (data.cfg.kind === 'wild') this.b.e.stab = Math.max(70, this.b.e.stab === 100 ? 85 + Math.floor(Math.random() * 16) : this.b.e.stab);
    if (data.tutorial) this.b.e.stab = 45;
    this.buildStage();
    this.cameras.main.fadeIn(250, 0, 0, 0);
    await this.intro();
    await this.loop();
  }

  // ---------------- stage ----------------
  buildStage() {
    this.base = this.ui.layer();
    this.add.image(0, 0, bgTex(this, this.bd.bg === 'relay' ? 'relay' : this.bd.bg)).setOrigin(0, 0).setDepth(0);
    this.add.image(172, 66, this.bd.bg === 'relay' || this.bd.bg === 'cave' || this.bd.bg === 'glitch' ? 'platform2' : 'platform').setDepth(1);
    this.add.image(66, 106, this.bd.bg === 'relay' || this.bd.bg === 'cave' || this.bd.bg === 'glitch' ? 'platform2' : 'platform').setDepth(1).setScale(1.2);
    const e = this.b.e.mon, p = this.b.p.mon;
    this.eSpecies = e.species; this.pSpecies = p.species;
    this.eSpr = this.add.image(172, 62, creatureTex(this, e.species, 'front', e.anomalous)).setOrigin(0.5, 1).setDepth(5);
    this.pSpr = this.add.image(64, 112, creatureTex(this, p.species, 'back', p.anomalous)).setOrigin(0.5, 1).setDepth(5);
    if (this.bd.trainer) { this.eSpr.setVisible(false); }
    this.buildHuds();
    this.setMsgBox();
    if (e.anomalous) this.sparkleAnomalous();
  }
  sparkleAnomalous() { this.time.addEvent({ delay: 250, loop: true, callback: () => { const s = this.add.image(140 + Math.random() * 64, 20 + Math.random() * 44, 'star').setDepth(8).setScale(0.6); this.tweens.add({ targets: s, alpha: 0, scale: 1.2, duration: 500, onComplete: () => s.destroy() }); } }); }
  buildHuds() {
    this.eHud?.destroy(); this.pHud?.destroy();
    const ui = this.ui; const e = this.b.e.mon, p = this.b.p.mon;
    const wildOrBoss = this.bd.cfg.kind !== 'trainer';
    // enemy HUD (top-left)
    const E = this.eHud = ui.layer();
    ui.win(E, 6, 6, 112, wildOrBoss ? 34 : 26);
    this.txtE = ui.text(E, 14, 11, displayName(e), INK); ui.text(E, 94, 11, `Lv${e.level}`, INK);
    this.ensureMiniLabels(E, 14, 21, 'HP');
    ui.rect(E, 33, 21, 80, 5, '#1a1830');
    this.hpE = ui.rect(E, 34, 22, 78, 3, '#30c868'); this.hpE.setOrigin(0, 0);
    this.stE = ui.text(E, 14, 30, '', MAG);
    if (wildOrBoss) { ui.text(E, 14, 30, this.bd.cfg.kind === 'boss' ? 'LINK' : 'STAB', MAG); ui.rect(E, 40, 31, 72, 5, '#1a1830'); this.stabE = ui.rect(E, 41, 32, 70, 3, '#b43cd8'); this.stabE.setOrigin(0, 0); }
    this.stP = undefined;
    // player HUD (bottom-right above text box)
    const P = this.pHud = ui.layer();
    ui.win(P, 124, 66, 114, 43);
    this.txtP = ui.text(P, 132, 71, displayName(p), INK); ui.text(P, 210, 71, `Lv${p.level}`, INK);
    this.ensureMiniLabels(P, 132, 81, 'HP');
    ui.rect(P, 151, 81, 80, 5, '#1a1830');
    this.hpP = ui.rect(P, 152, 82, 78, 3, '#30c868'); this.hpP.setOrigin(0, 0);
    this.hpTxt = ui.text(P, 190, 89, '', INK);
    ui.text(P, 132, 98, 'EXP', '#3a68c8'); ui.rect(P, 151, 99, 80, 4, '#1a1830'); this.expP = ui.rect(P, 152, 100, 78, 2, '#38a8e8'); this.expP.setOrigin(0, 0);
    this.shown.e = { hp: e.hp, max: maxHp(e) }; this.shown.p = { hp: p.hp, max: maxHp(p) };
    this.refreshBars(true);
    this.statusBadge('e', e.status); this.statusBadge('p', p.status);
  }
  badges: Partial<Record<Side, Layer>> = {};
  statusBadge(side: Side, st: string | null) {
    this.badges[side]?.destroy(); this.badges[side] = undefined;
    if (!st) return;
    const L = this.ui.layer(); const s = STATUS[st as keyof typeof STATUS];
    const x = side === 'e' ? 96 : 212, y = side === 'e' ? 20 : 70;
    this.ui.rect(L, x, y, 20, 8, '#1a1830'); this.ui.rect(L, x + 1, y + 1, 18, 6, s.color); this.ui.text(L, x + 2, y, s.short, WHITE);
    L.objs.forEach((o: any) => o.setDepth(3000)); this.badges[side] = L;
  }
  ensureMiniLabels(L: Layer, x: number, y: number, t: string) { this.ui.text(L, x, y - 1, t, '#d89020'); }
  refreshBars(instant = false) {
    const f = (s: { hp: number; max: number }) => Math.max(0, s.hp / s.max);
    this.hpE.width = Math.round(78 * f(this.shown.e)); this.hpE.setFillStyle(num(hpColor(f(this.shown.e))));
    this.hpP.width = Math.round(78 * f(this.shown.p)); this.hpP.setFillStyle(num(hpColor(f(this.shown.p))));
    this.hpTxt.setText(`${Math.max(0, Math.round(this.shown.p.hp))}/${this.shown.p.max}`);
    if (this.stabE) this.stabE.width = Math.round(70 * (this.b.e.stab / 100));
    if (this.expP) this.expP.width = Math.round(78 * expBar(this.b.p.mon));
    void instant;
  }
  async tweenHp(side: Side, to: number, max: number) {
    const s = this.shown[side]; s.max = max;
    const from = s.hp; const dist = Math.abs(to - from);
    if (!dist) { this.refreshBars(); return; }
    const dur = Math.min(900, 200 + dist * 12) / G.s.settings.gameSpeed;
    await new Promise<void>((res) => this.tweens.addCounter({ from, to, duration: dur, onUpdate: (tw) => { s.hp = tw.getValue()!; this.refreshBars(); }, onComplete: () => { s.hp = to; this.refreshBars(); res(); } }));
  }

  // ---------------- message box ----------------
  setMsgBox() {
    this.boxLayer?.destroy(); this.boxLayer = this.ui.layer();
    this.ui.win(this.boxLayer, 0, 112, 240, 48);
  }
  async say(text: string, o: { wait?: boolean; auto?: number } = {}) {
    this.msgLayer?.destroy(); const L = this.msgLayer = this.ui.layer();
    L.objs.forEach(() => {});
    const lines = this.wrapLines(text);
    const spd = [0, 30, 60, 160][G.s.settings.textSpeed] * G.s.settings.gameSpeed;
    const t1 = this.ui.text(L, 10, 122, '', INK), t2 = this.ui.text(L, 10, 135, '', INK);
    const full = [lines[0] ?? '', lines[1] ?? ''];
    const total = full[0].length + full[1].length; let shown = 0, acc = 0, skip = false;
    Input.clearPressed();
    await new Promise<void>((res) => { const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => { if (Input.consumePressed('a') || Input.consumePressed('b')) skip = true; acc += spd * 0.016; const st = skip ? total : Math.floor(acc); acc -= Math.floor(acc); if (st > 0) { shown = Math.min(total, shown + st); t1.setText(full[0].slice(0, Math.min(shown, full[0].length))); t2.setText(full[1].slice(0, Math.max(0, shown - full[0].length))); } if (shown >= total) { ev.remove(); res(); } } }); });
    if (lines.length > 2) { for (let i = 2; i < lines.length; i += 2) { await Input.wait(['a', 'b']); t1.setText(lines[i] ?? ''); t2.setText(lines[i + 1] ?? ''); } }
    if (o.wait) { const more = L.add(this.add.image(228, 150, 'more').setOrigin(0, 0).setTint(num(INK))); this.tweens.add({ targets: more, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 }); await Input.wait(['a', 'b']); }
    else await wait(this, o.auto ?? 520);
  }
  wrapLines(text: string): string[] {
    const out: string[] = []; let line = '';
    for (const w of text.split(' ')) { if (!line) line = w; else if ((line + ' ' + w).length <= 37) line += ' ' + w; else { out.push(line); line = w; } }
    if (line) out.push(line); return out;
  }
  clearMsg() { this.msgLayer?.destroy(); this.msgLayer = undefined; }

  // ---------------- intro ----------------
  async intro() {
    const d = this.bd; const e = this.b.e.mon;
    if (d.trainer) {
      // trainer slides in
      const key = ensureCharSheet(this, d.trainer.look);
      const spr = this.add.image(272, 50, key, 0).setScale(3).setOrigin(0.5, 1).setDepth(6); this.textures.get(key);
      const img = this.add.sprite(272, 62, key, 0).setScale(3).setOrigin(0.5, 1).setDepth(6); spr.destroy();
      this.tweens.add({ targets: img, x: 172, duration: 500 });
      await wait(this, 600);
      if (d.boss) { await this.say(d.boss.title, { auto: 800 }); }
      await this.say(`${d.cfg.kind === 'boss' ? 'NODE KEEPER' : d.trainer.cls} ${d.trainer.name} wants to battle!`, { wait: true });
      if (d.boss) { await this.say(d.boss.intro, { wait: true }); }
      this.tweens.add({ targets: img, x: 300, duration: 400 }); await wait(this, 400); img.destroy();
      this.eSpr.setVisible(true); this.slideIn(this.eSpr, 172); Audio.cry(e.species);
      await this.say(`${d.trainer.name} sent out ${displayName(e)}!`, { auto: 700 });
    } else {
      Audio.cry(e.species); this.slideIn(this.eSpr, 172);
      await this.say(`A ${this.bd.bg === 'relay' || this.bd.bg === 'glitch' ? 'corrupted ' : 'wild '}${displayName(e)} appeared!`, { wait: false, auto: 900 });
    }
    // player's creature
    this.pSpr.setX(-40); this.tweens.add({ targets: this.pSpr, x: 64, duration: 380 }); Audio.cry(this.b.p.mon.species);
    await this.say(`Go, ${displayName(this.b.p.mon)}!`, { auto: 500 });
    this.idle();
  }
  slideIn(spr: Phaser.GameObjects.Image, x: number) { spr.setX(x + 90); spr.setAlpha(0.2); this.tweens.add({ targets: spr, x, alpha: 1, duration: 420 }); this.pixelWipe(spr); }
  pixelWipe(spr: Phaser.GameObjects.Image) { this.cameras.main.flash(100, 255, 255, 255); void spr; }
  idleTw: Phaser.Tweens.Tween[] = [];
  idle() {
    this.idleTw.forEach((t) => t.stop()); this.idleTw = [];
    this.idleTw.push(this.tweens.add({ targets: this.eSpr, y: this.eSpr.y - 2, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    this.idleTw.push(this.tweens.add({ targets: this.pSpr, y: this.pSpr.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  }

  // ---------------- main loop ----------------
  async loop() {
    const b = this.b;
    for (;;) {
      if (b.over) break;
      if (b.needSwitch) { await this.forceSwitch(); continue; }
      const act = await this.chooseAction();
      if (!act) continue;
      const start = b.log.length;
      if (act.t === 'item') { takeItem(act.id); }
      b.doTurn(act);
      await this.playEvents(b.log.slice(start));
      this.refreshBars();
      if (b.over) break;
    }
    await this.finish();
  }

  async chooseAction(): Promise<Action | null> {
    const b = this.b; const wild = b.cfg.kind === 'wild';
    this.clearMsg();
    if (this.bd.tutorial) await this.tutorialHint();
    for (;;) {
      // command box
      const L = this.ui.layer();
      this.ui.win(L, 0, 112, 120, 48); this.ui.text(L, 8, 122, 'What will', INK); this.ui.text(L, 8, 134, `${displayName(b.p.mon).slice(0, 10)} do?`, INK);
      this.ui.win(L, 120, 112, 120, 48); this.menu = 'command';
      const cmds = ['FIGHT', 'BYTE', 'BAG', 'CONTAIN', 'RUN'];
      const pos = [[134, 120], [188, 120], [134, 133], [188, 133], [134, 146]];
      cmds.forEach((c, i) => this.ui.text(L, pos[i][0], pos[i][1], c, (c === 'CONTAIN' && !wild) || (c === 'RUN' && !wild) ? DIM : INK));
      const cur = L.add(this.add.image(0, 0, 'cursor').setOrigin(0, 0).setTint(num(INK)));
      let idx = this.lastCmd;
      let chosen = -1;
      for (;;) {
        cur.setPosition(pos[idx][0] - 8, pos[idx][1] + 0);
        const k = await Input.wait(['up', 'down', 'left', 'right', 'a']);
        if (k === 'left') { if (idx === 1) idx = 0; else if (idx === 3) idx = 2; } else if (k === 'right') { if (idx === 0) idx = 1; else if (idx === 2) idx = 3; }
        else if (k === 'up') { if (idx === 2) idx = 0; else if (idx === 3) idx = 1; else if (idx === 4) idx = 2; } else if (k === 'down') { if (idx === 0) idx = 2; else if (idx === 1) idx = 3; else if (idx === 2) idx = 4; else if (idx === 3) idx = 4; }
        else if (k === 'a') { Audio.sfx('select'); chosen = idx; break; }
        Audio.sfx('move');
      }
      this.lastCmd = chosen; L.destroy(); this.menu = '';
      if (chosen === 0) { const a = await this.moveMenu(); if (a) return a; }
      else if (chosen === 1) {
        const t = await this.partyPick(false); if (t >= 0) return { t: 'switch', to: t };
      } else if (chosen === 2) {
        const pick = await bagMenu(this, this.ui, { battle: true, wild });
        this.setMsgBox(); if (pick) return { t: 'item', id: pick.id, target: pick.target };
      } else if (chosen === 3) {
        if (!wild) { Audio.sfx('error'); await this.say("The Debugger can't CONTAIN another Debugger's Bytekin!", { auto: 800 }); continue; }
        const mods = itemCount('contain_module');
        let mod: string | undefined;
        if (mods > 0) {
          const c = await this.ui.choose(['STANDARD', `MODULE x${mods}`], { x: 120, y: 80, w: 112, title: `${Math.round(this.b.containProbability(1) * 100)}% / ${Math.round(this.b.containProbability(1.5) * 100)}%`.length ? 'CONTAIN' : '' });
          if (c < 0) continue; if (c === 1) mod = 'contain_module';
        }
        if (mod) takeItem('contain_module');
        return { t: 'contain', module: mod };
      } else if (chosen === 4) {
        if (!wild) { Audio.sfx('error'); await this.say("No running from a Debugger battle!", { auto: 800 }); continue; }
        return { t: 'run' };
      }
    }
  }
  lastCmd = 0;
  menu = '';
  async tutorialHint() {
    const s = this.tutorialStep++;
    const e = this.b.e;
    if (s === 0) await this.say('Pick FIGHT to attack. Damage lowers HP and STABILITY.', { wait: true });
    else if (s === 1 || e.stab < 60 || e.mon.hp < maxHp(e.mon) * 0.7) { if (s >= 1) await this.say('Its STABILITY is low! Choose CONTAIN to bond with it!', { wait: true }); }
  }
  async moveMenu(): Promise<Action | null> {
    const b = this.b; const p = b.p.mon;
    const L = this.ui.layer(); this.menu = 'move';
    this.ui.win(L, 0, 112, 160, 48); this.ui.win(L, 160, 112, 80, 48);
    const pos = [[16, 120], [88, 120], [16, 134], [88, 134]];
    p.moves.forEach((m, i) => this.ui.text(L, pos[i][0], pos[i][1], MOVES[m.id].name.slice(0, 11), m.pp > 0 ? INK : DIM));
    const cur = L.add(this.add.image(0, 0, 'cursor').setOrigin(0, 0).setTint(num(INK)));
    const info = this.ui.layer(); let infoL: Layer | null = null; void info;
    let idx = Math.min(this.lastMove, p.moves.length - 1);
    let res: Action | null = null;
    for (;;) {
      cur.setPosition(pos[idx][0] - 10, pos[idx][1]);
      infoL?.destroy(); infoL = this.ui.layer();
      const m = p.moves[idx], d = MOVES[m.id];
      this.ui.text(infoL, 168, 119, `PP ${m.pp}/${m.maxPp}`, m.pp === 0 ? RED : INK);
      this.ui.rect(infoL, 168, 131, d.type.length * 6 + 4, 9, '#1a1830'); this.ui.rect(infoL, 169, 132, d.type.length * 6 + 2, 7, TYPE_COLORS[d.type]); this.ui.text(infoL, 170, 132, d.type, WHITE);
      this.ui.text(infoL, 168, 144, d.cat === 'status' ? 'STATUS' : d.power ? `${d.cat === 'hit' ? 'HIT' : 'SYS'} ${d.power}` : '', DIM);
      const k = await Input.wait(['up', 'down', 'left', 'right', 'a', 'b']);
      if (k === 'b') { Audio.sfx('back'); break; }
      if (k === 'left' && idx % 2 === 1) idx--; else if (k === 'right' && idx % 2 === 0 && idx + 1 < p.moves.length) idx++;
      else if (k === 'up' && idx >= 2) idx -= 2; else if (k === 'down' && idx < 2 && idx + 2 < p.moves.length) idx += 2;
      else if (k === 'a') {
        if (m.pp <= 0) { Audio.sfx('error'); continue; }
        Audio.sfx('select'); this.lastMove = idx; res = { t: 'move', i: idx }; break;
      }
      Audio.sfx('move');
    }
    infoL?.destroy(); L.destroy(); this.menu = ''; return res;
  }
  lastMove = 0;
  async partyPick(forced: boolean): Promise<number> {
    const L = this.ui.layer(); void L; L.destroy();
    for (;;) {
      const i = await partyMenu(this, this.ui, { prompt: forced ? 'CHOOSE THE NEXT BYTEKIN' : 'SWITCH TO WHICH?', pick: true, battle: true, cancel: !forced });
      this.setMsgBox();
      if (i < 0) return -1;
      const m = G.s.party[i];
      if (m === this.b.p.mon) { await this.say(`${displayName(m)} is already in battle!`, { auto: 700 }); if (forced) continue; return -1; }
      return i;
    }
  }
  async forceSwitch() {
    const i = await this.partyPick(true);
    const start = this.b.log.length;
    this.b.forceSwitch(i);
    await this.playEvents(this.b.log.slice(start));
  }

  // ---------------- event playback ----------------
  fx(side: Side) { return side === 'e' ? this.eSpr : this.pSpr; }
  async playEvents(evs: BEvent[]) {
    for (const e of evs) await this.playEvent(e);
  }
  async playEvent(e: BEvent) {
    switch (e.k) {
      case 'msg': await this.say(e.text); break;
      case 'move': await this.moveAnim(e.side, e.move); break;
      case 'eff': break;
      case 'hp': {
        if (e.dmg && e.dmg > 0) { Audio.sfx(this.lastEff > 1 ? 'super' : this.lastEff < 1 ? 'weak' : 'hit'); await this.hitFx(e.side); this.lastEff = 1; }
        await this.tweenHp(e.side, e.hp, e.max); if (e.heal) Audio.sfx('heal');
        break;
      }
      case 'stab': this.refreshBars(); break;
      case 'status': this.statusBadge(e.side, e.status); this.refreshBars(); break;
      case 'stat': Audio.sfx(e.n > 0 ? 'stat_up' : 'stat_down'); await this.statFx(e.side, e.n > 0); break;
      case 'faint': await this.faintFx(e.side); break;
      case 'send': await this.sendFx(e); break;
      case 'field': this.fieldTxt?.destroy(); if (e.id) this.fieldTxt = this.add.bitmapText(6, 50, 'px', e.id.replace('_', ' ')).setTint(0xb43cd8).setDepth(3000); break;
      case 'contain': await this.containAnim(e.shakes, e.ok); break;
      case 'exp': { const target = e.uid === this.b.p.mon.uid; if (target) { await new Promise<void>((res) => this.tweens.addCounter({ from: 0, to: 1, duration: 500 / G.s.settings.gameSpeed, onUpdate: () => this.refreshBars(), onComplete: () => res() })); } break; }
      case 'levelup': {
        this.leveled = true; Audio.jingle('jingle_levelup', this.bd.bgm);
        const m = G.s.party.find((x) => x.uid === e.uid)!;
        await this.say(`${displayName(m)} grew to Lv. ${e.level}!`, { wait: true });
        if (m === this.b.p.mon) { this.txtP.setText(displayName(m)); this.refreshBars(); this.shown.p.max = maxHp(m); this.shown.p.hp = m.hp; this.refreshBars(); this.pHud.objs.forEach((o: any) => { if (o.text && /^Lv/.test(o.text)) o.setText(`Lv${m.level}`); }); }
        for (const mv of e.learned) await this.say(`${displayName(m)} learned ${MOVES[mv].name}!`, { wait: true });
        for (const mv of e.pending) await this.learnPrompt(m, mv);
        break;
      }
      case 'flee': this.eSpr.setVisible(false); break;
      case 'rule': if (e.id === 'cacheLink') { this.eSpr.setTint(0x80ffa0); await wait(this, 200); this.eSpr.clearTint(); } else { Audio.sfx('glitch'); this.cameras.main.shake(300, 0.01); this.stabE?.setFillStyle(0x606080); } break;
      case 'over': break;
    }
  }
  lastEff = 1;
  async learnPrompt(m: Bytekin, mv: string) {
    for (;;) {
      await this.say(`${displayName(m)} wants to learn ${MOVES[mv].name}, but it already knows four moves.`, { wait: true });
      const L = this.ui.layer(); this.ui.win(L, 4, 60, 232, 50); this.ui.text(L, 12, 66, 'FORGET WHICH MOVE?', BLUE);
      const names = [...m.moves.map((x) => MOVES[x.id].name), `(NEW) ${MOVES[mv].name}`];
      L.destroy();
      const c = await this.ui.choose(names, { x: 90, y: 20, w: 146, title: 'FORGET WHICH?' });
      if (c < 0 || c === 4) { if (await this.confirm(`Stop learning ${MOVES[mv].name}?`)) { await this.say(`${displayName(m)} did not learn ${MOVES[mv].name}.`, { wait: true }); return; } continue; }
      const old = MOVES[m.moves[c].id].name; learnMove(m, mv, c);
      await this.say(`1, 2, and... Poof! ${displayName(m)} forgot ${old} and learned ${MOVES[mv].name}!`, { wait: true }); return;
    }
  }
  async confirm(q: string) { await this.say(q, { auto: 100 }); return (await this.ui.choose(['YES', 'NO'], { x: 180, y: 64, w: 56 })) === 0; }

  // ---------------- animations ----------------
  async moveAnim(side: Side, id: string) {
    if (!G.s.settings.battleAnim) return;
    const mv = MOVES[id]; const atk = this.fx(side), def = this.fx(side === 'e' ? 'p' : 'e');
    const col = num(TYPE_COLORS[mv.type]);
    const sx = atk.x, dir = side === 'e' ? -1 : 1;
    this.idleTw.forEach((t) => t.pause());
    if (mv.cat === 'hit') {
      this.tweens.add({ targets: atk, x: sx - dir * -8 * 0 + dir * 22, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
      await wait(this, 120);
      this.burst(def.x, def.y - 24, col, 9);
    } else if (mv.cat === 'sys') {
      for (let i = 0; i < 5; i++) { const s = this.add.rectangle(atk.x, atk.y - 24, 5, 5, col).setDepth(20); this.tweens.add({ targets: s, x: def.x + (Math.random() * 16 - 8), y: def.y - 24 + (Math.random() * 16 - 8), duration: 260, delay: i * 55, onComplete: () => s.destroy() }); }
      await wait(this, 420); this.burst(def.x, def.y - 24, col, 8);
    } else {
      const tgt = mv.fx.some((f: any) => f.who === 'foe' || (f.t === 'stab' && f.who !== 'self') || f.t === 'copyLast') ? def : atk;
      for (let i = 0; i < 8; i++) { const s = this.add.rectangle(tgt.x + (Math.random() * 40 - 20), tgt.y - 4, 3, 3, col).setDepth(20); this.tweens.add({ targets: s, y: tgt.y - 44, alpha: 0, duration: 520, delay: i * 40, onComplete: () => s.destroy() }); }
      await wait(this, 520);
    }
    this.idleTw.forEach((t) => t.resume());
  }
  burst(x: number, y: number, col: number, n: number) {
    for (let i = 0; i < n; i++) { const s = this.add.rectangle(x, y, 3, 3, i % 3 ? col : 0xffffff).setDepth(20); const a = (i / n) * Math.PI * 2; this.tweens.add({ targets: s, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, duration: 300, onComplete: () => s.destroy() }); }
  }
  async hitFx(side: Side) {
    const t = this.fx(side);
    this.cameras.main.shake(120, 0.004);
    for (let i = 0; i < 4; i++) { t.setVisible(i % 2 === 1); await wait(this, 55); } t.setVisible(true);
  }
  async statFx(side: Side, up: boolean) {
    const t = this.fx(side); const col = up ? 0x80ff80 : 0xff6080;
    for (let i = 0; i < 4; i++) { const s = this.add.rectangle(t.x - 16 + i * 10, t.y - 8, 3, 3, col).setDepth(20); this.tweens.add({ targets: s, y: up ? t.y - 50 : t.y + 4, alpha: 0, duration: 450, onComplete: () => s.destroy() }); }
    await wait(this, 450);
  }
  async faintFx(side: Side) {
    const t = this.fx(side); Audio.sfx('faint'); Audio.cry(side === 'e' ? this.b.e.mon.species : this.b.p.mon.species);
    this.idleTw.forEach((x) => x.pause());
    // pixel dissolve: slide down and fade in steps
    this.tweens.add({ targets: t, y: t.y + 24, alpha: 0, duration: 650 });
    await wait(this, 700); t.setVisible(false); t.setAlpha(1); t.y -= 24;
    this.idleTw.forEach((x) => x.resume());
  }
  async sendFx(e: Extract<BEvent, { k: 'send' }>) {
    const m = e.side === 'e' ? this.b.e.mon : this.b.p.mon;
    const spr = this.fx(e.side);
    spr.setTexture(creatureTex(this, m.species, e.side === 'e' ? 'front' : 'back', m.anomalous)).setVisible(true).setAlpha(1);
    if (e.side === 'e') this.slideIn(spr, 172); else { spr.setX(-30); this.tweens.add({ targets: spr, x: 64, duration: 300 }); }
    Audio.cry(m.species);
    // rebuild HUD for new creature
    if (e.side === 'e') { this.eSpecies = m.species; } else this.pSpecies = m.species;
    this.rebuildHudKeepBoss();
    await wait(this, 250);
    this.idle();
  }
  rebuildHudKeepBoss() { this.buildHuds(); this.badges = {}; this.statusBadge('e', this.b.e.mon.status); this.statusBadge('p', this.b.p.mon.status); }

  /** CONTAIN: scan lines -> fragments into pixels -> pixels stream to Debugger -> shakes -> flash. */
  async containAnim(shakes: number, ok: boolean) {
    const t = this.eSpr; Audio.sfx('contain');
    this.idleTw.forEach((x) => x.pause());
    const dbgX = 36, dbgY = 78;
    const dbg = this.add.image(dbgX, dbgY, 'debugger').setScale(0.9).setDepth(30).setAngle(-8);
    this.tweens.add({ targets: dbg, y: dbgY - 4, duration: 250, yoyo: true });
    // scan lines wrap the creature
    const lines: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 10; i++) { const r = this.add.rectangle(t.x - 34, t.y - 64 + i * 6, 68, 1, 0x38e0e8).setOrigin(0, 0).setDepth(25); lines.push(r); this.tweens.add({ targets: r, scaleX: 1, alpha: 0.2, duration: 300, delay: i * 30, yoyo: true }); }
    await wait(this, 520); lines.forEach((l) => l.destroy());
    // fragment into pixels
    const src = this.textures.get(creatureTex(this, this.b.e.mon.species, 'front', this.b.e.mon.anomalous)).getSourceImage() as HTMLCanvasElement;
    const g = src.getContext('2d')!; const data = g.getImageData(0, 0, 64, 64).data;
    const pts: { x: number; y: number; c: number }[] = [];
    for (let y = 0; y < 64; y += 3) for (let x = 0; x < 64; x += 3) { const i = (y * 64 + x) * 4; if (data[i + 3] > 128) pts.push({ x, y, c: (data[i] << 16) | (data[i + 1] << 8) | data[i + 2] }); }
    const ox = t.x - 32, oy = t.y - 64;
    t.setVisible(false);
    const parts = pts.map((p, i) => { const r = this.add.rectangle(ox + p.x, oy + p.y, 3, 3, p.c).setDepth(22); this.tweens.add({ targets: r, x: dbgX + (Math.random() * 10 - 5), y: dbgY + (Math.random() * 10 - 5), duration: 420 + Math.random() * 200, delay: (i % 20) * 22, ease: 'Sine.easeIn', onComplete: () => r.destroy() }); return r; });
    Audio.sfx('warp');
    await wait(this, 1000); void parts;
    this.tweens.add({ targets: dbg, y: 106, angle: 0, duration: 300, ease: 'Bounce.easeOut' }); await wait(this, 400);
    const sw = (dir: number) => this.tweens.add({ targets: dbg, angle: dir * 16, duration: 110, yoyo: true });
    for (let i = 0; i < shakes; i++) { Audio.sfx('shake'); sw(i % 2 ? -1 : 1); dbg.setTint(0x38e0e8); await wait(this, 300); dbg.clearTint(); await wait(this, 320); }
    if (ok) {
      Audio.sfx('contain_ok'); this.cameras.main.flash(300, 120, 255, 255); dbg.setTint(0x80ff80);
      for (let i = 0; i < 14; i++) { const s = this.add.rectangle(dbgX, dbgY + 28, 3, 3, 0xffffff).setDepth(31); const a = Math.random() * Math.PI * 2; this.tweens.add({ targets: s, x: dbgX + Math.cos(a) * 24, y: dbgY + 28 + Math.sin(a) * 24, alpha: 0, duration: 500, onComplete: () => s.destroy() }); }
      await wait(this, 700); dbg.destroy();
    } else {
      Audio.sfx('contain_fail'); this.cameras.main.flash(200, 255, 80, 80); dbg.setTint(0xff6060); await wait(this, 200);
      dbg.destroy(); t.setVisible(true); t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 250 }); Audio.cry(this.b.e.mon.species); this.idleTw.forEach((x) => x.resume());
      await wait(this, 300);
    }
  }

  // ---------------- finish ----------------
  async finish() {
    const b = this.b;
    b.finish();
    const res = b.over!;
    if (res === 'win' && this.bd.cfg.kind !== 'wild') { Audio.jingle(this.bd.boss ? 'jingle_boss' : 'jingle_victory'); await wait(this, 900); }
    else if (res === 'win') { Audio.jingle('jingle_victory'); await wait(this, 400); }
    this.clearMsg();
    this.cameras.main.fadeOut(300, 0, 0, 0); await wait(this, 320);
    const resolve = this.bd.resolve;
    const enemy = b.eParty; const leveled = this.leveled;
    this.scene.stop();
    const world = this.scene.get('World'); this.scene.wake('World');
    Audio.play((world as any).def?.bgm ?? 'rivermoor'); Audio.glitch = !!(world as any).def?.glitchMusic;
    resolve({ result: res, enemy, leveled });
  }
}
void DIM; void GREEN; void flag; void ITEMS; void SPECIES;
