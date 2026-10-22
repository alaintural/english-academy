'use client';

import { useMemo, useState } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import type { Question } from '@/lib/types';
import { speak } from '@/lib/tts';
import { useStore } from '@/lib/store';
import { Button, SpeakButton } from '../ui';

// Tek soru: cevapla → kontrol et → geri bildirim → devam.
// onDone(correct) yalnızca kullanıcı "Devam" dediğinde çağrılır.

const norm = (s: string) => s.toLowerCase().replace(/[.,!?“”"]/g, '').replace(/\s+/g, ' ').trim();

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TITLES: Record<Question['type'], string> = {
  mcq: 'Doğru cevabı seç',
  fill: 'Boşluğu doldur',
  order: 'Cümleyi sırala',
  match: 'Eşleştir',
  listen: 'Dinle ve seç',
};

export function QuestionCard({ q, seed, onDone }: { q: Question; seed: number; onDone: (correct: boolean) => void }) {
  const { prefs } = useStore();
  const [picked, setPicked] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [matchState, setMatchState] = useState<{ left: number | null; done: number[]; mistakes: number; flash: number | null }>({
    left: null, done: [], mistakes: 0, flash: null,
  });

  const chunks = useMemo(() => (q.type === 'order' ? q.answer.replace(/[.?!]$/, '').trim().split(/\s+/) : []), [q]);
  const shuffled = useMemo(() => {
    if (q.type !== 'order') return [];
    let s = shuffle(chunks.map((_, i) => i), seed);
    if (s.every((v, i) => v === i) && s.length > 1) s = [...s.slice(1), s[0]];
    return s;
  }, [q, chunks, seed]);
  const rightCol = useMemo(() => (q.type === 'match' ? shuffle(q.pairs.map((_, i) => i), seed + 7) : []), [q, seed]);

  const say = (t: string) => speak(t, { rate: prefs.rate, voice: prefs.voice });

  function check() {
    let ok = false;
    if (q.type === 'mcq' || q.type === 'fill' || q.type === 'listen') ok = picked === q.answer;
    if (q.type === 'order') ok = norm(order.map((i) => chunks[i]).join(' ')) === norm(q.answer);
    if (q.type === 'match') ok = matchState.mistakes === 0;
    setChecked(ok);
    if (q.type === 'order' || (ok && q.type !== 'match')) {
      const text = q.type === 'order' ? q.answer : q.type === 'listen' ? q.audio : null;
      if (text) say(text);
    }
  }

  const canCheck =
    checked === null &&
    ((q.type === 'order' && order.length === chunks.length) ||
      (q.type === 'match' && matchState.done.length === q.pairs.length) ||
      ((q.type === 'mcq' || q.type === 'fill' || q.type === 'listen') && picked !== null));

  // ------------------------------------------------------------ seçenekli türler
  const options = (opts: string[], answer: number) => (
    <div className="mt-5 grid gap-3">
      {opts.map((o, i) => {
        const state = checked === null ? (picked === i ? 'picked' : '') : i === answer ? 'right' : picked === i ? 'wrong' : 'dim';
        const cls = {
          '': 'border-line bg-surface',
          picked: 'border-primary bg-primary-soft',
          right: 'border-success bg-success-soft',
          wrong: 'border-danger bg-danger-soft',
          dim: 'border-line bg-surface opacity-50',
        }[state];
        return (
          <button key={i} type="button" disabled={checked !== null} onClick={() => setPicked(i)}
            className={`flex min-h-[56px] items-center gap-3 rounded-2xl border-2 px-4 text-left text-[18px] font-medium transition ${cls}`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-[13px] text-muted">{String.fromCharCode(65 + i)}</span>
            <span className="flex-1">{o}</span>
            {state === 'right' && <Check className="text-success" size={22} aria-label="doğru" />}
            {state === 'wrong' && <X className="text-danger" size={22} aria-label="yanlış" />}
          </button>
        );
      })}
    </div>
  );

  let body: React.ReactNode = null;
  if (q.type === 'mcq') {
    body = (
      <>
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[21px] leading-snug font-semibold">{q.prompt}</p>
          {/[a-z]/i.test(q.prompt) && !/[ğüşıöçĞÜŞİÖÇ]/.test(q.prompt) && <SpeakButton text={q.prompt} />}
        </div>
        {q.prompt_tr && <p className="mt-1 text-[15px] text-muted">{q.prompt_tr}</p>}
        {options(q.options, q.answer)}
      </>
    );
  } else if (q.type === 'fill') {
    const [a, b] = q.prompt.split('___');
    const fillWord = picked !== null ? q.options[picked] : null;
    body = (
      <>
        <p className="text-[22px] leading-relaxed font-semibold">
          {a}
          <span className={`mx-1 inline-block min-w-[72px] rounded-lg border-b-2 px-2 text-center ${fillWord ? 'border-primary text-primary' : 'border-muted text-transparent'}`}>
            {fillWord ?? '___'}
          </span>
          {b}
        </p>
        {q.tr && <p className="mt-1 text-[15px] text-muted">{q.tr}</p>}
        {options(q.options, q.answer)}
      </>
    );
  } else if (q.type === 'listen') {
    body = (
      <>
        {q.prompt_tr && <p className="text-[17px] text-muted">{q.prompt_tr}</p>}
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => say(q.audio)} aria-label="Sesi çal"
            className="grid h-24 w-24 place-items-center rounded-full bg-primary text-on-primary shadow-lg active:scale-95">
            <Volume2 size={40} />
          </button>
        </div>
        <button type="button" onClick={() => speak(q.audio, { rate: 0.55, voice: prefs.voice })} className="mx-auto mt-2 block h-11 text-[15px] text-primary">
          🐢 Yavaş dinle
        </button>
        {options(q.options, q.answer)}
      </>
    );
  } else if (q.type === 'order') {
    body = (
      <>
        <p className="text-[17px] text-muted">{q.tr}</p>
        <div className="mt-4 flex min-h-[64px] flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed border-line p-3">
          {order.map((ci, k) => (
            <button key={`${ci}-${k}`} type="button" disabled={checked !== null}
              onClick={() => setOrder(order.filter((_, j) => j !== k))}
              className="min-h-[44px] rounded-xl bg-primary-soft px-3 text-[18px] font-medium text-primary">
              {chunks[ci]}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {shuffled.map((ci) => {
            const used = order.includes(ci);
            return (
              <button key={ci} type="button" disabled={used || checked !== null} onClick={() => setOrder([...order, ci])}
                className={`min-h-[44px] rounded-xl border border-line px-3 text-[18px] font-medium ${used ? 'opacity-0' : 'bg-surface'}`}>
                {chunks[ci]}
              </button>
            );
          })}
        </div>
        {checked === false && (
          <p className="mt-4 text-[15px]">Doğrusu: <b>{q.answer}</b></p>
        )}
      </>
    );
  } else if (q.type === 'match') {
    const { left, done, flash } = matchState;
    const tapRight = (ri: number) => {
      if (left === null || checked !== null) return;
      if (ri === left) {
        say(q.pairs[left][0]);
        setMatchState({ ...matchState, left: null, done: [...done, left] });
      } else {
        setMatchState({ ...matchState, mistakes: matchState.mistakes + 1, flash: ri });
        setTimeout(() => setMatchState((s) => ({ ...s, flash: null })), 450);
      }
    };
    body = (
      <>
        <p className="text-[17px] text-muted">{q.prompt_tr ?? 'İngilizce kelimeyi Türkçesiyle eşleştir.'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="grid gap-3">
            {q.pairs.map(([en], i) => (
              <button key={i} type="button" disabled={done.includes(i)}
                onClick={() => setMatchState({ ...matchState, left: i })}
                className={`min-h-[56px] rounded-2xl border-2 px-2 text-[17px] font-medium ${done.includes(i) ? 'border-success/40 bg-success-soft text-success opacity-60' : left === i ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}>
                {en}
              </button>
            ))}
          </div>
          <div className="grid gap-3">
            {rightCol.map((ri) => (
              <button key={ri} type="button" disabled={done.includes(ri)} onClick={() => tapRight(ri)}
                className={`min-h-[56px] rounded-2xl border-2 px-2 text-[17px] ${done.includes(ri) ? 'border-success/40 bg-success-soft text-success opacity-60' : flash === ri ? 'animate-pop border-danger bg-danger-soft' : 'border-line bg-surface'}`}>
                {q.pairs[ri][1]}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  const explain = 'explain_tr' in q ? q.explain_tr : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{TITLES[q.type]}</p>
      <div className="flex-1">{body}</div>

      <div className="pb-safe sticky bottom-0 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 pt-3 pb-3 backdrop-blur">
        {checked !== null && (
          <div className={`animate-fade mb-3 rounded-2xl p-3 ${checked ? 'bg-success-soft' : 'bg-danger-soft'}`} role="status">
            <p className={`font-bold ${checked ? 'text-success' : 'text-danger'}`}>
              {checked ? 'Harika, doğru! 🎉' : q.type === 'match' ? 'Tamamlandı ama hatalar var' : 'Yanlış'}
            </p>
            {!checked && explain && <p className="mt-1 text-[15px]">{explain}</p>}
          </div>
        )}
        {checked === null ? (
          <Button block onClick={check} disabled={!canCheck}>Kontrol et</Button>
        ) : (
          <Button block variant={checked ? 'success' : 'primary'} onClick={() => onDone(checked)}>Devam</Button>
        )}
      </div>
    </div>
  );
}
