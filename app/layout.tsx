import type { Metadata, Viewport } from 'next';
import { StoreProvider } from '@/lib/store';
import { SoundProvider } from '@/lib/sound';
import { AppShell } from '@/components/AppShell';
import { BASE } from '@/lib/paths';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'English Academy — Sıfırdan A1 İngilizce', template: '%s · English Academy' },
  description: 'Türkçe açıklamalı dersler ve klasik kitapların A1 uyarlamalarıyla sıfırdan İngilizce öğrenin.',
  manifest: `${BASE}/manifest.webmanifest`,
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: 'English Academy', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

// iPhone 13: 390×844 pt, çentik ve ana ekran çubuğu için güvenli alanlar (viewport-fit=cover)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f5f0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Tema, ilk boyamadan önce uygulanır (beyaz parlama olmasın) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('ea:v1')||'{}').prefs||{};var t=p.theme||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <StoreProvider>
          <SoundProvider>
            <AppShell>{children}</AppShell>
          </SoundProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
