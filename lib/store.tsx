'use client';

// Kullanıcı verisi: ilerleme, kişisel kelimeler, test denemeleri, tercihler.
// Her zaman tarayıcıda (localStorage) tutulur; giriş yapılmışsa Supabase'e de
// yazılır. Misafirken biriken veri girişte hesaba aktarılır.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { newWord, review } from './srs';
import type { Attempt, Prefs, ProgressEntry, ProgressKind, UserWord } from './types';

const KEY = 'ea:v1';
const DEFAULT_PREFS: Prefs = { theme: 'system', fontSize: 21, rate: 0.85, serif: true, sound: true };

type Data = {
  progress: Record<string, ProgressEntry>;
  words: Record<string, UserWord>;
  attempts: Attempt[];
  prefs: Prefs;
};
const EMPTY: Data = { progress: {}, words: {}, attempts: [], prefs: DEFAULT_PREFS };

const pkey = (kind: ProgressKind, ref: string) => `${kind}:${ref}`;
const wkey = (lemma: string) => lemma.toLowerCase();

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const d = JSON.parse(raw) as Partial<Data>;
    return { ...EMPTY, ...d, prefs: { ...DEFAULT_PREFS, ...d.prefs } };
  } catch {
    return EMPTY;
  }
}
function persist(d: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* gizli mod / dolu depolama: oturum içinde yine çalışır */
  }
}

function mergeProgress(a: ProgressEntry | undefined, b: ProgressEntry): ProgressEntry {
  if (!a) return b;
  const newer = Date.parse(b.updated_at) >= Date.parse(a.updated_at) ? b : a;
  return {
    ...newer,
    status: a.status === 'completed' || b.status === 'completed' ? 'completed' : 'started',
    score: Math.max(a.score ?? 0, b.score ?? 0) || undefined,
  };
}

type Store = Data & {
  ready: boolean;
  user: User | null;
  isAdmin: boolean;
  getProgress: (kind: ProgressKind, ref: string) => ProgressEntry | undefined;
  setProgress: (kind: ProgressKind, ref: string, patch: Partial<Omit<ProgressEntry, 'kind' | 'ref'>>) => void;
  saveWord: (w: Pick<UserWord, 'lemma' | 'meaning_tr'> & Partial<UserWord>) => void;
  removeWord: (lemma: string) => void;
  reviewWord: (lemma: string, correct: boolean) => void;
  setWordStatus: (lemma: string, status: UserWord['status']) => void;
  addAttempt: (a: Omit<Attempt, 'created_at'>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------- uzak senkron
  const remote = useCallback(
    (fn: (uid: string) => PromiseLike<{ error: unknown }>) => {
      if (!supabase || !user) return;
      fn(user.id).then(({ error }) => {
        if (error) console.warn('Supabase yazma hatası', error);
      });
    },
    [user],
  );

  const pullRemote = useCallback(async (u: User) => {
    if (!supabase) return;
    const [p, w, a, prof] = await Promise.all([
      supabase.from('user_progress').select('kind, ref, status, score, position, updated_at'),
      supabase.from('user_words').select('*'),
      supabase.from('test_attempts').select('ref, score, passed, wrong, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('role, prefs').eq('id', u.id).maybeSingle(),
    ]);
    setIsAdmin(prof.data?.role === 'admin');
    const local = load(); // localStorage her güncellemede yazılır; en güncel kaynak

    // Birleştir: yerel (misafir) + uzak
    const progress = { ...local.progress };
    for (const r of (p.data ?? []) as ProgressEntry[]) {
      const k = pkey(r.kind, r.ref);
      progress[k] = mergeProgress(progress[k], { ...r, score: r.score ?? undefined, position: r.position ?? undefined });
    }
    const words = { ...local.words };
    for (const r of (w.data ?? []) as (UserWord & { user_id: string })[]) {
      const { user_id: _u, ...word } = r;
      const k = wkey(word.lemma);
      if (!words[k] || word.correct + word.wrong >= words[k].correct + words[k].wrong) words[k] = word;
    }
    const remoteAttempts = (a.data ?? []) as Attempt[];
    const seen = new Set(remoteAttempts.map((x) => `${x.ref}|${x.created_at}`));
    const localOnlyAttempts = local.attempts.filter((x) => !seen.has(`${x.ref}|${x.created_at}`));
    const merged: Data = {
      progress,
      words,
      attempts: [...localOnlyAttempts, ...remoteAttempts].sort((x, y) => y.created_at.localeCompare(x.created_at)),
      prefs: { ...local.prefs, ...((prof.data?.prefs as Partial<Prefs>) ?? {}) },
    };
    setData(merged);
    persist(merged);

    // Misafir verisini hesaba yaz
    const uid = u.id;
    const rows = Object.values(progress).map((x) => ({ user_id: uid, ...x }));
    if (rows.length) await supabase.from('user_progress').upsert(rows);
    const wrows = Object.values(words).map((x) => ({ user_id: uid, ...x }));
    if (wrows.length) await supabase.from('user_words').upsert(wrows);
    if (localOnlyAttempts.length) await supabase.from('test_attempts').insert(localOnlyAttempts.map((x) => ({ user_id: uid, ...x })));
  }, []);

  useEffect(() => {
    setData(load());
    setReady(true);
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: s }) => {
      const u = s.session?.user ?? null;
      setUser(u);
      if (u) pullRemote(u);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === 'SIGNED_IN' && u) pullRemote(u);
      if (event === 'SIGNED_OUT') setIsAdmin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [pullRemote]);

  // ---------------------------------------------------------------- tema
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = data.prefs.theme === 'dark' || (data.prefs.theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1115' : '#f7f5f0');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [data.prefs.theme]);

  // ---------------------------------------------------------------- işlemler
  const store = useMemo<Store>(
    () => ({
      ...data,
      ready,
      user,
      isAdmin,
      getProgress: (kind, ref) => data.progress[pkey(kind, ref)],
      setProgress: (kind, ref, patch) => {
        const entry = mergeProgress(dataRef.current.progress[pkey(kind, ref)], {
          kind, ref, status: 'started', ...patch, updated_at: new Date().toISOString(),
        } as ProgressEntry);
        if (patch.position !== undefined) entry.position = patch.position;
        update((d) => ({ ...d, progress: { ...d.progress, [pkey(kind, ref)]: entry } }));
        remote((uid) => supabase!.from('user_progress').upsert({ user_id: uid, ...entry, score: entry.score ?? null, position: entry.position ?? null }));
      },
      saveWord: (w) => {
        const existing = dataRef.current.words[wkey(w.lemma)];
        const word = existing ? { ...existing, ...w, status: 'learning' as const } : newWord(w);
        update((d) => ({ ...d, words: { ...d.words, [wkey(w.lemma)]: word } }));
        remote((uid) => supabase!.from('user_words').upsert({ user_id: uid, ...word }));
      },
      removeWord: (lemma) => {
        update((d) => {
          const words = { ...d.words };
          delete words[wkey(lemma)];
          return { ...d, words };
        });
        remote((uid) => supabase!.from('user_words').delete().eq('user_id', uid).eq('lemma', lemma));
      },
      reviewWord: (lemma, correct) => {
        const w = dataRef.current.words[wkey(lemma)];
        if (!w) return;
        const next = review(w, correct);
        update((d) => ({ ...d, words: { ...d.words, [wkey(lemma)]: next } }));
        remote((uid) => supabase!.from('user_words').upsert({ user_id: uid, ...next }));
      },
      setWordStatus: (lemma, status) => {
        const w = dataRef.current.words[wkey(lemma)];
        if (!w) return;
        const next: UserWord = { ...w, status, box: status === 'known' ? 5 : 1, due_at: new Date().toISOString() };
        update((d) => ({ ...d, words: { ...d.words, [wkey(lemma)]: next } }));
        remote((uid) => supabase!.from('user_words').upsert({ user_id: uid, ...next }));
      },
      addAttempt: (a) => {
        const attempt: Attempt = { ...a, created_at: new Date().toISOString() };
        update((d) => ({ ...d, attempts: [attempt, ...d.attempts].slice(0, 500) }));
        remote((uid) => supabase!.from('test_attempts').insert({ user_id: uid, ...attempt }));
      },
      setPrefs: (p) => {
        const prefs = { ...dataRef.current.prefs, ...p };
        update((d) => ({ ...d, prefs }));
        remote((uid) => supabase!.from('profiles').update({ prefs }).eq('id', uid));
      },
      signOut: async () => {
        await supabase?.auth.signOut();
        // Paylaşılan cihazda bir sonraki kişi önceki hesabın verisini görmesin
        setData(EMPTY);
        persist(EMPTY);
      },
    }),
    [data, ready, user, isAdmin, update, remote],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider eksik');
  return s;
}
