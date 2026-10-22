'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, ChevronDown, Lock, PlayCircle, Trophy } from 'lucide-react';
import { getUnits } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { lessonDone, lessonUnlocked, nextLesson, unitTestDone, unitTestUnlocked } from '@/lib/academy';
import { Badge, Card, ErrorBox, ProgressBar, Screen, Spinner } from '@/components/ui';

export default function AcademyPage() {
  const { data: units, error, loading } = useData(getUnits, []);
  const { progress } = useStore();
  const [openUnit, setOpenUnit] = useState<number | null>(null);

  const total = units?.reduce((n, u) => n + u.lessons.length, 0) ?? 40;
  const done = units?.reduce((n, u) => n + u.lessons.filter((l) => lessonDone(progress, l.id)).length, 0) ?? 0;
  const current = units ? nextLesson(progress, units) : null;
  const expanded = openUnit ?? current?.unit.id ?? 1;

  return (
    <Screen title="Akademi" subtitle="Sıfırdan A1 sonuna: 8 ünite, 40 ders">
      <Card className="mb-5">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">A1 ilerlemen</p>
          <p className="text-[15px] font-semibold text-primary tabular-nums">{done}/{total} ders</p>
        </div>
        <ProgressBar value={(done / total) * 100} className="mt-3" />
      </Card>

      {loading && <Spinner />}
      {!!error && <ErrorBox error={error} />}

      <div className="grid gap-3 pb-6">
        {units?.map((u) => {
          const uDone = u.lessons.filter((l) => lessonDone(progress, l.id)).length;
          const anyAvailable = u.lessons.some((l) => l.available);
          const isOpen = expanded === u.id;
          return (
            <Card key={u.id} className="p-0" as="section">
              <button type="button" onClick={() => setOpenUnit(isOpen ? -1 : u.id)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[19px] font-bold ${uDone === 5 ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'}`}>
                  {uDone === 5 ? <CheckCircle2 size={24} /> : u.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Ünite {u.id}</p>
                  <p className="truncate text-[17px] font-semibold">{u.title_tr}</p>
                  {anyAvailable ? <ProgressBar value={(uDone / 5) * 100} className="mt-1.5 h-1.5" /> : <Badge>Yakında</Badge>}
                </div>
                <ChevronDown size={20} className={`text-muted transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {isOpen && (
                <ul className="border-t border-line">
                  {u.lessons.map((l) => {
                    const ok = lessonDone(progress, l.id);
                    const open = l.available && lessonUnlocked(progress, l.id);
                    const score = progress[`lesson:${l.id}`]?.score;
                    const row = (
                      <div className={`flex min-h-[60px] items-center gap-3 px-4 py-2 ${open ? 'active:bg-surface-2' : 'opacity-55'}`}>
                        {ok ? <CheckCircle2 size={22} className="text-success" /> : open ? <PlayCircle size={22} className="text-primary" /> : <Lock size={20} className="text-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-medium">{l.id}. {l.title_tr}</p>
                          <p className="text-[13px] text-muted">{!l.available ? 'Yakında' : ok ? `Tamamlandı · %${score}` : open ? 'Başla' : 'Önceki dersi bitir'}</p>
                        </div>
                      </div>
                    );
                    return <li key={l.id}>{open ? <Link href={`/akademi/ders/?id=${l.id}`}>{row}</Link> : row}</li>;
                  })}
                  {u.test_available && (
                    <li className="border-t border-line">
                      {unitTestUnlocked(progress, u) ? (
                        <Link href={`/akademi/test/?unite=${u.id}`} className="flex min-h-[60px] items-center gap-3 px-4 active:bg-surface-2">
                          <Trophy size={22} className="text-accent" />
                          <div className="flex-1">
                            <p className="text-[16px] font-semibold">Ünite {u.id} testi</p>
                            <p className="text-[13px] text-muted">{unitTestDone(progress, u.id) ? `Geçildi · %${progress[`test:unit-${u.id}`]?.score}` : '20 soru · geçme %80'}</p>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex min-h-[60px] items-center gap-3 px-4 opacity-55">
                          <Lock size={20} className="text-muted" />
                          <div><p className="text-[16px] font-semibold">Ünite {u.id} testi</p><p className="text-[13px] text-muted">5 dersi bitirince açılır</p></div>
                        </div>
                      )}
                    </li>
                  )}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
