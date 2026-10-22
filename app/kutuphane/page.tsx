'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getBooks } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { chapterId } from '@/lib/paths';
import { BookCover } from '@/components/BookCover';
import { Badge, ErrorBox, ProgressBar, Screen, Spinner } from '@/components/ui';

export default function LibraryPage() {
  const { data: books, error, loading } = useData(getBooks, []);
  const { progress } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Tümü');

  const cats = useMemo(() => ['Tümü', ...new Set((books ?? []).map((b) => b.category.split(' / ')[0]))], [books]);
  const list = (books ?? []).filter(
    (b) =>
      (cat === 'Tümü' || b.category.startsWith(cat)) &&
      (!q || `${b.title} ${b.title_tr} ${b.author}`.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))),
  );

  return (
    <Screen title="Kütüphane" subtitle="Klasik eserlerin A1 uyarlamaları">
      <label className="relative mb-3 block">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kitap veya yazar ara"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-10 outline-none placeholder:text-muted"
        />
      </label>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)}
            className={`h-9 shrink-0 rounded-full px-4 text-[15px] font-medium ${cat === c ? 'bg-ink text-bg' : 'bg-surface-2 text-ink'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      {!!error && <ErrorBox error={error} />}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pb-4">
        {list.map((b) => {
          const done = b.chapters.filter((c) => progress[`chapter:${chapterId(b.id, c.number)}`]?.status === 'completed').length;
          const pct = b.chapters.length ? (done / b.chapters.length) * 100 : 0;
          const inner = (
            <>
              <BookCover book={b} />
              <p className="mt-2 text-[15px] leading-tight font-semibold">{b.title_tr}</p>
              <p className="text-[13px] text-muted">{b.author}</p>
              <div className="mt-1.5 flex items-center gap-2">
                {b.available ? (
                  done ? <ProgressBar value={pct} className="h-1.5 flex-1" /> : <Badge tone="primary">{b.chapters.length} bölüm</Badge>
                ) : (
                  <Badge>Yakında</Badge>
                )}
              </div>
            </>
          );
          return (
            <li key={b.id} className={b.available ? '' : 'opacity-60'}>
              {b.available ? <Link href={`/kutuphane/kitap/?id=${b.id}`} className="block active:opacity-80">{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
      {!loading && !list.length && <p className="py-10 text-center text-muted">Sonuç bulunamadı.</p>}
    </Screen>
  );
}
