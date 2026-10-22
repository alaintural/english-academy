import type { MetadataRoute } from 'next';
import { BASE } from '@/lib/paths';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'English Academy',
    short_name: 'English A1',
    description: 'Sıfırdan A1 İngilizce: dersler ve klasik kitaplar',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#f7f5f0',
    lang: 'tr',
    icons: [
      { src: `${BASE}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${BASE}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  };
}
