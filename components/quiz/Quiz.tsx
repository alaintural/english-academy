'use client';

import Link from 'next/link';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { Question } from '@/lib/types';
import { ProgressBar } from '../ui';
import { QuestionCard } from './QuestionCard';

export type QuizResult = { correct: number; total: number; score: number; wrong: number[] };

/** Soruları sırayla sorar; bitince sonucu bildirir. */
export function Quiz({
  questions, label, exitHref, onFinish, seed = 1,
}: {
  questions: Question[]; label: string; exitHref: string; onFinish: (r: QuizResult) => void; seed?: number;
}) {
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);

  const done = (ok: boolean) => {
    const w = ok ? wrong : [...wrong, i];
    setWrong(w);
    if (i + 1 >= questions.length) {
      const correct = questions.length - w.length;
      onFinish({ correct, total: questions.length, score: Math.round((correct / questions.length) * 100), wrong: w });
    } else setI(i + 1);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="pt-safe sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-2">
          <Link href={exitHref} aria-label="Çık" className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-surface-2">
            <X size={26} />
          </Link>
          <ProgressBar value={(i / questions.length) * 100} className="h-3 flex-1" />
          <span className="w-14 pr-2 text-right text-[14px] font-semibold text-muted tabular-nums">{i + 1}/{questions.length}</span>
        </div>
        <p className="px-4 pb-2 text-[13px] text-muted">{label}</p>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-2">
        <QuestionCard key={i} q={questions[i]} seed={seed * 31 + i} onDone={done} />
      </div>
    </div>
  );
}
