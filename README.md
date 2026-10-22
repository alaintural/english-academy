# English Academy — Sıfırdan A1 İngilizce

Hiç İngilizce bilmeyen biri için Türkçe açıklamalı bir öğrenme platformu. İki ana bölümü var:
- **Akademi:** 8 ünite, 40 ders.
- **Kütüphane:** klasik kitapların A1 uyarlamaları; kelimeye ve cümleye dokunarak okunur.

Kelime bankası (Leitner tekrarı), testler ve ilerleme takibi bu iki bölümü destekler. Arayüz iPhone 13 (390×844) için tasarlandı.

**Canlı:** https://alaintural.github.io/english-academy/

## İlk sürümün kapsamı

| | Hedef | Bu sürümde |
|---|---|---|
| Dersler | 40 | Ünite 1–2: 10 ders, her biri Öğren → Dinle → Uygula → Test (10 soru, %80) → Pekiştir |
| Ünite testleri | 8 × 20 soru | Ünite 1 ve 2 |
| Kitaplar | 8 | *The Wonderful Wizard of Oz* (12 bölüm), *Alice's Adventures in Wonderland* (12 bölüm). Diğer 6 kitap "Yakında". |
| Kelime bankası | 800 | `npm run content` çıktısında yazar |

- **Okuyucu:**
  - Kelimeye dokununca bağlamsal anlam, kök, telaffuz ve "Kelimelerime ekle" gelir.
  - Cümle sonundaki noktaya dokununca cümlenin Türkçesi gelir.
  - Bölüm sesli dinlenebilir; okunan cümle vurgulanır.
  - Hız, yazı boyutu ve karanlık mod ayarlanabilir; kaldığın yer hatırlanır.
  - Her bölüm 5 anlama sorusuyla biter.
- **Çeviriler:** Anlık yapay zekâ çevirisi kullanılmaz. Her cümle ve her kelime için önceden hazırlanmış çeviriler kullanılır.
- **Seslendirme:** Tarayıcının İngilizce sesi kullanılır (Web Speech API; iPhone'da Siri sesleri).

## Mimari

- **Next.js 16 (statik export) + TypeScript + Tailwind 4.** Site GitHub Pages'te yayınlanır.
- **Supabase:**
  - Supabase Auth ile giriş.
  - PostgreSQL'de içerik ve kullanıcı verisi tutulur.
  - Tarayıcı Supabase'e doğrudan bağlanır. Güvenlik tamamen RLS ile sağlanır (`supabase/schema.sql`).
- **Supabase'siz çalışma:** Supabase tanımlı değilse ya da boşsa site yine çalışır.
  - İçerik `public/data` altındaki dosyalardan okunur.
  - İlerleme tarayıcıda (localStorage) tutulur.
  - Misafirken yapılan ilerleme, giriş yapınca hesaba aktarılır.
- **Hikâye verisi:** Hikâyeler düz metin değil, **cümle ve kelime düzeyinde** veri olarak saklanır. Tablolar: `sentences`, `tokens`, `translations`.

```
content/            TEK içerik kaynağı (JSON) — biçim: content/README.md
scripts/
  validate-content.ts   içerik kuralları (kelime hizalama, 250–450 kelime, 10/20/5 soru…)
  build-content.ts      content → public/data + supabase/seed/*.sql
  smoke-iphone.ts       iPhone 13 uçtan uca test + ekran görüntüleri
supabase/
  schema.sql        tablolar + RLS (bir kez)
  seed/*.sql        içerik yüklemesi (otomatik üretilir)
app/                ekranlar (Ana Sayfa, Akademi, Kütüphane, Okuyucu, Kelimelerim, Başarılarım, Profil, Admin)
lib/                içerik katmanı, kullanıcı verisi, TTS, tekrar algoritması
```

## Kurulum

### 1. Supabase

1. Supabase → **SQL Editor**'da `supabase/schema.sql` dosyasını çalıştırın.
2. Ardından `supabase/seed/` altındaki dosyaları sırayla çalıştırın (`00-core.sql`, `01-book-oz.sql`, `02-book-alice.sql`).
   - Seed içerik tablolarını sıfırlayıp yeniden yükler. Kullanıcı verisi korunur.
3. **Authentication → URL Configuration:**
   - Site URL: `https://alaintural.github.io/english-academy/`
   - Redirect URLs: `https://alaintural.github.io/english-academy/**`
4. Siteden kayıt olun, sonra kendinizi yönetici yapın:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'SIZIN@EPOSTA.COM');
   ```

### 2. GitHub Pages

1. **Settings → Pages → Source: GitHub Actions** seçin.
2. **Settings → Secrets and variables → Actions → Variables** altına iki değişken ekleyin: `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Değerler: Supabase → Project Settings → API.
   - Anon key herkese açık bir anahtardır.
3. `main`'e her push'ta `.github/workflows/pages.yml` derler ve yayınlar.

### Yerel geliştirme

```bash
npm ci
cp .env.example .env.local   # isteğe bağlı: Supabase bilgileri
npm run dev                  # http://localhost:3000/english-academy/
npm run build                # doğrula + derle → out/
node scripts/smoke-iphone.ts # iPhone 13 duman testi (önce build)
```

## İçerik eklemek

İki yol var:

1. **Depoda:**
   - `content/` altına JSON ekleyin. Biçim: [content/README.md](content/README.md).
   - `npm run content` çalıştırın. Önce doğrulama yapılır, ardından `public/data` ve `supabase/seed/*.sql` güncellenir.
   - Supabase'deki içeriği güncellemek için seed dosyalarını yeniden çalıştırın.
2. **Yönetim Paneli** (Profil → Yönetim Paneli):
   - Ders, ünite testi, kitap ve bölüm düzenleme.
   - Cümle, Türkçe çeviri ve her kelimenin kök/anlam düzenlemesi.
   - Aynı JSON biçiminde içe aktarma.
   - Değişiklikler hemen yayına girer, yeniden derleme gerekmez.
   - ⚠️ Seed dosyalarını yeniden çalıştırmak, panelden yapılan içerik değişikliklerini siler. Kalıcı içeriği `content/` klasöründe tutun.

## Telif

- **Kaynak eserler:** L. Frank Baum (ö. 1919) ve Lewis Carroll (ö. 1898) Türkiye ve ABD'de kamu malıdır.
- **Uyarlamalar:** Orijinal olay örgüsüne sadık, özgün A1 yeniden yazımlarıdır.
- **Kapaklar:** Telifli görsel kullanılmadı; kapaklar tipografiktir.
- **Diğer ülkeler:** Başka ülkelerde yayımlamadan önce o ülkenin telif süresini kontrol edin.
