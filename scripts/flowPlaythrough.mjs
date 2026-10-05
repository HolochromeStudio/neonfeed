// Headless flow check (A02): menu -> new run -> first duel WIN -> reward pick -> next node, then reload mid-run and resume.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/flowPlaythrough.mjs
// Writes scripts/out/flow_*.png and prints what each step saw. Real pointer input only (clicks on the registered hit rects).
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
const server = await createServer({ root: ROOT, server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `flow_${name}.png`) });
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Name of the scene the flow is showing (the flow remembers it). */
const current = (page) => page.evaluate(() => window.__neonfeed?.flow.current);
const waitScene = (page, key, timeout = 15000) => page.waitForFunction((k) => window.__neonfeed?.flow.current === k && window.__neonfeed.game.scene.isActive(k) && window.__neonfeed.game.scene.getScene(k)?.sys.settings.status === 5, key, { timeout });
/** Hit rects registered by the active UI scene (label -> {x,y,w,h}) in canvas logical px. */
const hits = (page) => page.evaluate(() => {
  const g = window.__neonfeed.game;
  const sc = g.scene.getScenes(true)[0];
  return { key: sc.sys.settings.key, hits: (sc.hits ?? []).map((h) => ({ label: h.label, ...h.rect })) };
});
/** Logical canvas px -> page px (canvas is centred and zoomed). */
const toPage = (page, x, y) => page.evaluate(([lx, ly]) => {
  const c = document.querySelector('canvas');
  const b = c.getBoundingClientRect();
  return { x: b.left + (lx / 360) * b.width, y: b.top + (ly / 640) * b.height };
}, [x, y]);
const tap = async (page, x, y) => {
  const p = await toPage(page, x, y);
  await page.mouse.click(p.x, p.y);
};
const tapLabel = async (page, label) => {
  const h = await hits(page);
  const r = h.hits.find((q) => q.label === label || q.label.startsWith(label));
  if (!r) throw new Error(`no hit "${label}" in ${h.key}: ${h.hits.map((q) => q.label).join(', ')}`);
  await tap(page, r.x + r.w / 2, r.y + r.h / 2);
  return r;
};

/** Plays one duel to a WIN with real input: hold, flick on the cue, aim at the head, release, tap Continue. */
async function winDuel(page, tag) {
  await page.waitForFunction(() => window.__duel !== undefined && window.__duel.scene.sys.settings.status === 5, null, { timeout: 15000 });
  const info = await page.evaluate(() => ({ enemy: window.__duel.scene.enemyDef.name, boss: !!window.__duel.scene.boss, hp: window.__duel.snapshot().enemyMaxHp, heroHp: window.__duel.snapshot().heroHp }));
  log(`  duel vs ${info.enemy}${info.boss ? ' (BOSS)' : ''}: enemy hp ${info.hp}, hero hp ${info.heroHp}`);
  await sleep(300);
  await shot(page, `${tag}_duel_wait`);
  const phaseIs = (ph, timeout = 20000) => page.waitForFunction((p) => window.__duel?.snapshot().phase === p, ph, { timeout, polling: 'raf' });
  const start = await toPage(page, 180, 568);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await phaseIs('CUE');
  await sleep(40);
  await shot(page, `${tag}_duel_cue`);
  const up1 = await toPage(page, 180, 530), up2 = await toPage(page, 180, 490);
  await page.mouse.move(up1.x, up1.y, { steps: 2 });
  await page.mouse.move(up2.x, up2.y, { steps: 2 });
  await phaseIs('AIM');
  // keep shooting the head until the duel resolves (bosses have more hp)
  for (let shots = 0; shots < 8; shots++) {
    const aim = await toPage(page, 250, 364);
    await page.mouse.move(aim.x, aim.y, { steps: 2 });
    await sleep(60);
    if (shots === 0) await shot(page, `${tag}_duel_aim`);
    await page.mouse.up();
    await sleep(40);
    const ph = await page.evaluate(() => window.__duel.snapshot().phase);
    if (ph === 'RESOLVE' || ph === 'RETRY') break;
    await page.waitForFunction(() => ['AIM', 'RESOLVE', 'RETRY'].includes(window.__duel?.snapshot().phase), null, { timeout: 5000, polling: 'raf' });
    const again = await toPage(page, 250, 364);
    await page.mouse.move(again.x, again.y);
    await page.mouse.down();
  }
  await phaseIs('RETRY');
  const res = await page.evaluate(() => window.__duel.system.lastResult);
  await sleep(100);
  await shot(page, `${tag}_duel_result`);
  log(`  result: ${res.outcome}, tier ${res.tier}, reaction ${Math.round(res.reactionMs ?? -1)} ms, hero hp ${res.heroHp}, headshots ${res.headshots}`);
  if (res.outcome !== 'WIN') throw new Error('duel was not won');
  await tap(page, 180, 568); // the CONTINUE plank
}

try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('console', m.text()); } });
  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.__neonfeed !== undefined, null, { timeout: 15000 });
  await waitScene(page, 'MainMenu');
  await sleep(400);
  await shot(page, '1_menu');
  log('menu hits:', (await hits(page)).hits.map((h) => h.label).join(', '));

  // ---- menu -> new run
  await tapLabel(page, 'duel');
  await waitScene(page, 'RunMap');
  await sleep(300);
  await shot(page, '2_map');
  const map1 = await page.evaluate(() => { const d = window.__neonfeed.game.scene.getScene('RunMap').params; return { label: d.progressLabel, choices: d.choices.map((c) => c.label) }; });
  log('map:', JSON.stringify(map1));
  const saved1 = await page.evaluate(() => window.__neonfeed.save.getRun()?.seed);
  log('run saved with seed', saved1);

  // ---- first duel
  await tapLabel(page, 'go:');
  await waitScene(page, 'Duel');
  await winDuel(page, '3');

  // ---- reward
  await waitScene(page, 'Reward');
  await sleep(500);
  await shot(page, '4_reward');
  const rh = await hits(page);
  log('reward hits:', rh.hits.map((h) => h.label).join(', '));
  const card = rh.hits.find((h) => h.label.startsWith('card:'));
  await tap(page, card.x + card.w / 2, card.y + card.h / 2);
  await sleep(250);
  await shot(page, '4b_reward_selected');
  const take = (await hits(page)).hits.find((h) => /^(take|confirm)/i.test(h.label));
  if (take) { log('confirm plank:', take.label); await tap(page, take.x + take.w / 2, take.y + take.h / 2); }
  await waitScene(page, 'RunMap');
  await sleep(300);
  await shot(page, '5_map_after_reward');
  const map2 = await page.evaluate(() => { const d = window.__neonfeed.game.scene.getScene('RunMap').params; return { label: d.progressLabel, hp: d.hp, coins: d.coins, perks: d.perkCount, choices: d.choices.map((c) => c.label) }; });
  log('map after reward:', JSON.stringify(map2));
  if (map2.perks !== 1) throw new Error('perk was not taken');

  // ---- reload mid-run -> menu offers CONTINUE -> resumes on the same map
  await page.evaluate(() => window.__neonfeed.save.flush());
  await page.reload();
  await page.waitForFunction(() => window.__neonfeed !== undefined, null, { timeout: 15000 });
  await waitScene(page, 'MainMenu');
  await sleep(400);
  await shot(page, '6_menu_continue');
  const menu2 = await page.evaluate(() => { const d = window.__neonfeed.game.scene.getScene('MainMenu').params; return { hasRun: d.hasRun, runLabel: d.runLabel, coins: d.coins }; });
  log('menu after reload:', JSON.stringify(menu2));
  if (!menu2.hasRun) throw new Error('reload lost the run');
  await tapLabel(page, 'continue');
  await waitScene(page, 'RunMap');
  await sleep(300);
  await shot(page, '7_map_resumed');
  const map3 = await page.evaluate(() => { const d = window.__neonfeed.game.scene.getScene('RunMap').params; return { label: d.progressLabel, hp: d.hp, coins: d.coins, perks: d.perkCount, choices: d.choices.map((c) => c.label) }; });
  log('map after resume:', JSON.stringify(map3));
  if (JSON.stringify(map3) !== JSON.stringify(map2)) throw new Error('resumed map differs');

  // ---- next node
  const next = await page.evaluate(() => window.__neonfeed.game.scene.getScene('RunMap').params.choices[0]);
  log('entering', next.label);
  await tapLabel(page, 'go:');
  await sleep(600);
  const key = await current(page);
  log('now showing:', key);
  await shot(page, '8_next_node');

  // ---- a wide window shows the integer zoom + letterbox
  await page.setViewportSize({ width: 900, height: 1500 });
  await sleep(400);
  await shot(page, '9_letterbox');
  const z = await page.evaluate(() => { const b = document.querySelector('canvas').getBoundingClientRect(); return { w: b.width, h: b.height, left: b.left, top: b.top }; });
  log('canvas at 900x1500:', JSON.stringify(z));
  console.log('page errors:', errors.length);
} finally {
  await browser.close();
  await server.close();
}
process.exit(errors.length ? 1 : 0);
