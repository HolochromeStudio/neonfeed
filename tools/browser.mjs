// Headless playtest helper. Usage: node tools/browser.mjs  (expects vite dev server on :5173)
import { chromium } from 'playwright-core';
export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 960, height: 640 }, hasTouch: opts.touch ?? false, isMobile: opts.mobile ?? false, deviceScaleFactor: opts.dpr ?? 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text()); });
  await page.goto(`http://127.0.0.1:4173/${opts.query ?? ''}`);
  try { await page.waitForFunction(() => window.__game && window.__game.scene.scenes.length > 0, null, { timeout: 15000 }); } catch (e) { console.log('LOAD FAIL', errors.join('\n')); throw e; }
  await page.waitForTimeout(800);
  return { browser, page, errors };
}
export const key = async (page, k, ms = 60) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(40); };
export const shot = (page, name) => page.screenshot({ path: `.scratch/${name}.png` });
