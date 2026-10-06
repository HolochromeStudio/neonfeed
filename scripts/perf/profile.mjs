// Headless runtime profile (A16).
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/perf/profile.mjs [--dev] [--throttle=4] [--idle=4000] [--loops=3] [--gfxprobe] [--json=path]
//
// Builds the production bundle into scripts/perf/out/dist (never touches ./dist), serves it with vite preview,
// opens it in chromium at 360x640 DPR 2 with CDP CPU throttling (default 4x), then walks:
//   menu (idle) -> run map (idle) -> duel (real pointer input, WIN) -> reward (idle, pick a card)
// and then replays `--loops` extra practice duels to look for leaks (textures, display objects, JS heap after GC).
//
// Recorded per scene segment: requestAnimationFrame deltas (p50/p95/p99/max, dropped-frame %), long tasks (>50 ms),
// JS heap, DOM node count, canvas size/renderer, texture count + estimated texture memory (w*h*4), display-list size.
//
// HONESTY NOTE: headless chromium renders with a software GL (SwiftShader) or the 2D canvas path. That is NOT a mobile
// GPU. CPU throttling approximates a slower main thread, not fill-rate, thermal limits or driver behaviour. Use the
// numbers to compare scenes and spot hot spots (and to compare before/after a change on this same machine); do not
// quote them as device FPS. Validate on real hardware (Android mid-range + older iPhone) via remote debugging.
import { build, preview } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'scripts/perf/out');
fs.mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const THROTTLE = Number(args.throttle ?? 4);
const IDLE_MS = Number(args.idle ?? 4000);
const LOOPS = Number(args.loops ?? 3);
const FRAME_MS = 1000 / 60;

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  return createRequire('/opt/node-tools/node_modules/')('playwright');
}
const { chromium } = await loadPlaywright();

let server;
let base;
if (args.dev) {
  const { createServer } = await import('vite');
  server = await createServer({ root: ROOT, server: { port: 5197, strictPort: false }, logLevel: 'error' });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
} else {
  const outDir = path.join(OUT, 'dist');
  await build({ root: ROOT, logLevel: 'error', build: { outDir, emptyOutDir: true } });
  server = await preview({ root: ROOT, build: { outDir }, preview: { port: 5196, strictPort: false } });
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, p) => (sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
const r2 = (n) => Math.round(n * 100) / 100;

// Runs in the page before any script: rAF delta recorder + long task observer, bucketed by window.__perfLabel.
const INIT = () => {
  const P = (window.__perf = { frames: {}, long: {}, last: 0 });
  window.__perfLabel = 'boot';
  const tick = (t) => {
    if (P.last) (P.frames[window.__perfLabel] ??= []).push(t - P.last);
    P.last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (P.long[window.__perfLabel] ??= []).push(e.duration);
    }).observe({ entryTypes: ['longtask'] });
  } catch { /* longtask unsupported */ }
};

/** Scene/texture/display-list stats evaluated inside the page. */
const STATS = () => {
  const r = (n) => Math.round(n * 100) / 100;
  const g = window.__neonfeed.game;
  const tm = g.textures;
  let texBytes = 0, texCount = 0, pxTex = 0, pxBytes = 0, canvasTex = 0;
  const big = [];
  for (const key of tm.getTextureKeys()) {
    if (key === '__DEFAULT' || key === '__MISSING' || key === '__WHITE' || key === '__NORMAL') continue;
    const t = tm.get(key);
    const src = t.source && t.source[0];
    if (!src) continue;
    const bytes = src.width * src.height * 4;
    texCount++; texBytes += bytes;
    if (key.startsWith('px|')) { pxTex++; pxBytes += bytes; }
    if (src.isCanvas) canvasTex++;
    if (bytes > 200000) big.push({ key, w: src.width, h: src.height, kb: Math.round(bytes / 1024) });
  }
  let objects = 0, graphics = 0, cmds = 0, texts = 0;
  const active = [];
  for (const sc of g.scene.getScenes(true)) {
    active.push(sc.sys.settings.key);
    for (const o of sc.children.list) {
      objects++;
      if (o.type === 'Graphics') { graphics++; cmds += o.commandBuffer.length; }
      else if (o.type === 'Text') texts++;
    }
  }
  const canvas = document.querySelector('canvas');
  const mem = performance.memory;
  return {
    activeScenes: active,
    renderer: g.renderer.type === 1 ? 'CANVAS' : g.renderer.type === 2 ? 'WEBGL' : String(g.renderer.type),
    canvas: canvas ? { w: canvas.width, h: canvas.height, cssW: Math.round(canvas.getBoundingClientRect().width), cssH: Math.round(canvas.getBoundingClientRect().height) } : null,
    domNodes: document.getElementsByTagName('*').length,
    textures: { count: texCount, canvasTextures: canvasTex, pixelTextTextures: pxTex, estMB: r(texBytes / 1048576), pixelTextMB: r(pxBytes / 1048576), big },
    displayList: { objects, graphics, graphicsCommands: cmds, texts },
    tweens: g.scene.getScenes(true).reduce((n, s) => n + s.tweens.getTweens().length, 0),
    jsHeapMB: mem ? r(mem.usedJSHeapSize / 1048576) : null,
    phaserFps: r(g.loop.actualFps),
  };
};

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const report = { when: new Date().toISOString(), throttle: THROTTLE, viewport: '360x640@2x', mode: args.dev ? 'dev' : 'production build', scenes: {}, stats: {}, leak: [] };

try {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => { errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(INIT);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const label = (l) => page.evaluate((x) => { window.__perfLabel = x; }, l);
  const stats = async (l) => { report.stats[l] = await page.evaluate(STATS); };
  const heap = async (gc) => {
    if (gc) await cdp.send('HeapProfiler.collectGarbage');
    const h = await cdp.send('Runtime.getHeapUsage');
    return r2(h.usedSize / 1048576);
  };
  const waitScene = (key, timeout = 20000) => page.waitForFunction((k) => window.__neonfeed?.flow.current === k && window.__neonfeed.game.scene.getScene(k)?.sys.settings.status === 5, key, { timeout });
  const hits = () => page.evaluate(() => { const sc = window.__neonfeed.game.scene.getScenes(true)[0]; return (sc.hits ?? []).map((h) => ({ label: h.label, ...h.rect })); });
  const toPage = (x, y) => page.evaluate(([lx, ly]) => { const b = document.querySelector('canvas').getBoundingClientRect(); return { x: b.left + (lx / 360) * b.width, y: b.top + (ly / 640) * b.height }; }, [x, y]);
  const tap = async (x, y) => { const p = await toPage(x, y); await page.mouse.click(p.x, p.y); };
  const tapLabel = async (l) => {
    const h = (await hits()).find((q) => q.label === l || q.label.startsWith(l));
    if (!h) throw new Error(`no hit ${l}`);
    await tap(h.x + h.w / 2, h.y + h.h / 2);
  };

  /** --gfxprobe: re-measure the current UI scene with every Graphics object hidden = upper bound of what baking static Graphics to textures can save. */
  const gfxProbe = async (lab) => {
    if (!args.gfxprobe) return;
    await page.evaluate(() => { for (const sc of window.__neonfeed.game.scene.getScenes(true)) for (const o of sc.children.list) if (o.type === 'Graphics') { o.__wasVisible = o.visible; o.setVisible(false); } });
    await label(`${lab}-NOGFX`); await sleep(IDLE_MS);
    await page.evaluate(() => { for (const sc of window.__neonfeed.game.scene.getScenes(true)) for (const o of sc.children.list) if (o.type === 'Graphics') o.setVisible(o.__wasVisible !== false); });
  };

  async function playDuel(lab) {
    await page.waitForFunction(() => window.__duel !== undefined && window.__duel.scene.sys.settings.status === 5, null, { timeout: 20000 });
    await label(lab);
    await stats(`${lab}:start`);
    const phaseIs = (ph, timeout = 25000) => page.waitForFunction((p) => window.__duel?.snapshot().phase === p, ph, { timeout, polling: 'raf' });
    const start = await toPage(180, 568);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await phaseIs('CUE');
    await stats(`${lab}:cue`);
    const a = await toPage(180, 530), b = await toPage(180, 490);
    await page.mouse.move(a.x, a.y, { steps: 2 });
    await page.mouse.move(b.x, b.y, { steps: 2 });
    await phaseIs('AIM');
    for (let shots = 0; shots < 8; shots++) {
      const aim = await toPage(250, 364);
      await page.mouse.move(aim.x, aim.y, { steps: 2 });
      await sleep(60);
      await page.mouse.up();
      await sleep(40);
      const ph = await page.evaluate(() => window.__duel.snapshot().phase);
      if (ph === 'RESOLVE' || ph === 'RETRY') break;
      await page.waitForFunction(() => ['AIM', 'RESOLVE', 'RETRY'].includes(window.__duel?.snapshot().phase), null, { timeout: 8000, polling: 'raf' });
      const again = await toPage(250, 364);
      await page.mouse.move(again.x, again.y);
      await page.mouse.down();
    }
    await phaseIs('RETRY');
    await sleep(600); // result panel on screen
    await stats(`${lab}:result`);
  }

  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.__neonfeed !== undefined, null, { timeout: 30000 });
  await waitScene('MainMenu');
  await sleep(500);

  await label('menu'); await sleep(IDLE_MS); await stats('menu'); await gfxProbe('menu');
  await tapLabel('duel');
  await waitScene('RunMap');
  await sleep(300);
  await label('map'); await sleep(IDLE_MS); await stats('map'); await gfxProbe('map');
  await tapLabel('go:');
  await waitScene('Duel');
  await playDuel('duel');
  await label('duel-result'); await sleep(1000);
  await tap(180, 568); // continue
  await waitScene('Reward');
  await sleep(300);
  await label('reward'); await sleep(IDLE_MS); await stats('reward'); await gfxProbe('reward');
  const card = (await hits()).find((h) => h.label.startsWith('card:'));
  if (card) { await tap(card.x + card.w / 2, card.y + card.h / 2); await sleep(300); await label('reward-selected'); await sleep(IDLE_MS / 2); await stats('reward-selected'); }

  // ---- leak loop: repeated practice duels via the debug handle (same path as the playthrough scripts)
  const s0 = await page.evaluate(STATS);
  report.leak.push({ loop: 0, heapAfterGcMB: await heap(true), texCount: s0.textures.count, pixelTextTextures: s0.textures.pixelTextTextures, texEstMB: s0.textures.estMB, objects: s0.displayList.objects, tweens: s0.tweens });
  for (let i = 1; i <= LOOPS; i++) {
    await label(`loop${i}`);
    await page.evaluate(() => {
      const g = window.__neonfeed.game;
      for (const s of g.scene.getScenes(true)) if (s.sys.settings.key !== 'Duel') g.scene.stop(s.sys.settings.key);
      delete window.__duel;
      g.scene.start('Duel', { mode: 'practice', seed: 1344, arenaId: 'dust_creek', enemyId: 'bandit', difficulty: 0.3 });
    });
    await playDuel(`loop${i}`);
    const s = await page.evaluate(STATS);
    report.leak.push({ loop: i, heapAfterGcMB: await heap(true), texCount: s.textures.count, pixelTextTextures: s.textures.pixelTextTextures, texEstMB: s.textures.estMB, objects: s.displayList.objects, tweens: s.tweens });
  }

  // ---- summarise
  const raw = await page.evaluate(() => window.__perf);
  for (const [lab, frames] of Object.entries(raw.frames)) {
    if (lab === 'boot' || frames.length < 20) continue;
    const f = frames.slice(2); // drop first two frames after a label switch
    const sorted = [...f].sort((a, b) => a - b);
    const total = f.reduce((s, x) => s + x, 0);
    const missed = f.reduce((s, x) => s + Math.max(0, Math.round(x / FRAME_MS) - 1), 0);
    const longs = raw.long[lab] ?? [];
    report.scenes[lab] = {
      frames: f.length,
      avgFps: r2((f.length / total) * 1000),
      p50: r2(pct(sorted, 50)), p95: r2(pct(sorted, 95)), p99: r2(pct(sorted, 99)), max: r2(sorted[sorted.length - 1]),
      droppedFramePct: r2((missed / (missed + f.length)) * 100),
      over33msPct: r2((f.filter((x) => x > 33.4).length / f.length) * 100),
      longTasks: longs.length, longTaskMaxMs: longs.length ? r2(Math.max(...longs)) : 0,
    };
  }

  console.log(`\nNeonfeed runtime profile (${report.mode}, CPU throttle ${THROTTLE}x, 360x640@2x, renderer ${report.stats.menu?.renderer})`);
  console.log('NOTE: headless software rendering - relative hot spots only, not device FPS.\n');
  console.log('scene'.padEnd(18), 'frames', ' avgFps', '   p50', '   p95', '   p99', '   max', ' drop%', ' >33ms%', ' longTasks');
  for (const [k, v] of Object.entries(report.scenes)) {
    console.log(k.padEnd(18), String(v.frames).padStart(6), String(v.avgFps).padStart(7), String(v.p50).padStart(6), String(v.p95).padStart(6), String(v.p99).padStart(6), String(v.max).padStart(6), String(v.droppedFramePct).padStart(6), String(v.over33msPct).padStart(7), `${v.longTasks} (max ${v.longTaskMaxMs}ms)`);
  }
  console.log('\nscene stats');
  for (const [k, v] of Object.entries(report.stats)) {
    console.log(k.padEnd(16), `objs ${v.displayList.objects} gfx ${v.displayList.graphics} gfxCmds ${v.displayList.graphicsCommands} texts ${v.displayList.texts} | tex ${v.textures.count} (${v.textures.estMB} MB est, px-text ${v.textures.pixelTextTextures}/${v.textures.pixelTextMB} MB) | heap ${v.jsHeapMB} MB | dom ${v.domNodes} | canvas ${v.canvas?.w}x${v.canvas?.h}`);
  }
  console.log('\nleak loop (heap after forced GC)');
  for (const l of report.leak) console.log(JSON.stringify(l));
  console.log('\npage errors:', errors.length, errors.slice(0, 5));
  report.errors = errors;
  const jsonPath = typeof args.json === 'string' ? path.resolve(args.json) : path.join(OUT, 'profile.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log('wrote', path.relative(ROOT, jsonPath));
} finally {
  await browser.close();
  await new Promise((r) => (server.httpServer ? server.httpServer.close(() => r()) : r()));
}
process.exit(0);
