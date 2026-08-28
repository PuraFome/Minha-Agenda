import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(process.cwd(), 'dist/Minha-Agenda/browser');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let fp = normalize(join(ROOT, p));
    let data;
    try { data = await readFile(fp); }
    catch { data = await readFile(join(ROOT, 'index.html')); p = '/index.html'; }
    res.setHeader('Content-Type', types[extname(p)] || 'application/octet-stream');
    res.end(data);
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
});
await new Promise((r) => server.listen(4200, '127.0.0.1', r));
console.log('server listening on 4200');

const BASE = 'http://127.0.0.1:4200';
const consoleErrors = [];
const report = {};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const t = msg.text();
    if (/api\//i.test(t) || /Failed to load resource/i.test(t)) return;
    consoleErrors.push(t);
  }
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

await context.addInitScript(() => {
  localStorage.setItem('ma.auth.token', 'test-token');
  localStorage.setItem('ma.hero.v1', JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }));
});

await page.route('**/api/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sub: '123', email: 't@e.com', name: 'QA', picture: '' }) }));
await page.route('**/api/hero', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }) }));
await page.route('**/api/npc-friendship', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

await page.goto(`${BASE}/taberna`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(400);

report.url = page.url();
report.onTaberna = report.url.endsWith('/taberna');

// ---- Overlap measurement (desktop) ----
const wraps = page.locator('.taberna__character-wrapper');
const wrapCount = await wraps.count();
report.cards = [];
for (let i = 0; i < wrapCount; i++) {
  const w = wraps.nth(i);
  const nameBox = await w.locator('.character__name').boundingBox();
  const barBox = await w.locator('.taberna__friendship-bar').boundingBox();
  const btnBox = await w.locator('.taberna__character-btn').boundingBox();
  const nameText = (await w.locator('.character__name').innerText()).trim();
  // overlap: name bottom vs friendship bar top
  const nameOverflowsButton = nameBox && btnBox ? +(nameBox.y + nameBox.height - btnBox.y - btnBox.height).toFixed(1) : null;
  const nameBarGap = nameBox && barBox ? +(barBox.y - (nameBox.y + nameBox.height)).toFixed(1) : null; // negative => overlapping
  report.cards.push({ name: nameText, nameBox, btnBox, barBox, nameOverflowsButton, nameBarGap });
}

// screenshots desktop (light + dark)
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/opencode/taberna-desktop-light.png', fullPage: true });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/opencode/taberna-desktop-dark.png', fullPage: true });

// open dialog screenshot
const firstCard = page.locator('button.taberna__character-btn').first();
await firstCard.click();
await page.waitForTimeout(500);
const overlayVisible = await page.locator('.taberna__dialog-overlay').isVisible().catch(() => false);
report.dialogOpens = overlayVisible;
await page.screenshot({ path: '/tmp/opencode/taberna-dialog.png', fullPage: false });
await page.keyboard.press('Escape').catch(() => {});
await page.locator('.taberna__dialog-overlay').click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.waitForTimeout(300);

// ---- Mobile ----
const mContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mPage = await mContext.newPage();
const mConsole = [];
mPage.on('console', (msg) => { if (msg.type() === 'error') { const t = msg.text(); if (/api\//i.test(t) || /Failed to load resource/i.test(t)) return; mConsole.push(t); } });
mPage.on('pageerror', (e) => mConsole.push('PAGEERROR: ' + e.message));
await mContext.addInitScript(() => {
  localStorage.setItem('ma.auth.token', 'test-token');
  localStorage.setItem('ma.hero.v1', JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }));
});
await mPage.route('**/api/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sub: '123', email: 't@e.com', name: 'QA', picture: '' }) }));
await mPage.route('**/api/hero', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'Hero QA', heroClass: 'GUERREIRO', totalXp: 0 }) }));
await mPage.route('**/api/npc-friendship', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
await mPage.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await mPage.goto(`${BASE}/taberna`, { waitUntil: 'networkidle', timeout: 30000 });
await mPage.waitForTimeout(400);
await mPage.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await mPage.waitForTimeout(150);
await mPage.screenshot({ path: '/tmp/opencode/taberna-mobile-light.png', fullPage: true });
// measure horizontal overflow at mobile
const overflow = await mPage.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
  cardsPerRow: (() => {
    const ws = [...document.querySelectorAll('.taberna__character-wrapper')].map((e) => e.getBoundingClientRect().top);
    const top0 = ws[0];
    return ws.filter((t) => Math.abs(t - top0) < 5).length;
  })(),
}));
report.mobile = { ...overflow, consoleErrors: mConsole };

report.consoleErrors = consoleErrors;
console.log(JSON.stringify(report, null, 2));

await browser.close();
server.close();
