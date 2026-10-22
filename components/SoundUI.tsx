'use client';

import { Headphones, Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/lib/sound';
import { Button, Sheet } from './ui';

// "Ses açık" uyarı kartı + "Ses kapalı" bildirimi (lib/sound.tsx yönetir).
export function SoundUI() {
  const { warnOpen, answerWarning, notice, dismissNotice, setOn } = useSound();
  return (
    <>
      <Sheet open={warnOpen} onClose={() => answerWarning(false)}>
        <div className="flex flex-col items-center pt-1 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><Volume2 size={32} /></div>
          <h2 className="mt-3 text-[22px] font-bold">Ses açık</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-muted">
            Bu uygulama İngilizce seslendirme yapar. Sessiz bir ortamdaysan <b className="text-ink">kulaklık tak</b> ya da <b className="text-ink">sesi kapat</b>.
          </p>
          <p className="mt-2 text-[14px] text-muted">
            Sesi her zaman sağ üstteki <Volume2 size={16} className="inline align-[-3px]" aria-hidden /> düğmesinden değiştirebilirsin.
          </p>
          <div className="mt-5 grid w-full gap-2">
            <Button block onClick={() => answerWarning(true)}><Headphones size={20} /> Sesli devam et</Button>
            <Button block variant="secondary" onClick={() => answerWarning(false)}><VolumeX size={20} /> Sesi kapat</Button>
          </div>
        </div>
      </Sheet>

      {notice && (
        <div role="status" className="pt-safe animate-fade pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex max-w-[430px] justify-center px-4">
          <div className="pointer-events-auto mt-14 flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-4 text-bg shadow-xl">
            <VolumeX size={18} aria-hidden />
            <span className="text-[15px] font-medium">Ses kapalı</span>
            <button type="button" onClick={() => setOn(true)} className="h-9 rounded-full bg-primary px-4 text-[14px] font-semibold text-on-primary">Aç</button>
            <button type="button" onClick={dismissNotice} aria-label="Kapat" className="h-9 px-2 text-[14px] opacity-70">✕</button>
          </div>
        </div>
      )}
    </>
  );
}
