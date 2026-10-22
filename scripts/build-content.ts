// content/ → public/data/ (statik site) + supabase/seed/*.sql (Supabase yüklemesi)
// Kullanım: node scripts/build-content.ts   (npm run content önce doğrulayıcıyı çalıştırır)

import fs from 'node:fs';
import path from 'node:path';
import { words } from '../lib/tokenize.ts';
import type {
  BookMeta, BookWithChapters, Chapter, Lesson, Question, UnitMeta, UnitTest, VocabEntry, VocabWithSource,
} from '../lib/types.ts';

const ROOT = path.join(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'public', 'data');
const SEED = path.join(ROOT, 'supabase', 'seed');

const read = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const write = (p: string, data: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
};
const pad = (n: number) => String(n).padStart(2, '0');

fs.rmSync(OUT, { recursive: true, force: true });

// ---------------------------------------------------------------- oku
type UnitOutline = { id: number; title_tr: string; title_en: string; lessons: string[] };
const outline = read<UnitOutline[]>(path.join(CONTENT, 'units.json'));

const lessons = new Map<number, Lesson>();
for (const f of fs.readdirSync(path.join(CONTENT, 'lessons')).filter((f) => f.endsWith('.json')).sort()) {
  const l = read<Lesson>(path.join(CONTENT, 'lessons', f));
  lessons.set(l.id, l);
}
const unitTests = new Map<number, UnitTest>();
for (const f of fs.readdirSync(path.join(CONTENT, 'units')).filter((f) => /^\d+\.json$/.test(f))) {
  const u = read<UnitTest>(path.join(CONTENT, 'units', f));
  unitTests.set(u.unit, u);
}

type BookSrc = { meta: BookMeta; chapters: Chapter[] };
const books: BookSrc[] = fs
  .readdirSync(path.join(CONTENT, 'books'))
  .filter((d) => fs.existsSync(path.join(CONTENT, 'books', d, 'book.json')))
  .map((d) => {
    const dir = path.join(CONTENT, 'books', d);
    return {
      meta: read<BookMeta>(path.join(dir, 'book.json')),
      chapters: fs.readdirSync(dir).filter((f) => /^\d\d\.json$/.test(f)).sort().map((f) => read<Chapter>(path.join(dir, f))),
    };
  })
  .sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));

const chapterWords = (c: Chapter) => c.sentences.reduce((n, s) => n + words(s.en).length, 0);

// ---------------------------------------------------------------- kelime bankası (ilk kaynak kazanır)
const vocab = new Map<string, VocabWithSource>();
const addVocab = (v: VocabEntry, source: string, label: string) => {
  const k = v.lemma.toLowerCase();
  if (!vocab.has(k)) vocab.set(k, { ...v, source, source_label: label });
};
for (const l of [...lessons.values()].sort((a, b) => a.id - b.id))
  l.vocab.forEach((v) => addVocab(v, `lesson:${l.id}`, `Ders ${l.id} · ${l.title_tr}`));
for (const b of books)
  for (const c of b.chapters) c.new_words.forEach((v) => addVocab(v, `chapter:${b.meta.id}-${pad(c.number)}`, `${b.meta.title} · Bölüm ${c.number}`));

// ---------------------------------------------------------------- public/data
const units: UnitMeta[] = outline.map((u) => ({
  id: u.id,
  title_tr: u.title_tr,
  title_en: u.title_en,
  lessons: u.lessons.map((t, i) => {
    const id = (u.id - 1) * 5 + i + 1;
    return { id, title_tr: lessons.get(id)?.title_tr ?? t, available: lessons.has(id) };
  }),
  test_available: unitTests.has(u.id),
}));
write(path.join(OUT, 'units.json'), units);
for (const l of lessons.values()) write(path.join(OUT, 'lessons', `${l.id}.json`), l);
for (const u of unitTests.values()) write(path.join(OUT, 'units', `${u.unit}.json`), u);

const bookList: BookWithChapters[] = books.map(({ meta, chapters }) => ({
  ...meta,
  available: chapters.length > 0,
  chapters: chapters.map((c) => ({ number: c.number, title_en: c.title_en, title_tr: c.title_tr, words: chapterWords(c) })),
}));
write(path.join(OUT, 'books.json'), bookList);
for (const b of books) for (const c of b.chapters) write(path.join(OUT, 'books', b.meta.id, `${pad(c.number)}.json`), c);
write(path.join(OUT, 'vocabulary.json'), [...vocab.values()]);

// ---------------------------------------------------------------- supabase/seed
const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `${q(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const rows = (table: string, cols: string[], data: unknown[][], chunk = 500) => {
  const out: string[] = [];
  for (let i = 0; i < data.length; i += chunk)
    out.push(`insert into ${table} (${cols.join(', ')}) values\n${data.slice(i, i + chunk).map((r) => `(${r.map(q).join(', ')})`).join(',\n')};`);
  return out.join('\n');
};
const questionRows = (qs: Question[], ctx: { lesson_id?: number; unit_id?: number; chapter_id?: string }, section: string) =>
  qs.map((x, i) => {
    const { type, ...data } = x;
    return [ctx.lesson_id ?? null, ctx.unit_id ?? null, ctx.chapter_id ?? null, section, i + 1, type, data];
  });
const QCOLS = ['lesson_id', 'unit_id', 'chapter_id', 'section', 'position', 'type', 'data'];
const header = (title: string) =>
  `-- ${title}\n-- OTOMATİK ÜRETİLDİ: node scripts/build-content.ts — elle düzenlemeyin.\n-- Supabase → SQL Editor'da sırayla çalıştırın (00, 01, 02…).\n\n`;

fs.rmSync(SEED, { recursive: true, force: true });
fs.mkdirSync(SEED, { recursive: true });

// 00: içerik tablolarını sıfırla + ünite/ders/soru/kelime
const core: string[] = [
  header('Çekirdek içerik: üniteler, dersler, sorular, kelime bankası'),
  '-- ⚠️ İçerik tablolarını sıfırlar (kullanıcı ilerlemesi ve kelimeleri korunur).',
  'truncate table translations, tokens, sentences, questions, chapters, books, lessons, units, vocabulary, courses restart identity cascade;',
  rows('courses', ['id', 'title', 'level'], [['a1', 'A1 İngilizce', 'A1']]),
  rows('units', ['id', 'course_id', 'position', 'title_tr', 'title_en'], outline.map((u) => [u.id, 'a1', u.id, u.title_tr, u.title_en])),
  rows(
    'lessons',
    ['id', 'unit_id', 'position', 'title_tr', 'title_en', 'summary_tr', 'content', 'published'],
    units.flatMap((u) =>
      u.lessons.map((ls, i) => {
        const l = lessons.get(ls.id);
        return [ls.id, u.id, i + 1, ls.title_tr, l?.title_en ?? '', l?.summary_tr ?? '', l ? { learn: l.learn, listen: l.listen } : {}, !!l];
      }),
    ),
  ),
  rows(
    'questions',
    QCOLS,
    [
      ...[...lessons.values()].flatMap((l) => [
        ...questionRows(l.practice, { lesson_id: l.id }, 'practice'),
        ...questionRows(l.test, { lesson_id: l.id }, 'test'),
      ]),
      ...[...unitTests.values()].flatMap((u) => questionRows(u.questions, { unit_id: u.unit }, 'unit')),
    ],
  ),
  rows(
    'books',
    ['id', 'title', 'title_tr', 'author', 'year', 'category', 'description_tr', 'cover', 'chapters_planned', 'position', 'published'],
    books.map(({ meta: m, chapters }, bi) => [
      m.id, m.title, m.title_tr, m.author, m.year, m.category, m.description_tr, m.cover, m.chapters_planned, bi + 1, chapters.length > 0,
    ]),
  ),
  rows(
    'vocabulary',
    ['lemma', 'pos', 'meaning_tr', 'ipa', 'example_en', 'example_tr', 'level', 'source', 'source_label'],
    [...vocab.values()].map((v) => [v.lemma, v.pos, v.tr, v.ipa ?? null, v.ex_en, v.ex_tr, 'A1', v.source, v.source_label]),
  ),
];
fs.writeFileSync(path.join(SEED, '00-core.sql'), core.join('\n\n') + '\n');

// 01+: bölümü olan her kitap ayrı dosya (SQL Editor boyut sınırları için)
let sentenceId = 0;
let tokenId = 0;
books
  .filter((b) => b.chapters.length)
  .forEach(({ meta, chapters }, bi) => {
    const chRows: unknown[][] = [];
    const sRows: unknown[][] = [];
    const tRows: unknown[][] = [];
    const trRows: unknown[][] = [];
    const qRows: unknown[][] = [];
    for (const c of chapters) {
      const cid = `${meta.id}-${pad(c.number)}`;
      chRows.push([cid, meta.id, c.number, c.title_en, c.title_tr, chapterWords(c), true]);
      c.sentences.forEach((s, si) => {
        const sid = ++sentenceId;
        sRows.push([sid, cid, si + 1, s.en, !!s.p]);
        trRows.push([sid, null, 'tr', s.tr]);
        words(s.en).forEach((surface, ti) => {
          const tid = ++tokenId;
          tRows.push([tid, sid, ti + 1, surface, s.w[ti][0]]);
          trRows.push([null, tid, 'tr', s.w[ti][1]]);
        });
      });
      qRows.push(...questionRows(c.questions, { chapter_id: cid }, 'chapter'));
    }
    const sql = [
      header(`Kitap: ${meta.title} (${chapters.length} bölüm)`),
      rows('chapters', ['id', 'book_id', 'number', 'title_en', 'title_tr', 'word_count', 'published'], chRows),
      rows('sentences', ['id', 'chapter_id', 'position', 'text_en', 'paragraph'], sRows),
      rows('tokens', ['id', 'sentence_id', 'position', 'surface', 'lemma'], tRows),
      rows('translations', ['sentence_id', 'token_id', 'lang', 'text'], trRows),
      rows('questions', QCOLS, qRows),
      '-- Kelime → kelime bankası bağlantısı',
      `update tokens t set vocabulary_id = v.id from vocabulary v, sentences s, chapters c\n  where t.sentence_id = s.id and s.chapter_id = c.id and c.book_id = ${q(meta.id)} and lower(t.lemma) = lower(v.lemma);`,
      "select setval(pg_get_serial_sequence('sentences', 'id'), (select max(id) from sentences));",
      "select setval(pg_get_serial_sequence('tokens', 'id'), (select max(id) from tokens));",
    ];
    fs.writeFileSync(path.join(SEED, `${pad(bi + 1)}-book-${meta.id}.sql`), sql.join('\n\n') + '\n');
  });

const chapterCount = books.reduce((n, b) => n + b.chapters.length, 0);
console.log(
  `public/data + supabase/seed üretildi: ${lessons.size} ders, ${unitTests.size} ünite testi, ` +
    `${books.length} kitap (${chapterCount} bölüm), ${vocab.size} kelime, ${tokenId} kelime parçası`,
);
