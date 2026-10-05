// Headless arena preview (A11). Renders every arena to scripts/out/arena_<id>.png (+ _overlay.png
// with zone/target rects). Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/arenaPreview.mjs [arenaId...]
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
  const req = createRequire('/opt/node-tools/node_modules/');
  return req('playwright');
}

const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['dust_creek', 'dust_creek_night', 'saloon_interior'];

const { chromium } = await loadPlaywright();
const server = await createServer({ root: ROOT, server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  for (const id of IDS) {
    for (const overlay of [0, 1]) {
      await page.goto(`${base}/scripts/preview/arena.html?arena=${id}&overlay=${overlay}`);
      await page.waitForFunction(() => window.__arenaReady === true, null, { timeout: 15000 });
      await page.waitForTimeout(150);
      const file = path.join(OUT, `arena_${id}${overlay ? '_overlay' : ''}.png`);
      await page.screenshot({ path: file });
      console.log('wrote', path.relative(ROOT, file));
    }
  }
} finally {
  await browser.close();
  await server.close();
}
