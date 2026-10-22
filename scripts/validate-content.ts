// İçerik doğrulayıcı. Kullanım:
//   node scripts/validate-content.ts                  # tüm içerik
//   node scripts/validate-content.ts content/books/oz # yalnızca bir klasör/dosya
// Hata varsa 1 ile çıkar. Kurallar: content/README.md

import fs from 'node:fs';
import path from 'node:path';
import { words } from '../lib/tokenize.ts';
import type { Chapter, Lesson, Question, UnitTest, VocabEntry, BookMeta } from '../lib/types.ts';

const ROOT = path.join(import.meta.dirname, '..', 'content');
const filters = process.argv.slice(2).map((f) => path.resolve(f));
const errors: string[] = [];
const warnings: string[] = [];
const stats = { lessons: 0, unitTests: 0, chapters: 0, chapterWords: 0, questions: 0 };
const allLemmas = new Set<string>();

const wanted = (file: string) => !filters.length || filters.some((f) => file.startsWith(f));
const rel = (file: string) => path.relative(process.cwd(), file);
const err = (file: string, where: string, msg: string) => errors.push(`${rel(file)} ${where}: ${msg}`);
const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (e) {
    err(file, '', `JSON okunamadı: ${(e as Error).message}`);
    return null;
  }
}

function checkQuestion(file: string, where: string, q: Question, allowed?: Question['type'][]) {
  stats.questions++;
  if (!q || typeof q !== 'object') return err(file, where, 'soru nesnesi değil');
  if (allowed && !allowed.includes(q.type)) return err(file, where, `bu bölümde '${q.type}' türüne izin yok`);
  const opts = (o: unknown, answer: unknown) => {
    if (!Array.isArray(o) || o.length < 2 || o.length > 4) return err(file, where, 'options 2-4 seçenek olmalı');
    if (o.some((x) => !nonEmpty(x))) return err(file, where, 'boş seçenek');
    if (new Set(o.map((x: string) => x.trim().toLowerCase())).size !== o.length) err(file, where, 'tekrarlanan seçenek');
    if (typeof answer !== 'number' || answer < 0 || answer >= o.length) err(file, where, 'answer geçerli bir seçenek sırası değil');
  };
  switch (q.type) {
    case 'mcq':
      if (!nonEmpty(q.prompt)) err(file, where, 'prompt boş');
      opts(q.options, q.answer);
      break;
    case 'fill':
      if (!nonEmpty(q.prompt) || !q.prompt.includes('___')) err(file, where, "fill prompt'u '___' içermeli");
      opts(q.options, q.answer);
      break;
    case 'listen':
      if (!nonEmpty(q.audio)) err(file, where, 'audio boş');
      opts(q.options, q.answer);
      break;
    case 'order': {
      if (!nonEmpty(q.answer) || !nonEmpty(q.tr)) err(file, where, 'order answer ve tr zorunlu');
      const n = q.answer.replace(/[.?!]$/, '').trim().split(/\s+/).length;
      if (n < 3 || n > 9) err(file, where, `order cümlesi 3-9 kelime olmalı (${n})`);
      break;
    }
    case 'match':
      if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 5) err(file, where, 'match 3-5 çift olmalı');
      else if (q.pairs.some((p) => !Array.isArray(p) || p.length !== 2 || !nonEmpty(p[0]) || !nonEmpty(p[1])))
        err(file, where, 'match çifti [en, tr] olmalı');
      break;
    default:
      err(file, where, `bilinmeyen soru türü '${(q as { type: string }).type}'`);
  }
}

function checkVocab(file: string, where: string, v: VocabEntry) {
  for (const k of ['lemma', 'pos', 'tr', 'ex_en', 'ex_tr'] as const)
    if (!nonEmpty(v?.[k])) err(file, `${where}`, `kelime alanı '${k}' boş`);
  if (v?.lemma) allLemmas.add(v.lemma.toLowerCase());
}

// ---------------------------------------------------------------- dersler
const lessonDir = path.join(ROOT, 'lessons');
for (const f of fs.existsSync(lessonDir) ? fs.readdirSync(lessonDir).sort() : []) {
  const file = path.join(lessonDir, f);
  if (!f.endsWith('.json') || !wanted(file)) continue;
  const l = readJson<Lesson>(file);
  if (!l) continue;
  stats.lessons++;
  if (Number(f.replace('.json', '')) !== l.id) err(file, '', `dosya adı ile id (${l.id}) uyuşmuyor`);
  if (l.unit !== Math.ceil(l.id / 5)) err(file, '', `ders ${l.id} ünite ${Math.ceil(l.id / 5)} olmalı`);
  for (const k of ['title_tr', 'title_en', 'summary_tr'] as const) if (!nonEmpty(l[k])) err(file, '', `${k} boş`);
  if (!Array.isArray(l.learn) || l.learn.length < 4) err(file, 'learn', 'en az 4 blok olmalı');
  l.learn?.forEach((b, i) => {
    const w = `learn[${i}]`;
    if (b.type === 'text' || b.type === 'tip') { if (!nonEmpty(b.tr)) err(file, w, 'tr boş'); }
    else if (b.type === 'examples') { if (!b.items?.length || b.items.some((x) => !nonEmpty(x.en) || !nonEmpty(x.tr))) err(file, w, 'örnekler en+tr olmalı'); }
    else if (b.type === 'table') { if (!b.head?.length || !b.rows?.length || b.rows.some((r) => r.length !== b.head.length)) err(file, w, 'tablo satırları başlıkla aynı uzunlukta olmalı'); }
    else err(file, w, `bilinmeyen blok '${(b as { type: string }).type}'`);
  });
  if (!Array.isArray(l.listen) || l.listen.length < 6) err(file, 'listen', 'en az 6 öğe olmalı');
  l.listen?.forEach((x, i) => { if (!nonEmpty(x.en) || !nonEmpty(x.tr)) err(file, `listen[${i}]`, 'en+tr zorunlu'); });
  if (!Array.isArray(l.practice) || l.practice.length < 6) err(file, 'practice', 'en az 6 alıştırma olmalı');
  l.practice?.forEach((q, i) => checkQuestion(file, `practice[${i}]`, q));
  if (!Array.isArray(l.test) || l.test.length !== 10) err(file, 'test', `tam 10 soru olmalı (${l.test?.length})`);
  l.test?.forEach((q, i) => checkQuestion(file, `test[${i}]`, q));
  if (!Array.isArray(l.vocab) || l.vocab.length < 6) err(file, 'vocab', 'en az 6 kelime olmalı');
  l.vocab?.forEach((v, i) => checkVocab(file, `vocab[${i}]`, v));
}

// ---------------------------------------------------------------- ünite testleri
const unitDir = path.join(ROOT, 'units');
for (const f of fs.existsSync(unitDir) ? fs.readdirSync(unitDir).sort() : []) {
  const file = path.join(unitDir, f);
  if (!/^\d+\.json$/.test(f) || !wanted(file)) continue;
  const u = readJson<UnitTest>(file);
  if (!u) continue;
  stats.unitTests++;
  if (Number(f.replace('.json', '')) !== u.unit) err(file, '', 'dosya adı ile unit uyuşmuyor');
  if (!Array.isArray(u.questions) || u.questions.length !== 20) err(file, 'questions', `tam 20 soru olmalı (${u.questions?.length})`);
  u.questions?.forEach((q, i) => checkQuestion(file, `questions[${i}]`, q));
}

// ---------------------------------------------------------------- kitaplar
const booksDir = path.join(ROOT, 'books');
for (const id of fs.existsSync(booksDir) ? fs.readdirSync(booksDir).sort() : []) {
  const dir = path.join(booksDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const metaFile = path.join(dir, 'book.json');
  if (wanted(metaFile) || wanted(dir + '/')) {
    const meta = fs.existsSync(metaFile) ? readJson<BookMeta>(metaFile) : null;
    if (!meta) err(metaFile, '', 'book.json eksik');
    else if (meta.id !== id) err(metaFile, '', `id '${meta.id}' klasör adıyla ('${id}') aynı olmalı`);
  }
  const taughtInBook = new Map<string, number>(); // kitap içinde new_words tekrarı yasak
  for (const f of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, f);
    if (!/^\d\d\.json$/.test(f) || !wanted(file)) continue;
    const c = readJson<Chapter>(file);
    if (!c) continue;
    stats.chapters++;
    if (c.book !== id) err(file, '', `book '${c.book}' klasör adıyla aynı olmalı`);
    if (Number(f.slice(0, 2)) !== c.number) err(file, '', 'dosya adı ile number uyuşmuyor');
    if (!nonEmpty(c.title_en) || !nonEmpty(c.title_tr)) err(file, '', 'başlıklar boş');
    let total = 0;
    const lemmas = new Set<string>();
    c.sentences?.forEach((s, i) => {
      const w = `sentences[${i}]`;
      if (!nonEmpty(s.en) || !nonEmpty(s.tr)) return err(file, w, 'en ve tr zorunlu');
      if (!/[.!?][”"’)]*$/.test(s.en.trim())) err(file, w, 'cümle . ! ? ile bitmeli (okuyucuda çeviri düğmesi orada)');
      const ws = words(s.en);
      total += ws.length;
      if (ws.length > 18) warnings.push(`${rel(file)} ${w}: ${ws.length} kelime — A1 için uzun`);
      if (!Array.isArray(s.w) || s.w.length !== ws.length) {
        err(file, w, `w dizisi ${s.w?.length ?? 0} öğe, cümlede ${ws.length} kelime var: [${ws.join(', ')}]`);
        return;
      }
      s.w.forEach((pair, j) => {
        if (!Array.isArray(pair) || pair.length !== 2 || !nonEmpty(pair[0]) || !nonEmpty(pair[1]))
          err(file, `${w}.w[${j}]`, `'${ws[j]}' için [kök, anlam] eksik`);
        else lemmas.add(pair[0].toLowerCase());
      });
    });
    if (!c.sentences?.length) err(file, 'sentences', 'boş');
    else if (!c.sentences[0].p) warnings.push(`${rel(file)}: ilk cümlede p:true yok`);
    if (total < 250 || total > 450) err(file, '', `bölüm 250-450 kelime olmalı (${total})`);
    stats.chapterWords += total;
    if (!Array.isArray(c.new_words) || c.new_words.length < 5 || c.new_words.length > 15)
      err(file, 'new_words', `5-15 yeni kelime olmalı (${c.new_words?.length})`);
    c.new_words?.forEach((v, i) => {
      checkVocab(file, `new_words[${i}]`, v);
      if (v?.lemma && !lemmas.has(v.lemma.toLowerCase())) err(file, `new_words[${i}]`, `'${v.lemma}' bölümdeki hiçbir kelimenin kökü değil`);
      const prev = v?.lemma && taughtInBook.get(v.lemma.toLowerCase());
      if (prev) err(file, `new_words[${i}]`, `'${v.lemma}' zaten ${prev}. bölümde öğretildi`);
      else if (v?.lemma) taughtInBook.set(v.lemma.toLowerCase(), c.number);
    });
    if (!Array.isArray(c.questions) || c.questions.length !== 5) err(file, 'questions', `tam 5 soru olmalı (${c.questions?.length})`);
    c.questions?.forEach((q, i) => checkQuestion(file, `questions[${i}]`, q, ['mcq']));
  }
}

for (const w of warnings) console.warn('uyarı:', w);
console.log(
  `${stats.lessons} ders, ${stats.unitTests} ünite testi, ${stats.chapters} bölüm (${stats.chapterWords} kelime), ` +
    `${stats.questions} soru, ${allLemmas.size} benzersiz öğretilen kelime`,
);
if (errors.length) {
  for (const e of errors) console.error('HATA:', e);
  console.error(`${errors.length} hata`);
  process.exit(1);
}
console.log('İçerik geçerli ✓');
