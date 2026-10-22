'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { clearContentCache, getLesson, getUnitTest } from '@/lib/content';
import { saveLesson, saveUnitTest } from '@/lib/admin';
import { useStore } from '@/lib/store';
import type { Lesson } from '@/lib/types';
import { AdminGuard, Field, SaveBar, inputCls, jsonCls } from '@/components/AdminGuard';
import { Spinner } from '@/components/ui';

const j = (v: unknown) => JSON.stringify(v, null, 2);

function LessonEditor() {
  const params = useSearchParams();
  const id = Number(params.get('id') ?? 0);
  const unit = Number(params.get('unite') ?? 0);
  const { isAdmin } = useStore();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [published, setPublished] = useState(false);
  const [json, setJson] = useState({ learn: '', listen: '', practice: '', test: '', vocab: '' });
  const [unitJson, setUnitJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    clearContentCache();
    if (unit) {
      getUnitTest(unit).then((t) => setUnitJson(j(t.questions)), () => setUnitJson('[]'));
      return;
    }
    getLesson(id).then((l) => {
      setLesson(l);
      setJson({ learn: j(l.learn), listen: j(l.listen), practice: j(l.practice), test: j(l.test), vocab: j(l.vocab) });
    });
    supabase?.from('lessons').select('published').eq('id', id).single().then(({ data }) => setPublished(!!data?.published));
  }, [id, unit, isAdmin]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      if (unit) {
        const qs = JSON.parse(unitJson);
        await saveUnitTest(unit, qs);
        setMsg({ ok: true, text: `${qs.length} soru kaydedildi.` });
      } else if (lesson) {
        const parsed = Object.fromEntries(Object.entries(json).map(([k, v]) => [k, JSON.parse(v)]));
        if (parsed.test.length !== 10) throw new Error(`Test tam 10 soru olmalı (${parsed.test.length})`);
        await saveLesson({ ...lesson, ...parsed }, published);
        setMsg({ ok: true, text: 'Ders kaydedildi.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? `JSON hatası: ${e.message}` : (e as Error).message });
    }
    setBusy(false);
  }

  if (unit)
    return (
      <AdminGuard title={`Ünite ${unit} testi`}>
        <Field label="Sorular (JSON, 20 soru önerilir — format: content/README.md)">
          <textarea rows={24} value={unitJson} onChange={(e) => setUnitJson(e.target.value)} className={jsonCls} spellCheck={false} />
        </Field>
        <SaveBar busy={busy} msg={msg} onSave={save} />
      </AdminGuard>
    );

  return (
    <AdminGuard title={`Ders ${id}`}>
      {!lesson ? <Spinner /> : (
        <div className="grid gap-4">
          <Field label="Başlık (TR)"><input className={inputCls} value={lesson.title_tr} onChange={(e) => setLesson({ ...lesson, title_tr: e.target.value })} /></Field>
          <Field label="Başlık (EN)"><input className={inputCls} value={lesson.title_en} onChange={(e) => setLesson({ ...lesson, title_en: e.target.value })} /></Field>
          <Field label="Özet"><textarea rows={2} className={inputCls} value={lesson.summary_tr} onChange={(e) => setLesson({ ...lesson, summary_tr: e.target.value })} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-[16px]">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-5 w-5" /> Yayında
          </label>
          {(['learn', 'listen', 'practice', 'test', 'vocab'] as const).map((k) => (
            <Field key={k} label={{ learn: 'Öğren blokları', listen: 'Dinle öğeleri', practice: 'Alıştırmalar', test: 'Test (10 soru)', vocab: 'Kelimeler' }[k] + ' — JSON'}>
              <textarea rows={10} value={json[k]} onChange={(e) => setJson({ ...json, [k]: e.target.value })} className={jsonCls} spellCheck={false} />
            </Field>
          ))}
          <SaveBar busy={busy} msg={msg} onSave={save} />
        </div>
      )}
    </AdminGuard>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><LessonEditor /></Suspense>;
}
