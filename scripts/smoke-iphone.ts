// iPhone 13 duman testi: derlenmiş siteyi (out/) /english-academy/ altında sunar ve
// ana akışları uçtan uca yürütür; her ekranın görüntüsünü screenshots/ altına kaydeder.
//   npm run build && node scripts/smoke-iphone.ts
// Ortamda Playwright sürümüyle eşleşmeyen tarayıcı varsa: CHROMIUM_PATH=/yol/chrome

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, devices, type Page } from 'playwright';
import type { Lesson, Question } from '../lib/types.ts';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'out');
const SHOTS = path.join(ROOT, 'screenshots');
const BASE = '/english-academy';
const PORT = 4321;
fs.mkdirSync(SHOTS, { recursive: true });

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!p.startsWith(BASE)) { res.writeHead(404).end(); return; }
  p = p.slice(BASE.length) || '/';
  let file = path.join(OUT, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html' }).end(fs.readFileSync(path.join(OUT, '404.html'))); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise<void>((r) => server.listen(PORT, r));
const url = (p: string) => `http://localhost:${PORT}${BASE}${p}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'tr-TR' });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

let step = 0;
async function shot(name: string) {
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error(`${name}: yatay taşma ${overflow}px`);
  await page.screenshot({ path: path.join(SHOTS, `${String(++step).padStart(2, '0')}-${name}.png`) });
  console.log(`✓ ${name}`);
}
const tapText = (t: string | RegExp) => page.getByRole('button', { name: t }).first().click();

async function answer(p: Page, q: Question) {
  if (q.type === 'mcq' || q.type === 'fill' || q.type === 'listen') {
    await p.locator('button', { hasText: q.options[q.answer] }).filter({ hasText: /^[A-D]/ }).first().click();
  } else if (q.type === 'order') {
    const chunks = q.answer.replace(/[.?!]$/, '').trim().split(/\s+/);
    const pool = p.locator('div.mt-4.flex.flex-wrap.gap-2 > button');
    for (const c of chunks) await pool.filter({ hasText: new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).and(p.locator(':not([disabled])')).first().click();
  } else if (q.type === 'match') {
    const cols = p.locator('div.grid.grid-cols-2 > div');
    for (const [en, tr] of q.pairs) {
      await cols.nth(0).getByRole('button', { name: en, exact: true }).click();
      await cols.nth(1).getByRole('button', { name: tr, exact: true }).click();
    }
  }
  await tapText('Kontrol et');
  await tapText('Devam');
}

try {
  // ------------------------------------------------------------ ana sayfa
  await page.goto(url('/'));
  await page.getByText('Kaldığın yer').waitFor();
  await shot('ana-sayfa');

  // ------------------------------------------------------------ akademi
  await page.getByRole('link', { name: 'Akademi' }).click();
  await page.getByText('Ünite 1').first().waitFor();
  await shot('akademi');
  await page.getByRole('link', { name: /1\. Alfabe/ }).click();
  await page.getByRole('button', { name: 'Dinlemeye geç' }).waitFor();
  await shot('ders-ogren');
  await tapText('Dinlemeye geç');
  await shot('ders-dinle');
  await tapText('Alıştırmalara geç');

  const lesson = JSON.parse(fs.readFileSync(path.join(OUT, 'data/lessons/1.json'), 'utf8')) as Lesson;
  for (const [i, q] of lesson.practice.entries()) {
    if (i === 0) await shot(`alistirma-${q.type}`);
    await answer(page, q);
  }
  await tapText('Teste başla');
  for (const [i, q] of lesson.test.entries()) {
    if (q.type === 'order' || q.type === 'match' || i === 0) {
      await shot(`test-${i + 1}-${q.type}`);
    }
    await answer(page, q);
  }
  await page.getByText('%100').waitFor();
  await shot('ders-sonuc');

  // ------------------------------------------------------------ kütüphane + okuyucu
  await page.goto(url('/kutuphane/'));
  await page.getByText('Oz Büyücüsü').waitFor();
  await shot('kutuphane');
  await page.getByRole('link', { name: /Oz Büyücüsü/ }).click();
  await page.getByText('Bölümler').waitFor();
  await shot('kitap');
  await page.getByRole('link', { name: 'Okumaya başla' }).click();
  await page.getByText('Bölümü dinle').first().waitFor();
  await shot('okuyucu');
  await page.locator('article button').nth(1).click(); // ikinci kelime
  await page.getByText('Bu cümlede').waitFor();
  await shot('okuyucu-kelime');
  await tapText('Kelimelerime ekle');
  await page.getByText('Kelimelerimde').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cümlenin Türkçesi' }).first().click();
  await page.getByRole('dialog', { name: 'Cümlenin Türkçesi' }).waitFor();
  await shot('okuyucu-cumle');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await shot('okuyucu-ayarlar');
  await page.getByRole('button', { name: 'Karanlık' }).click();
  await page.keyboard.press('Escape');
  await shot('okuyucu-karanlik');
  await page.getByRole('button', { name: 'Okuma ayarları' }).click();
  await page.getByRole('button', { name: 'Açık' }).click();
  await page.keyboard.press('Escape');

  // bölüm sonu soruları
  await tapText('Bölüm sonu soruları');
  const ch = JSON.parse(fs.readFileSync(path.join(OUT, 'data/books/oz/01.json'), 'utf8'));
  for (const q of ch.questions) await answer(page, q);
  await page.getByText('Bölüm 1 tamamlandı').waitFor();
  await shot('bolum-sonuc');

  // ------------------------------------------------------------ kelimeler + tekrar
  await page.goto(url('/kelimelerim/'));
  await page.getByText('kelime tekrar bekliyor').waitFor();
  await shot('kelimelerim');
  await page.getByRole('link', { name: /Tekrara başla|Serbest tekrar/ }).click();
  await page.getByText(/Anlamını seç|Hatırlıyor musun/).waitFor();
  await shot('tekrar');

  // ------------------------------------------------------------ diğer ekranlar
  for (const [p, name, wait] of [
    ['/basarilarim/', 'basarilarim', 'Rozetler'],
    ['/profil/', 'profil', 'Tercihler'],
    ['/akademi/test/?unite=1', 'unite-testi', 'Ünite 1 testi'],
    ['/admin/', 'admin', 'Yönetim Paneli'],
  ] as const) {
    await page.goto(url(p));
    await page.getByText(wait).first().waitFor();
    await shot(name);
  }

  // ilerleme ana sayfaya yansıdı mı
  await page.goto(url('/'));
  await page.getByText('Kaldığın yer').waitFor();
  const done = await page.locator('text=/ders$/').first().textContent();
  await shot('ana-sayfa-ilerleme');
  console.log('ilerleme halkası:', done);
} finally {
  await browser.close();
  server.close();
}

const real = errors.filter((e) => !/favicon|Failed to load resource/.test(e));
if (real.length) {
  console.error('Tarayıcı hataları:\n' + real.join('\n'));
  process.exit(1);
}
console.log(`Tüm akışlar geçti · ${step} ekran görüntüsü: screenshots/`);
