import type { NextConfig } from 'next';

// GitHub Pages: statik çıktı, depo adı alt yolunda yayınlanır.
// Özel alan adına geçilirse BASE_PATH boş bırakılır.
const basePath = process.env.BASE_PATH ?? '/english-academy';

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default config;
