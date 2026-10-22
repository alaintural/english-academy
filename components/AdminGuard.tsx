'use client';

import type { ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { hasSupabase } from '@/lib/supabase';
import { Button, Card, Screen, Spinner } from './ui';

export function AdminGuard({ title, back = '/admin/', children }: { title: string; back?: string; children: ReactNode }) {
  const { ready, user, isAdmin } = useStore();
  let body: ReactNode = children;
  if (!hasSupabase) body = <Card className="text-[15px]">Yönetim paneli Supabase bağlantısı gerektirir. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalı.</Card>;
  else if (!ready) body = <Spinner />;
  else if (!user) body = <Card className="grid gap-3 text-[15px]">Yönetim paneli için giriş yapın.<Button href="/giris/">Giriş yap</Button></Card>;
  else if (!isAdmin)
    body = (
      <Card className="text-[15px]">
        Bu hesabın yönetici yetkisi yok. Supabase SQL Editor&apos;da:
        <code className="mt-2 block rounded-lg bg-surface-2 p-2 text-[12px] break-all">
          update profiles set role = &apos;admin&apos; where id = (select id from auth.users where email = &apos;{user.email}&apos;);
        </code>
      </Card>
    );
  return <Screen title={title} back={back} large={false}><div className="pt-4 pb-10">{body}</div></Screen>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary';
export const jsonCls = `${inputCls} font-mono text-[13px] leading-snug`;

export function SaveBar({ busy, msg, onSave, label = 'Kaydet' }: { busy: boolean; msg: { ok: boolean; text: string } | null; onSave: () => void; label?: string }) {
  return (
    <div className="pb-safe sticky bottom-0 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 pt-3 pb-3 backdrop-blur">
      {msg && <p role="status" className={`mb-2 rounded-xl p-2 text-[14px] ${msg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
      <Button block onClick={onSave} disabled={busy}>{busy ? 'Kaydediliyor…' : label}</Button>
    </div>
  );
}
