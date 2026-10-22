'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, GraduationCap, Layers, Trophy } from 'lucide-react';
import { getBooks, getUnits } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { isDue } from '@/lib/srs';
import { lessonDone, nextLesson } from '@/lib/academy';
import { chapterId } from '@/lib/paths';
import { BookCover } from '@/components/BookCover';
import { Card, ProgressRing } from '@/components/ui';

export default function HomePage() {
  const { data } = useData(() => Promise.all([getUnits(), getBooks()]), []);
  const { progress, words, user, ready } = useStore();
  const [units, books] = data ?? [[], []];

  const totalLessons = units.reduce((n, u) => n + u.lessons.length, 0) || 40;
  const lessonsDone = units.reduce((n, u) => n + u.lessons.filter((l) => lessonDone(progress, l.id)).length, 0);
  const chaptersDone = Object.values(progress).filter((p) => p.kind === 'chapter' && p.status === 'completed').length;
  const known = Object.values(words).filter((w) => w.status === 'known').length;
  const due = Object.values(words).filter((w) => isDue(w)).length;

  // Kaldığın yer: en son dokunulan, bitmemiş ders ya da bölüm
  const last = Object.values(progress)
    .filter((p) => p.kind !== 'test' && p.status === 'started')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  let resume: { href: string; kicker: string; title: string; icon: 'lesson' | 'book' } | null = null;
  if (last?.kind === 'chapter') {
    const [bookId, num] = [last.ref.slice(0, last.ref.lastIndexOf('-')), Number(last.ref.slice(last.ref.lastIndexOf('-') + 1))];
    const b = books.find((x) => x.id === bookId);
    const c = b?.chapters.find((x) => x.number === num);
    if (b && c) resume = { href: `/okuyucu/?kitap=${b.id}&bolum=${num}`, kicker: `${b.title_tr} · Bölüm ${num}`, title: c.title_en, icon: 'book' };
  } else if (last?.kind === 'lesson') {
    const l = units.flatMap((u) => u.lessons).find((x) => String(x.id) === last.ref);
    if (l) resume = { href: `/akademi/ders/?id=${l.id}`, kicker: `Ders ${l.id}`, title: l.title_tr, icon: 'lesson' };
  }
  const nl = nextLesson(progress, units);
  if (!resume && nl) resume = { href: `/akademi/ders/?id=${nl.lesson.id}`, kicker: lessonsDone ? `Sıradaki · Ders ${nl.lesson.id}` : 'Buradan başla · Ders 1', title: nl.lesson.title_tr, icon: 'lesson' };

  const name = user?.email?.split('@')[0];
  const reading = books.filter((b) => b.available).slice(0, 4);

  return (
    <div className="animate-fade">
      <header className="pt-safe px-4">
        <p className="pt-4 text-[15px] font-medium text-muted">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">Merhaba{name ? `, ${name}` : ''} 👋</h1>
      </header>

      <div className="grid gap-4 px-4 pt-4">
        {resume && (
          <Link href={resume.href} className="block active:opacity-90">
            <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-on-primary shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" aria-hidden />
              <p className="text-[13px] font-semibold tracking-wide uppercase opacity-80">Kaldığın yer</p>
              <div className="mt-2 flex items-center gap-3">
                {resume.icon === 'book' ? <BookOpen size={30} /> : <GraduationCap size={30} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] opacity-85">{resume.kicker}</p>
                  <p className="truncate text-[21px] font-bold">{resume.title}</p>
                </div>
                <ChevronRight size={26} />
              </div>
            </div>
          </Link>
        )}

        <Card className="flex items-center gap-4">
          <ProgressRing value={(lessonsDone / totalLessons) * 100}>
            <div>
              <div className="text-[20px] font-bold tabular-nums">{lessonsDone}</div>
              <div className="text-[11px] text-muted">/{totalLessons} ders</div>
            </div>
          </ProgressRing>
          <div className="grid flex-1 gap-2 text-[15px]">
            <Stat label="Biliyorum" value={known} unit="kelime" />
            <Stat label="Okunan" value={chaptersDone} unit="bölüm" />
            <Stat label="Hedef" value={800} unit="kelime" muted />
          </div>
        </Card>

        <Link href={due ? '/kelimelerim/tekrar/' : '/kelimelerim/'} className="block active:opacity-90">
          <Card className="flex items-center gap-4">
            <div className={`grid h-12 w-12 place-items-center rounded-2xl ${due ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}><Layers size={24} /></div>
            <div className="flex-1">
              <p className="text-[17px] font-semibold">{due ? `${due} kelime tekrar bekliyor` : 'Tekrarların güncel'}</p>
              <p className="text-[13px] text-muted">{due ? 'Birkaç dakikalık tekrar hafızanı tazeler.' : `${Object.keys(words).length} kayıtlı kelime`}</p>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </Card>
        </Link>

        {!!reading.length && (
          <section>
            <div className="mb-2 flex items-end justify-between">
              <h2 className="text-[22px] font-bold">Kütüphane</h2>
              <Link href="/kutuphane/" className="flex h-11 items-center text-[15px] text-primary">Tümü</Link>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
              {reading.map((b) => {
                const done = b.chapters.filter((c) => progress[`chapter:${chapterId(b.id, c.number)}`]?.status === 'completed').length;
                return (
                  <Link key={b.id} href={`/kutuphane/kitap/?id=${b.id}`} className="w-32 shrink-0 active:opacity-80">
                    <BookCover book={b} />
                    <p className="mt-2 truncate text-[14px] font-semibold">{b.title_tr}</p>
                    <p className="text-[12px] text-muted">{done}/{b.chapters.length} bölüm</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <Link href="/basarilarim/" className="mb-4 block active:opacity-90">
          <Card className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Trophy size={24} /></div>
            <div className="flex-1">
              <p className="text-[17px] font-semibold">Başarılarım</p>
              <p className="text-[13px] text-muted">Test sonuçların ve rozetlerin</p>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </Card>
        </Link>
        {!ready && <span className="sr-only">Yükleniyor</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, muted }: { label: string; value: number; unit: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className={muted ? 'text-muted' : 'font-semibold'}><span className="tabular-nums">{value}</span> {unit}</span>
    </div>
  );
}
