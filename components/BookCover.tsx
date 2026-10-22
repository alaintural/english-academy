import { Clock, KeyRound, Leaf, Map, Rabbit, Route, TreePalm, Waves, BookOpen } from 'lucide-react';
import type { BookMeta } from '@/lib/types';

const MOTIF = { road: Route, rabbit: Rabbit, map: Map, key: KeyRound, island: TreePalm, river: Waves, leaf: Leaf, clock: Clock };

// Telifli kapak görseli kullanılmaz: renk + motiften oluşan tipografik kapak.
export function BookCover({ book, size = 'md' }: { book: Pick<BookMeta, 'title' | 'author' | 'cover'>; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = MOTIF[book.cover.motif as keyof typeof MOTIF] ?? BookOpen;
  const s = { sm: { w: 'w-16', t: 'text-[9px]', i: 18, p: 'p-1.5' }, md: { w: 'w-full', t: 'text-[15px]', i: 34, p: 'p-3' }, lg: { w: 'w-36', t: 'text-[15px]', i: 36, p: 'p-3' } }[size];
  return (
    <div
      className={`${s.w} relative aspect-[2/3] overflow-hidden rounded-xl shadow-[0_6px_18px_rgba(0,0,0,0.18)]`}
      style={{ background: `linear-gradient(160deg, ${book.cover.bg}, color-mix(in srgb, ${book.cover.bg} 70%, black))`, color: book.cover.fg }}
      aria-hidden
      lang="en"
    >
      <div className="absolute inset-y-0 left-0 w-[6%] bg-black/20" />
      <div className={`flex h-full flex-col ${s.p} pl-[12%]`}>
        <div className="h-0.5 w-8 rounded" style={{ background: book.cover.accent }} />
        <p className={`mt-2 font-serif leading-tight font-bold ${s.t}`}>{book.title}</p>
        <div className="flex flex-1 items-center justify-center" style={{ color: book.cover.accent }}>
          <Icon size={s.i} strokeWidth={1.5} />
        </div>
        {size !== 'sm' && <p className="text-[10px] tracking-wider uppercase opacity-80">{book.author}</p>}
      </div>
    </div>
  );
}
