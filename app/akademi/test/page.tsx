'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUnitTest, getUnits } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { PASS_MARK, unitTestUnlocked } from '@/lib/academy';
import { Quiz, type QuizResult } from '@/components/quiz/Quiz';
import { Result } from '@/components/quiz/Result';
import { BackButton, Button, Card, ErrorBox, Spinner } from '@/components/ui';

function UnitTestFlow() {
  const unit = Number(useSearchParams().get('unite') ?? '1');
  const { data, error, loading } = useData(() => Promise.all([getUnitTest(unit), getUnits()]), [unit]);
  const { progress, getProgress, setProgress, addAttempt } = useStore();
  const [stage, setStage] = useState<'intro' | 'quiz' | 'result' | 'review'>('intro');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [attempt, setAttempt] = useState(1);

  if (loading) return <Spinner />;
  if (error || !data) return <div className="pt-safe px-4"><BackButton href="/akademi/" /><ErrorBox error={error} /></div>;
  const [test, units] = data;
  const meta = units.find((u) => u.id === unit);
  const best = getProgress('test', `unit-${unit}`);
  const ref = `unit-${unit}`;

  if (stage === 'quiz')
    return (
      <Quiz key={attempt} questions={test.questions} label={test.title_tr} exitHref="/akademi/" seed={unit * 11 + attempt}
        onFinish={(r) => {
          const passed = r.score >= PASS_MARK;
          setResult(r);
          setStage('result');
          addAttempt({ ref, score: r.score, passed, wrong: r.wrong });
          setProgress('test', ref, { status: passed ? 'completed' : 'started', score: r.score });
        }} />
    );
  if (stage === 'review' && result)
    return (
      <Quiz key={`r${attempt}`} questions={result.wrong.map((i) => test.questions[i])} label="Pekiştirme · yanlış yaptığın sorular"
        exitHref="/akademi/" seed={attempt * 5} onFinish={() => setStage('result')} />
    );
  if (stage === 'result' && result) {
    const passed = result.score >= PASS_MARK;
    const next = units.find((u) => u.id === unit + 1);
    return (
      <Result score={result.score} passMark={PASS_MARK} title={passed ? `Ünite ${unit} tamamlandı! 🏆` : 'Biraz daha çalışalım'}>
        <p className="mb-2 text-[15px] text-muted">{result.correct}/{result.total} doğru</p>
        {passed && next?.lessons[0]?.available && <Button block href={`/akademi/ders/?id=${next.lessons[0].id}`}>Ünite {next.id}: {next.title_tr}</Button>}
        {passed && <Button block variant="secondary" href="/kutuphane/">Kütüphanede bir hikâye oku</Button>}
        {result.wrong.length > 0 && <Button block variant={passed ? 'ghost' : 'primary'} onClick={() => setStage('review')}>Pekiştir: {result.wrong.length} hata</Button>}
        {!passed && <Button block variant="secondary" onClick={() => { setAttempt(attempt + 1); setStage('quiz'); }}>Testi tekrar çöz</Button>}
        <Button block variant="ghost" href="/akademi/">Akademiye dön</Button>
      </Result>
    );
  }

  const unlocked = meta ? unitTestUnlocked(progress, meta) : false;
  return (
    <div className="pt-safe min-h-dvh px-4">
      <BackButton href="/akademi/" label="Akademi" />
      <div className="pt-8 text-center">
        <div className="text-5xl" aria-hidden>🏆</div>
        <h1 className="mt-4 text-[26px] font-bold">Ünite {unit} testi</h1>
        <p className="mt-1 text-[17px] font-medium text-primary">{meta?.title_tr}</p>
        <p className="mt-3 text-[16px] text-muted">{test.questions.length} soru · ünitedeki 5 dersin hepsinden. Geçme puanı %{PASS_MARK}.</p>
        {best?.score !== undefined && <p className="mt-2 text-[15px]">En iyi puanın: <b>%{best.score}</b></p>}
      </div>
      {!unlocked && (
        <Card className="mt-6 border-accent/40 bg-accent-soft text-[15px]">
          Önerilen: önce ünitedeki 5 dersi tamamla. İstersen yine de deneyebilirsin.
        </Card>
      )}
      <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto max-w-[430px] px-4 pb-4">
        <Button block onClick={() => setStage('quiz')}>Teste başla</Button>
      </div>
    </div>
  );
}

export default function UnitTestPage() {
  return <Suspense fallback={<Spinner />}><UnitTestFlow /></Suspense>;
}
