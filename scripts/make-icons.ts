// public/icon.svg → PNG ikonlar (192, 512, apple-touch 180). Bir kez çalıştırılır, çıktılar depoda.
//   node scripts/make-icons.ts
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const pub = path.join(import.meta.dirname, '..', 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
// Ortamda farklı sürüm tarayıcı varsa: CHROMIUM_PATH=/yol/chrome
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: path.join(pub, name), omitBackground: false });
}
await browser.close();
console.log('ikonlar üretildi');
