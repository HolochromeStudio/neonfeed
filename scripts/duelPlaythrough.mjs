// Headless full-duel check (A02). Dust Creek vs Bandit: WAIT -> CUE -> flick -> aim -> shot -> WIN, then a loss + retry.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/duelPlaythrough.mjs
// Writes scripts/out/play_*.png and prints loss-to-next-WAIT timings.
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts/out');
fs.mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  return createRequire('/opt/node-tools/node_modules/')('playwright');
}
const { chromium } = await loadPlaywright();
const server = await createServer({ root: ROOT, server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
/** main.ts boots the full game flow: start a practice duel (Dust Creek vs Bandit, free retry) straight from the debug handle. */
async function startDuel(page, extra = {}) {
  await page.waitForFunction(() => window.__neonfeed !== undefined && (window.__neonfeed.game.scene.isActive('MainMenu') || window.__duel !== undefined), null, { timeout: 15000 });
  await page.evaluate((data) => {
    const g = window.__neonfeed.game;
    if (g.scene.isActive('MainMenu')) g.scene.stop('MainMenu');
    delete window.__duel;
    g.scene.start('Duel', { mode: 'practice', seed: 1337, arenaId: 'dust_creek', enemyId: 'bandit', difficulty: 0.3, ...data });
  }, extra);
  await page.waitForFunction(() => window.__duel !== undefined && window.__duel.scene.sys.settings.status === 5, null, { timeout: 15000 });
  const rect = await page.evaluate(() => { const b = document.querySelector('canvas').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  if (Math.abs(rect.l) > 0.5 || Math.abs(rect.t) > 0.5 || Math.abs(rect.w - 360) > 0.5) throw new Error(`canvas is not 1:1 at 360x640: ${JSON.stringify(rect)}`);
}
const browser = await chromium.launch();
const errors = [];
const shot = async (page, name) => page.screenshot({ path: path.join(OUT, `play_${name}.png`) });
const phaseIs = (page, ph, timeout = 15000) => page.waitForFunction((p) => window.__duel?.snapshot().phase === p, ph, { timeout, polling: 'raf' });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('console', m.text()); } });
  await page.goto(`${base}/`);
  await startDuel(page);
  await page.evaluate(() => {
    const d = window.__duel.system;
    window.__log = [];
    for (const n of ['onResolve', 'onRetry', 'onCue', 'onDraw', 'onPhase']) d.events.on(n, (e) => window.__log.push({ n, at: performance.now(), e }));
  });
  const info = await page.evaluate(() => {
    const s = window.__duel.scene; return { enemy: s.enemyDef.name, fake: s.opponentCtl.fakeTell ?? null, plan: window.__duel.system.plan, hp: window.__duel.snapshot().enemyMaxHp };
  });
  console.log('setup', JSON.stringify(info));
  await page.waitForTimeout(300);
  await shot(page, '1_wait');

  // ---- WIN: hold the holster, flick on the cue, aim at the head, release
  await page.mouse.move(180, 568);
  await page.mouse.down();
  await phaseIs(page, 'CUE');
  await page.waitForTimeout(40);
  await shot(page, '2_cue');
  await page.mouse.move(180, 530, { steps: 2 });
  await page.mouse.move(180, 490, { steps: 2 });
  await phaseIs(page, 'AIM');
  await page.mouse.move(250, 364, { steps: 2 });
  await page.waitForTimeout(60);
  await shot(page, '3_aim');
  await page.mouse.up();
  await page.waitForTimeout(25);
  await shot(page, '4_shot');
  await phaseIs(page, 'RETRY');
  await shot(page, '5_win');
  const win = await page.evaluate(() => window.__duel.system.lastResult);
  console.log('WIN?', win.outcome, 'reaction', Math.round(win.reactionMs), 'tier', win.tier);

  // ---- LOSS + RETRY: tap retry (in the holster zone), hold, never draw
  await page.mouse.click(180, 568);
  await page.waitForFunction(() => window.__duel.snapshot().attempt === 2, null, { timeout: 3000 });
  await page.mouse.move(180, 568);
  await page.mouse.down();
  await phaseIs(page, 'CUE');
  await phaseIs(page, 'RESOLVE');
  await page.waitForTimeout(40);
  await shot(page, '6_loss');
  await phaseIs(page, 'RETRY');
  await shot(page, '7_retry');
  await page.mouse.up();
  await page.evaluate(() => { window.__log.length = 0; });
  const losses = [];
  for (let i = 0; i < 5; i++) {
    // lose again quickly, then measure resolve -> retry button -> next WAIT with an immediate tap
    await page.mouse.down();
    await phaseIs(page, 'RESOLVE', 20000);
    await page.mouse.up();
    await phaseIs(page, 'RETRY');
    await page.mouse.click(180, 568);
    await page.waitForFunction(() => window.__log.some((l) => l.n === 'onRetry'), null, { timeout: 3000 });
    const t = await page.evaluate(() => {
      const r = window.__log.find((l) => l.n === 'onResolve').at;
      const rt = window.__log.find((l) => l.n === 'onRetry').at;
      const ph = window.__log.filter((l) => l.n === 'onPhase' && l.e.phase === 'WAIT').pop();
      window.__log.length = 0;
      return { resolveToRetry: rt - r, resolveToWaitPhase: ph ? ph.at - r : null };
    });
    losses.push(t);
  }
  console.log('loss -> next WAIT (ms, real clock, tap issued as soon as RETRY is seen):', JSON.stringify(losses.map((l) => Math.round(l.resolveToRetry))));
  await page.waitForTimeout(150);
  await shot(page, '8_after_retry');

  // ---- DODGE (D18) on a fresh page: do not draw; flick sideways when the muzzle raise opens the window, then counter-shoot
  const dodgeSetup = async () => {
    await page.reload();
    await page.waitForFunction(() => window.__duel === undefined && window.__neonfeed?.game.scene.isActive('MainMenu'), null, { timeout: 15000 });
    await startDuel(page);
    await page.evaluate(() => {
      const d = window.__duel.system;
      window.__dodges = [];
      d.events.on('onDodge', (e) => window.__dodges.push(e));
      d.events.on('onMiss', (e) => { if (e.shooter === 'enemy') window.__dodges.push({ miss: e.evaded ?? 'natural' }); });
    });
    await page.waitForTimeout(250);
  };
  const flick = async (dx) => { await page.mouse.move(180 + dx * 0.33, 568); await page.mouse.move(180 + dx * 0.66, 568); await page.mouse.move(180 + dx, 568); };
  const openWindow = () => page.waitForFunction(() => window.__duel.snapshot().dodge.open, null, { timeout: 15000, polling: 'raf' });
  const state = () => page.evaluate(() => ({ events: window.__dodges.map((d) => d.result ?? `miss:${d.miss}`), dodge: window.__duel.snapshot().dodge, phase: window.__duel.snapshot().phase, hp: window.__duel.snapshot().heroHp }));

  // 1) EARLY dodge: costs a stumble (TOO EARLY), the shot lands and costs a life
  await dodgeSetup();
  await page.mouse.move(180, 568);
  await page.mouse.down();
  await phaseIs(page, 'CUE');
  await page.waitForTimeout(30);
  await flick(-150);
  await page.waitForTimeout(60);
  await shot(page, '9_dodge_early');
  const early = await state();
  console.log('EARLY dodge ->', JSON.stringify(early));
  if (early.events[0] !== 'early') throw new Error('expected an early dodge');
  await page.mouse.up();

  // 1b) the window prompt (muzzle-raise glint + DODGE NOW), no flick: the shot lands
  await dodgeSetup();
  await page.mouse.move(180, 568);
  await page.mouse.down();
  await phaseIs(page, 'CUE');
  await openWindow();
  await shot(page, '10_dodge_window');
  await page.mouse.up();

  // 2) GOOD dodge: wait for the window, flick at once (no screenshot first: it would eat the window), side-step + puff,
  // the shot misses, counter draw, head shot
  await dodgeSetup();
  await page.mouse.move(180, 568);
  await page.mouse.down();
  await phaseIs(page, 'CUE');
  await openWindow();
  await flick(-150);
  await page.waitForTimeout(50);
  await shot(page, '11_dodge_sidestep');
  const ok = await state();
  console.log('GOOD dodge ->', JSON.stringify(ok));
  if (!ok.events[0] || !['ok', 'perfect'].includes(ok.events[0])) throw new Error(`dodge did not succeed: ${JSON.stringify(ok)}`);
  await page.waitForFunction(() => window.__dodges.some((d) => d.miss === 'dodge'), null, { timeout: 3000 });
  await page.waitForTimeout(40);
  await shot(page, '12_dodged_shot');
  await phaseIs(page, 'AIM');
  await page.mouse.move(250, 364, { steps: 2 });
  await page.waitForTimeout(40);
  await shot(page, '13_dodge_counter_aim');
  await page.mouse.up();
  for (let i = 0; i < 6 && !['RESOLVE', 'RETRY'].includes(await page.evaluate(() => window.__duel.snapshot().phase)); i++) {
    await page.waitForFunction(() => ['AIM', 'RESOLVE', 'RETRY'].includes(window.__duel.snapshot().phase), null, { timeout: 5000, polling: 'raf' });
    await page.mouse.move(250, 364);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(30);
  }
  await phaseIs(page, 'RETRY', 20000);
  await shot(page, '14_dodge_win');
  const dres = await page.evaluate(() => window.__duel.system.lastResult);
  console.log('DODGE run:', dres.outcome, 'dodges', dres.dodges, 'fails', dres.dodgeFails, 'tier', dres.tier, 'hero hp', dres.heroHp);
  if (dres.outcome !== 'WIN' || dres.dodges !== 1) throw new Error('dodge run did not win with one dodge');
  console.log('page errors:', errors.length);
} finally {
  await browser.close();
  await server.close();
}
process.exit(errors.length ? 1 : 0);
