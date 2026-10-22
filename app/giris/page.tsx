'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { BASE } from '@/lib/paths';
import { Segmented } from '@/components/ReaderSettings';
import { Button, Card, Screen } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { user } = useStore();
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (user) router.replace('/profil/'); }, [user, router]);

  if (!supabase)
    return (
      <Screen title="Giriş" back="/profil/">
        <Card className="text-[15px]">Hesap sistemi henüz yapılandırılmadı. İlerlemen bu cihazda saklanmaya devam ediyor.</Card>
      </Screen>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const redirect = `${window.location.origin}${BASE}/giris/`;
    setBusy(true);
    setMsg(null);
    const { error } =
      mode === 'login'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : mode === 'signup'
          ? await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
          : await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) setMsg({ ok: false, text: trError(error.message) });
    else if (mode === 'signup') setMsg({ ok: true, text: 'Kayıt alındı. E-postana gelen bağlantıyla hesabını doğrula.' });
    else if (mode === 'magic') setMsg({ ok: true, text: 'Giriş bağlantısı e-postana gönderildi.' });
  }

  return (
    <Screen title={mode === 'signup' ? 'Kayıt ol' : 'Giriş yap'} back="/profil/" subtitle="İlerlemen tüm cihazlarında senkronize olsun.">
      <Segmented value={mode} onChange={(v) => { setMode(v); setMsg(null); }}
        options={[{ v: 'login', l: 'Giriş' }, { v: 'signup', l: 'Kayıt' }, { v: 'magic', l: 'Şifresiz' }]} />
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <label className="grid gap-1">
          <span className="text-[14px] font-medium">E-posta</span>
          <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-line bg-surface px-3 outline-none focus:border-primary" />
        </label>
        {mode !== 'magic' && (
          <label className="grid gap-1">
            <span className="text-[14px] font-medium">Şifre</span>
            <input type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border border-line bg-surface px-3 outline-none focus:border-primary" />
          </label>
        )}
        {msg && <p role="status" className={`rounded-xl p-3 text-[15px] ${msg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
        <Button type="submit" block disabled={busy} className="mt-2">
          {busy ? 'Bekleyin…' : mode === 'login' ? 'Giriş yap' : mode === 'signup' ? 'Hesap oluştur' : 'Bağlantı gönder'}
        </Button>
      </form>
      <p className="mt-4 text-[13px] text-muted">Misafir olarak yaptığın ilerleme, giriş yapınca hesabına aktarılır.</p>
    </Screen>
  );
}

function trError(m: string) {
  if (/invalid login/i.test(m)) return 'E-posta veya şifre hatalı.';
  if (/not confirmed/i.test(m)) return 'E-posta adresin henüz doğrulanmadı.';
  if (/already registered/i.test(m)) return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (/rate limit/i.test(m)) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  return m;
}
