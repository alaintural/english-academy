// Cümleyi kelime ve aradaki parçalara (boşluk, noktalama) böler.
// İçerik dosyalarındaki `w` dizisi, bu fonksiyonun döndürdüğü KELİME
// parçalarıyla birebir aynı sırada ve sayıda olmalıdır (validator denetler).

export const WORD_RE = /[A-Za-z0-9]+(?:['’][A-Za-z]+)*(?:-[A-Za-z0-9]+)*/g;

export type Segment = { text: string; word: boolean };

export function segment(sentence: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of sentence.matchAll(WORD_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: sentence.slice(last, i), word: false });
    out.push({ text: m[0], word: true });
    last = i + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), word: false });
  return out;
}

export function words(sentence: string): string[] {
  return [...sentence.matchAll(WORD_RE)].map((m) => m[0]);
}

export function wordCount(sentence: string): number {
  return words(sentence).length;
}
