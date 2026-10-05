// Headless UI preview (A10). Mounts each UI scene with sample view-models and screenshots it at
// 360x640, 320x568, 412x915 (plus a notch case). Also taps the real buttons and audits hit rects.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/uiPreview.mjs [variant...] [--overlay]
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

const args = process.argv.slice(2);
const withOverlay = args.includes('--overlay');
const ALL = ['menu', 'menu_run', 'reward', 'reward_poor', 'shop', 'shop_poor', 'results_death', 'results_win'];
const variants = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : ALL;
const VIEWPORTS = [
  { name: '360x640', w: 360, h: 640, inset: '' },
  { name: '320x568', w: 320, h: 568, inset: '' },
  { name: '412x915', w: 412, h: 915, inset: '' },
  { name: '360x640notch', w: 360, h: 640, inset: '44,0,34,0' },
  { name: '390x844notch', w: 390, h: 844, inset: '47,0,34,0' },
];

const { chromium } = await loadPlaywright();
const server = await createServer({ root: ROOT, server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
let failures = 0;
const fail = (m) => { failures++; console.error('FAIL', m); };

async function open(page, v, vp, extra = '') {
  const url = `${base}/scripts/preview/ui.html?v=${v}${vp.inset ? `&inset=${vp.inset}` : ''}${extra}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__uiReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(250);
}

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => fail(`pageerror ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') fail(`console ${m.text()}`); });
    for (const v of variants) {
      await open(page, v, vp, '&reduce=1');
      const file = path.join(OUT, `ui_${v}_${vp.name}.png`);
      await page.screenshot({ path: file });
      const audit = await page.evaluate(() => window.__ui.scene.auditUi());
      if (audit.length) fail(`${v} @${vp.name} audit: ${audit.join('; ')}`);
      console.log('wrote', path.relative(ROOT, file), audit.length ? `AUDIT ${audit.length}` : 'audit ok');
      if (withOverlay) {
        await open(page, v, vp, '&reduce=1&overlay=1');
        await page.screenshot({ path: path.join(OUT, `ui_${v}_${vp.name}_overlay.png`) });
      }
    }
    await page.close();
  }

  // ---- interaction smoke test at 360x640 (real pointer taps through Phaser input) --------------
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => fail(`pageerror ${e.message}`));
  const tap = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(120); };
  const events = () => page.evaluate(() => window.__events);
  const hit = (label) => page.evaluate((l) => window.__ui.scene.hits.find((h) => h.label === l)?.rect, label);
  const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];

  await open(page, 'reward', VIEWPORTS[0], '&reduce=1');
  await tap(...center(await hit('card:dust_kick')));
  const ev1 = await events();
  if (!ev1.some((e) => e.name === 'pick' && e.payload === 'dust_kick')) fail(`reward pick not reported: ${JSON.stringify(ev1)}`);
  await tap(...center(await hit('card:hair_trigger')));
  if ((await events()).filter((e) => e.name === 'pick').length !== 1) fail('reward allowed a second pick');
  await page.screenshot({ path: path.join(OUT, 'ui_reward_picked.png') });

  await open(page, 'reward_poor', VIEWPORTS[0], '&reduce=1');
  await tap(...center(await hit('reroll')));
  if ((await events()).some((e) => e.name === 'reroll')) fail('disabled reroll fired');

  await open(page, 'shop', VIEWPORTS[0], '&reduce=1');
  await tap(...center(await hit('buy')));
  if (!(await events()).some((e) => e.name === 'buy' && e.payload === 'luck')) fail('shop buy (<=50, no confirm) not reported');
  await tap(...center(await hit('item:3')));      // Marshal Badge $140, unaffordable at 120 coins
  await tap(...center(await hit('buy')));
  if ((await events()).filter((e) => e.name === 'buy').length !== 1) fail('unaffordable purchase fired');
  await tap(...center(await hit('item:1')));      // Steady Hand $60 needs confirm
  await tap(...center(await hit('buy')));
  if ((await events()).filter((e) => e.name === 'buy').length !== 1) fail('purchase >50 did not need a confirm tap');
  await tap(...center(await hit('buy')));
  if (!(await events()).some((e) => e.name === 'buy' && e.payload === 'aim')) fail('confirmed purchase not reported');
  await page.screenshot({ path: path.join(OUT, 'ui_shop_bought.png') });

  await open(page, 'menu_run', VIEWPORTS[0], '&reduce=1');
  await tap(...center(await hit('new_run')));
  await page.screenshot({ path: path.join(OUT, 'ui_menu_confirm.png') });
  if ((await events()).some((e) => e.name === 'action')) fail('new_run fired without confirm');
  await tap(...center(await hit('confirm-yes')));
  if (!(await events()).some((e) => e.name === 'action' && e.payload === 'new_run')) fail('new_run not reported after confirm');

  await open(page, 'results_death', VIEWPORTS[0], '&reduce=1');
  await tap(...center(await hit('retry')));
  if (!(await events()).some((e) => e.name === 'action' && e.payload === 'retry')) fail('results retry not reported');
  await page.close();
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `${failures} FAILURE(S)` : 'ALL OK');
process.exit(failures ? 1 : 0);
