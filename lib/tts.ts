// Tarayıcı seslendirmesi (Web Speech API). iPhone'da Siri/enhanced sesler
// kullanılır. iOS, sesi yalnızca bir dokunma olayının içinden başlatır; bu
// yüzden speak() her zaman tıklama işleyicisinden çağrılmalı.

let voices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function englishVoices() {
  loadVoices();
  return voices;
}

function pickVoice(preferred?: string) {
  if (!voices.length) loadVoices();
  if (preferred) {
    const v = voices.find((x) => x.voiceURI === preferred);
    if (v) return v;
  }
  // Önce kaliteli (enhanced/premium), sonra en-US, sonra en-GB
  return (
    voices.find((v) => /enhanced|premium|natural/i.test(v.name) && v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang === 'en-US' && v.localService) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang === 'en-GB') ||
    voices[0]
  );
}

export type SpeakOpts = { rate?: number; voice?: string; onEnd?: () => void; onBoundary?: (charIndex: number) => void };

export function speak(text: string, opts: SpeakOpts = {}) {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(opts.voice);
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'en-US';
  u.rate = opts.rate ?? 0.9;
  if (opts.onEnd) u.onend = opts.onEnd;
  if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex);
  synth.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** Cümleleri sırayla okur; her cümle başında onSentence(i) çağrılır. Durdurmak için dönen fonksiyonu çağırın. */
export function speakSequence(items: string[], start: number, opts: SpeakOpts & { onSentence: (i: number) => void; onDone: () => void }) {
  let stopped = false;
  const next = (i: number) => {
    if (stopped) return;
    if (i >= items.length) return opts.onDone();
    opts.onSentence(i);
    speak(items[i], { ...opts, onEnd: () => setTimeout(() => next(i + 1), 250) });
  };
  next(start);
  return () => {
    stopped = true;
    stopSpeaking();
  };
}
