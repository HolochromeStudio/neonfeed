import Phaser from 'phaser';
import { Ui, wait, INK, DIM, windowTex } from '../ui/ui';
import { Input } from '../core/input';
import { Audio } from '../audio/audio';
import { G, flag, setFlag, clearFlag, incFlag, cond, addItem, takeItem, itemCount, addMon, markDex, healParty, partyAlive, timeOfDay, restUntilMorning, startQuest, completeQuest, refreshQuests, onFlags, writeSlot, rootKeys, giveStarter, tickPlaytime, questDone, SLOTS } from '../core/state';
import { MAPS, SCRIPTS, TRAINERS, BOSSES, ENCOUNTERS, ITEMS, SPECIES, QUESTS } from '../data';
import { compileMap, isSolidAt, tileDef, CompiledMap } from '../world/mapCompiler';
import { TILE_INDEX, TILESET_COLS } from '../gfx/tiles';
import { ensurePlayerSheet, ensureCharSheet, creatureTex } from '../gfx/textures';
import { frameIndex } from '../gfx/chars';
import { makeMon, maxHp, displayName, checkEvolution, healFull } from '../core/mon';
import type { Dir, Bytekin } from '../types';
import { levelCap } from '../battle/rules';
import { partyMenu, vaultMenu } from '../ui/party';
import { bagMenu, shopMenu } from '../ui/bag';
import { dexMenu, questMenu, mapMenu, debuggerMenu } from '../ui/info';
import { openOptions, saveMenu } from '../ui/options';
import { playEvolution } from '../ui/evolution';
import { radioMenu, numberEntry } from '../ui/devices';
import { rng } from '../gfx/pen';
import type { BattleConfig } from '../battle/engine';

const T = 16;
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface Actor {
  id: string; spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; tx: number; ty: number; dir: Dir; step: number; moving: boolean;
  cfg: any; home: [number, number]; nextWander: number; tex: string; visible: boolean; trainer?: string; isPlayer?: boolean;
}

export type BattleResult = 'win' | 'lose' | 'ran' | 'contained' | 'fled';

export class WorldScene extends Phaser.Scene {
  ui!: Ui;
  def: any; cm!: CompiledMap;
  tm?: Phaser.Tilemaps.Tilemap; gl?: Phaser.Tilemaps.TilemapLayer; ol?: Phaser.Tilemaps.TilemapLayer;
  anim: { layer: Phaser.Tilemaps.TilemapLayer; x: number; y: number; base: number }[] = [];
  animF = 0;
  player!: Actor;
  actors = new Map<string, Actor>();
  sprites: Phaser.GameObjects.GameObject[] = [];
  objSprites = new Map<string, Phaser.GameObjects.Image>();
  moveT = 0; moveFrom: [number, number] = [0, 0]; moveDur = 180; turnCd = 0; bumpCd = 0;
  lockCount = 0; dirty = false; stepsSinceBattle = 0;
  get busy() { return this.lockCount > 0; }
  weather: 'clear' | 'rain' | 'static' = 'clear';
  tint?: Phaser.GameObjects.Rectangle; rain: Phaser.GameObjects.Image[] = [];
  wanderers: { spr: Phaser.GameObjects.Image; x: number; y: number; next: number; entry: any }[] = [];
  nextSpawn = 0; clockAcc = 0; debugOn = false; debugText?: Phaser.GameObjects.BitmapText;
  fadeLock = false; mapName?: Phaser.GameObjects.Container; sparkles: Phaser.GameObjects.Image[] = [];
  glitchFx = 0; mira?: any; staticBars: Phaser.GameObjects.Rectangle[] = [];
  tmpLayers: any[] = [];

  constructor() { super('World'); }

  create(data: { fromSave?: boolean }) {
    this.ui = new Ui(this);
    G.toast = (t) => this.ui.toast(t);
    this.events.once('shutdown', () => { G.toast = null; });
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.roundPixels = true;
    ensurePlayerSheet(this, G.s.look);
    if (!data.fromSave) { setFlag('game_start'); refreshQuests(); }
    onFlags(() => { this.dirty = true; });
    this.input.keyboard?.on('keydown-F1', () => this.toggleDebug());
    (window as any).bb = this.debugApi();
    Audio.setVolumes(G.s.settings.musicVol, G.s.settings.sfxVol);
    // tint overlay (day/night)
    this.tint = this.add.rectangle(0, 0, 240, 160, 0xffffff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(900).setBlendMode(Phaser.BlendModes.MULTIPLY);
    for (let i = 0; i < 40; i++) this.rain.push(this.add.image(Math.random() * 240, Math.random() * 160, 'raindrop').setScrollFactor(0).setDepth(901).setVisible(false).setAlpha(0.7));
    this.time.addEvent({ delay: 380, loop: true, callback: () => this.tickAnim() });
    document.addEventListener('visibilitychange', this.onVis);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', this.onVis));
    this.loadMap(G.s.map, G.s.x, G.s.y, G.s.dir, { first: true });
  }
  onVis = () => { if (document.hidden && G.s.settings.autosave && G.slot) { try { this.persistPosition(); writeSlot(G.slot); } catch { /* ignore */ } } };

  // ====================== MAP LOADING ======================
  clearMap() {
    this.tm?.destroy(); this.tm = undefined;
    for (const a of this.actors.values()) { a.spr.destroy(); a.shadow.destroy(); }
    this.actors.clear();
    for (const s of this.sprites) s.destroy(); this.sprites = [];
    this.objSprites.forEach((o) => o.destroy()); this.objSprites.clear(); this.anim = []; this.wanderers.forEach((w) => w.spr.destroy()); this.wanderers = [];
    this.sparkles.forEach((s) => s.destroy()); this.sparkles = [];
  }
  loadMap(id: string, x: number, y: number, dir: Dir, o: { first?: boolean } = {}) {
    const def = MAPS[id]; if (!def) throw new Error('Unknown map ' + id);
    this.clearMap();
    this.def = def; G.s.map = id;
    if (!G.s.visited.includes(id)) G.s.visited.push(id);
    this.rebuildTiles();
    // weather decided per map+day
    const day = Math.floor(G.s.clock / 1440);
    const rr = rng((day + 1) * 977 + id.length * 31 + id.charCodeAt(0))();
    this.weather = def.weather && rr < 0.22 ? 'rain' : def.weather && rr > 0.95 ? 'static' : 'clear';
    this.rain.forEach((r) => r.setVisible(this.weather === 'rain'));
    // actors
    const pl = ensurePlayerSheet; void pl;
    this.player = this.makeActor('player', 'char_player', x, y, dir, {}); this.player.isPlayer = true;
    this.buildEntities();
    this.cameras.main.startFollow(this.player.spr, true, 1, 1);
    this.setupCamera();
    this.updateTint();
    Audio.play(def.bgm ?? 'rivermoor');
    Audio.glitch = !!def.glitchMusic || flag('keys_stolen');
    if (!o.first) this.persistPosition();
    this.showMapName();
    this.nextSpawn = 0;
    this.time.delayedCall(30, () => { this.checkTrainersSight(); this.runEnterScripts(); });
  }
  setupCamera() {
    const cam = this.cameras.main; const W = this.cm.w * T, H = this.cm.h * T;
    const bx = W < 240 ? -(240 - W) / 2 : 0, by = H < 160 ? -(160 - H) / 2 : 0;
    cam.setBounds(bx, by, Math.max(W, 240), Math.max(H, 160));
    cam.setScroll(this.player.spr.x - 120, this.player.spr.y - 88);
  }
  rebuildTiles() {
    this.dirty = false;
    this.cm = compileMap(this.def);
    const w = this.cm.w, h = this.cm.h;
    const toRows = (arr: Int16Array) => { const r: number[][] = []; for (let y = 0; y < h; y++) { r.push(Array.from(arr.subarray(y * w, y * w + w))); } return r; };
    if (this.tm) { this.tm.destroy(); }
    this.anim = [];
    this.tm = this.make.tilemap({ data: toRows(this.cm.g), tileWidth: T, tileHeight: T });
    const ts = this.tm.addTilesetImage('tiles', 'tiles', T, T, 0, 0)!;
    this.gl = this.tm.createLayer(0, ts, 0, 0)!; this.gl.setDepth(0);
    this.ol = this.tm.createBlankLayer('objects', ts, 0, 0, w, h)!; this.ol.setDepth(1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gi = this.cm.g[y * w + x], oi = this.cm.o[y * w + x];
      if (tileDef(gi)?.anim) this.anim.push({ layer: this.gl, x, y, base: gi });
      if (oi >= 0) { this.ol.putTileAt(oi, x, y); if (tileDef(oi)?.anim) this.anim.push({ layer: this.ol, x, y, base: oi }); }
    }
    this.gl.setSkipCull(true); this.ol.setSkipCull(true);
    void TILESET_COLS;
    this.rebuiltAt = this.time.now;
  }
  rebuiltAt = 0; noEnc = false;
  tickAnim() {
    this.animF ^= 1;
    for (const a of this.anim) a.layer.putTileAt(a.base + this.animF, a.x, a.y);
    // lamp posts at night etc handled by tint
  }
  showMapName() {
    this.mapName?.destroy();
    const t = this.def.name as string; if (!t || this.def.noTitle) return;
    const c = this.add.container(0, -20).setScrollFactor(0).setDepth(950);
    const bg = this.add.image(4, 2, windowTex(this, 'win', t.length * 6 + 20, 18)).setOrigin(0, 0);
    const tx = this.add.bitmapText(14, 7, 'px', t).setTint(0x1a1830);
    c.add([bg, tx]); this.mapName = c;
    this.tweens.add({ targets: c, y: 0, duration: 250, hold: 1600, yoyo: true, onComplete: () => c.destroy() });
  }

  // ====================== ENTITIES ======================
  makeActor(id: string, tex: string, x: number, y: number, dir: Dir, cfg: any): Actor {
    const spr = this.add.sprite(x * T + 8, y * T + 17, tex, frameIndex(dir, 0)).setOrigin(0.5, 1);
    const shadow = this.add.image(x * T + 8, y * T + 16, 'shadow').setOrigin(0.5, 0.5).setAlpha(0.8);
    spr.setFlipX(dir === 'right');
    const a: Actor = { id, spr, shadow, tx: x, ty: y, dir, step: 0, moving: false, cfg, home: [x, y], nextWander: this.time.now + 1500 + Math.random() * 2000, tex, visible: true };
    spr.setDepth(10 + y); shadow.setDepth(9 + y);
    this.actors.set(id, a);
    return a;
  }
  setFacing(a: Actor, d: Dir, step = 0) { a.dir = d; a.spr.setFrame(frameIndex(d, step)); a.spr.setFlipX(d === 'right'); }
  buildEntities() {
    const def = this.def;
    for (const n of def.npcs ?? []) this.spawnNpc(n);
    for (const t of def.trainers ?? []) this.spawnNpc({ ...t, trainerId: t.id, move: 'none' });
    this.refreshObjects();
  }
  spawnNpc(n: any) {
    if (this.actors.has(n.id)) return;
    const tex = ensureCharSheet(this, n.look ?? 'kid');
    const a = this.makeActor(n.id, tex, n.x, n.y, n.dir ?? 'down', n);
    a.trainer = n.trainerId;
    this.applyNpcVisibility(a);
  }
  applyNpcVisibility(a: Actor) {
    const n = a.cfg; let vis = true;
    if (n.show !== undefined && !cond(n.show)) vis = false;
    if (n.hide !== undefined && cond(n.hide)) vis = false;
    if (a.trainer && false) vis = true;
    a.visible = vis; a.spr.setVisible(vis); a.shadow.setVisible(vis);
  }
  refreshObjects() {
    // object sprites (item balls, starter pedestal creatures)
    for (const [k, s] of this.objSprites) { s.destroy(); this.objSprites.delete(k); }
    for (const o of this.def.objects ?? []) {
      if (o.when !== undefined && !cond(o.when)) continue;
      if (o.type === 'item' && !flag(this.objFlag(o))) {
        const s = this.add.image(o.x * T + 8, o.y * T + 14, 'itemball').setOrigin(0.5, 1).setDepth(10 + o.y); this.objSprites.set(o.id ?? `${o.x},${o.y}`, s);
      }
      if (o.sprite && (o.show === undefined || cond(o.show))) {
        const key = creatureTex(this, o.sprite, 'icon');
        const s = this.add.image(o.x * T + 8, o.y * T + 14, key).setOrigin(0.5, 1).setDepth(10 + o.y); this.objSprites.set(o.id, s);
        this.tweens.add({ targets: s, y: s.y - 2, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1 });
        if (o.glitchy) this.time.addEvent({ delay: 500 + Math.random() * 600, loop: true, callback: () => { s.setVisible(Math.random() > 0.15); s.x = o.x * T + 8 + (Math.random() < 0.3 ? Phaser.Math.Between(-2, 2) : 0); } });
      }
    }
  }
  objFlag(o: any) { return o.flag ?? `got_${this.def.id}_${o.x}_${o.y}`; }

  actorAt(x: number, y: number): Actor | undefined {
    for (const a of this.actors.values()) if (!a.isPlayer && a.visible && (a.tx === x && a.ty === y)) return a;
    return undefined;
  }
  objectAt(x: number, y: number): any | undefined {
    for (const o of this.def.objects ?? []) { if (o.x === x && o.y === y && (o.when === undefined || cond(o.when))) return o; }
    return undefined;
  }
  blockedByObject(x: number, y: number) {
    const o = this.objectAt(x, y); if (!o) return false;
    if (o.type === 'item' && !flag(this.objFlag(o))) return true;
    if (o.sprite && (o.show === undefined || cond(o.show))) return true;
    return !!o.solid;
  }
  canEnter(x: number, y: number, ignoreActors = false): boolean {
    if (isSolidAt(this.cm, x, y)) return false;
    if (!ignoreActors && this.actorAt(x, y)) return false;
    if (this.blockedByObject(x, y)) return false;
    return true;
  }
  groundAt(x: number, y: number) { return tileDef(this.cm.g[y * this.cm.w + x]); }

  // ====================== MAIN LOOP ======================
  update(_t: number, dtRaw: number) {
    const speedMul = G.s.settings.gameSpeed;
    const dt = Math.min(50, dtRaw) * speedMul;
    // clock + playtime
    this.clockAcc += dtRaw;
    if (this.clockAcc > 2500) { this.clockAcc = 0; if (!this.def.freezeTime) G.s.clock++; if (G.s.clock % 30 === 0) this.updateTint(); }
    if (this.dirty && !this.moveInProgress()) { this.rebuildTiles(); this.ensurePlayerFree(); this.sparkleRefresh(); this.actors.forEach((a) => { if (!a.isPlayer) this.applyNpcVisibility(a); }); this.refreshObjects(); this.setupCameraKeep(); }
    // weather
    if (this.weather === 'rain') for (const r of this.rain) { r.y += dt * 0.25; r.x -= dt * 0.06; if (r.y > 164) { r.y = -6; r.x = Math.random() * 260; } }
    // static storm: pixel-authentic tearing bars
    if (this.weather === 'static') { if (!this.staticBars.length) for (let i = 0; i < 5; i++) this.staticBars.push(this.add.rectangle(0, 0, 240, 2, 0xb43cd8, 0.5).setOrigin(0, 0).setScrollFactor(0).setDepth(902)); for (const b of this.staticBars) { b.setVisible(Math.random() < 0.35); b.y = Math.floor(Math.random() * 160); b.setFillStyle(Math.random() < 0.5 ? 0x38e0e8 : 0xb43cd8, 0.45); b.height = 1 + Math.floor(Math.random() * 3); } } else if (this.staticBars.length) { this.staticBars.forEach((b) => b.destroy()); this.staticBars = []; }
    // glitch fx
    if (this.glitchFx > 0) { this.glitchFx -= dtRaw; if (Math.random() < 0.3) this.cameras.main.setScroll(this.cameras.main.scrollX + Phaser.Math.Between(-2, 2), this.cameras.main.scrollY); }
    this.updateActors(dt);
    this.updateWanderers(dt);
    this.sparkleUpdate();
    if (this.debugOn) this.updateDebug();
    if (this.busy || this.fadeLock) { Input.clearPressed(); return; }
    // player
    if (this.player.moving) { this.advancePlayer(dt); return; }
    if (Input.consumePressed('start')) { void this.openMenu(); return; }
    if (Input.consumePressed('a')) { void this.interact(); return; }
    if (this.turnCd > 0) this.turnCd -= dt;
    const d: Dir | null = Input.isDown('up') ? 'up' : Input.isDown('down') ? 'down' : Input.isDown('left') ? 'left' : Input.isDown('right') ? 'right' : null;
    if (d) this.tryMove(d);
  }
  /** If a rebuild (time-of-day path change, puzzle) put solid terrain under the player, nudge them to the nearest free tile. */
  ensurePlayerFree() {
    const p = this.player; if (!isSolidAt(this.cm, p.tx, p.ty)) return;
    const w = this.cm.w, h = this.cm.h; const seen = new Set<number>([p.ty * w + p.tx]); const q: [number, number][] = [[p.tx, p.ty]];
    while (q.length) { const [x, y] = q.shift()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx)) continue; seen.add(ny * w + nx); if (!isSolidAt(this.cm, nx, ny) && !this.actorAt(nx, ny)) { p.tx = nx; p.ty = ny; p.spr.setPosition(nx * T + 8, ny * T + 17); p.shadow.setPosition(nx * T + 8, ny * T + 16); return; } q.push([nx, ny]); } }
  }
  moveInProgress() { return this.player.moving || this.busy; }
  setupCameraKeep() { /* camera keeps following */ }

  // ---------- actors ----------
  updateActors(dt: number) {
    const now = this.time.now;
    for (const a of this.actors.values()) {
      a.spr.setDepth(10 + (a.moving ? a.spr.y / T : a.ty) + (a.isPlayer ? 0.5 : 0)); a.shadow.setDepth(9 + a.ty);
      if (a.isPlayer || !a.visible || a.moving || this.busy) continue;
      const m = a.cfg.move;
      if (m === 'wander' && now > a.nextWander) {
        a.nextWander = now + 1200 + Math.random() * 2200;
        const d = (['up', 'down', 'left', 'right'] as Dir[])[(Math.random() * 4) | 0];
        const [dx, dy] = DIRS[d]; const nx = a.tx + dx, ny = a.ty + dy; const r = a.cfg.r ?? 2;
        if (Math.abs(nx - a.home[0]) <= r && Math.abs(ny - a.home[1]) <= r && this.canEnter(nx, ny) && !(this.player.tx === nx && this.player.ty === ny)) { void this.walkActor(a, d, 260); }
        else this.setFacing(a, d);
      } else if (m === 'look' && now > a.nextWander) { a.nextWander = now + 1500 + Math.random() * 2500; this.setFacing(a, (['up', 'down', 'left', 'right'] as Dir[])[(Math.random() * 4) | 0]); }
    }
  }
  walkActor(a: Actor, d: Dir, dur = 200, noCollide = false): Promise<void> {
    return new Promise((res) => {
      const [dx, dy] = DIRS[d];
      a.dir = d; a.moving = true; a.step = a.step === 1 ? 2 : 1;
      this.setFacing(a, d, a.step);
      const sx = a.tx * T + 8, sy = a.ty * T + 17; a.tx += dx; a.ty += dy; void noCollide;
      this.tweens.addCounter({ from: 0, to: 1, duration: Math.max(40, dur / G.s.settings.gameSpeed), onUpdate: (tw) => { const v = tw.getValue()!; a.spr.setPosition(sx + dx * T * v, sy + dy * T * v); a.shadow.setPosition(a.spr.x, a.spr.y - 1); },
        onComplete: () => { a.spr.setPosition(a.tx * T + 8, a.ty * T + 17); a.shadow.setPosition(a.spr.x, a.spr.y - 1); a.moving = false; this.setFacing(a, d, 0); res(); } });
    });
  }

  // ---------- player movement ----------
  tryMove(d: Dir) {
    const p = this.player;
    if (p.dir !== d && this.turnCd <= 0 && !(Input.isDown('up') && Input.isDown('down'))) { this.setFacing(p, d, 0); this.turnCd = 90; return; }
    if (this.turnCd > 0) return;
    const [dx, dy] = DIRS[d]; let nx = p.tx + dx, ny = p.ty + dy;
    const g = this.groundAt(nx, ny);
    let hop = false;
    if (g?.ledge) { if (d !== 'down') { this.bump(); return; } if (this.canEnter(nx, ny + 1)) { hop = true; ny += 1; } else { this.bump(); return; } }
    else if (!this.canEnter(nx, ny)) { this.bump(); return; }
    // trigger checks for blocked-by-script tiles (e.g., closed doors) are handled via object scripts
    this.startPlayerMove(nx, ny, d, hop);
  }
  bump() { const now = this.time.now; if (now > this.bumpCd) { Audio.sfx('bump'); this.bumpCd = now + 350; } }
  startPlayerMove(nx: number, ny: number, d: Dir, hop: boolean) {
    const p = this.player;
    p.moving = true; this.moveT = 0; this.moveFrom = [p.tx, p.ty]; p.tx = nx; p.ty = ny; this.hopping = hop;
    const run = Input.isDown('run') || Input.runToggle || (G.s.settings.autoRun && !Input.isDown('b'));
    this.moveDur = (run ? 105 : 175) * (hop ? 2 : 1);
    p.step = p.step === 1 ? 2 : 1; this.setFacing(p, d, p.step);
  }
  hopping = false;
  advancePlayer(dt: number) {
    const p = this.player;
    this.moveT += dt / this.moveDur;
    const v = Math.min(1, this.moveT);
    const sx = this.moveFrom[0] * T + 8, sy = this.moveFrom[1] * T + 17, ex = p.tx * T + 8, ey = p.ty * T + 17;
    let y = sy + (ey - sy) * v; if (this.hopping) y -= Math.sin(v * Math.PI) * 6;
    p.spr.setPosition(Math.round(sx + (ex - sx) * v), Math.round(y)); p.shadow.setPosition(p.spr.x, sy + (ey - sy) * v - 1);
    if (this.moveT >= 0.5 && p.step !== 0 && (this.moveT - dt / this.moveDur) < 0.5) this.setFacing(p, p.dir, 0);
    if (v >= 1) {
      p.moving = false; p.spr.setPosition(ex, ey); p.shadow.setPosition(ex, ey - 1); this.setFacing(p, p.dir, 0);
      if (this.hopping) Audio.sfx('step');
      this.onStep();
    }
  }
  persistPosition() { G.s.x = this.player.tx; G.s.y = this.player.ty; G.s.dir = this.player.dir; }

  // ====================== TILE EVENTS ======================
  onStep() {
    const p = this.player; G.s.stats.steps++; this.stepsSinceBattle++;
    if (G.s.beaconSteps > 0) G.s.beaconSteps--;
    if (G.s.stats.steps % 8 === 0 && !this.def.freezeTime) { G.s.clock++; }
    this.persistPosition();
    // warps
    for (const w of this.def.warps ?? []) {
      if (w.when !== undefined && !cond(w.when)) continue;
      if (p.tx >= w.x && p.tx < w.x + (w.w ?? 1) && p.ty >= w.y && p.ty < w.y + (w.h ?? 1)) { void this.doWarp(w); return; }
    }
    // triggers
    for (const t of this.def.triggers ?? []) {
      if (t.when !== undefined && !cond(t.when)) continue;
      if (t.once && flag(t.once)) continue;
      if (p.tx >= t.x && p.tx < t.x + (t.w ?? 1) && p.ty >= t.y && p.ty < t.y + (t.h ?? 1)) { if (t.once) setFlag(t.once); void this.runScriptId(t.script, t.id); return; }
    }
    if (this.checkTrainersSight()) return;
    // wanderer contact
    for (const w of this.wanderers) if (Math.abs(w.x - p.tx) + Math.abs(w.y - p.ty) <= 0) { void this.visibleEncounter(w); return; }
    // wild encounter
    this.rollRandomEncounter();
  }
  async doWarp(w: any) {
    this.lockCount++;
    Audio.sfx(w.sfx ?? 'door');
    this.cameras.main.fadeOut(180, 0, 0, 0);
    await wait(this, 200);
    const prevAuto = G.s.settings.autosave;
    this.loadMap(w.to, w.tx, w.ty, w.dir ?? 'down');
    this.cameras.main.fadeIn(180, 0, 0, 0);
    if (prevAuto && G.slot && !this.def.noAutosave) { this.persistPosition(); writeSlot(G.slot); }
    await wait(this, 120);
    this.lockCount--;
  }
  runEnterScripts() {
    for (const t of this.def.triggers ?? []) {
      if (!t.onEnter) continue;
      if (t.when !== undefined && !cond(t.when)) continue;
      if (t.once && flag(t.once)) continue;
      if (t.once) setFlag(t.once);
      void this.runScriptId(t.script, t.id); return;
    }
  }

  // ---------- trainers ----------
  checkTrainersSight(): boolean {
    if (this.busy) return false;
    for (const a of this.actors.values()) {
      if (!a.trainer || !a.visible || a.isPlayer) continue;
      if (G.s.trainersBeaten.includes(a.trainer)) continue;
      if (a.cfg.when !== undefined && !cond(a.cfg.when)) continue;
      const sight = a.cfg.sight ?? 4; const [dx, dy] = DIRS[a.dir];
      for (let i = 1; i <= sight; i++) {
        const x = a.tx + dx * i, y = a.ty + dy * i;
        if (isSolidAt(this.cm, x, y) && !(this.player.tx === x && this.player.ty === y)) break;
        if (this.player.tx === x && this.player.ty === y) { void this.trainerSpot(a, i); return true; }
      }
    }
    return false;
  }
  async trainerSpot(a: Actor, dist: number) {
    this.lockCount++; this.player.moving = false;
    Audio.sfx('alert');
    const ex = this.add.image(a.spr.x, a.spr.y - 20, 'alert').setDepth(2000);
    await wait(this, 600); ex.destroy();
    for (let i = 0; i < dist - 1; i++) await this.walkActor(a, a.dir, 170);
    this.setFacing(this.player, OPP[a.dir]);
    try { await this.runTrainerBattle(a.trainer!, a.cfg); } finally { this.lockCount--; }
  }
  async runTrainerBattle(tid: string, npcCfg?: any) {
    const tr = TRAINERS[tid];
    const pre = npcCfg?.pre ?? tr.pre;
    if (pre) await this.ui.say(pre, { who: tr.name });
    else await this.ui.say(`Let's battle!`, { who: tr.name });
    const res = await this.battleTrainer(tid);
    if (res === 'win') { G.s.trainersBeaten.push(tid); setFlag(`tr_${tid}`); if (tr.win) await this.ui.say(tr.win, { who: tr.name }); }
    else if (res === 'lose') { await this.whiteout(); }
    return res;
  }

  // ---------- encounters ----------
  encounterTable() { const id = this.def.area; return id ? ENCOUNTERS[id] : null; }
  rollRandomEncounter() {
    const zone = this.encounterTable(); if (!zone || zone.rate <= 0 || this.noEnc) return;
    if (!G.s.party.some((m) => m.hp > 0)) return;
    const mode = G.s.settings.encounters; if (mode === 'VISIBLE') return;
    const onGrass = zone.grass === false ? true : !!this.groundAt(this.player.tx, this.player.ty)?.grass;
    if (!onGrass) return;
    if (this.stepsSinceBattle < 5) return;
    let rate = zone.rate / 100; if (G.s.beaconSteps > 0) rate *= 2;
    if (Math.random() > rate) return;
    const pool = zone.table.filter((e) => this.entryAllowed(e) && !(mode === 'HYBRID' && e.rare));
    if (!pool.length) return;
    const e = this.pickWeighted(pool);
    void this.startWild(e);
  }
  entryAllowed(e: any) {
    if (e.time && !e.time.includes(timeOfDay())) return false;
    if (e.weather && !e.weather.includes(this.weather)) return false;
    if (e.needs && !cond(e.needs)) return false;
    return true;
  }
  pickWeighted(pool: any[]) { let tot = pool.reduce((s, e) => s + e.w, 0); let r = Math.random() * tot; for (const e of pool) { r -= e.w; if (r <= 0) return e; } return pool[0]; }
  scaleLevel(lv: number) { const d = G.s.settings.difficulty; return Math.max(2, lv + (d === 'CASUAL' ? -2 : d === 'EXPERT' ? 1 : 0)); }
  async startWild(e: { s: string; min: number; max: number }) {
    if (this.busy) return;
    this.lockCount++; this.player.moving = false;
    const lv = this.scaleLevel(e.min + Math.floor(Math.random() * (e.max - e.min + 1)));
    const mon = makeMon(e.s, lv);
    Audio.sfx('encounter'); this.cameras.main.flash(120, 255, 255, 255);
    await wait(this, 450);
    const res = await this.battleWild(mon);
    this.stepsSinceBattle = 0;
    await this.afterBattle(res);
    this.lockCount--;
  }
  // visible wanderers
  updateWanderers(dt: number) {
    const mode = G.s.settings.encounters; const zone = this.encounterTable();
    const cap = 3;
    if (mode === 'CLASSIC' || !zone || this.busy || !G.s.party.length) { if (mode === 'CLASSIC' && this.wanderers.length) { this.wanderers.forEach((w) => w.spr.destroy()); this.wanderers = []; } return; }
    const now = this.time.now;
    if (this.wanderers.length < cap && now > this.nextSpawn && zone.grass !== false) {
      this.nextSpawn = now + 6000 + Math.random() * 6000;
      const pool = zone.table.filter((e) => this.entryAllowed(e) && (mode === 'VISIBLE' || e.rare));
      if (pool.length) {
        for (let k = 0; k < 20; k++) {
          const x = (Math.random() * this.cm.w) | 0, y = (Math.random() * this.cm.h) | 0;
          if (!this.groundAt(x, y)?.grass || !this.canEnter(x, y) || Math.abs(x - this.player.tx) + Math.abs(y - this.player.ty) < 4) continue;
          const spr = this.add.image(x * T + 8, y * T + 14, 'shimmer').setOrigin(0.5, 1).setDepth(10 + y);
          this.tweens.add({ targets: spr, alpha: 0.5, duration: 300, yoyo: true, repeat: -1 });
          this.wanderers.push({ spr, x, y, next: now + 800, entry: this.pickWeighted(pool) }); break;
        }
      }
    }
    for (const w of this.wanderers) {
      if (now > w.next) {
        w.next = now + 600 + Math.random() * 600;
        const d = (['up', 'down', 'left', 'right'] as Dir[])[(Math.random() * 4) | 0]; const [dx, dy] = DIRS[d];
        const nx = w.x + dx, ny = w.y + dy;
        if (this.groundAt(nx, ny)?.grass && this.canEnter(nx, ny)) { w.x = nx; w.y = ny; this.tweens.add({ targets: w.spr, x: nx * T + 8, y: ny * T + 14, duration: 300 }); w.spr.setDepth(10 + ny); }
      }
      if (!this.player.moving && w.x === this.player.tx && w.y === this.player.ty) { void this.visibleEncounter(w); break; }
    }
    void dt;
  }
  async visibleEncounter(w: { spr: Phaser.GameObjects.Image; entry: any }) {
    if (this.busy) return;
    const i = this.wanderers.indexOf(w as any); if (i >= 0) this.wanderers.splice(i, 1);
    w.spr.destroy();
    await this.startWild(w.entry);
  }

  // ---------- sparkles for hidden scan points ----------
  sparkleRefresh() { this.sparkles.forEach((s) => s.destroy()); this.sparkles = []; }
  sparkleUpdate() {
    const objs = (this.def.objects ?? []).filter((o: any) => ((o.type === 'scan' && flag('has_scan')) || (o.type === 'freq' && flag('has_freq'))) && !flag(this.objFlag(o)) && (o.when === undefined || cond(o.when)));
    if (this.sparkles.length !== objs.length) { this.sparkles.forEach((s) => s.destroy()); this.sparkles = objs.map((o: any) => this.add.image(o.x * T + 8, o.y * T + 8, 'sparkle').setDepth(500).setVisible(false)); }
    objs.forEach((o: any, i: number) => { const d = Math.abs(o.x - this.player.tx) + Math.abs(o.y - this.player.ty); const s = this.sparkles[i]; s.setVisible(d <= 4 && (this.time.now % 600 < 400)); });
  }

  // ====================== INTERACTION ======================
  async interact() {
    if (this.busy) return;
    const p = this.player; const [dx, dy] = DIRS[p.dir]; const x = p.tx + dx, y = p.ty + dy;
    this.lockCount++;
    try {
      const a = this.actorAt(x, y);
      if (a) { await this.talkTo(a); return; }
      let o = this.objectAt(x, y);
      if (!o) { const here = this.objectAt(p.tx, p.ty); if (here && here.type === 'scan') o = here; }
      if (o) { await this.useObject(o); return; }
      // hidden scan adjacent
      if (flag('has_scan')) for (const so of this.def.objects ?? []) if ((so.type === 'scan') && Math.abs(so.x - p.tx) + Math.abs(so.y - p.ty) <= 1 && !flag(this.objFlag(so))) { await this.useObject(so); return; }
    } finally { this.lockCount--; Input.clearPressed(); }
  }
  async talkTo(a: Actor) {
    if (!a.isPlayer && !a.moving) { this.setFacing(a, OPP[this.player.dir]); }
    const cfg = a.cfg;
    if (a.trainer && !G.s.trainersBeaten.includes(a.trainer)) { await this.runTrainerBattle(a.trainer, cfg); return; }
    if (a.trainer && TRAINERS[a.trainer]) { await this.ui.say(TRAINERS[a.trainer].win ? [TRAINERS[a.trainer].win] : ['...'], { who: TRAINERS[a.trainer].name }); return; }
    const list = cfg.scripts as { when?: any; run: any }[] | undefined;
    if (list) { for (const s of list) { if (s.when === undefined || cond(s.when)) { await this.runScript(s.run, a.id); return; } } }
    if (cfg.script) { await this.runScript(cfg.script, a.id); return; }
    if (cfg.text) await this.ui.say(cfg.text, { who: cfg.name });
  }
  async useObject(o: any) {
    switch (o.type) {
      case 'sign': await this.ui.say(o.text); break;
      case 'item': {
        const f = this.objFlag(o); if (flag(f)) break;
        setFlag(f); addItem(o.item, o.n ?? 1); this.refreshObjects(); Audio.jingle('jingle_item', this.def.bgm);
        await this.ui.say(`${G.s.name} found ${o.n && o.n > 1 ? o.n + ' ' : 'a '}${ITEMS[o.item].name}!`);
        break;
      }
      case 'scan': {
        const f = this.objFlag(o); if (flag(f)) { await this.ui.say('Nothing else here.'); break; }
        if (!flag('has_scan')) { await this.ui.say(o.blind ?? 'Nothing there.'); break; }
        Audio.sfx('scan'); await this.ui.say(o.text ?? 'FIELD SCAN: a faint signal... Something is buried here!');
        setFlag(f); if (o.counter) incFlag(o.counter);
        if (o.item) { addItem(o.item, o.n ?? 1); Audio.jingle('jingle_item', this.def.bgm); await this.ui.say(`Found ${o.n && o.n > 1 ? o.n + ' ' : 'a '}${ITEMS[o.item].name}!`); }
        if (o.script) await this.runScriptId(o.script);
        break;
      }
      case 'freq': {
        const f = this.objFlag(o); if (flag(f)) { await this.ui.say('The channel is quiet now.'); break; }
        if (!flag('has_freq')) { await this.ui.say(o.blind ?? 'An old radio. Only static. Maybe with the right tuning...'); break; }
        Audio.sfx('glitch'); setFlag(f); this.rebuildTiles();
        if (o.script) await this.runScriptId(o.script);
        break;
      }
      case 'radio': {
        await radioMenu(this, this.ui, o.title ?? 'RADIO', o.stations);
        for (const a of o.after ?? []) if (cond(a.when)) await this.runScriptId(a.run);
        break;
      }
      case 'lore': {
        const f = `lore_${o.id}`;
        Audio.sfx('select'); await this.ui.say(o.text, { kind: 'winDark' });
        if (!flag(f)) { setFlag(f); const n = incFlag('lore_count'); this.ui.toast(`LORE LOG ${n} FOUND`); }
        break;
      }
      case 'keypad': {
        if (flag(o.flag)) { await this.ui.say(o.done ?? 'The lock is open.'); break; }
        await this.ui.say(o.text ?? 'A numeric keypad. It wants a code.');
        const code = await numberEntry(this, this.ui, String(o.code).length, o.title ?? 'ENTER CODE');
        if (code === null) break;
        if (code === String(o.code)) { Audio.sfx('door'); setFlag(o.flag); this.rebuildTiles(); this.refreshObjects(); await this.ui.say(o.ok ?? 'Click. The lock opens!'); if (o.script) await this.runScriptId(o.script); }
        else { Audio.sfx('error'); await this.ui.say(o.fail ?? 'Wrong code. The keypad buzzes.'); }
        break;
      }
      case 'terminal': await this.terminal(o); break;
      case 'script': if (o.script) await this.runScript(o.script, o.id); break;
      case 'pulse': {
        if (!flag('has_pulse')) { await this.ui.say(o.blind ?? 'A dormant Signal switch. It does not respond.'); break; }
        if (flag(o.flag)) { await this.ui.say('The switch hums quietly.'); break; }
        Audio.sfx('pulse'); this.cameras.main.flash(200, 120, 255, 255); this.cameras.main.shake(250, 0.004);
        await this.ui.say(`${G.s.name} sent a PULSE into the switch!`);
        setFlag(o.flag); this.rebuildTiles(); this.refreshObjects();
        if (o.script) await this.runScriptId(o.script);
        break;
      }
      default: if (o.text) await this.ui.say(o.text);
    }
  }
  async terminal(o: any) {
    Audio.sfx('select');
    const opts = ['SAVE', 'BYTE VAULT'];
    if (o.rest) opts.push('REST');
    opts.push('CLOSE');
    await this.ui.say(o.text ?? 'A Debugger terminal. Its screen blinks patiently.', { noWait: false });
    const c = await this.ui.choose(opts, { x: 150, y: 70, w: 86 });
    const sel = c >= 0 ? opts[c] : 'CLOSE';
    if (sel === 'SAVE') { this.persistPosition(); await saveMenu(this, this.ui); }
    else if (sel === 'BYTE VAULT') { await vaultMenu(this, this.ui); }
    else if (sel === 'REST') { await this.sleepScene(); }
  }
  async sleepScene() {
    this.cameras.main.fadeOut(500, 0, 0, 0); await wait(this, 600);
    restUntilMorning(); healParty(); G.s.lastHeal = { map: G.s.map, x: this.player.tx, y: this.player.ty + 1 };
    this.updateTint(); Audio.jingle('jingle_heal', this.def.bgm);
    await wait(this, 900); this.cameras.main.fadeIn(500, 0, 0, 0);
    await this.ui.say('You rested until morning. Your Bytekin are fully restored!');
  }

  // ====================== SCRIPT RUNNER ======================
  async runScriptId(id: string, who?: string) {
    const s = SCRIPTS[id]; if (!s) { console.warn('missing script', id); return; }
    this.lockCount++;
    try { await this.runScript(s, who); } finally { this.lockCount--; Input.clearPressed(); }
  }
  async runScript(script: any, who?: string) {
    const cmds = typeof script === 'string' ? SCRIPTS[script] : script;
    if (!cmds) { console.warn('bad script', script); return; }
    for (const c of cmds) { const r = await this.exec(c, who); if (r === 'end') return 'end'; }
  }
  actorByName(id: string): Actor | undefined { return id === 'player' ? this.player : this.actors.get(id); }
  async exec(c: any, who?: string): Promise<string | void> {
    if (c.when !== undefined && !cond(c.when)) return;
    const ui = this.ui;
    if ('say' in c) { await ui.say(c.say, { who: c.who, kind: c.kind }); return; }
    if ('ask' in c) { await ui.say(c.ask, { who: c.who, noWait: true }).then(async (l: any) => { const yes = await ui.yesNo(); l?.destroy(); const r = await this.runScript(yes ? c.yes ?? [] : c.no ?? [], who); if (r === 'end') this.endFlag = true; }); if (this.endFlag) { this.endFlag = false; return 'end'; } return; }
    if ('choose' in c) {
      const ch = c.choose; const l = await ui.say(ch.q, { who: c.who, noWait: true }); const i = await ui.choose(ch.opts, { x: 150, y: 100 - ch.opts.length * 12 - 8, cancel: false }); l?.destroy();
      const r = await this.runScript(ch.branches[i] ?? [], who); return r;
    }
    if ('set' in c) { setFlag(c.set, c.value ?? true); return; }
    if ('unset' in c) { clearFlag(c.unset); return; }
    if ('inc' in c) { incFlag(c.inc, c.n ?? 1); return; }
    if ('if' in c) { const r = await this.runScript(cond(c.if) ? c.then ?? [] : c.else ?? [], who); return r; }
    if ('give' in c) { addItem(c.give, c.n ?? 1); if (!c.quiet) { Audio.jingle(c.key ? 'jingle_key' : 'jingle_item', this.def.bgm); await ui.say(`${G.s.name} received ${c.n && c.n > 1 ? c.n + ' ' : ''}${ITEMS[c.give].name}!`); } return; }
    if ('take' in c) { takeItem(c.take, c.n ?? 1); return; }
    if ('credits' in c) { G.s.credits = Math.max(0, G.s.credits + c.credits); if (c.credits > 0 && !c.quiet) { Audio.sfx('buy'); await ui.say(`Received ${c.credits} CREDITS!`); } return; }
    if ('quest' in c) { if (c.quest === 'start') startQuest(c.id); else if (c.quest === 'complete') completeQuest(c.id); return; }
    if ('warp' in c) { await this.scriptWarp(c); return; }
    if ('face' in c) { const a = this.actorByName(c.face); if (a) this.setFacing(a, c.dir === 'player' ? this.dirToward(a, this.player) : c.dir); return; }
    if ('move' in c) { await this.scriptMove(c); return; }
    if ('show' in c) { const a = this.actors.get(c.show); if (a) { a.visible = true; a.spr.setVisible(true); a.shadow.setVisible(true); } if (c.x !== undefined && a) this.placeActor(a, c.x, c.y, c.dir); return; }
    if ('hide' in c) { const a = this.actors.get(c.hide); if (a) { a.visible = false; a.spr.setVisible(false); a.shadow.setVisible(false); } return; }
    if ('place' in c) { const a = this.actors.get(c.place); if (a) this.placeActor(a, c.x, c.y, c.dir); return; }
    if ('wait' in c) { await wait(this, c.wait); return; }
    if ('shake' in c) { this.cameras.main.shake(c.shake, c.amt ?? 0.008); Audio.sfx('bump'); return; }
    if ('flash' in c) { this.cameras.main.flash(c.flash, 255, 255, 255); return; }
    if ('fade' in c) { if (c.fade === 'out') { this.cameras.main.fadeOut(c.ms ?? 400, 0, 0, 0); await wait(this, (c.ms ?? 400) + 50); } else { this.cameras.main.fadeIn(c.ms ?? 400, 0, 0, 0); await wait(this, (c.ms ?? 400) + 50); } return; }
    if ('glitch' in c) { Audio.sfx('glitch'); this.glitchFx = c.glitch; this.cameras.main.flash(80, 180, 60, 220); await wait(this, c.glitch); return; }
    if ('bgm' in c) { Audio.play(c.bgm); return; }
    if ('sfx' in c) { Audio.sfx(c.sfx); return; }
    if ('jingle' in c) { Audio.jingle(c.jingle, this.def.bgm); if (c.wait) await wait(this, c.wait); return; }
    if ('emote' in c) { const a = this.actorByName(c.emote); if (a) { const e = this.add.image(a.spr.x, a.spr.y - 20, 'alert').setDepth(2000); Audio.sfx('alert'); await wait(this, 600); e.destroy(); } return; }
    if ('title' in c) { await this.titleCard(c.title, c.sub); return; }
    if ('heal' in c) { await this.healScene(c); return; }
    if ('shop' in c) { await shopMenu(this, ui, c.shop); return; }
    if ('vault' in c) { await vaultMenu(this, ui); return; }
    if ('save' in c) { this.persistPosition(); await saveMenu(this, ui); return; }
    if ('rest' in c) { await this.sleepScene(); return; }
    if ('tile' in c) { this.dirty = true; return; }
    if ('rebuild' in c) { this.rebuildTiles(); this.refreshObjects(); return; }
    if ('pickStarter' in c) { await this.pickStarter(c.pickStarter); return; }
    if ('givemon' in c) { await this.giveMon(c.givemon.species, c.givemon.level); return; }
    if ('battle' in c) {
      const res = await this.scriptBattle(c);
      const branch = c.on?.[res]; if (branch) { const r = await this.runScript(branch, who); if (r === 'end') return 'end'; }
      if (res === 'lose') return 'end';
      return;
    }
    if ('run' in c) { return this.runScript(c.run, who); }
    if ('end' in c) return 'end';
    if ('lockdoor' in c) return;
    if ('setmap' in c) { return; }
    if ('puzzle' in c) { await this.puzzle(c); return; }
    if ('text' in c) { ui.toast(c.text); return; }
    if ('evolveCheck' in c) { await this.evolutionCheck(); return; }
    if ('weather' in c) { this.weather = c.weather; this.rain.forEach((r) => r.setVisible(c.weather === 'rain')); return; }
    if ('keys' in c) { return; }
    console.warn('unknown script cmd', c);
  }
  endFlag = false;
  dirToward(a: Actor, b: Actor): Dir { const dx = b.tx - a.tx, dy = b.ty - a.ty; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  placeActor(a: Actor, x: number, y: number, dir?: Dir) { a.tx = x; a.ty = y; a.spr.setPosition(x * T + 8, y * T + 17); a.shadow.setPosition(x * T + 8, y * T + 16); a.home = [x, y]; if (dir) this.setFacing(a, dir); a.visible = true; a.spr.setVisible(true); a.shadow.setVisible(true); }
  async scriptMove(c: any) {
    const a = this.actorByName(c.move); if (!a) return;
    const toks = (c.path as string).trim().split(/\s+/);
    const map: Record<string, Dir> = { u: 'up', d: 'down', l: 'left', r: 'right' };
    const seq: Dir[] = [];
    for (const t of toks) { const d = map[t[0]]; const n = parseInt(t.slice(1) || '1'); for (let i = 0; i < n; i++) seq.push(d); }
    const dur = c.slow ? 260 : c.fast ? 110 : 180;
    const wasVisible = a.visible; if (!wasVisible) { a.visible = true; a.spr.setVisible(true); a.shadow.setVisible(true); }
    for (const d of seq) await this.walkActor(a, d, dur, true);
    if (c.wait === false) return;
  }
  async scriptWarp(c: any) {
    this.cameras.main.fadeOut(c.ms ?? 250, 0, 0, 0); await wait(this, (c.ms ?? 250) + 30);
    this.loadMap(c.warp, c.x, c.y, c.dir ?? 'down');
    this.cameras.main.fadeIn(c.ms ?? 250, 0, 0, 0); await wait(this, 100);
    if (G.s.settings.autosave && G.slot && !c.noSave) { this.persistPosition(); writeSlot(G.slot); }
  }
  async titleCard(title: string, sub?: string) {
    const L = this.ui.layer(); this.ui.rect(L, 0, 0, 240, 160, '#000000');
    const t = this.ui.textC(L, 120, 64, title, '#ffffff'); t.setScale(2); t.x = 120 - (title.length * 12) / 2;
    if (sub) this.ui.textC(L, 120, 92, sub, '#8a90d0');
    await wait(this, 2200); L.destroy();
  }
  async healScene(c: any) {
    Audio.jingle('jingle_heal'); const L = this.ui.layer(); this.ui.rect(L, 0, 0, 240, 160, '#ffffff', 0); 
    const r = L.objs[0] as Phaser.GameObjects.Rectangle; this.tweens.add({ targets: r, alpha: 0.6, duration: 400, yoyo: true, repeat: 1 });
    await wait(this, 1700); L.destroy();
    if (G.s.settings.difficulty === 'EXPERT' && !c.free) { /* expert: hub healing costs credits, handled by caller */ }
    healParty(); G.s.lastHeal = { map: G.s.map, x: this.player.tx, y: this.player.ty + 1 };
  }
  async puzzle(c: any) {
    // generic helper puzzles implemented as flag logic in data; hook for custom named puzzles
    if (c.puzzle === 'relay_plate') {
      const order: string[] = (flag('relay_seq') ? String(G.s.flags['relay_seq']).split(',') : []);
      const want = ['tri', 'cir', 'sq'];
      if (flag(`relay_plate_${c.id}`)) return;
      Audio.sfx('select');
      if (want[order.length] === c.id) {
        order.push(c.id); setFlag(`relay_plate_${c.id}`); setFlag('relay_seq', order.join(',')); this.rebuildTiles(); this.refreshObjects();
        if (order.length === 3) {
          Audio.sfx('power'); this.cameras.main.shake(700, 0.006); await wait(this, 500);
          setFlag('relay_puzzle_solved'); this.rebuildTiles(); this.refreshObjects(); this.cameras.main.flash(300, 120, 255, 255);
          await this.ui.say('The signal flows through the tower. A heavy gate to the north slides open!');
        }
      } else {
        Audio.sfx('error'); this.glitchFx = 500; this.cameras.main.shake(300, 0.01);
        for (const p of want) clearFlag(`relay_plate_${p}`); clearFlag('relay_seq'); this.rebuildTiles(); this.refreshObjects();
        await this.ui.say('The plates flicker and reset. Wrong order!');
        if (Math.random() < 0.4 && G.s.party.length) { await this.startWild({ s: 'rustbot', min: 3, max: 4 }); }
      }
    } else if (c.puzzle === 'valve') {
      // valve n flips lanes per table in map data
      const flips: Record<string, number[]> = { v1: [1, 2], v2: [2, 3], v3: [3] };
      Audio.sfx('valve');
      for (const lane of flips[c.id]) { const k = `lane_${lane}`; if (flag(k)) clearFlag(k); else setFlag(k); }
      this.rebuildTiles(); this.refreshObjects();
      const all = flag('lane_1') && flag('lane_2') && flag('lane_3');
      if (all && !flag('node1_valves_done')) { setFlag('node1_valves_done'); Audio.sfx('power'); this.cameras.main.shake(500, 0.005); await wait(this, 400); this.rebuildTiles(); await this.ui.say('Water surges down all three channels in sync! The control room door unlocks.'); }
      else if (!all && flag('node1_valves_done')) { clearFlag('node1_valves_done'); this.rebuildTiles(); }
    }
  }

  // ====================== BATTLE GLUE ======================
  buildBattleConfig(kind: 'wild' | 'trainer' | 'boss', enemy: Bytekin[], ai: any, extra: Partial<BattleConfig> = {}): BattleConfig {
    let aiLevel = ai;
    if (G.s.settings.difficulty === 'EXPERT') aiLevel = ai === 'random' ? 'basic' : 'smart';
    if (G.s.settings.difficulty === 'CASUAL' && ai === 'smart') aiLevel = 'basic';
    return { kind, player: G.s.party, enemy, difficulty: G.s.settings.difficulty, ai: aiLevel, rootKeys: rootKeys(), levelCap: levelCap(rootKeys()), partyExp: G.s.settings.partyExp, ...extra };
  }
  runBattleScene(data: any): Promise<{ result: BattleResult; enemy: Bytekin[]; leveled: boolean }> {
    return new Promise((resolve) => {
      this.cameras.main.fadeOut(1, 0, 0, 0);
      this.scene.launch('Battle', { ...data, resolve });
      this.scene.sleep();
    });
  }
  bgForMap(): string { return this.def.battleBg ?? (this.def.outdoor === false ? 'relay' : 'grass'); }
  async battleWild(mon: Bytekin, o: { tutorial?: boolean } = {}): Promise<BattleResult> {
    markDex(mon.species, 1);
    const cfg = this.buildBattleConfig('wild', [mon], 'basic', { tutorial: o.tutorial } as any);
    const r = await this.runBattleScene({ cfg, bg: this.bgForMap(), bgm: this.def.battleBgm ?? 'battle_wild', tutorial: o.tutorial });
    this.cameras.main.fadeIn(250, 0, 0, 0);
    return this.finishBattle(r, mon);
  }
  async battleTrainer(tid: string): Promise<BattleResult> {
    const tr = TRAINERS[tid];
    let team: [string, number][] = tr.team;
    if (tr.teamBy) team = tr.teamBy[G.s.starter] ?? Object.values<any>(tr.teamBy)[0];
    const enemy = team.map(([s, l]) => makeMon(s, this.scaleLevel(l), { hidden: false, anomalous: false }));
    enemy.forEach((m) => markDex(m.species, 1));
    const boss = tr.boss ? BOSSES[tr.boss] : null;
    const cfg = this.buildBattleConfig(boss ? 'boss' : 'trainer', enemy, tr.ai ?? 'basic', { trainerName: tr.name, rules: boss?.rules });
    const r = await this.runBattleScene({ cfg, bg: tr.bg ?? this.bgForMap(), bgm: tr.bgm ?? 'battle_rival', trainer: { name: tr.name, look: tr.look, cls: tr.cls }, boss: boss ? { intro: boss.intro, title: boss.title } : null });
    this.cameras.main.fadeIn(250, 0, 0, 0);
    const res = await this.finishBattle(r, null);
    if (res === 'win') { G.s.credits += tr.reward ?? 0; if (tr.reward) { Audio.sfx('buy'); await this.ui.say(`${G.s.name} got ${tr.reward} CREDITS for winning!`); } }
    return res;
  }
  async scriptBattle(c: any): Promise<BattleResult> {
    let res: BattleResult;
    if (c.battle === 'wild') { const mon = makeMon(c.species, c.level, { hidden: false, anomalous: false }); if (c.stab) (mon as any)._stab = c.stab; res = await this.battleWild(mon, { tutorial: c.tutorial }); await this.afterBattle(res, true); }
    else {
      const tid = c.battle; const tr = TRAINERS[tid];
      if (tr.pre && !c.skipPre) await this.ui.say(tr.pre, { who: tr.name });
      res = await this.battleTrainer(tid);
      if (res === 'win') { if (!G.s.trainersBeaten.includes(tid)) G.s.trainersBeaten.push(tid); setFlag(`tr_${tid}`); if (tr.win && !c.skipWin) await this.ui.say(tr.win, { who: tr.name }); await this.afterBattle(res, true); }
      else if (res === 'lose') { if (c.retry) { await this.whiteout(); return 'lose'; } await this.whiteout(); }
    }
    return res;
  }
  async finishBattle(r: { result: BattleResult; enemy: Bytekin[]; leveled: boolean }, wild: Bytekin | null): Promise<BattleResult> {
    G.s.stats.battles++;
    if (r.result === 'win') G.s.stats.wins++;
    if (r.result === 'contained' && wild) {
      const where = addMon(wild);
      Audio.jingle('jingle_victory', this.def.bgm);
      await this.ui.say(`${displayName(wild)} was ${where === 'party' ? 'added to your party' : 'sent to the Byte Vault'}!`);
      if (!questDone('x') ) { /* quest refresh happens in addMon */ }
    }
    refreshQuests();
    return r.result;
  }
  async afterBattle(res: BattleResult, noWhiteout = false) {
    if (res === 'lose') { if (!noWhiteout) await this.whiteout(); return; }
    await this.evolutionCheck();
    if (G.s.settings.autosave && G.slot) { this.persistPosition(); writeSlot(G.slot); }
  }
  async evolutionCheck() {
    for (const m of G.s.party) {
      const to = checkEvolution(m, {}); if (!to) continue;
      await playEvolution(this, this.ui, m, to);
    }
  }
  async whiteout() {
    G.s.stats.faints++;
    this.lockCount++;
    this.cameras.main.fadeOut(600, 0, 0, 0); await wait(this, 700);
    const lose = G.s.settings.difficulty === 'CASUAL' ? 0 : Math.floor(G.s.credits * (G.s.settings.difficulty === 'EXPERT' ? 0.2 : 0.1));
    G.s.credits -= lose; healParty();
    const h = G.s.lastHeal;
    this.loadMap(h.map, h.x, h.y, 'down');
    this.cameras.main.fadeIn(600, 0, 0, 0);
    await wait(this, 600);
    await this.ui.say(`${G.s.name} blacked out...${lose ? ` Dropped ${lose} CREDITS.` : ''} Your Bytekin were patched up.`);
    this.lockCount--;
  }

  // ====================== STORY HELPERS ======================
  async pickStarter(species: string) {
    const counter: Record<string, string> = { nullcat: 'segbyte', segbyte: 'bitbird', bitbird: 'nullcat' };
    giveStarter(species); G.s.rivalStarter = counter[species];
    setFlag('starter_selected'); setFlag(`starter_${species}`);
    markDex(species, 2); markDex(counter[species], 1);
    this.refreshObjects();
  }
  async giveMon(species: string, level: number) { const m = makeMon(species, level); const where = addMon(m); await this.ui.say(`${displayName(m)} joined ${where === 'party' ? 'your party' : 'the Byte Vault'}!`); }

  // ====================== MENU ======================
  async openMenu() {
    if (this.busy) return;
    this.lockCount++; Audio.sfx('select');
    const items = ['BYTE', 'BAG', 'BYTEDEX', 'QUESTS', 'MAP', 'DEBUGGER', 'SAVE', 'OPTIONS', 'TITLE'];
    let idx = 0;
    for (;;) {
      const c = await this.ui.choose(items, { x: 146, y: 2, w: 92, start: idx, title: undefined });
      if (c < 0) break; idx = c;
      const it = items[c];
      if (it === 'BYTE') await partyMenu(this, this.ui, {});
      else if (it === 'BAG') await bagMenu(this, this.ui);
      else if (it === 'BYTEDEX') await dexMenu(this, this.ui);
      else if (it === 'QUESTS') await questMenu(this, this.ui);
      else if (it === 'MAP') await mapMenu(this, this.ui);
      else if (it === 'DEBUGGER') await debuggerMenu(this, this.ui);
      else if (it === 'SAVE') { this.persistPosition(); await saveMenu(this, this.ui); }
      else if (it === 'OPTIONS') { await openOptions(this, this.ui, true); this.updateTint(); }
      else if (it === 'TITLE') { if (await this.confirmQuit()) { this.persistPosition(); if (G.slot && G.s.settings.autosave) writeSlot(G.slot); Audio.stop(); this.lockCount--; this.scene.start('Title'); return; } }
      await this.evolutionCheck();
    }
    this.lockCount--;
  }
  async confirmQuit() { const L = this.ui.layer(); this.ui.win(L, 40, 60, 160, 36); this.ui.text(L, 50, 68, 'RETURN TO TITLE?', INK); this.ui.text(L, 50, 80, 'UNSAVED PROGRESS IS LOST.', DIM); const c = await this.ui.choose(['NO', 'YES'], { x: 150, y: 96, w: 48 }); L.destroy(); return c === 1; }

  // ====================== TINT / DEBUG ======================
  phase = '';
  updateTint() {
    const ph = timeOfDay(); if (ph !== this.phase) { if (this.phase) this.dirty = true; this.phase = ph; }
    if (!this.tint) return;
    const indoor = this.def.outdoor === false;
    let col = 0xffffff; const t = timeOfDay();
    if (!indoor) { if (t === 'evening') col = 0xffd8b0; else if (t === 'night') col = 0x7888c8; else if (t === 'morning') col = 0xfff0e0; if (this.weather === 'rain') col = (col & 0xf0f0f0) - 0x101018; }
    if (this.def.tint) col = parseInt(this.def.tint.slice(1), 16);
    this.tint.setFillStyle(col, 1);
  }
  toggleDebug() { this.debugOn = !this.debugOn; if (!this.debugText) this.debugText = this.add.bitmapText(2, 2, 'px', '').setScrollFactor(0).setDepth(1500).setTint(0x30ff80); this.debugText.setVisible(this.debugOn); }
  updateDebug() {
    const p = this.player; const flags = Object.keys(G.s.flags).filter((k) => G.s.flags[k]).slice(-6).join(',');
    this.debugText?.setText([`FPS ${Math.round(this.game.loop.actualFps)} MAP ${this.def.id}`, `POS ${p.tx},${p.ty} ${p.dir}`, `TIME ${timeOfDay()} WX ${this.weather}`, `KEYS ${rootKeys()} PARTY ${G.s.party.length}`, `FLAGS ${flags}`].join('\n'));
  }
  debugApi() {
    const self = this;
    return {
      warp(map: string, x: number, y: number) { self.loadMap(map, x, y, 'down'); },
      flag(k: string, v = true) { setFlag(k, v); },
      give(id: string, n = 1) { addItem(id, n); },
      mon(species: string, level = 5) { addMon(makeMon(species, level)); },
      level(i: number, lv: number) { const m = G.s.party[i]; if (m) { m.level = lv; m.exp = lv ** 3; m.hp = maxHp(m); } },
      noEncounters(v = true) { self.noEnc = v; },
      levelAll(lv: number) { for (const m of G.s.party) { m.level = lv; m.exp = lv ** 3; m.hp = maxHp(m); } },
      heal() { healParty(); }, keys(n: number) { for (let i = 1; i <= 8; i++) { if (i <= n) G.s.bag[`root_key_0${i}`] = 1; else delete G.s.bag[`root_key_0${i}`]; } },
      battle(species: string, level = 5) { void self.startWild({ s: species, min: level, max: level }); },
      time(h: number) { G.s.clock = Math.floor(G.s.clock / 1440) * 1440 + h * 60; self.updateTint(); },
      quest(id: string) { completeQuest(id); },
      state() { return { map: self.def.id, x: self.player.tx, y: self.player.ty, dir: self.player.dir, busy: self.busy, moving: self.player.moving, battle: self.scene.isActive('Battle'), hp: G.s.party.map((m) => m.hp + '/' + maxHp(m)), flags: Object.keys(G.s.flags).filter((k) => G.s.flags[k]) }; },
      /** BFS next step toward a tile (test bot / debug helper). */
      nextDir(tx: number, ty: number): string | null {
        const w = self.cm.w, h = self.cm.h; const sx = self.player.tx, sy = self.player.ty;
        if (sx === tx && sy === ty) return null;
        const prev = new Map<number, number>(); const q = [sy * w + sx]; prev.set(q[0], -1);
        const D: [string, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
        while (q.length) {
          const cur = q.shift()!; const cx = cur % w, cy = (cur / w) | 0;
          if (cx === tx && cy === ty) break;
          for (const [, dx, dy] of D) {
            const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const k = ny * w + nx; if (prev.has(k)) continue;
            const goal = nx === tx && ny === ty;
            const g = self.groundAt(nx, ny);
            if (g?.ledge && dy !== 1) continue;
            if (!goal && !self.canEnter(nx, ny)) continue;
            if (goal && isSolidAt(self.cm, nx, ny)) continue;
            prev.set(k, cur); q.push(k);
          }
        }
        const gk = ty * w + tx; if (!prev.has(gk)) return null;
        let c = gk; while (prev.get(c) !== sy * w + sx) { c = prev.get(c)!; if (c === undefined || c === -1) return null; }
        const dx = (c % w) - sx, dy = ((c / w) | 0) - sy;
        return dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
      },
      scene: self, G,
    };
  }
}
void SLOTS; void TILE_INDEX; void healFull; void partyAlive; void INK;
