'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, LogIn, LogOut, Shield, Trophy } from 'lucide-react';
import { useStore } from '@/lib/store';
import { hasSupabase } from '@/lib/supabase';
import { englishVoices, speak } from '@/lib/tts';
import { Segmented } from '@/components/ReaderSettings';
import { Button, Card, Screen } from '@/components/ui';

export default function ProfilePage() {
  const { user, isAdmin, prefs, setPrefs, signOut, progress, words } = useStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    const t = setTimeout(load, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Screen title="Profil">
      <Card className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-[22px] font-bold text-primary">
          {(user?.email?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {user ? (
            <>
              <p className="truncate text-[17px] font-semibold">{user.email}</p>
              <p className="text-[13px] text-muted">İlerlemen hesabına kaydediliyor</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold">Misafir</p>
              <p className="text-[13px] text-muted">İlerlemen yalnızca bu cihazda saklanıyor</p>
            </>
          )}
        </div>
      </Card>
      {hasSupabase && (
        user ? (
          <Button block variant="secondary" className="mt-3" onClick={signOut}><LogOut size={18} /> Çıkış yap</Button>
        ) : (
          <Button block className="mt-3" href="/giris/"><LogIn size={18} /> Giriş yap / Kayıt ol</Button>
        )
      )}

      <Card className="mt-5 p-0">
        <Row href="/basarilarim/" icon={<Trophy size={20} className="text-accent" />} label="Başarılarım"
          detail={`${Object.values(progress).filter((p) => p.status === 'completed').length} tamamlanan`} />
        {isAdmin && <Row href="/admin/" icon={<Shield size={20} className="text-primary" />} label="Yönetim Paneli" />}
      </Card>

      <h2 className="mt-7 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Tercihler</h2>
      <Card className="grid gap-5">
        <div>
          <p className="mb-2 text-[15px] font-medium">Tema</p>
          <Segmented value={prefs.theme} onChange={(v) => setPrefs({ theme: v })}
            options={[{ v: 'system', l: 'Otomatik' }, { v: 'light', l: 'Açık' }, { v: 'dark', l: 'Karanlık' }]} />
        </div>
        <div>
          <div className="mb-1 flex justify-between"><p className="text-[15px] font-medium">Konuşma hızı</p><p className="text-[15px] tabular-nums">×{prefs.rate.toFixed(2)}</p></div>
          <input type="range" min={0.5} max={1.2} step={0.05} value={prefs.rate} aria-label="Konuşma hızı"
            onChange={(e) => setPrefs({ rate: Number(e.target.value) })} className="h-11 w-full accent-[var(--primary)]" />
        </div>
        {voices.length > 0 && (
          <div>
            <p className="mb-2 text-[15px] font-medium">İngilizce ses</p>
            <select value={prefs.voice ?? ''} onChange={(e) => { setPrefs({ voice: e.target.value || undefined }); speak('Hello! Nice to meet you.', { voice: e.target.value || undefined, rate: prefs.rate }); }}
              className="h-11 w-full rounded-xl bg-surface-2 px-3">
              <option value="">Otomatik (önerilen)</option>
              {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
            </select>
            <p className="mt-2 text-[12px] text-muted">iPhone&apos;da daha doğal sesler için: Ayarlar › Erişilebilirlik › Seslendirilen İçerik › Sesler › İngilizce.</p>
          </div>
        )}
        <Button variant="secondary" onClick={() => speak('This is how I sound. Nice to meet you!', { rate: prefs.rate, voice: prefs.voice })}>Sesi dene</Button>
      </Card>

      <h2 className="mt-7 mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">Hakkında</h2>
      <Card className="mb-8 text-[14px] leading-relaxed text-muted">
        <p>
          English Academy, hiç İngilizce bilmeyenler için Türkçe açıklamalı bir A1 programıdır. Öğrenme çıktıları CEFR A1 ve
          British Council başlangıç seviyesiyle uyumlu tasarlanmıştır. 40 ders ve 800 kelime platformun kendi hedefleridir.
        </p>
        <p className="mt-2">
          Kütüphanedeki hikâyeler, telif süresi dolmuş klasiklerin (ör. L. Frank Baum, Lewis Carroll) özgün olay örgüsüne
          sadık, A1 düzeyinde yeniden yazılmış uyarlamalarıdır.
        </p>
        <p className="mt-2">{Object.keys(words).length} kayıtlı kelime · Sürüm 0.1</p>
      </Card>
    </Screen>
  );
}

function Row({ href, icon, label, detail }: { href: string; icon: React.ReactNode; label: string; detail?: string }) {
  return (
    <Link href={href} className="flex min-h-[56px] items-center gap-3 border-b border-line px-4 last:border-0 active:bg-surface-2">
      {icon}
      <span className="flex-1 text-[16px] font-medium">{label}</span>
      {detail && <span className="text-[14px] text-muted">{detail}</span>}
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );
}
