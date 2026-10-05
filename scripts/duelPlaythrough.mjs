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
const browser = await chromium.launch();
const errors = [];
const shot = async (page, name) => page.screenshot({ path: path.join(OUT, `play_${name}.png`) });
const phaseIs = (page, ph, timeout = 15000) => page.waitForFunction((p) => window.__duel?.snapshot().phase === p, ph, { timeout, polling: 'raf' });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('console', m.text()); } });
  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.__duel !== undefined, null, { timeout: 15000 });
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
  console.log('page errors:', errors.length);
} finally {
  await browser.close();
  await server.close();
}
process.exit(errors.length ? 1 : 0);
