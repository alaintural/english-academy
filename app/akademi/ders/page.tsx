'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookmarkCheck, BookmarkPlus, Lightbulb, Play, Square, VolumeX } from 'lucide-react';
import { getLesson, getUnits } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { PASS_MARK, lessonUnlocked } from '@/lib/academy';
import { useSound } from '@/lib/sound';
import type { LearnBlock, Lesson, Question, UnitMeta } from '@/lib/types';
import { Quiz, type QuizResult } from '@/components/quiz/Quiz';
import { Result } from '@/components/quiz/Result';
import { BackButton, Button, Card, ErrorBox, Rich, SoundToggle, SpeakButton, Spinner } from '@/components/ui';

type Step = 'learn' | 'listen' | 'practice' | 'test-intro' | 'test' | 'result' | 'review';
const STEPS: { key: Step[]; label: string }[] = [
  { key: ['learn'], label: 'Öğren' },
  { key: ['listen'], label: 'Dinle' },
  { key: ['practice'], label: 'Uygula' },
  { key: ['test-intro', 'test', 'result'], label: 'Test' },
  { key: ['review'], label: 'Pekiştir' },
];

function LessonLoader() {
  const id = Number(useSearchParams().get('id') ?? '1');
  const { data, error, loading } = useData(() => Promise.all([getLesson(id), getUnits()]), [id]);
  if (loading) return <Spinner />;
  if (error || !data) return <div className="pt-safe px-4"><BackButton href="/akademi/" /><ErrorBox error={error} /></div>;
  return <LessonFlow key={id} lesson={data[0]} units={data[1]} />;
}

function LessonFlow({ lesson, units }: { lesson: Lesson; units: UnitMeta[] }) {
  const { progress, getProgress, setProgress, addAttempt } = useStore();
  const prev = getProgress('lesson', String(lesson.id));
  const [step, setStep] = useState<Step>('learn');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [attempt, setAttempt] = useState(1);

  useEffect(() => {
    if (!prev) setProgress('lesson', String(lesson.id), { status: 'started' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  useEffect(() => window.scrollTo(0, 0), [step]);

  const allLessons = units.flatMap((u) => u.lessons);
  const nextL = allLessons.find((l) => l.id === lesson.id + 1);
  const unit = units.find((u) => u.id === lesson.unit);
  const locked = !lessonUnlocked(progress, lesson.id);

  if (step === 'practice')
    return <Quiz questions={lesson.practice} label={`Ders ${lesson.id} · Alıştırmalar`} exitHref="/akademi/" seed={lesson.id} onFinish={() => setStep('test-intro')} />;
  if (step === 'test')
    return (
      <Quiz
        key={attempt}
        questions={lesson.test}
        label={`Ders ${lesson.id} · Test`}
        exitHref="/akademi/"
        seed={lesson.id * 7 + attempt}
        onFinish={(r) => {
          const passed = r.score >= PASS_MARK;
          setResult(r);
          setStep('result');
          addAttempt({ ref: `lesson-${lesson.id}`, score: r.score, passed, wrong: r.wrong });
          setProgress('lesson', String(lesson.id), { status: passed ? 'completed' : 'started', score: r.score });
        }}
      />
    );
  if (step === 'result' && result) {
    const passed = result.score >= PASS_MARK;
    return (
      <Result score={result.score} passMark={PASS_MARK} title={passed ? `Ders ${lesson.id} tamamlandı!` : 'Neredeyse oldu!'}>
        <p className="mb-2 text-[15px] text-muted">{result.correct}/{result.total} doğru</p>
        {passed && nextL?.available && <Button block href={`/akademi/ders/?id=${nextL.id}`}>Sonraki ders: {nextL.title_tr}</Button>}
        {passed && nextL && !nextL.available && <Button block href="/akademi/">Akademiye dön</Button>}
        {passed && lesson.id % 5 === 0 && unit?.test_available && <Button block variant="secondary" href={`/akademi/test/?unite=${lesson.unit}`}>Ünite {lesson.unit} testine geç</Button>}
        {result.wrong.length > 0 && (
          <Button block variant={passed ? 'secondary' : 'primary'} onClick={() => setStep('review')}>
            Pekiştir: {result.wrong.length} hatayı çalış
          </Button>
        )}
        {!passed && <Button block variant="secondary" onClick={() => { setAttempt(attempt + 1); setStep('test'); }}>Testi tekrar çöz</Button>}
        {passed && <Button block variant="ghost" href="/akademi/">Akademiye dön</Button>}
      </Result>
    );
  }
  if (step === 'review' && result) {
    const wrongQs: Question[] = result.wrong.map((i) => lesson.test[i]);
    return (
      <Quiz
        key={`review-${attempt}`}
        questions={wrongQs}
        label={`Ders ${lesson.id} · Pekiştirme (yanlış yaptığın sorular)`}
        exitHref="/akademi/"
        seed={attempt * 13}
        onFinish={() => {
          if (result.score >= PASS_MARK) setStep('result');
          else { setAttempt(attempt + 1); setStep('test'); }
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-bg/90 backdrop-blur-xl">
        <div className="flex h-12 items-center px-1">
          <BackButton href="/akademi/" label="Akademi" />
          <p className="flex-1 truncate pr-1 text-right text-[13px] font-semibold text-muted">Ünite {lesson.unit} · Ders {lesson.id}</p>
          <SoundToggle />
        </div>
        <ol className="flex gap-1.5 px-4 pb-3" aria-label="Ders adımları">
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex((x) => x.key.includes(step));
            return (
              <li key={s.label} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= idx ? 'bg-primary' : 'bg-surface-2'}`} />
                <p className={`mt-1 text-center text-[11px] font-semibold ${i === idx ? 'text-primary' : 'text-muted'}`}>{s.label}</p>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="px-4 pt-5 pb-36">
        {locked && (
          <Card className="mb-4 border-accent/40 bg-accent-soft text-[15px]">
            Bu ders, önceki dersin testini geçince açılır. Yine de göz atabilirsin.
          </Card>
        )}
        {step === 'learn' && <LearnStep lesson={lesson} />}
        {step === 'listen' && <ListenStep lesson={lesson} />}
        {step === 'test-intro' && (
          <div className="pt-6 text-center">
            <div className="text-5xl" aria-hidden>📝</div>
            <h1 className="mt-4 text-[26px] font-bold">Ders sonu testi</h1>
            <p className="mt-2 text-[16px] text-muted">10 soru. Geçmek için en az %{PASS_MARK} (8 doğru) gerekiyor.</p>
            {prev?.score !== undefined && <p className="mt-2 text-[15px]">En iyi puanın: <b>%{prev.score}</b></p>}
          </div>
        )}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-bg/95 px-4 pt-3 pb-3 backdrop-blur">
        {step === 'learn' && <Button block onClick={() => setStep('listen')}>Dinlemeye geç</Button>}
        {step === 'listen' && <Button block onClick={() => setStep('practice')}>Alıştırmalara geç</Button>}
        {step === 'test-intro' && (
          <div className="grid gap-2">
            <Button block onClick={() => setStep('test')}>Teste başla</Button>
            <Button block variant="ghost" onClick={() => setStep('learn')}>Konuyu tekrar oku</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Öğren
function LearnStep({ lesson }: { lesson: Lesson }) {
  return (
    <div className="animate-fade">
      <h1 className="text-[28px] leading-tight font-bold">{lesson.title_tr}</h1>
      <p className="mt-1 text-[15px] font-medium text-primary">{lesson.title_en}</p>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">{lesson.summary_tr}</p>
      <div className="mt-6 grid gap-4">
        {lesson.learn.map((b, i) => <Block key={i} b={b} />)}
      </div>
      <VocabList lesson={lesson} />
    </div>
  );
}

function Block({ b }: { b: LearnBlock }) {
  if (b.type === 'text') return <Rich text={b.tr} className="text-[17px] leading-relaxed" />;
  if (b.type === 'tip')
    return (
      <div className="flex gap-3 rounded-2xl bg-accent-soft p-4">
        <Lightbulb size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <Rich text={b.tr} className="text-[16px] leading-relaxed" />
      </div>
    );
  if (b.type === 'examples')
    return (
      <Card className="p-0">
        {b.title_tr && <p className="px-4 pt-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{b.title_tr}</p>}
        <ul className="divide-y divide-line">
          {b.items.map((x, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-semibold">{x.en}</p>
                <p className="text-[15px] text-muted">{x.tr}</p>
                {x.note_tr && <p className="mt-0.5 text-[13px] text-accent">{x.note_tr}</p>}
              </div>
              <SpeakButton text={x.en} />
            </li>
          ))}
        </ul>
      </Card>
    );
  return (
    <Card className="overflow-x-auto p-0">
      {b.title_tr && <p className="px-4 pt-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{b.title_tr}</p>}
      <table className="w-full text-left text-[15px]">
        <thead><tr>{b.head.map((h, i) => <th key={i} className="border-b border-line px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i} className="even:bg-surface-2/50">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function VocabList({ lesson }: { lesson: Lesson }) {
  const { words, saveWord } = useStore();
  const label = `Ders ${lesson.id} · ${lesson.title_tr}`;
  const allSaved = lesson.vocab.every((v) => words[v.lemma.toLowerCase()]);
  const save = (v: Lesson['vocab'][number]) => saveWord({ lemma: v.lemma.toLowerCase(), meaning_tr: v.tr, example_en: v.ex_en, example_tr: v.ex_tr, source_label: label });
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[20px] font-bold">Bu dersin kelimeleri</h2>
        <button type="button" disabled={allSaved} onClick={() => lesson.vocab.forEach(save)}
          className="h-11 text-[15px] font-semibold text-primary disabled:text-muted">
          {allSaved ? 'Hepsi eklendi ✓' : 'Hepsini ekle'}
        </button>
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {lesson.vocab.map((v) => {
            const saved = !!words[v.lemma.toLowerCase()];
            return (
              <li key={v.lemma} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{v.lemma} <span className="text-[13px] font-normal text-muted">{v.ipa}</span></p>
                  <p className="text-[15px] text-muted">{v.tr}</p>
                </div>
                <SpeakButton text={v.lemma} />
                <button type="button" aria-label={saved ? 'Kelimelerimde' : 'Kelimelerime ekle'} onClick={() => !saved && save(v)}
                  className={`grid h-11 w-11 place-items-center rounded-full ${saved ? 'text-success' : 'text-muted active:bg-surface-2'}`}>
                  {saved ? <BookmarkCheck size={22} /> : <BookmarkPlus size={22} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------- Dinle
function ListenStep({ lesson }: { lesson: Lesson }) {
  const { sequence, on: soundOn, setOn } = useSound();
  const [current, setCurrent] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const playAll = () => {
    if (current !== null) { stop.current?.(); setCurrent(null); return; }
    stop.current = sequence(lesson.listen.map((x) => x.en), 0, { onSentence: setCurrent, onDone: () => setCurrent(null) });
  };
  return (
    <div className="animate-fade">
      <h1 className="text-[28px] font-bold">Dinle ve tekrar et</h1>
      <p className="mt-2 text-[16px] text-muted">Her cümleyi dinle ve yüksek sesle tekrar et. Konuşma, öğrenmenin en hızlı yoludur.</p>
      {!soundOn && (
        <Card className="mt-4 flex items-center gap-3 border-danger/30 bg-danger-soft">
          <VolumeX size={22} className="shrink-0 text-danger" aria-hidden />
          <p className="flex-1 text-[15px]">Ses kapalı. Cümleleri okuyarak çalışabilirsin.</p>
          <Button variant="secondary" className="min-h-[44px] px-4 text-[15px]" onClick={() => setOn(true)}>Sesi aç</Button>
        </Card>
      )}
      <Button block variant="secondary" className="mt-4" onClick={playAll}>
        {current !== null ? <><Square size={18} /> Durdur</> : <><Play size={18} /> Hepsini sırayla dinle</>}
      </Button>
      <ul className="mt-4 grid gap-3">
        {lesson.listen.map((x, i) => (
          <li key={i}>
            <Card className={`flex items-center gap-3 transition ${current === i ? 'border-primary bg-primary-soft' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-[19px] font-semibold">{x.en}</p>
                <p className="text-[15px] text-muted">{x.tr}</p>
              </div>
              <SpeakButton text={x.en} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LessonPage() {
  return <Suspense fallback={<Spinner />}><LessonLoader /></Suspense>;
}
