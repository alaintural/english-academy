// İçerik ve kullanıcı verisi tipleri. content/ altındaki JSON dosyaları,
// public/data/ altındaki derlenmiş dosyalar ve Supabase sorguları aynı
// tiplere dönüştürülür.

// ---------------------------------------------------------------- sorular
export type QMcq = { type: 'mcq'; prompt: string; prompt_tr?: string; options: string[]; answer: number; explain_tr?: string };
export type QFill = { type: 'fill'; prompt: string; tr?: string; options: string[]; answer: number; explain_tr?: string };
export type QOrder = { type: 'order'; answer: string; tr: string; explain_tr?: string };
export type QMatch = { type: 'match'; prompt_tr?: string; pairs: [string, string][] };
export type QListen = { type: 'listen'; audio: string; prompt_tr?: string; options: string[]; answer: number; explain_tr?: string };
export type Question = QMcq | QFill | QOrder | QMatch | QListen;

// ---------------------------------------------------------------- kelime
export type VocabEntry = {
  lemma: string;
  pos: string; // noun, verb, adj, adv, pron, prep, det, num, phrase, name…
  tr: string;
  ex_en: string;
  ex_tr: string;
  ipa?: string;
};
export type VocabWithSource = VocabEntry & { source: string; source_label: string };

// ---------------------------------------------------------------- dersler
export type LearnBlock =
  | { type: 'text'; tr: string }
  | { type: 'tip'; tr: string }
  | { type: 'examples'; title_tr?: string; items: { en: string; tr: string; note_tr?: string }[] }
  | { type: 'table'; title_tr?: string; head: string[]; rows: string[][] };

export type Lesson = {
  id: number;
  unit: number;
  title_tr: string;
  title_en: string;
  summary_tr: string;
  learn: LearnBlock[];
  listen: { en: string; tr: string }[];
  practice: Question[];
  test: Question[];
  vocab: VocabEntry[];
};

export type UnitMeta = {
  id: number;
  title_tr: string;
  title_en: string;
  lessons: { id: number; title_tr: string; available: boolean }[];
  test_available: boolean;
};

export type UnitTest = { unit: number; title_tr: string; questions: Question[] };

// ---------------------------------------------------------------- kitaplar
export type Sentence = {
  en: string;
  tr: string;
  /** Her kelime parçası için [kök, bağlamsal Türkçe anlam] — segment() sırasıyla */
  w: [string, string][];
  /** Bu cümle yeni paragraf başlatır */
  p?: boolean;
};

export type Chapter = {
  book: string;
  number: number;
  title_en: string;
  title_tr: string;
  sentences: Sentence[];
  new_words: VocabEntry[];
  questions: QMcq[];
};

export type BookMeta = {
  id: string;
  title: string;
  title_tr: string;
  author: string;
  year: number;
  category: string; // Macera, Fantastik…
  description_tr: string;
  cover: { bg: string; fg: string; accent: string; motif: string };
  chapters_planned: number;
  order?: number;
};

export type ChapterSummary = { number: number; title_en: string; title_tr: string; words: number };
export type BookWithChapters = BookMeta & { chapters: ChapterSummary[]; available: boolean };

// ---------------------------------------------------------------- kullanıcı
export type ProgressKind = 'lesson' | 'chapter' | 'test';
export type ProgressEntry = {
  kind: ProgressKind;
  ref: string; // lesson:3 → "3", chapter → "oz-01", test → "unit-1"
  status: 'started' | 'completed';
  score?: number; // 0-100
  position?: number; // okuyucuda kalınan cümle
  updated_at: string;
};

export type UserWord = {
  lemma: string;
  meaning_tr: string;
  example_en?: string;
  example_tr?: string;
  source_label?: string;
  status: 'learning' | 'known';
  box: number; // Leitner 1-5
  due_at: string;
  correct: number;
  wrong: number;
  created_at: string;
};

export type Attempt = {
  ref: string; // "lesson-3" | "unit-1" | "chapter-oz-01"
  score: number;
  passed: boolean;
  wrong: number[]; // yanlış yapılan soru sıraları
  created_at: string;
};

export type Prefs = {
  theme: 'system' | 'light' | 'dark';
  fontSize: number; // okuyucu, px
  rate: number; // TTS hızı 0.5-1.2
  serif: boolean;
  voice?: string;
  /** Seslendirme açık mı (sessiz ortamlar için kapatılabilir) */
  sound: boolean;
};
