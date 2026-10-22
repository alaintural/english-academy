import type { UserWord } from './types';

// Leitner kutuları: doğru bilinen kelime bir üst kutuya çıkar ve daha seyrek
// gelir (1, 2, 4, 8, 16 gün); yanlış bilinen 1. kutuya döner ve kısa süre
// sonra yeniden sorulur. 5. kutuda doğru bilinen kelime "biliyorum" olur.
export const BOX_DAYS = [0, 1, 2, 4, 8, 16];

export function review(w: UserWord, correct: boolean, now = new Date()): UserWord {
  const box = correct ? Math.min(5, w.box + 1) : 1;
  const due = new Date(now);
  if (correct) due.setDate(due.getDate() + BOX_DAYS[box]);
  else due.setTime(now.getTime() + 10 * 60 * 1000); // yanlış: 10 dk sonra yeniden sorulur
  return {
    ...w,
    box,
    due_at: due.toISOString(),
    correct: w.correct + (correct ? 1 : 0),
    wrong: w.wrong + (correct ? 0 : 1),
    status: box >= 5 ? 'known' : w.status === 'known' && !correct ? 'learning' : w.status,
  };
}

export const isDue = (w: UserWord, now = Date.now()) => w.status === 'learning' && Date.parse(w.due_at) <= now;

export function newWord(p: Pick<UserWord, 'lemma' | 'meaning_tr'> & Partial<UserWord>): UserWord {
  const now = new Date().toISOString();
  return { status: 'learning', box: 1, due_at: now, correct: 0, wrong: 0, created_at: now, ...p };
}
