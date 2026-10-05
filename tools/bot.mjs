// Scripted playtest bot built on the debug API (window.bb). Drives the real game with keyboard input.
import { launch, key, shot } from './browser.mjs';
export async function createBot(opts = {}) {
  const { browser, page, errors } = await launch(opts);
  const P = (ms) => page.waitForTimeout(ms);
  const bot = {
    browser, page, errors, P,
    state: () => page.evaluate(() => window.bb.state()),
    key: (k, ms) => key(page, k, ms),
    shot: (n) => shot(page, n),
    ev: (fn, arg) => page.evaluate(fn, arg),
    /** advance dialogue/menus by mashing A until the world is free again */
    async mash(maxMs = 150000, until) {
      const t0 = Date.now();
      for (;;) {
        const s = await bot.state().catch(() => null);
        if (!s) { await page.evaluate(() => { window.__input.press('a'); setTimeout(() => window.__input.release('a'), 30); }); await P(150); if (Date.now() - t0 > maxMs) throw new Error('mash timeout (no world)'); continue; }
        if (s && !s.busy && !s.battle && !s.moving) { await P(120); const s2 = await bot.state(); if (!s2.busy && !s2.battle) return s2; }
        if (until && s && await until(s)) return s;
        if (Date.now() - t0 > maxMs) throw new Error('mash timeout; state=' + JSON.stringify(s));
        await bot.battleStep();
        await page.evaluate(() => { const w = window; const busy = w.bb && (w.bb.scene.busy || w.bb.scene.scene.isActive('Battle')); if (busy) { w.__input.press('a'); setTimeout(() => w.__input.release('a'), 30); } });
        await P(90);
      }
    },
    /** If a battle command/move menu is open, choose: CONTAIN when the wild target is weak, otherwise FIGHT with the first usable move. */
    async battleStep() {
      const act = await page.evaluate(() => {
        const b = window.__battle; if (!b || !b.scene.isActive() || !b.b) return null;
        const bt = b.b; const wild = bt.cfg.kind === 'wild';
        const hp = bt.e.mon.hp / Math.max(1, (window.__maxHp ? window.__maxHp(bt.e.mon) : 30));
        return { menu: b.menu, wild, over: bt.over, ehp: bt.e.mon.hp, stab: bt.e.stab, cont: b.lastCmd };
      });
      const needSw = await page.evaluate(() => { const b = window.__battle; return !!(b && b.scene.isActive() && b.b && b.b.needSwitch && !b.b.over); });
      if (needSw) { await page.evaluate(() => { const i = window.__input; ['down', 'a'].forEach((k, n) => setTimeout(() => { i.press(k); i.release(k); }, n * 120)); }); await P(350); return; }
      if (!act || !act.menu || act.over) return;
      if (act.menu === 'command') {
        const wantContain = bot.wantContain && act.wild;
        if (wantContain) { await page.evaluate(() => { const i = window.__input; const seq = ['down', 'right', 'a']; seq.forEach((k, n) => setTimeout(() => { i.press(k); i.release(k); }, n * 80)); }); await P(400); }
        else { await page.evaluate(() => { const i = window.__input; i.press('a'); i.release('a'); }); await P(250); }
      } else if (act.menu === 'move') { await page.evaluate(() => { const i = window.__input; i.press('a'); i.release('a'); }); await P(250); }
    },
    wantContain: false,
    async goto(tx, ty, maxMs = 600000) {
      const t0 = Date.now(); const startMap = (await bot.state()).map;
      for (;;) {
        const s = await bot.state();
        if (s.map !== startMap) { await P(350); return await bot.state(); }
        if (s.x === tx && s.y === ty) { await P(350); return await bot.state(); }
        if (s.busy || s.battle) { await bot.mash(); continue; }
        const d = await page.evaluate(([x, y]) => window.bb.nextDir(x, y), [tx, ty]);
        if (!d) throw new Error(`no path to ${tx},${ty} from ${s.x},${s.y} on ${s.map}`);
        const k = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[d];
        await page.keyboard.down(k);
        const sx = s.x, sy = s.y; let n = 0;
        while (n++ < 40) { await P(30); const t = await bot.state(); if (t.x !== sx || t.y !== sy || t.busy || t.battle) break; }
        await page.keyboard.up(k); await P(20);
        if (Date.now() - t0 > maxMs) throw new Error('goto timeout ' + tx + ',' + ty);
      }
    },
    async face(dir) { const k = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]; await bot.key(k, 120); await P(120); },
    async interact(dir) { if (dir) await bot.face(dir); await bot.key('z', 60); await P(150); await bot.mash(); },
    async newGame() {
      await key(page, 'z'); await P(400); await key(page, 'z'); await P(500); await key(page, 'z'); await P(7000);
      await key(page, 'z'); await P(2200); for (let i = 0; i < 5; i++) await key(page, 'ArrowDown');
      await key(page, 'z'); await P(600); await key(page, 'Enter'); await P(1200);
      await bot.mash(15000);
    },
  };
  return bot;
}
