'use client';

import type { ReactNode } from 'react';
import { ProgressRing } from '../ui';

export function Result({ score, passMark, title, children }: { score: number; passMark?: number; title: string; children: ReactNode }) {
  const passed = passMark === undefined || score >= passMark;
  return (
    <div className="pt-safe animate-fade flex min-h-dvh flex-col items-center px-6 pt-16 text-center">
      <div className="text-5xl" aria-hidden>{passed ? '🎉' : '💪'}</div>
      <h1 className="mt-4 text-[26px] font-bold">{title}</h1>
      <div className="mt-6">
        <ProgressRing value={score} size={150} stroke={12}>
          <div>
            <div className="text-[38px] font-bold tabular-nums">%{score}</div>
            {passMark !== undefined && <div className="text-[13px] text-muted">geçme: %{passMark}</div>}
          </div>
        </ProgressRing>
      </div>
      <p className={`mt-5 text-[17px] font-semibold ${passed ? 'text-success' : 'text-danger'}`}>
        {passMark === undefined ? 'Tamamlandı' : passed ? 'Başarılı! Sonraki adıma geçebilirsin.' : `Geçmek için en az %${passMark} gerekiyor.`}
      </p>
      <div className="pb-safe mt-auto grid w-full gap-3 pt-8 pb-6">{children}</div>
    </div>
  );
}
