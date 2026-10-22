'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, Volume2, X } from 'lucide-react';
import { speak } from '@/lib/tts';
import { useStore } from '@/lib/store';

// ---------------------------------------------------------------- ekran başlığı
export function Screen({
  title, subtitle, back, right, children, large = true,
}: {
  title: string; subtitle?: string; back?: string | true; right?: ReactNode; children: ReactNode; large?: boolean;
}) {
  // Geri/sağ düğmesi olmayan büyük başlıklı ekranlarda boş üst çubuk gösterilmez (iOS sekme kökleri gibi).
  const bar = !large || back || right;
  return (
    <div className="animate-fade">
      {!bar && <div className="pt-safe h-3" />}
      {bar && <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-xl">
        <div className="flex h-12 items-center gap-1 px-2">
          {back ? <BackButton href={back === true ? undefined : back} /> : <span className="w-2" />}
          {!large && <h1 className="flex-1 truncate text-[17px] font-semibold">{title}</h1>}
          {large && <span className="flex-1" />}
          {right}
        </div>
      </header>}
      {large && (
        <div className="px-4 pt-1 pb-3">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
      )}
      <div className="px-4">{children}</div>
    </div>
  );
}

export function BackButton({ href, label = 'Geri' }: { href?: string; label?: string }) {
  const router = useRouter();
  const cls = 'flex h-11 items-center pr-2 text-[17px] text-primary';
  const inner = (
    <>
      <ChevronLeft size={28} strokeWidth={2.2} aria-hidden />
      <span className="-ml-1">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={() => router.back()} className={cls}>{inner}</button>
  );
}

export function IconButton({ label, onClick, children, className = '' }: { label: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-full text-ink active:bg-surface-2 ${className}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- temel öğeler
export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' }) {
  return <As className={`rounded-2xl border border-line/70 bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</As>;
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-primary text-on-primary active:opacity-85',
  secondary: 'bg-surface-2 text-ink active:opacity-80',
  ghost: 'text-primary active:bg-primary-soft',
  success: 'bg-success text-white active:opacity-85',
  danger: 'bg-danger text-white active:opacity-85',
};
export function Button({
  children, variant = 'primary', onClick, disabled, href, className = '', type = 'button', block,
}: {
  children: ReactNode; variant?: BtnVariant; onClick?: () => void; disabled?: boolean; href?: string;
  className?: string; type?: 'button' | 'submit'; block?: boolean;
}) {
  const cls = `inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-semibold transition disabled:opacity-40 ${BTN[variant]} ${block ? 'w-full' : ''} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function ProgressBar({ value, className = '', color = 'bg-primary' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 88, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <Card className="my-6 border-danger/30 bg-danger-soft text-[15px]">
      <b>İçerik yüklenemedi.</b>
      <p className="mt-1 text-muted">{error instanceof Error ? error.message : 'Bağlantınızı kontrol edip tekrar deneyin.'}</p>
    </Card>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">{icon}</div>
      <h2 className="text-[19px] font-semibold">{title}</h2>
      {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'primary' | 'success' | 'accent' | 'danger' }) {
  const t = {
    muted: 'bg-surface-2 text-muted',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    accent: 'bg-accent-soft text-accent',
    danger: 'bg-danger-soft text-danger',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${t}`}>{children}</span>;
}

// ---------------------------------------------------------------- ses
export function SpeakButton({ text, label = 'Dinle', size = 20, className = '' }: { text: string; label?: string; size?: number; className?: string }) {
  const { prefs } = useStore();
  return (
    <button type="button" aria-label={`${label}: ${text}`}
      onClick={(e) => { e.stopPropagation(); speak(text, { rate: prefs.rate, voice: prefs.voice }); }}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary active:scale-95 ${className}`}>
      <Volume2 size={size} aria-hidden />
    </button>
  );
}

// ---------------------------------------------------------------- alt sayfa (bottom sheet)
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[430px]" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Kapat" onClick={onClose} className="animate-fade absolute inset-0 bg-black/35" />
      <div className="animate-sheet pb-safe absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[22px] bg-surface shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between bg-surface px-4 pt-2">
          <span className="mx-auto mt-1 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        </div>
        <div className="flex items-start justify-between gap-2 px-5 pt-2">
          {title ? <h2 className="pt-2 text-[20px] font-bold">{title}</h2> : <span />}
          <IconButton label="Kapat" onClick={onClose} className="-mr-2"><X size={22} /></IconButton>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- basit biçim (**kalın**, satır sonu)
export function Rich({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
              : part.split('\n').map((line, k, arr) => <span key={`${j}-${k}`}>{line}{k < arr.length - 1 && <br />}</span>),
          )}
        </p>
      ))}
    </div>
  );
}
