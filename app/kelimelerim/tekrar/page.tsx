'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isDue } from '@/lib/srs';
import { useSound } from '@/lib/sound';
import { getVocabulary } from '@/lib/content';
import { useData } from '@/lib/useData';
import type { UserWord } from '@/lib/types';
import { Button, Empty, ProgressBar, SoundToggle, SpeakButton, Spinner } from '@/components/ui';
import { Result } from '@/components/quiz/Result';

const SESSION = 15;

// Tekrar oturumu: vadesi gelen kelimeler (yoksa en zayıf kutudakiler).
// Kartlar sırayla çoktan seçmeli ve "hatırlıyor musun?" kartı olarak gelir.
// Yanlış bilinen kelime 1. kutuya döner ve oturum sonunda bir kez daha sorulur.
export default function ReviewPage() {
  const { words, ready, reviewWord } = useStore();
  const { say } = useSound();
  const { data: bank } = useData(getVocabulary, []);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (!ready || queue) return;
    const all = Object.values(words).filter((w) => w.status === 'learning');
    const due = all.filter((w) => isDue(w));
    const pool = (due.length ? due : all).sort((a, b) => a.box - b.box || Date.parse(a.due_at) - Date.parse(b.due_at));
    setQueue(pool.slice(0, SESSION).map((w) => w.lemma));
  }, [ready, words, queue]);

  const word: UserWord | undefined = queue ? words[queue[i]?.toLowerCase()] : undefined;
  const mcq = i % 2 === 0;
  const options = useMemo(() => {
    if (!word) return [];
    const others = [
      ...Object.values(words).map((w) => w.meaning_tr),
      ...(bank ?? []).map((v) => v.tr),
    ].filter((m, k, a) => m !== word.meaning_tr && a.indexOf(m) === k);
    const pick: string[] = [];
    let seed = word.lemma.length * 17 + i;
    while (pick.length < 3 && others.length) {
      seed = (seed * 9301 + 49297) % 233280;
      pick.push(others.splice(seed % others.length, 1)[0]);
    }
    const pos = (word.lemma.charCodeAt(0) + i) % (pick.length + 1);
    pick.splice(pos, 0, word.meaning_tr);
    return pick;
  }, [word, words, bank, i]);

  if (!ready || !queue) return <Spinner />;
  if (!queue.length)
    return (
      <div className="pt-safe px-4">
        <Link href="/kelimelerim/" className="flex h-12 items-center text-primary">‹ Kelimelerim</Link>
        <Empty icon={<span className="text-3xl">🌱</span>} title="Tekrar edilecek kelime yok">
          Okurken ve derslerde kelime kaydet; zamanı gelince burada tekrar edeceksin.
        </Empty>
      </div>
    );
  if (i >= queue.length || !word)
    return (
      <Result score={Math.round((stats.right / Math.max(1, stats.right + stats.wrong)) * 100)} title="Tekrar tamamlandı">
        <p className="mb-2 text-[15px] text-muted">✓ {stats.right} bildin · ✗ {stats.wrong} tekrar edilecek</p>
        <Button block href="/kelimelerim/">Kelimelerime dön</Button>
        <Button block variant="secondary" href="/">Ana sayfa</Button>
      </Result>
    );

  const answer = (ok: boolean) => {
    reviewWord(word.lemma, ok);
    setStats((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }));
    // Yanlışsa sona bir kez daha ekle
    if (!ok && queue.indexOf(word.lemma, i + 1) === -1) setQueue([...queue, word.lemma]);
  };
  const next = () => { setI(i + 1); setRevealed(false); setPicked(null); };

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="pt-safe flex h-14 items-center gap-3 px-2">
        <Link href="/kelimelerim/" aria-label="Çık" className="grid h-11 w-11 place-items-center text-muted"><X size={26} /></Link>
        <ProgressBar value={(i / queue.length) * 100} className="h-3 flex-1" />
        <span className="text-right text-[14px] font-semibold text-muted tabular-nums">{i + 1}/{queue.length}</span>
        <SoundToggle />
      </div>

      <div className="flex flex-1 flex-col px-4 pt-6">
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">{mcq ? 'Anlamını seç' : 'Hatırlıyor musun?'}</p>
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="font-serif text-[40px] font-bold">{word.lemma}</p>
          <SpeakButton text={word.lemma} className="mt-2 h-14 w-14" size={26} />
          {word.example_en && (revealed || picked !== null || mcq) && (
            <p className="mt-4 font-serif text-[17px] text-muted">“{word.example_en}”</p>
          )}
        </div>

        {mcq ? (
          <div className="mt-8 grid gap-3">
            {options.map((o, k) => {
              const right = o === word.meaning_tr;
              const cls = picked === null ? 'border-line bg-surface' : right ? 'border-success bg-success-soft' : picked === k ? 'border-danger bg-danger-soft' : 'border-line bg-surface opacity-50';
              return (
                <button key={k} type="button" disabled={picked !== null}
                  onClick={() => { setPicked(k); answer(right); if (right) say(word.lemma); }}
                  className={`min-h-[56px] rounded-2xl border-2 px-4 text-left text-[18px] font-medium ${cls}`}>{o}</button>
              );
            })}
          </div>
        ) : revealed ? (
          <div className="animate-fade mt-8 rounded-2xl bg-primary-soft p-5 text-center">
            <p className="text-[24px] font-bold text-primary">{word.meaning_tr}</p>
            {word.example_tr && <p className="mt-1 text-[15px] text-muted">{word.example_tr}</p>}
          </div>
        ) : null}

        <div className="pb-safe mt-auto grid gap-2 py-4">
          {mcq && picked !== null && <Button block onClick={next}>Devam</Button>}
          {!mcq && !revealed && <Button block variant="secondary" onClick={() => setRevealed(true)}>Anlamını göster</Button>}
          {!mcq && revealed && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="danger" onClick={() => { answer(false); next(); }}>Bilemedim</Button>
              <Button variant="success" onClick={() => { answer(true); next(); }}>Bildim</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
