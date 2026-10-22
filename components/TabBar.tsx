'use client';

import Link from 'next/link';
import { BookOpen, GraduationCap, House, Layers, UserRound } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isDue } from '@/lib/srs';

const TABS = [
  { href: '/', label: 'Ana Sayfa', icon: House },
  { href: '/akademi/', label: 'Akademi', icon: GraduationCap },
  { href: '/kutuphane/', label: 'Kütüphane', icon: BookOpen },
  { href: '/kelimelerim/', label: 'Kelimeler', icon: Layers },
  { href: '/profil/', label: 'Profil', icon: UserRound },
];

export function TabBar({ pathname }: { pathname: string }) {
  const { words } = useStore();
  const due = Object.values(words).filter((w) => isDue(w)).length;
  return (
    <nav
      aria-label="Ana menü"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-line bg-surface/90 backdrop-blur-xl"
    >
      <ul className="grid h-16 grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/\/$/, ''));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-primary' : 'text-muted'}`}
              >
                <Icon size={24} strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                {label}
                {href === '/kelimelerim/' && due > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] leading-[18px] font-bold text-white">
                    {due > 99 ? '99+' : due}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
