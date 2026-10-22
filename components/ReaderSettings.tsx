'use client';

import { Minus, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSound } from '@/lib/sound';
import type { Prefs } from '@/lib/types';
import { Sheet } from './ui';

const THEMES: { v: Prefs['theme']; l: string }[] = [
  { v: 'system', l: 'Otomatik' },
  { v: 'light', l: 'Açık' },
  { v: 'dark', l: 'Karanlık' },
];

export function Segmented<T extends string | boolean>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v}
          className={`h-10 rounded-lg text-[15px] font-medium ${value === o.v ? 'bg-surface shadow-sm' : 'text-muted'}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function ReaderSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, setPrefs } = useStore();
  const { say } = useSound();
  const size = (d: number) => setPrefs({ fontSize: Math.max(16, Math.min(32, prefs.fontSize + d)) });
  return (
    <Sheet open={open} onClose={onClose} title="Okuma ayarları">
      <div className="grid gap-5">
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted uppercase">Yazı boyutu</p>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Küçült" onClick={() => size(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-2"><Minus size={20} /></button>
            <p className={`flex-1 text-center ${prefs.serif ? 'font-serif' : ''}`} style={{ fontSize: prefs.fontSize }}>Aa · {prefs.fontSize}</p>
            <button type="button" aria-label="Büyüt" onClick={() => size(1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-2"><Plus size={20} /></button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted uppercase">Yazı tipi</p>
          <Segmented value={prefs.serif} onChange={(v) => setPrefs({ serif: v })} options={[{ v: true, l: 'Kitap (serif)' }, { v: false, l: 'Modern' }]} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted uppercase">Tema</p>
          <Segmented value={prefs.theme} onChange={(v) => setPrefs({ theme: v })} options={THEMES} />
        </div>
        <div>
          <div className="mb-2 flex justify-between">
            <p className="text-[13px] font-semibold text-muted uppercase">Okuma hızı</p>
            <p className="text-[13px] font-semibold tabular-nums">×{prefs.rate.toFixed(2)}</p>
          </div>
          <input type="range" min={0.5} max={1.2} step={0.05} value={prefs.rate}
            onChange={(e) => setPrefs({ rate: Number(e.target.value) })}
            onPointerUp={() => say('This is my reading speed.')}
            aria-label="Okuma hızı" className="h-11 w-full accent-[var(--primary)]" />
          <div className="flex justify-between text-[12px] text-muted"><span>Yavaş</span><span>Normal</span></div>
        </div>
      </div>
    </Sheet>
  );
}
