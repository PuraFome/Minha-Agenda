import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4200';
const results = [];
const consoleErrors = [];
let failed = false;

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  if (!cond) failed = true;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const t = msg.text();
    // Ignore intercepted /api noise (SPA fallback returns index.html for unrouted /api)
    if (/api\//i.test(t) || /Failed to load resource/i.test(t)) return;
    consoleErrors.push(t);
  }
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

await context.addInitScript(() => {
  localStorage.setItem('ma.auth.token', 'test-token');
  localStorage.setItem('ma.hero.v1', JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }));
});

// API stubs
await page.route('**/api/me', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sub: '123', email: 't@e.com', name: 'QA', picture: '' }) }));
await page.route('**/api/hero', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }) }));
await page.route('**/api/npc-friendship', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
// Fallback for any other /api call so networkidle resolves cleanly
await page.route('**/api/**', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

try {
  await page.goto(`${BASE}/taberna`, { waitUntil: 'networkidle', timeout: 30000 });

  // 1. Guards passed — still on /taberna
  const url = page.url();
  check('route stays on /taberna', url.endsWith('/taberna'), `url=${url}`);

  // 2. Exactly 5 NPC cards with expected names
  const expected = ['Dona Arruma', 'Capitão Compromisso', 'Mestre Cadência', 'Frei Equilíbrio', 'Barão do Orçamento'];
  const cards = page.locator('button.sheet');
  const cardCount = await cards.count();
  check('exactly 5 NPC cards', cardCount === 5, `count=${cardCount}`);
  const names = [];
  for (let i = 0; i < cardCount; i++) {
    names.push((await cards.nth(i).locator('.sheet__nameplate').innerText()).trim());
  }
  const namesOk = expected.every((n) => names.includes(n)) && names.length === expected.length;
  check('NPC names match', namesOk, `names=${JSON.stringify(names)}`);

  // 3. Click first NPC card -> dialog opens with personality + missions
  await cards.first().click();
  const overlay = page.locator('.taberna__dialog-overlay');
  const overlayVisible = await overlay.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  check('npc-dialog overlay opens', overlayVisible);
  const banter = (await page.locator('.dialog .banter').first().innerText().catch(() => '')).trim();
  check('dialog shows personality (greeting)', banter.length > 0, `banter="${banter.slice(0, 40)}"`);
  const missionCards = await page.locator('.dialog .cards .card').count();
  check('dialog shows missions', missionCards >= 1, `missions=${missionCards}`);

  // close dialog for clean screenshots
  await page.keyboard.press('Escape').catch(() => {});
  await overlay.click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.waitForTimeout(300);

  // 4. Theme toggle flips data-theme and persists localStorage
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.locator('button.theme-toggle').click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const persisted = await page.evaluate(() => localStorage.getItem('theme'));
  check('theme flips', before !== after && (after === 'light' || after === 'dark'), `before=${before} after=${after}`);
  check('theme persists in localStorage', persisted === after, `localStorage.theme=${persisted}`);

  // 5. Screenshots (light + dark)
  mkdirSync('.playwright-mcp', { recursive: true });
  // ensure light screenshot
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), 'light');
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.playwright-mcp/taberna-light.png', fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.playwright-mcp/taberna-dark.png', fullPage: true });

  // 6. Console errors
  check('no real JS console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
} catch (e) {
  check('script executed without throwing', false, String(e));
} finally {
  await browser.close();
}

console.log('\n==== QA SUMMARY ====');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
}
console.log(`consoleErrors=${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.join('\n'));
console.log(failed ? 'OVERALL: FAIL' : 'OVERALL: PASS');
process.exit(failed ? 1 : 0);
