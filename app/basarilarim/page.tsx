'use client';

import { Award, BookOpen, CheckCircle2, GraduationCap, Layers, XCircle } from 'lucide-react';
import { getBooks, getUnits } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { PASS_MARK, lessonDone, unitTestDone } from '@/lib/academy';
import { chapterId } from '@/lib/paths';
import { Card, ProgressBar, Screen } from '@/components/ui';

export default function AchievementsPage() {
  const { data } = useData(() => Promise.all([getUnits(), getBooks()]), []);
  const { progress, words, attempts } = useStore();
  const [units, books] = data ?? [[], []];

  const lessons = units.flatMap((u) => u.lessons);
  const done = lessons.filter((l) => lessonDone(progress, l.id));
  const chapters = Object.values(progress).filter((p) => p.kind === 'chapter' && p.status === 'completed');
  const known = Object.values(words).filter((w) => w.status === 'known').length;
  const saved = Object.keys(words).length;
  const finishedBooks = books.filter((b) => b.chapters.length && b.chapters.every((c) => progress[`chapter:${chapterId(b.id, c.number)}`]?.status === 'completed'));

  const badges = [
    { t: 'İlk adım', d: 'İlk dersi bitir', ok: done.length >= 1, icon: GraduationCap },
    { t: 'İlk sayfa', d: 'Bir bölüm oku', ok: chapters.length >= 1, icon: BookOpen },
    { t: 'Koleksiyoncu', d: '25 kelime kaydet', ok: saved >= 25, icon: Layers },
    { t: 'Hafıza', d: '50 kelimeyi öğren', ok: known >= 50, icon: Layers },
    ...units.filter((u) => u.test_available).map((u) => ({ t: `Ünite ${u.id}`, d: `${u.title_tr} testini geç`, ok: unitTestDone(progress, u.id), icon: Award })),
    { t: 'Kitap kurdu', d: 'Bir kitabı bitir', ok: finishedBooks.length >= 1, icon: BookOpen },
    { t: 'A1 yolcusu', d: '20 dersi bitir', ok: done.length >= 20, icon: GraduationCap },
  ];

  const labelFor = (ref: string) => {
    if (ref.startsWith('lesson-')) { const id = Number(ref.slice(7)); return `Ders ${id} · ${lessons.find((l) => l.id === id)?.title_tr ?? ''}`; }
    if (ref.startsWith('unit-')) return `Ünite ${ref.slice(5)} testi`;
    if (ref.startsWith('chapter-')) {
      const r = ref.slice(8); const b = books.find((x) => r.startsWith(`${x.id}-`));
      return b ? `${b.title_tr} · Bölüm ${Number(r.slice(b.id.length + 1))}` : r;
    }
    return ref;
  };

  return (
    <Screen title="Başarılarım" back="/profil/">
      <div className="grid grid-cols-2 gap-3">
        <Tile n={done.length} l="ders tamamlandı" />
        <Tile n={chapters.length} l="bölüm okundu" />
        <Tile n={known} l="kelime biliyorum" />
        <Tile n={attempts.filter((a) => a.passed).length} l="test geçildi" />
      </div>

      <h2 className="mt-7 mb-2 text-[20px] font-bold">Rozetler</h2>
      <div className="grid grid-cols-3 gap-3">
        {badges.map((b) => (
          <div key={b.t} className={`flex flex-col items-center rounded-2xl border p-3 text-center ${b.ok ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface opacity-55'}`}>
            <b.icon size={26} className={b.ok ? 'text-accent' : 'text-muted'} aria-hidden />
            <p className="mt-1 text-[13px] font-semibold">{b.t}</p>
            <p className="text-[11px] leading-tight text-muted">{b.d}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-7 mb-2 text-[20px] font-bold">Ünite ilerlemesi</h2>
      <Card className="grid gap-3">
        {units.map((u) => {
          const n = u.lessons.filter((l) => lessonDone(progress, l.id)).length;
          return (
            <div key={u.id}>
              <div className="flex justify-between text-[14px]"><span>{u.id}. {u.title_tr}</span><span className="text-muted tabular-nums">{n}/5{unitTestDone(progress, u.id) ? ' · 🏆' : ''}</span></div>
              <ProgressBar value={(n / 5) * 100} className="mt-1 h-1.5" />
            </div>
          );
        })}
      </Card>

      <h2 className="mt-7 mb-2 text-[20px] font-bold">Son testler</h2>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {attempts.slice(0, 15).map((a) => (
            <li key={a.ref + a.created_at} className="flex items-center gap-3 px-4 py-3">
              {a.passed ? <CheckCircle2 size={20} className="text-success" /> : <XCircle size={20} className="text-danger" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{labelFor(a.ref)}</p>
                <p className="text-[12px] text-muted">{new Date(a.created_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <span className={`text-[16px] font-bold tabular-nums ${a.score >= PASS_MARK ? 'text-success' : 'text-muted'}`}>%{a.score}</span>
            </li>
          ))}
          {!attempts.length && <li className="p-6 text-center text-[15px] text-muted">Henüz test çözmedin.</li>}
        </ul>
      </Card>

      <p className="mt-6 mb-8 text-[13px] leading-relaxed text-muted">
        Testler, öğrendiklerini takip etmen için hazırlandı. A1 yeterliliği konuşma ve yazma becerisini de kapsar;
        tek başına çoktan seçmeli testleri geçmek resmî bir A1 belgesi yerine geçmez.
      </p>
    </Screen>
  );
}

function Tile({ n, l }: { n: number; l: string }) {
  return (
    <Card>
      <p className="text-[30px] font-bold tabular-nums">{n}</p>
      <p className="text-[13px] text-muted">{l}</p>
    </Card>
  );
}
