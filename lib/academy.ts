import type { ProgressEntry, UnitMeta } from './types';

// Ders kilitleri: ilk ders açık; her ders, bir önceki dersin testi geçilince açılır.
// Ünite testi, ünitenin 5 dersi tamamlanınca açılır.
export const PASS_MARK = 80;

type P = Record<string, ProgressEntry>;
export const lessonDone = (p: P, id: number) => p[`lesson:${id}`]?.status === 'completed';
export const unitTestDone = (p: P, unit: number) => p[`test:unit-${unit}`]?.status === 'completed';

export function lessonUnlocked(p: P, id: number) {
  return id === 1 || lessonDone(p, id - 1);
}

export function unitTestUnlocked(p: P, u: UnitMeta) {
  return u.test_available && u.lessons.every((l) => lessonDone(p, l.id));
}

/** Sıradaki çalışılacak ders (yazılmış ve tamamlanmamış ilk ders) */
export function nextLesson(p: P, units: UnitMeta[]) {
  for (const u of units) for (const l of u.lessons) if (l.available && !lessonDone(p, l.id)) return { unit: u, lesson: l };
  return null;
}
