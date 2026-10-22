// Yönetim paneli yazma işlemleri. Supabase RLS yalnızca admin rolüne izin verir.
// Bölüm ve ders kaydı "sil ve yeniden yaz" yöntemiyle yapılır: cümle/kelime
// hizalaması her kayıtta baştan kurulur, yarım güncelleme kalmaz.

import { supabase } from './supabase';
import { clearContentCache } from './content';
import { chapterId } from './paths';
import { words } from './tokenize';
import type { BookMeta, Chapter, Lesson, Question, VocabEntry } from './types';

function db() {
  if (!supabase) throw new Error('Supabase yapılandırılmamış');
  return supabase;
}
async function run<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
const qRows = (qs: Question[], ctx: Record<string, unknown>, section: string) =>
  qs.map((q, i) => {
    const { type, ...data } = q;
    return { ...ctx, section, position: i + 1, type, data };
  });

async function addVocab(list: VocabEntry[], source: string, label: string) {
  if (!list.length) return;
  await run(
    db().from('vocabulary').upsert(
      list.map((v) => ({ lemma: v.lemma, pos: v.pos, meaning_tr: v.tr, ipa: v.ipa ?? null, example_en: v.ex_en, example_tr: v.ex_tr, source, source_label: label })),
      { onConflict: 'lemma', ignoreDuplicates: true },
    ),
  );
}

/** Bölümü (içerik formatında) Supabase'e yazar. */
export async function saveChapter(c: Chapter, opts: { published: boolean; bookTitle: string }) {
  const id = chapterId(c.book, c.number);
  const bad = c.sentences.findIndex((s) => s.w.length !== words(s.en).length);
  if (bad >= 0) throw new Error(`${bad + 1}. cümlede kelime/anlam sayısı uyuşmuyor`);
  const wordCount = c.sentences.reduce((n, s) => n + words(s.en).length, 0);

  await run(db().from('chapters').upsert({
    id, book_id: c.book, number: c.number, title_en: c.title_en, title_tr: c.title_tr, word_count: wordCount, published: opts.published,
  }));
  await run(db().from('sentences').delete().eq('chapter_id', id));
  if (c.sentences.length) {
    const sRows = await run(
      db().from('sentences')
        .insert(c.sentences.map((s, i) => ({ chapter_id: id, position: i + 1, text_en: s.en, paragraph: !!s.p })))
        .select('id, position'),
    );
    const sid = new Map(sRows.map((r: { id: number; position: number }) => [r.position, r.id]));
    await run(db().from('translations').insert(c.sentences.map((s, i) => ({ sentence_id: sid.get(i + 1), text: s.tr }))));
    const tokInput = c.sentences.flatMap((s, i) =>
      words(s.en).map((surface, j) => ({ sentence_id: sid.get(i + 1), position: j + 1, surface, lemma: s.w[j][0] })),
    );
    const tRows = await run(db().from('tokens').insert(tokInput).select('id, sentence_id, position'));
    const meaning = new Map<string, string>();
    c.sentences.forEach((s, i) => s.w.forEach(([, m], j) => meaning.set(`${sid.get(i + 1)}:${j + 1}`, m)));
    await run(db().from('translations').insert(
      tRows.map((t: { id: number; sentence_id: number; position: number }) => ({ token_id: t.id, text: meaning.get(`${t.sentence_id}:${t.position}`) ?? '' })),
    ));
  }
  await run(db().from('questions').delete().eq('chapter_id', id));
  if (c.questions.length) await run(db().from('questions').insert(qRows(c.questions, { chapter_id: id }, 'chapter')));
  await addVocab(c.new_words, `chapter:${id}`, `${opts.bookTitle} · Bölüm ${c.number}`);
  clearContentCache();
}

/** Dersi (içerik formatında) Supabase'e yazar. */
export async function saveLesson(l: Lesson, published: boolean) {
  await run(db().from('lessons').upsert({
    id: l.id, unit_id: l.unit, position: ((l.id - 1) % 5) + 1, title_tr: l.title_tr, title_en: l.title_en, summary_tr: l.summary_tr,
    content: { learn: l.learn, listen: l.listen }, published, updated_at: new Date().toISOString(),
  }));
  await run(db().from('questions').delete().eq('lesson_id', l.id));
  const rows = [...qRows(l.practice, { lesson_id: l.id }, 'practice'), ...qRows(l.test, { lesson_id: l.id }, 'test')];
  if (rows.length) await run(db().from('questions').insert(rows));
  await addVocab(l.vocab, `lesson:${l.id}`, `Ders ${l.id} · ${l.title_tr}`);
  clearContentCache();
}

export async function saveUnitTest(unit: number, questions: Question[]) {
  await run(db().from('questions').delete().eq('unit_id', unit).eq('section', 'unit'));
  if (questions.length) await run(db().from('questions').insert(qRows(questions, { unit_id: unit }, 'unit')));
  clearContentCache();
}

export async function saveBook(b: BookMeta & { published: boolean }) {
  const { order, ...rest } = b;
  await run(db().from('books').upsert({ ...rest, position: order ?? 99 }));
  clearContentCache();
}

export async function deleteChapter(book: string, n: number) {
  await run(db().from('chapters').delete().eq('id', chapterId(book, n)));
  clearContentCache();
}

export async function counts() {
  const tables = ['lessons', 'books', 'chapters', 'sentences', 'tokens', 'vocabulary', 'questions', 'profiles'] as const;
  const res = await Promise.all(tables.map((t) => db().from(t).select('*', { count: 'exact', head: true })));
  return Object.fromEntries(tables.map((t, i) => [t, res[i].count ?? 0])) as Record<(typeof tables)[number], number>;
}
