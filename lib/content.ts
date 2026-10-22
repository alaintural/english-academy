// İçerik katmanı. Supabase yapılandırılmışsa ve içerik yüklenmişse oradan,
// değilse derlenmiş statik dosyalardan (public/data) okur. Her iki kaynak da
// lib/types.ts tiplerine dönüştürülür; ekranlar kaynağı bilmez.

import { supabase } from './supabase';
import { asset, chapterId } from './paths';
import { words } from './tokenize';
import type {
  BookWithChapters, Chapter, Lesson, QMcq, Question, UnitMeta, UnitTest, VocabEntry, VocabWithSource,
} from './types';

const cache = new Map<string, Promise<unknown>>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key) as Promise<T>;
}
export const clearContentCache = () => cache.clear();

async function staticJson<T>(p: string): Promise<T> {
  const res = await fetch(asset(`/data/${p}`));
  if (!res.ok) throw new Error(`İçerik bulunamadı: ${p}`);
  return res.json() as Promise<T>;
}

// Supabase'te içerik var mı? (şema kurulmuş ama seed çalıştırılmamış olabilir)
const dbReady = () =>
  memo('db-ready', async () => {
    if (!supabase) return false;
    const { count, error } = await supabase.from('units').select('id', { count: 'exact', head: true });
    return !error && (count ?? 0) > 0;
  });

type QRow = { position: number; type: Question['type']; data: Record<string, unknown> };
const toQuestions = (rows: QRow[] | null) =>
  (rows ?? []).sort((a, b) => a.position - b.position).map((r) => ({ type: r.type, ...r.data }) as Question);
type VRow = { lemma: string; pos: string; meaning_tr: string; ipa: string | null; example_en: string | null; example_tr: string | null; source?: string; source_label?: string };
const toVocab = (r: VRow): VocabEntry => ({
  lemma: r.lemma, pos: r.pos, tr: r.meaning_tr, ipa: r.ipa ?? undefined, ex_en: r.example_en ?? '', ex_tr: r.example_tr ?? '',
});

// ---------------------------------------------------------------- akademi
export const getUnits = () =>
  memo('units', async (): Promise<UnitMeta[]> => {
    if (await dbReady()) {
      const { data, error } = await supabase!
        .from('units')
        .select('id, title_tr, title_en, lessons(id, position, title_tr, published), questions(id)')
        .order('id');
      if (error) throw error;
      return data.map((u) => ({
        id: u.id,
        title_tr: u.title_tr,
        title_en: u.title_en,
        lessons: [...u.lessons].sort((a, b) => a.position - b.position).map((l) => ({ id: l.id, title_tr: l.title_tr, available: l.published })),
        test_available: u.questions.length > 0,
      }));
    }
    return staticJson<UnitMeta[]>('units.json');
  });

export const getLesson = (id: number) =>
  memo(`lesson-${id}`, async (): Promise<Lesson> => {
    if (await dbReady()) {
      const [l, q, v] = await Promise.all([
        supabase!.from('lessons').select('*').eq('id', id).single(),
        supabase!.from('questions').select('position, type, data, section').eq('lesson_id', id),
        supabase!.from('vocabulary').select('*').eq('source', `lesson:${id}`).order('id'),
      ]);
      if (l.error) throw l.error;
      const qs = (q.data ?? []) as (QRow & { section: string })[];
      return {
        id: l.data.id,
        unit: l.data.unit_id,
        title_tr: l.data.title_tr,
        title_en: l.data.title_en,
        summary_tr: l.data.summary_tr,
        learn: l.data.content?.learn ?? [],
        listen: l.data.content?.listen ?? [],
        practice: toQuestions(qs.filter((x) => x.section === 'practice')),
        test: toQuestions(qs.filter((x) => x.section === 'test')),
        vocab: ((v.data ?? []) as VRow[]).map(toVocab),
      };
    }
    return staticJson<Lesson>(`lessons/${id}.json`);
  });

export const getUnitTest = (unit: number) =>
  memo(`unit-${unit}`, async (): Promise<UnitTest> => {
    if (await dbReady()) {
      const [u, q] = await Promise.all([
        supabase!.from('units').select('title_tr').eq('id', unit).single(),
        supabase!.from('questions').select('position, type, data').eq('unit_id', unit).eq('section', 'unit'),
      ]);
      if (u.error) throw u.error;
      return { unit, title_tr: `${u.data.title_tr} — Ünite Testi`, questions: toQuestions(q.data as QRow[]) };
    }
    return staticJson<UnitTest>(`units/${unit}.json`);
  });

// ---------------------------------------------------------------- kütüphane
export const getBooks = () =>
  memo('books', async (): Promise<BookWithChapters[]> => {
    if (await dbReady()) {
      const { data, error } = await supabase!
        .from('books')
        .select('*, chapters(number, title_en, title_tr, word_count, published)')
        .order('position');
      if (error) throw error;
      return data.map(({ chapters, published, position, ...b }) => ({
        ...b,
        order: position,
        available: published && chapters.some((c: { published: boolean }) => c.published),
        chapters: (chapters as { number: number; title_en: string; title_tr: string; word_count: number; published: boolean }[])
          .filter((c) => c.published)
          .sort((a, b) => a.number - b.number)
          .map((c) => ({ number: c.number, title_en: c.title_en, title_tr: c.title_tr, words: c.word_count })),
      }));
    }
    return staticJson<BookWithChapters[]>('books.json');
  });

export const getBook = async (id: string) => (await getBooks()).find((b) => b.id === id) ?? null;

type SentenceRow = {
  position: number; text_en: string; paragraph: boolean;
  translations: { text: string }[];
  tokens: { position: number; lemma: string; translations: { text: string }[] }[];
};

export const getChapter = (book: string, n: number) =>
  memo(`chapter-${book}-${n}`, async (): Promise<Chapter> => {
    if (await dbReady()) {
      const id = chapterId(book, n);
      const [c, q, v] = await Promise.all([
        supabase!
          .from('chapters')
          .select('number, title_en, title_tr, sentences(position, text_en, paragraph, translations(text), tokens(position, lemma, translations(text)))')
          .eq('id', id)
          .single(),
        supabase!.from('questions').select('position, type, data').eq('chapter_id', id),
        supabase!.from('vocabulary').select('*').eq('source', `chapter:${id}`).order('id'),
      ]);
      if (c.error) throw c.error;
      const sentences = (c.data.sentences as SentenceRow[]).sort((a, b) => a.position - b.position).map((s) => {
        const toks = [...s.tokens].sort((a, b) => a.position - b.position);
        // Hizalama bozuksa (admin düzenlemesi) eksik anlamlar boş kalır, okuyucu yine çalışır.
        const w = words(s.text_en).map((_, i) => [toks[i]?.lemma ?? '', toks[i]?.translations[0]?.text ?? ''] as [string, string]);
        return { en: s.text_en, tr: s.translations[0]?.text ?? '', w, p: s.paragraph };
      });
      return {
        book,
        number: c.data.number,
        title_en: c.data.title_en,
        title_tr: c.data.title_tr,
        sentences,
        new_words: ((v.data ?? []) as VRow[]).map(toVocab),
        questions: toQuestions(q.data as QRow[]) as QMcq[],
      };
    }
    return staticJson<Chapter>(`books/${book}/${String(n).padStart(2, '0')}.json`);
  });

// ---------------------------------------------------------------- kelime bankası
export const getVocabulary = () =>
  memo('vocabulary', async (): Promise<VocabWithSource[]> => {
    if (await dbReady()) {
      const { data, error } = await supabase!.from('vocabulary').select('*').order('id');
      if (error) throw error;
      return (data as VRow[]).map((r) => ({ ...toVocab(r), source: r.source ?? '', source_label: r.source_label ?? '' }));
    }
    return staticJson<VocabWithSource[]>('vocabulary.json');
  });
