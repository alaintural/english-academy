'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ChevronRight, Circle, CircleDot } from 'lucide-react';
import { getBook } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { chapterId } from '@/lib/paths';
import { BookCover } from '@/components/BookCover';
import { Badge, Button, Card, ErrorBox, Screen, Spinner } from '@/components/ui';

function BookDetail() {
  const id = useSearchParams().get('id') ?? '';
  const { data: book, error, loading } = useData(() => getBook(id), [id]);
  const { progress } = useStore();

  if (loading) return <Spinner />;
  if (error || !book) return <Screen title="Kitap" back="/kutuphane/"><ErrorBox error={error ?? new Error('Kitap bulunamadı')} /></Screen>;

  const state = (n: number) => progress[`chapter:${chapterId(book.id, n)}`];
  const next = book.chapters.find((c) => state(c.number)?.status !== 'completed') ?? book.chapters[0];
  const started = book.chapters.some((c) => state(c.number));
  const totalWords = book.chapters.reduce((n, c) => n + c.words, 0);

  return (
    <Screen title={book.title_tr} back="/kutuphane/" large={false}>
      <div className="flex gap-4 pt-4">
        <div className="w-32 shrink-0"><BookCover book={book} /></div>
        <div className="min-w-0">
          <h2 className="font-serif text-[22px] leading-tight font-bold">{book.title}</h2>
          <p className="mt-1 text-[15px] text-muted">{book.author} · {book.year}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="accent">{book.category}</Badge>
            <Badge tone="primary">A1</Badge>
          </div>
          <p className="mt-2 text-[13px] text-muted">{book.chapters.length} bölüm · ~{totalWords.toLocaleString('tr')} kelime</p>
        </div>
      </div>
      <p className="mt-4 text-[16px] leading-relaxed">{book.description_tr}</p>
      {next && (
        <Button block className="mt-5" href={`/okuyucu/?kitap=${book.id}&bolum=${next.number}`}>
          {started ? `Devam et · Bölüm ${next.number}` : 'Okumaya başla'}
        </Button>
      )}

      <h3 className="mt-7 mb-2 text-[20px] font-bold">Bölümler</h3>
      <Card className="mb-6 p-0">
        <ul className="divide-y divide-line">
          {book.chapters.map((c) => {
            const s = state(c.number);
            const Icon = s?.status === 'completed' ? CheckCircle2 : s ? CircleDot : Circle;
            return (
              <li key={c.number}>
                <Link href={`/okuyucu/?kitap=${book.id}&bolum=${c.number}`} className="flex min-h-[64px] items-center gap-3 px-4 py-2 active:bg-surface-2">
                  <Icon size={22} className={s?.status === 'completed' ? 'text-success' : s ? 'text-primary' : 'text-line'} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{c.number}. {c.title_en}</p>
                    <p className="truncate text-[13px] text-muted">
                      {c.title_tr} · {c.words} kelime{s?.score !== undefined ? ` · test %${s.score}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </Screen>
  );
}

export default function BookPage() {
  return <Suspense fallback={<Spinner />}><BookDetail /></Suspense>;
}
