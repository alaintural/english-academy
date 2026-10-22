// next/link basePath'i kendisi ekler; fetch ve window.location eklemez.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (p: string) => `${BASE}${p}`;
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const chapterId = (book: string, n: number) => `${book}-${pad2(n)}`;
