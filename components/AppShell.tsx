'use client';

import { usePathname } from 'next/navigation';
import { TabBar } from './TabBar';
import { SoundUI } from './SoundUI';

// Okuma ve ders/test akışları tam ekran: alt sekme çubuğu gizlenir.
const FULLSCREEN = ['/okuyucu', '/akademi/ders', '/akademi/test', '/kelimelerim/tekrar', '/admin'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const full = FULLSCREEN.some((p) => pathname.startsWith(p));
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-bg sm:shadow-[0_0_0_1px_var(--line)]">
      <main className={full ? '' : 'pb-tabbar'}>{children}</main>
      {!full && <TabBar pathname={pathname} />}
      <SoundUI />
    </div>
  );
}
