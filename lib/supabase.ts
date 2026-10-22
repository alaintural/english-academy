import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Anon key herkese açıktır; güvenlik Supabase RLS politikalarıyla sağlanır
// (supabase/schema.sql). Değişkenler yoksa uygulama Supabase'siz çalışır:
// içerik public/data'dan, ilerleme tarayıcıdan okunur.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;

export const hasSupabase = supabase !== null;
