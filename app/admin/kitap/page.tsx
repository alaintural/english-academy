'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { saveBook } from '@/lib/admin';
import { useStore } from '@/lib/store';
import type { BookMeta } from '@/lib/types';
import { BookCover } from '@/components/BookCover';
import { AdminGuard, Field, SaveBar, inputCls } from '@/components/AdminGuard';
import { Badge, Card, Spinner } from '@/components/ui';

type Book = BookMeta & { published: boolean };
const EMPTY: Book = {
  id: '', title: '', title_tr: '', author: '', year: 1900, category: 'Macera', description_tr: '',
  cover: { bg: '#24456b', fg: '#ffffff', accent: '#f2c14e', motif: 'map' }, chapters_planned: 12, order: 99, published: false,
};
const MOTIFS = ['road', 'rabbit', 'map', 'key', 'island', 'river', 'leaf', 'clock'];

function BookEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const isNew = params.has('yeni');
  const id = params.get('id') ?? '';
  const { isAdmin } = useStore();
  const [book, setBook] = useState<Book | null>(isNew ? EMPTY : null);
  const [chapters, setChapters] = useState<{ number: number; title_en: string; published: boolean; word_count: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin || isNew || !supabase) return;
    supabase.from('books').select('*, chapters(number, title_en, published, word_count)').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      const { chapters: ch, position, ...b } = data;
      setBook({ ...b, order: position });
      setChapters([...ch].sort((a: { number: number }, b: { number: number }) => a.number - b.number));
    });
  }, [id, isNew, isAdmin]);

  async function save() {
    if (!book) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!/^[a-z0-9-]+$/.test(book.id)) throw new Error('Kimlik yalnızca küçük harf, rakam ve - içermeli (ör. treasure-island)');
      await saveBook(book);
      setMsg({ ok: true, text: 'Kitap kaydedildi.' });
      if (isNew) router.replace(`/admin/kitap/?id=${book.id}`);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  const set = <K extends keyof Book>(k: K, v: Book[K]) => book && setBook({ ...book, [k]: v });
  const nextNum = (chapters.at(-1)?.number ?? 0) + 1;

  return (
    <AdminGuard title={isNew ? 'Yeni kitap' : 'Kitap'}>
      {!book ? <Spinner /> : (
        <div className="grid gap-4">
          <div className="flex gap-4">
            <div className="w-28 shrink-0"><BookCover book={book} /></div>
            <div className="grid flex-1 gap-2">
              <Field label="Kimlik (URL)"><input className={inputCls} value={book.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} /></Field>
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={book.published} onChange={(e) => set('published', e.target.checked)} className="h-5 w-5" /> Yayında</label>
            </div>
          </div>
          <Field label="Başlık (orijinal)"><input className={inputCls} value={book.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Başlık (TR)"><input className={inputCls} value={book.title_tr} onChange={(e) => set('title_tr', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Yazar"><input className={inputCls} value={book.author} onChange={(e) => set('author', e.target.value)} /></Field>
            <Field label="Yıl"><input type="number" className={inputCls} value={book.year} onChange={(e) => set('year', Number(e.target.value))} /></Field>
            <Field label="Kategori"><input className={inputCls} value={book.category} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Sıra"><input type="number" className={inputCls} value={book.order ?? 99} onChange={(e) => set('order', Number(e.target.value))} /></Field>
          </div>
          <Field label="Açıklama"><textarea rows={3} className={inputCls} value={book.description_tr} onChange={(e) => set('description_tr', e.target.value)} /></Field>
          <div className="grid grid-cols-4 gap-2">
            {(['bg', 'fg', 'accent'] as const).map((k) => (
              <Field key={k} label={{ bg: 'Zemin', fg: 'Yazı', accent: 'Vurgu' }[k]}>
                <input type="color" value={book.cover[k]} onChange={(e) => set('cover', { ...book.cover, [k]: e.target.value })} className="h-11 w-full rounded-xl" />
              </Field>
            ))}
            <Field label="Motif">
              <select value={book.cover.motif} onChange={(e) => set('cover', { ...book.cover, motif: e.target.value })} className={inputCls}>
                {MOTIFS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>

          {!isNew && (
            <>
              <h2 className="mt-2 text-[18px] font-bold">Bölümler</h2>
              <Card className="p-0">
                {chapters.map((c) => (
                  <Link key={c.number} href={`/admin/bolum/?kitap=${book.id}&bolum=${c.number}`} className="flex min-h-[48px] items-center gap-2 border-b border-line px-4 active:bg-surface-2">
                    <span className="flex-1 truncate text-[15px]">{c.number}. {c.title_en}</span>
                    <Badge tone={c.published ? 'success' : 'muted'}>{c.word_count} kel.</Badge>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                ))}
                <Link href={`/admin/bolum/?kitap=${book.id}&bolum=${nextNum}&yeni=1`} className="flex min-h-[48px] items-center gap-2 px-4 text-[15px] font-semibold text-primary">
                  <Plus size={18} /> Bölüm {nextNum} ekle
                </Link>
              </Card>
            </>
          )}
          <SaveBar busy={busy} msg={msg} onSave={save} label="Kitap bilgilerini kaydet" />
        </div>
      )}
    </AdminGuard>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><BookEditor /></Suspense>;
}
