'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, FileUp, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { counts } from '@/lib/admin';
import { useStore } from '@/lib/store';
import { AdminGuard } from '@/components/AdminGuard';
import { Badge, Card } from '@/components/ui';

type LessonRow = { id: number; unit_id: number; title_tr: string; published: boolean };
type BookRow = { id: string; title: string; published: boolean; chapters: { count: number }[] };

export default function AdminHome() {
  const { isAdmin } = useStore();
  const [c, setC] = useState<Record<string, number> | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [books, setBooks] = useState<BookRow[]>([]);

  useEffect(() => {
    if (!isAdmin || !supabase) return;
    counts().then(setC).catch(() => {});
    supabase.from('lessons').select('id, unit_id, title_tr, published').order('id').then(({ data }) => setLessons((data ?? []) as LessonRow[]));
    supabase.from('books').select('id, title, published, chapters(count)').order('position').then(({ data }) => setBooks((data ?? []) as BookRow[]));
  }, [isAdmin]);

  return (
    <AdminGuard title="Yönetim Paneli" back="/profil/">
      {c && (
        <div className="grid grid-cols-4 gap-2">
          {Object.entries({ Ders: c.lessons, Kitap: c.books, Bölüm: c.chapters, Cümle: c.sentences, Kelime: c.tokens, Sözlük: c.vocabulary, Soru: c.questions, Üye: c.profiles }).map(([k, v]) => (
            <Card key={k} className="p-2 text-center"><p className="text-[17px] font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted">{k}</p></Card>
          ))}
        </div>
      )}

      <Link href="/admin/ice-aktar/" className="mt-4 flex min-h-[52px] items-center gap-3 rounded-2xl bg-primary-soft px-4 font-semibold text-primary">
        <FileUp size={20} /> İçerik içe aktar (JSON)
      </Link>

      <h2 className="mt-6 mb-2 text-[18px] font-bold">Kitaplar</h2>
      <Card className="p-0">
        {books.map((b) => (
          <Link key={b.id} href={`/admin/kitap/?id=${b.id}`} className="flex min-h-[52px] items-center gap-2 border-b border-line px-4 last:border-0 active:bg-surface-2">
            <span className="flex-1 truncate text-[15px] font-medium">{b.title}</span>
            <Badge tone={b.published ? 'success' : 'muted'}>{b.chapters[0]?.count ?? 0} bölüm</Badge>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
        <Link href="/admin/kitap/?yeni=1" className="flex min-h-[52px] items-center gap-2 px-4 text-[15px] font-semibold text-primary"><Plus size={18} /> Yeni kitap</Link>
      </Card>

      <h2 className="mt-6 mb-2 text-[18px] font-bold">Dersler ve ünite testleri</h2>
      <Card className="p-0">
        {lessons.map((l) => (
          <div key={l.id}>
            <Link href={`/admin/ders/?id=${l.id}`} className="flex min-h-[48px] items-center gap-2 border-b border-line px-4 active:bg-surface-2">
              <span className="w-7 text-[13px] text-muted tabular-nums">{l.id}</span>
              <span className="flex-1 truncate text-[15px]">{l.title_tr}</span>
              <Badge tone={l.published ? 'success' : 'muted'}>{l.published ? 'Yayında' : 'Taslak'}</Badge>
            </Link>
            {l.id % 5 === 0 && (
              <Link href={`/admin/ders/?unite=${l.unit_id}`} className="flex min-h-[44px] items-center gap-2 border-b border-line bg-surface-2/50 px-4 text-[14px] font-semibold text-accent">
                Ünite {l.unit_id} testi
              </Link>
            )}
          </div>
        ))}
      </Card>
    </AdminGuard>
  );
}
