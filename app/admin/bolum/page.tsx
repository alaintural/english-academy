'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clearContentCache, getChapter } from '@/lib/content';
import { saveChapter } from '@/lib/admin';
import { useStore } from '@/lib/store';
import { words } from '@/lib/tokenize';
import { useSound } from '@/lib/sound';
import type { Chapter, Sentence } from '@/lib/types';
import { AdminGuard, Field, SaveBar, inputCls, jsonCls } from '@/components/AdminGuard';
import { Button, Card, Spinner } from '@/components/ui';

// İngilizce cümle değişince kelime/anlam satırları yeniden hizalanır:
// aynı sıradaki aynı kelimenin anlamı korunur, değilse aynı kelimenin ilk anlamı aranır.
function realign(s: Sentence, en: string): Sentence {
  const oldWords = words(s.en);
  const w = words(en).map((tok, i): [string, string] => {
    if (oldWords[i]?.toLowerCase() === tok.toLowerCase() && s.w[i]) return s.w[i];
    const j = oldWords.findIndex((o) => o.toLowerCase() === tok.toLowerCase());
    return j >= 0 && s.w[j] ? s.w[j] : [tok.toLowerCase(), ''];
  });
  return { ...s, en, w };
}

function ChapterEditor() {
  const params = useSearchParams();
  const book = params.get('kitap') ?? '';
  const n = Number(params.get('bolum') ?? 1);
  const isNew = params.has('yeni');
  const { isAdmin } = useStore();
  const { say } = useSound();
  const [c, setC] = useState<Chapter | null>(null);
  const [bookTitle, setBookTitle] = useState('');
  const [published, setPublished] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [extra, setExtra] = useState({ new_words: '[]', questions: '[]' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin || !supabase) return;
    supabase.from('books').select('title').eq('id', book).single().then(({ data }) => setBookTitle(data?.title ?? book));
    if (isNew) {
      setC({ book, number: n, title_en: '', title_tr: '', sentences: [{ en: '', tr: '', w: [], p: true }], new_words: [], questions: [] });
      setOpen(0);
      return;
    }
    clearContentCache();
    getChapter(book, n).then((ch) => {
      setC(ch);
      setExtra({ new_words: JSON.stringify(ch.new_words, null, 2), questions: JSON.stringify(ch.questions, null, 2) });
    });
    supabase.from('chapters').select('published').eq('id', `${book}-${String(n).padStart(2, '0')}`).single().then(({ data }) => setPublished(!!data?.published));
  }, [book, n, isNew, isAdmin]);

  if (!c) return <AdminGuard title="Bölüm"><Spinner /></AdminGuard>;

  const setS = (i: number, s: Sentence) => setC({ ...c, sentences: c.sentences.map((x, k) => (k === i ? s : x)) });
  const total = c.sentences.reduce((sum, s) => sum + words(s.en).length, 0);
  const missing = c.sentences.reduce((sum, s) => sum + s.w.filter(([l, m]) => !l || !m).length + (s.tr ? 0 : 1), 0);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const chapter = { ...c!, new_words: JSON.parse(extra.new_words), questions: JSON.parse(extra.questions) };
      if (chapter.sentences.some((s) => !s.en.trim())) throw new Error('Boş cümle var');
      await saveChapter(chapter, { published, bookTitle });
      setMsg({ ok: true, text: `Kaydedildi · ${chapter.sentences.length} cümle, ${total} kelime${missing ? ` · ${missing} eksik çeviri/anlam` : ''}` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? `JSON hatası: ${e.message}` : (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <AdminGuard title={`${bookTitle} · Bölüm ${n}`} back={`/admin/kitap/?id=${book}`}>
      <div className="grid gap-3">
        <Field label="Başlık (EN)"><input className={inputCls} value={c.title_en} onChange={(e) => setC({ ...c, title_en: e.target.value })} /></Field>
        <Field label="Başlık (TR)"><input className={inputCls} value={c.title_tr} onChange={(e) => setC({ ...c, title_tr: e.target.value })} /></Field>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-5 w-5" /> Yayında</label>
        <p className={`text-[14px] ${total < 250 || total > 450 ? 'text-accent' : 'text-muted'}`}>
          {c.sentences.length} cümle · {total} kelime (hedef 250–450){missing ? ` · ${missing} eksik` : ''}
        </p>
      </div>

      <h2 className="mt-5 mb-2 text-[18px] font-bold">Cümleler</h2>
      <div className="grid gap-2">
        {c.sentences.map((s, i) => (
          <Card key={i} className="p-0">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start gap-2 p-3 text-left">
              <span className="w-6 pt-0.5 text-[12px] text-muted tabular-nums">{i + 1}</span>
              <span className="flex-1">
                <span className="block text-[15px]">{s.p && '¶ '}{s.en || <i className="text-muted">boş</i>}</span>
                <span className="block text-[13px] text-muted">{s.tr}</span>
              </span>
              {s.w.some(([l, m]) => !l || !m) && <span className="h-2 w-2 rounded-full bg-accent" aria-label="eksik anlam" />}
              <ChevronDown size={18} className={`text-muted ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="grid gap-3 border-t border-line p-3">
                <Field label="İngilizce"><textarea rows={2} className={inputCls} value={s.en} onChange={(e) => setS(i, realign(s, e.target.value))} /></Field>
                <Field label="Türkçe çeviri"><textarea rows={2} className={inputCls} value={s.tr} onChange={(e) => setS(i, { ...s, tr: e.target.value })} /></Field>
                <label className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" checked={!!s.p} onChange={(e) => setS(i, { ...s, p: e.target.checked })} className="h-5 w-5" /> Yeni paragraf başlatır</label>
                <div className="grid gap-1.5">
                  <p className="text-[13px] font-semibold text-muted">Kelime · kök · bağlamsal anlam</p>
                  {words(s.en).map((tok, k) => (
                    <div key={k} className="grid grid-cols-[minmax(64px,auto)_1fr_1.4fr] items-center gap-1.5">
                      <button type="button" onClick={() => say(tok, { explicit: true })} className="truncate text-left text-[14px] font-semibold">{tok}</button>
                      <input aria-label={`${tok} kök`} className={`${inputCls} min-h-10 px-2 text-[15px]`} value={s.w[k]?.[0] ?? ''}
                        onChange={(e) => setS(i, { ...s, w: s.w.map((p, x) => (x === k ? [e.target.value, p[1]] : p)) })} />
                      <input aria-label={`${tok} anlam`} className={`${inputCls} min-h-10 px-2 text-[15px] ${s.w[k]?.[1] ? '' : 'border-accent'}`} value={s.w[k]?.[1] ?? ''}
                        onChange={(e) => setS(i, { ...s, w: s.w.map((p, x) => (x === k ? [p[0], e.target.value] : p)) })} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => { const arr = [...c.sentences]; arr.splice(i + 1, 0, { en: '', tr: '', w: [] }); setC({ ...c, sentences: arr }); setOpen(i + 1); }}>
                    <Plus size={18} /> Altına ekle
                  </Button>
                  <Button variant="danger" onClick={() => { setC({ ...c, sentences: c.sentences.filter((_, k) => k !== i) }); setOpen(null); }} className="px-4">
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Bu bölümde öğretilen kelimeler (JSON)">
          <textarea rows={8} className={jsonCls} value={extra.new_words} onChange={(e) => setExtra({ ...extra, new_words: e.target.value })} spellCheck={false} />
        </Field>
        <Field label="Bölüm sonu soruları (JSON, 5 mcq)">
          <textarea rows={8} className={jsonCls} value={extra.questions} onChange={(e) => setExtra({ ...extra, questions: e.target.value })} spellCheck={false} />
        </Field>
      </div>
      <SaveBar busy={busy} msg={msg} onSave={save} label="Bölümü kaydet" />
    </AdminGuard>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ChapterEditor /></Suspense>;
}
