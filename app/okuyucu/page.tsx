'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight, Languages, Pause, Play, Type } from 'lucide-react';
import { getBook, getChapter, getVocabulary } from '@/lib/content';
import { useData } from '@/lib/useData';
import { useStore } from '@/lib/store';
import { segment, words } from '@/lib/tokenize';
import { chapterId } from '@/lib/paths';
import { speak, speakSequence, stopSpeaking } from '@/lib/tts';
import type { BookWithChapters, Chapter, Sentence, VocabWithSource } from '@/lib/types';
import { Quiz, type QuizResult } from '@/components/quiz/Quiz';
import { Result } from '@/components/quiz/Result';
import { Badge, Button, ErrorBox, IconButton, Sheet, SpeakButton, Spinner } from '@/components/ui';
import { ReaderSettings } from '@/components/ReaderSettings';

type WordSel = { si: number; wi: number };

function Reader() {
  const params = useSearchParams();
  const bookId = params.get('kitap') ?? '';
  const n = Number(params.get('bolum') ?? '1');
  const { data, error, loading } = useData(
    () => Promise.all([getBook(bookId), getChapter(bookId, n), getVocabulary()]),
    [bookId, n],
  );
  if (loading) return <Spinner />;
  if (error || !data?.[0]) return <div className="pt-safe px-4"><ErrorBox error={error ?? new Error('Kitap bulunamadı')} /></div>;
  return <ReaderView key={`${bookId}-${n}`} book={data[0]} chapter={data[1]} vocab={data[2]} />;
}

function ReaderView({ book, chapter, vocab }: { book: BookWithChapters; chapter: Chapter; vocab: VocabWithSource[] }) {
  const { prefs, words: myWords, saveWord, removeWord, getProgress, setProgress, addAttempt } = useStore();
  const cid = chapterId(book.id, chapter.number);
  const ref = `chapter-${cid}`;
  const [wordSel, setWordSel] = useState<WordSel | null>(null);
  const [sentSel, setSentSel] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [mode, setMode] = useState<'read' | 'quiz' | 'result'>('read');
  const [result, setResult] = useState<QuizResult | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const sentenceEls = useRef<(HTMLElement | null)[]>([]);
  const topVisible = useRef(0);

  const vocabMap = useMemo(() => new Map(vocab.map((v) => [v.lemma.toLowerCase(), v])), [vocab]);
  const newWords = useMemo(() => new Set(chapter.new_words.map((v) => v.lemma.toLowerCase())), [chapter]);
  const savedHere = chapter.sentences.flatMap((s) => s.w.map(([l]) => l.toLowerCase())).filter((l, i, a) => a.indexOf(l) === i && myWords[l]).length;

  // ---------------------------------------------------------------- kaldığın yer
  useEffect(() => {
    const saved = getProgress('chapter', cid);
    if (!saved) setProgress('chapter', cid, { status: 'started', position: 0 });
    else if (saved.position && saved.position > 0) {
      requestAnimationFrame(() => sentenceEls.current[saved.position!]?.scrollIntoView({ block: 'center' }));
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.i);
          if (e.isIntersecting && e.boundingClientRect.top < window.innerHeight / 2) topVisible.current = i;
        }
      },
      { rootMargin: '-80px 0px -40% 0px' },
    );
    sentenceEls.current.forEach((el) => el && io.observe(el));
    const save = () => setProgress('chapter', cid, { position: topVisible.current });
    const t = setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    return () => {
      io.disconnect();
      clearInterval(t);
      window.removeEventListener('pagehide', save);
      save();
      stopRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  // ---------------------------------------------------------------- dinleme modu
  const togglePlay = useCallback(() => {
    if (playing) {
      stopRef.current?.();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    stopRef.current = speakSequence(chapter.sentences.map((s) => s.en), current ?? topVisible.current, {
      rate: prefs.rate,
      voice: prefs.voice,
      onSentence: (i) => {
        setCurrent(i);
        sentenceEls.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      },
      onDone: () => {
        setPlaying(false);
        setCurrent(null);
      },
    });
  }, [playing, chapter, current, prefs.rate, prefs.voice]);

  const openWord = (si: number, wi: number) => {
    if (playing) { stopRef.current?.(); setPlaying(false); }
    setWordSel({ si, wi });
    speak(words(chapter.sentences[si].en)[wi] ?? '', { rate: prefs.rate, voice: prefs.voice });
  };

  const prev = book.chapters.find((c) => c.number === chapter.number - 1);
  const next = book.chapters.find((c) => c.number === chapter.number + 1);

  // ---------------------------------------------------------------- test modları
  if (mode === 'quiz')
    return (
      <Quiz
        questions={chapter.questions}
        label={`${book.title} · Bölüm ${chapter.number} · Anlama soruları`}
        exitHref={`/okuyucu/?kitap=${book.id}&bolum=${chapter.number}`}
        seed={chapter.number}
        onFinish={(r) => {
          setResult(r);
          setMode('result');
          setProgress('chapter', cid, { status: 'completed', score: r.score });
          addAttempt({ ref, score: r.score, passed: r.score >= 60, wrong: r.wrong });
        }}
      />
    );
  if (mode === 'result' && result)
    return (
      <Result score={result.score} title={`Bölüm ${chapter.number} tamamlandı`}>
        <p className="mb-2 text-[15px] text-muted">{result.correct}/{result.total} soruyu doğru cevapladın.</p>
        {next ? (
          <Button block href={`/okuyucu/?kitap=${book.id}&bolum=${next.number}`}>Sonraki bölüm: {next.title_en}</Button>
        ) : (
          <Button block href={`/kutuphane/kitap/?id=${book.id}`}>Kitabı bitirdin! 📚</Button>
        )}
        <Button block variant="secondary" onClick={() => { setMode('read'); window.scrollTo(0, 0); }}>Bölümü tekrar oku</Button>
      </Result>
    );

  const sel = wordSel ? chapter.sentences[wordSel.si] : null;
  const selWord = sel && wordSel ? segment(sel.en).filter((s) => s.word)[wordSel.wi]?.text : '';
  const [selLemma, selMeaning] = sel && wordSel ? sel.w[wordSel.wi] : ['', ''];
  const selVocab = vocabMap.get(selLemma.toLowerCase());
  const isName = /^[A-Z]/.test(selLemma) && selLemma !== 'I';
  const saved = !!myWords[selLemma.toLowerCase()];

  const paragraphs: number[][] = [];
  chapter.sentences.forEach((s, i) => {
    if (s.p || !paragraphs.length) paragraphs.push([i]);
    else paragraphs[paragraphs.length - 1].push(i);
  });

  return (
    <div className="min-h-dvh bg-reader">
      {/* üst çubuk */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-reader/90 backdrop-blur-xl">
        <div className="flex h-12 items-center gap-1 px-1">
          <Link href={`/kutuphane/kitap/?id=${book.id}`} aria-label="Kitaba dön" className="grid h-11 w-11 place-items-center text-primary">
            <ChevronLeft size={28} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p lang="en" className="truncate text-[11px] font-semibold tracking-wider text-muted uppercase">{book.title}</p>
            <p className="truncate text-[15px] font-semibold">Bölüm {chapter.number} — {chapter.title_en}</p>
          </div>
          <IconButton label="Okuma ayarları" onClick={() => setSettings(true)}><Type size={22} /></IconButton>
        </div>
      </header>

      <article className="px-5 pt-6 pb-40">
        <div className="mb-6 flex items-center gap-2">
          <Badge tone="primary">A1</Badge>
          <span className="text-[13px] text-muted">{chapter.title_tr}</span>
        </div>
        <p className="mb-6 rounded-xl bg-surface-2/70 px-3 py-2 text-[13px] text-muted">
          Anlamı için <b>kelimeye</b>, cümlenin Türkçesi için <b>cümle sonundaki noktaya</b> dokun.
        </p>
        <div
          lang="en"
          className={prefs.serif ? 'font-serif' : 'font-sans'}
          style={{ fontSize: prefs.fontSize, lineHeight: 1.75 }}
        >
          {paragraphs.map((idxs) => (
            <p key={idxs[0]} className="mb-[0.9em]">
              {idxs.map((si) => (
                <SentenceView
                  key={si}
                  s={chapter.sentences[si]}
                  si={si}
                  refEl={(el) => { sentenceEls.current[si] = el; }}
                  active={current === si}
                  selected={wordSel?.si === si ? wordSel.wi : null}
                  saved={myWords}
                  newWords={newWords}
                  onWord={openWord}
                  onEnd={(i) => { setSentSel(i); speak(chapter.sentences[i].en, { rate: prefs.rate, voice: prefs.voice }); }}
                />
              ))}
            </p>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="text-[17px] font-semibold">Bölüm bitti 🎯</p>
          <p className="mt-1 text-[15px] text-muted">Anladıklarını 5 kısa soruyla kontrol et.</p>
          <Button block className="mt-4" onClick={() => { stopRef.current?.(); setPlaying(false); setMode('quiz'); }}>
            Bölüm sonu soruları
          </Button>
          <div className="mt-3 flex justify-between">
            {prev ? (
              <Link href={`/okuyucu/?kitap=${book.id}&bolum=${prev.number}`} className="flex h-11 items-center text-[15px] text-primary">
                <ChevronLeft size={18} /> Önceki
              </Link>
            ) : <span />}
            {next && (
              <Link href={`/okuyucu/?kitap=${book.id}&bolum=${next.number}`} className="flex h-11 items-center text-[15px] text-primary">
                Sonraki <ChevronRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* alt araç çubuğu */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-surface/92 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4">
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Durdur' : 'Bölümü dinle'}
            className="grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary shadow active:scale-95">
            {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{playing ? 'Dinleniyor…' : 'Bölümü dinle'}</p>
            <p className="text-[13px] text-muted">Hız ×{prefs.rate.toFixed(2)} · {savedHere} kelime kaydedildi</p>
          </div>
          <Link href="/kelimelerim/" className="flex h-11 items-center gap-1 rounded-full bg-surface-2 px-3 text-[14px] font-semibold">
            <BookmarkCheck size={18} className="text-primary" /> {savedHere}
          </Link>
        </div>
      </div>

      {/* kelime kartı */}
      <Sheet open={!!wordSel} onClose={() => setWordSel(null)}>
        {sel && (
          <div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[30px] leading-tight font-bold">{selWord}</p>
                <p className="text-[15px] text-muted">
                  {selLemma.toLowerCase() !== selWord.toLowerCase() && <>kök: <b className="text-ink">{selLemma}</b> · </>}
                  {selVocab?.ipa && <span>{selVocab.ipa} · </span>}
                  {selVocab?.pos && <span>{posTr(selVocab.pos)}</span>}
                </p>
              </div>
              <SpeakButton text={selWord} label="Kelimeyi dinle" size={22} className="h-12 w-12" />
            </div>
            <div className="mt-4 rounded-2xl bg-primary-soft p-4">
              <p className="text-[12px] font-semibold tracking-wide text-primary uppercase">Bu cümlede</p>
              <p className="mt-0.5 text-[22px] font-semibold">{selMeaning}</p>
              {selVocab && selVocab.tr !== selMeaning && <p className="mt-1 text-[15px] text-muted">Sözlük: {selVocab.tr}</p>}
            </div>
            <div className="mt-4">
              <p className="font-serif text-[17px] leading-snug">{sel.en}</p>
              <p className="mt-1 text-[15px] text-muted">{sel.tr}</p>
            </div>
            {!isName && (
              <Button
                block
                className="mt-5"
                variant={saved ? 'secondary' : 'primary'}
                onClick={() =>
                  saved
                    ? removeWord(selLemma)
                    : saveWord({
                        lemma: selLemma.toLowerCase(),
                        meaning_tr: selVocab?.tr ?? selMeaning,
                        example_en: sel.en,
                        example_tr: sel.tr,
                        source_label: `${book.title} · Bölüm ${chapter.number}`,
                      })
                }
              >
                {saved ? <><BookmarkCheck size={20} /> Kelimelerimde · Kaldır</> : <><BookmarkPlus size={20} /> Kelimelerime ekle</>}
              </Button>
            )}
          </div>
        )}
      </Sheet>

      {/* cümle çevirisi */}
      <Sheet open={sentSel !== null} onClose={() => setSentSel(null)} title="Cümlenin Türkçesi">
        {sentSel !== null && (
          <div>
            <div className="flex items-start gap-3">
              <p className="flex-1 font-serif text-[19px] leading-snug">{chapter.sentences[sentSel].en}</p>
              <SpeakButton text={chapter.sentences[sentSel].en} label="Cümleyi dinle" />
            </div>
            <div className="mt-4 flex gap-3 rounded-2xl bg-accent-soft p-4">
              <Languages size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <p className="text-[18px] leading-snug">{chapter.sentences[sentSel].tr}</p>
            </div>
            <button type="button" onClick={() => speak(chapter.sentences[sentSel].en, { rate: 0.55, voice: prefs.voice })}
              className="mt-3 h-11 text-[15px] font-medium text-primary">🐢 Yavaş dinle</button>
          </div>
        )}
      </Sheet>

      <ReaderSettings open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

function SentenceView({
  s, si, refEl, active, selected, saved, newWords, onWord, onEnd,
}: {
  s: Sentence; si: number; refEl: (el: HTMLElement | null) => void; active: boolean; selected: number | null;
  saved: Record<string, unknown>; newWords: Set<string>; onWord: (si: number, wi: number) => void; onEnd: (si: number) => void;
}) {
  const segs = segment(s.en);
  // Cümle sonundaki noktalama (son kelimeden sonraki ilk .!? içeren parça) dokunulabilir olur.
  let lastWord = -1;
  segs.forEach((g, i) => { if (g.word) lastWord = i; });
  let wi = -1;
  return (
    <span ref={refEl} data-i={si} className={`rounded transition-colors ${active ? 'bg-mark' : ''}`}>
      {segs.map((g, i) => {
        if (g.word) {
          wi++;
          const idx = wi;
          const lemma = s.w[idx]?.[0]?.toLowerCase() ?? '';
          const isSaved = !!saved[lemma];
          const isNew = newWords.has(lemma);
          return (
            <button key={i} type="button" onClick={() => onWord(si, idx)}
              className={`inline rounded-[4px] px-[1px] text-left transition-colors active:bg-primary-soft ${selected === idx ? 'bg-primary-soft text-primary' : ''} ${isSaved ? 'underline decoration-primary decoration-2 underline-offset-4' : isNew ? 'underline decoration-accent/60 decoration-dotted decoration-2 underline-offset-4' : ''}`}>
              {g.text}
            </button>
          );
        }
        if (i > lastWord && /[.!?]/.test(g.text)) {
          const [lead, punct, rest] = splitPunct(g.text);
          return (
            <span key={i}>
              {lead}
              {/* Nokta normal metin gibi durur; görünmez geniş dokunma alanı (after:) parmakla kolay basılsın diye */}
              <button type="button" onClick={() => onEnd(si)} aria-label="Cümlenin Türkçesi"
                className="relative inline rounded-sm px-[2px] font-bold text-accent after:absolute after:-inset-x-2.5 after:-inset-y-2 after:content-[''] active:bg-accent-soft">
                {punct}
              </button>
              {rest}
            </span>
          );
        }
        return <span key={i}>{g.text}</span>;
      })}{' '}
    </span>
  );
}

// "”." gibi parçalarda yalnızca son noktalama işaretini butona çevirir.
function splitPunct(t: string): [string, string, string] {
  const m = t.match(/^(.*?)([.!?]+)([^.!?]*)$/s);
  return m ? [m[1], m[2], m[3]] : ['', t, ''];
}

const POS: Record<string, string> = {
  noun: 'isim', verb: 'fiil', adj: 'sıfat', adjective: 'sıfat', adv: 'zarf', adverb: 'zarf', pron: 'zamir', pronoun: 'zamir',
  prep: 'edat', preposition: 'edat', det: 'belirleyici', num: 'sayı', conj: 'bağlaç', phrase: 'kalıp', name: 'özel isim', interj: 'ünlem',
};
const posTr = (p: string) => POS[p.toLowerCase()] ?? p;

export default function ReaderPage() {
  return <Suspense fallback={<Spinner />}><Reader /></Suspense>;
}
