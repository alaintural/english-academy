# İçerik formatı

Bu klasör platformun TEK içerik kaynağıdır. `npm run content` şunları üretir:
- `public/data/`: statik site ve Supabase'siz kullanım için
- `supabase/seed/*.sql`: Supabase'e yükleme için

Her değişiklikten sonra şu komutu çalıştırın:

```
node scripts/validate-content.ts            # hepsi
node scripts/validate-content.ts content/books/oz
```

## Genel kurallar (A1)

- Öğrenci hiç İngilizce bilmiyor. Açıklamalar Türkçe, sade ve kısa olur.
- İngilizce metinlerde A1 kelimeleri kullanılır. Hikâyelerde ağırlıklı zaman Present Simple'dır. Kısa cümle yazılır: hedef ≤ 12 kelime, 18 kelimenin üstü uyarı verir.
- Tırnak için tipografik tırnak kullanılır: “ ” (JSON içinde `\"` kaçışı gerekmez). Kesme işareti düz `'` olur.
- `-` ile birleşik kelime yazmaktan kaçının.

## Kelime hizalama: `w` dizisi (en önemli kural)

Cümle şu düzenli ifadeyle kelimelere bölünür:

```
/[A-Za-z0-9]+(?:['’][A-Za-z]+)*(?:-[A-Za-z0-9]+)*/g
```

- Noktalama ve boşluk kelime sayılmaz.
- `don't`, `Dorothy's`, `o'clock` birer kelimedir.
- `Mr.` → `Mr` kelimesi ve ardından `.` gelir.

`w` dizisinde her kelime için sırasıyla `[kök, bağlamsal Türkçe anlam]` bulunur. Dizinin uzunluğu cümledeki kelime sayısına EŞİT olmalıdır.

- **kök (lemma):** sözlük biçimi, küçük harfle.
  - Örnekler: `lives` → `live`, `houses` → `house`, `is` → `be`, `her` → `her`, `don't` → `do`.
  - Özel isimler olduğu gibi yazılır: `Dorothy`.
- **anlam:** O cümledeki anlamı, Türkçe ve kısa yazılır.
  - Örnekler: `lives` → `yaşıyor`, `with` → `ile`, `a` → `bir`.
  - Özel isim: `Dorothy` → `Dorothy (kız adı)`.
  - Görevsel kelimelere de anlam verilir: `the` → `(belirli tanımlık)`, `to` → `-e / -a`, `do` (soru) → `(soru yardımcısı)`.

## Kitap: `content/books/<id>/book.json`

```json
{ "id": "oz", "title": "The Wonderful Wizard of Oz", "title_tr": "Oz Büyücüsü",
  "author": "L. Frank Baum", "year": 1900, "category": "Fantastik",
  "description_tr": "…", "cover": { "bg": "#0F5132", "fg": "#FFF7D6", "accent": "#F2C14E", "motif": "road" },
  "chapters_planned": 12 }
```

## Bölüm: `content/books/<id>/NN.json`

```json
{
  "book": "oz",
  "number": 1,
  "title_en": "Dorothy's Home",
  "title_tr": "Dorothy'nin Evi",
  "sentences": [
    {
      "p": true,
      "en": "Dorothy lives in a small house with her aunt.",
      "tr": "Dorothy, teyzesiyle birlikte küçük bir evde yaşıyor.",
      "w": [["Dorothy","Dorothy (kız adı)"],["live","yaşıyor"],["in","içinde, -de"],["a","bir"],
            ["small","küçük"],["house","ev"],["with","ile"],["her","onun (kadın)"],["aunt","teyze"]]
    }
  ],
  "new_words": [
    { "lemma": "house", "pos": "noun", "tr": "ev", "ipa": "/haʊs/",
      "ex_en": "Dorothy lives in a small house.", "ex_tr": "Dorothy küçük bir evde yaşıyor." }
  ],
  "questions": [
    { "type": "mcq", "prompt": "Where does Dorothy live?", "prompt_tr": "Dorothy nerede yaşıyor?",
      "options": ["In a small house", "In a big city", "In a castle"], "answer": 0 }
  ]
}
```

Bölüm kuralları:

- **Uzunluk:** 250–450 kelime.
- **Paragraflar:** Yeni paragraf başlatan cümleye `"p": true` yazılır. İlk cümlede `p` zorunludur.
- **`new_words`:** 5–15 kelime arası.
  - Bunlar bu bölümde öğretilen temel kelimelerdir. Her birinin kökü bölümde geçmelidir.
  - Daha önceki bölümlerde öğretilmiş kelimeler tekrar eklenmez; metinde tekrar kullanılır.
- **`questions`:** Tam 5 adet `mcq` sorusu olur. Okuduğunu anlama sorularıdır ve İngilizce, basit yazılır. `prompt_tr` eklenir.

## Ders: `content/lessons/NN.json` (id 1–40, ünite = ceil(id/5))

```json
{
  "id": 6, "unit": 2, "title_tr": "I am / You are", "title_en": "The verb 'to be'",
  "summary_tr": "Kendini ve karşındakini tanıtmak için am / are kullanmayı öğren.",
  "learn": [ … ],
  "listen": [ { "en": "I am a student.", "tr": "Ben bir öğrenciyim." } ],
  "practice": [ … sorular … ],
  "test": [ … tam 10 soru … ],
  "vocab": [ { "lemma": "student", "pos": "noun", "tr": "öğrenci", "ipa": "/ˈstjuːdənt/",
               "ex_en": "I am a student.", "ex_tr": "Ben bir öğrenciyim." } ]
}
```

`learn` blokları (en az 4 tane):

- `{ "type": "text", "tr": "Türkçe açıklama. **kalın** yazı desteklenir." }`
- `{ "type": "tip", "tr": "Dikkat / ipucu kutusu" }`
- `{ "type": "examples", "title_tr": "Örnekler", "items": [ { "en": "…", "tr": "…", "note_tr": "isteğe bağlı" } ] }`
- `{ "type": "table", "title_tr": "…", "head": ["Zamir","be"], "rows": [["I","am"],["You","are"]] }`

Diğer alanlar:

- `listen`: En az 6 sesli öğe. Her biri telefonun İngilizce sesiyle okunur.
- `practice`: En az 6 alıştırma; türler karışık olur (match, order, fill, listen, mcq).
- `test`: Tam 10 soru. Geçme eşiği %80'dir.
- `vocab`: En az 6 kelime.

## Soru türleri

```json
{ "type": "mcq",    "prompt": "…", "prompt_tr": "…", "options": ["…","…","…"], "answer": 0, "explain_tr": "…" }
{ "type": "fill",   "prompt": "I ___ a student.", "tr": "Ben bir öğrenciyim.", "options": ["am","is","are"], "answer": 0, "explain_tr": "…" }
{ "type": "order",  "answer": "I am from Turkey.", "tr": "Ben Türkiye'denim." }
{ "type": "match",  "prompt_tr": "Eşleştir", "pairs": [["hello","merhaba"],["goodbye","hoşça kal"],["thank you","teşekkürler"]] }
{ "type": "listen", "audio": "thirteen", "prompt_tr": "Duyduğun sayıyı seç.", "options": ["13","30","3"], "answer": 0 }
```

Soru kuralları:

- **Seçenekler:** 2–4 seçenek. `answer`, doğru seçeneğin sırasıdır (0'dan başlar). Doğru cevabın sırası sorudan soruya değişmelidir; hep 0 olmamalıdır.
- **`fill`:** prompt mutlaka `___` içerir.
- **`order`:** 3–9 kelimelik cümle. Uygulama kelimeleri karıştırır.
- **`match`:** 3–5 çift.
- **`explain_tr`:** Yanlış cevapta gösterilen kısa Türkçe açıklama. Test sorularında yazılması önerilir.

## Ünite testi: `content/units/N.json`

```json
{ "unit": 1, "title_tr": "Temel Başlangıç — Ünite Testi", "questions": [ … tam 20 soru … ] }
```

`content/units.json` dosyası 8 ünitenin ve 40 dersin başlıklarını tutar. Henüz yazılmamış dersler uygulamada "Yakında" olarak görünür.
