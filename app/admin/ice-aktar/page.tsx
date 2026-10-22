'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { saveBook, saveChapter, saveLesson, saveUnitTest } from '@/lib/admin';
import { words } from '@/lib/tokenize';
import type { BookMeta, Chapter, Lesson, UnitTest } from '@/lib/types';
import { AdminGuard, Field, SaveBar, jsonCls } from '@/components/AdminGuard';
import { Card } from '@/components/ui';

// content/ klasöründeki biçimde (content/README.md) JSON içe aktarır.
// Tek nesne ya da dizi kabul edilir: kitap, bölüm, ders, ünite testi.
type Item =
  | { kind: 'book'; v: BookMeta }
  | { kind: 'chapter'; v: Chapter }
  | { kind: 'lesson'; v: Lesson }
  | { kind: 'unit'; v: UnitTest };

function classify(x: Record<string, unknown>): Item {
  if ('sentences' in x) return { kind: 'chapter', v: x as unknown as Chapter };
  if ('learn' in x) return { kind: 'lesson', v: x as unknown as Lesson };
  if ('cover' in x) return { kind: 'book', v: x as unknown as BookMeta };
  if ('unit' in x && 'questions' in x) return { kind: 'unit', v: x as unknown as UnitTest };
  throw new Error('Tanınmayan nesne: kitap, bölüm, ders veya ünite testi bekleniyor');
}

function describe(it: Item) {
  if (it.kind === 'book') return `Kitap: ${it.v.title} (${it.v.id})`;
  if (it.kind === 'lesson') return `Ders ${it.v.id}: ${it.v.title_tr} · ${it.v.test.length} test sorusu`;
  if (it.kind === 'unit') return `Ünite ${it.v.unit} testi · ${it.v.questions.length} soru`;
  const c = it.v;
  const bad = c.sentences.filter((s) => s.w.length !== words(s.en).length).length;
  const total = c.sentences.reduce((n, s) => n + words(s.en).length, 0);
  return `Bölüm: ${c.book} #${c.number} ${c.title_en} · ${c.sentences.length} cümle · ${total} kelime${bad ? ` · ⚠️ ${bad} hizalama hatası` : ''}`;
}

export default function ImportPage() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const parse = (t: string) => {
    setText(t);
    setMsg(null);
    try {
      const raw = JSON.parse(t);
      setItems((Array.isArray(raw) ? raw : [raw]).map(classify));
    } catch (e) {
      setItems([]);
      if (t.trim()) setMsg({ ok: false, text: (e as Error).message });
    }
  };

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      for (const it of items) {
        if (it.kind === 'book') await saveBook({ ...it.v, published: false });
        if (it.kind === 'lesson') await saveLesson(it.v, true);
        if (it.kind === 'unit') await saveUnitTest(it.v.unit, it.v.questions);
        if (it.kind === 'chapter') {
          const { data } = await supabase!.from('books').select('title').eq('id', it.v.book).single();
          if (!data) throw new Error(`Önce '${it.v.book}' kitabını ekleyin`);
          await saveChapter(it.v, { published: true, bookTitle: data.title });
        }
      }
      setMsg({ ok: true, text: `${items.length} öğe içe aktarıldı. Yeni kitapları kitap sayfasından yayına alın.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <AdminGuard title="İçe aktar">
      <p className="mb-3 text-[14px] text-muted">
        Biçim depodaki <code>content/README.md</code> ile aynıdır. Kitap, bölüm, ders veya ünite testi; tek nesne ya da dizi.
        Aynı kimlikli içerik varsa üzerine yazılır.
      </p>
      <input type="file" accept="application/json,.json" multiple className="mb-3 block w-full text-[15px]"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          const all = await Promise.all(files.map((f) => f.text().then((t) => JSON.parse(t))));
          parse(JSON.stringify(all.flat(), null, 2));
        }} />
      <Field label="JSON">
        <textarea rows={14} className={jsonCls} value={text} onChange={(e) => parse(e.target.value)} spellCheck={false} placeholder='{"book":"oz","number":13, …}' />
      </Field>
      {!!items.length && (
        <Card className="mt-3 grid gap-1 text-[14px]">
          {items.map((it, i) => <p key={i}>• {describe(it)}</p>)}
        </Card>
      )}
      <SaveBar busy={busy || !items.length} msg={msg} onSave={run} label={`İçe aktar${items.length ? ` (${items.length})` : ''}`} />
    </AdminGuard>
  );
}
