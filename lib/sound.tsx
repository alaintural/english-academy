'use client';

// Tüm seslendirme buradan geçer. İki güvenlik:
//  1) Ses kapatılabilir (prefs.sound). Kapalıyken otomatik sesler sessizce
//     atlanır; hoparlör düğmesine bilerek basılırsa "Ses kapalı" bildirimi çıkar.
//  2) Her açılışta (tarayıcı oturumu) ilk ses çalmadan önce "Ses açık" uyarısı
//     gösterilir; kullanıcı onaylarsa bekleyen ses o dokunuşun içinde çalınır
//     (iOS sesi yalnızca dokunuşla başlatır).
// Arayüz (uyarı kartı, bildirim) components/SoundUI.tsx'te.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from './store';
import { speak, speakSequence, stopSpeaking } from './tts';

const SESSION_KEY = 'ea:sound-ok';
const SLOW_RATE = 0.55;

type SayOpts = { slow?: boolean; explicit?: boolean };
type SeqCbs = { onSentence: (i: number) => void; onDone: () => void };
type Pending = { run: () => void; cancel: () => void };

type Sound = {
  on: boolean;
  toggle: () => void;
  setOn: (v: boolean) => void;
  /** Tek bir metni okur. explicit: kullanıcı bir hoparlör düğmesine bastı. */
  say: (text: string, opts?: SayOpts) => void;
  /** Metinleri sırayla okur (her zaman kullanıcı isteğiyle). Durdurma fonksiyonu döner. */
  sequence: (items: string[], start: number, cbs: SeqCbs) => () => void;
  warnOpen: boolean;
  answerWarning: (keepSound: boolean) => void;
  notice: boolean;
  dismissNotice: () => void;
};

const Ctx = createContext<Sound | null>(null);

function sessionOk() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markSession() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* gizli mod: yalnızca bellekte */ }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const { prefs, setPrefs } = useStore();
  const on = prefs.sound !== false;
  const [warnOpen, setWarnOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const pending = useRef<Pending | null>(null);
  const okThisSession = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Çalan diziler: ses kapatılınca hepsi durdurulur ve ekranlara "bitti" bildirilir
  // (yalnızca synth.cancel() yetmez; iptal edilen cümlenin onend'i sıradakini başlatabilir).
  const active = useRef(new Set<{ stop: () => void; done: () => void }>());

  const showNotice = useCallback(() => {
    setNotice(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(false), 3500);
  }, []);

  const setOn = useCallback(
    (v: boolean) => {
      if (!v) {
        for (const a of active.current) { a.stop(); a.done(); }
        active.current.clear();
        stopSpeaking();
      }
      else { okThisSession.current = true; markSession(); } // bilerek açtı: ayrıca uyarmaya gerek yok
      setPrefs({ sound: v });
      setNotice(false);
    },
    [setPrefs],
  );

  // Ses açıksa: oturumda onaylandıysa hemen çal, değilse önce uyar.
  const gate = useCallback((p: Pending, explicit: boolean) => {
    if (!on) {
      p.cancel();
      if (explicit) showNotice();
      return;
    }
    if (okThisSession.current || sessionOk()) {
      okThisSession.current = true;
      p.run();
      return;
    }
    pending.current?.cancel();
    pending.current = p;
    setWarnOpen(true);
  }, [on, showNotice]);

  const sound = useMemo<Sound>(() => ({
    on,
    setOn,
    toggle: () => setOn(!on),
    say: (text, opts = {}) =>
      gate({ run: () => speak(text, { rate: opts.slow ? SLOW_RATE : prefs.rate, voice: prefs.voice }), cancel: () => {} }, !!opts.explicit),
    sequence: (items, start, cbs) => {
      let stop: (() => void) | null = null;
      let cancelled = false;
      const entry = { stop: () => stop?.(), done: cbs.onDone };
      gate(
        {
          run: () => {
            if (cancelled) return;
            active.current.add(entry);
            stop = speakSequence(items, start, {
              rate: prefs.rate, voice: prefs.voice, onSentence: cbs.onSentence,
              onDone: () => { active.current.delete(entry); cbs.onDone(); },
            });
          },
          cancel: () => cbs.onDone(),
        },
        true,
      );
      return () => { cancelled = true; active.current.delete(entry); stop?.(); };
    },
    warnOpen,
    answerWarning: (keepSound) => {
      setWarnOpen(false);
      const p = pending.current;
      pending.current = null;
      if (keepSound) {
        okThisSession.current = true;
        markSession();
        p?.run();
      } else {
        p?.cancel();
        setOn(false);
      }
    },
    notice,
    dismissNotice: () => setNotice(false),
  }), [on, setOn, gate, prefs.rate, prefs.voice, warnOpen, notice]);

  return <Ctx.Provider value={sound}>{children}</Ctx.Provider>;
}

export function useSound() {
  const s = useContext(Ctx);
  if (!s) throw new Error('SoundProvider eksik');
  return s;
}
