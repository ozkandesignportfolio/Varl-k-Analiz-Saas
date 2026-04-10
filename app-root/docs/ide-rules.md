# Assetly — IDE Kuralları (Universal)

> Bu dosya tüm IDEler (Cursor, VS Code, Windsurf, GitHub Copilot vb.) tarafından okunabilir.
> This file is readable by all IDEs (Cursor, VS Code, Windsurf, GitHub Copilot, etc.)

## Proje Amacı

Bu projede yalnızca belirlenen altyapıların kullanılması, güvenlik ve kalite hatalarının minimize edilmesi, mobil/PWA ve prod deploy'da sürpriz çıkmaması.

---

## Stack (Değiştirilemez)

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js (App Router) + React |
| Dil | TypeScript (strict) |
| Stil | Tailwind CSS |
| Grafik | Chart.js |
| Backend/Auth/DB/Storage | Supabase (PostgreSQL, Supabase Auth, Supabase Storage) |
| Rapor | jsPDF |

### Temel Kurallar

1. **Stack dışına çıkma**: Firebase, Prisma, MongoDB, Express, başka auth/storage/ORM ekleme.
2. **Her değişiklik minimal olmalı**: ilgili modülle sınırlı, gereksiz refactor yapma.
3. **Güvenlik**: RLS ve Storage policy asla gevşetilmez. "anon" key ile admin iş yapılmaz.
4. **Veri**: Multi-tenant varsayımı: her kayıt user_id ile bağlanmalı; tüm sorgular user_id filtreli olmalı.
5. **Kalite**: TypeScript strict, lint/build geçmeden PR/commit yok.

---

## Repo ve Dosya Yapısı

```
app/        → Next.js App Router sayfaları
components/ → UI bileşenleri
lib/        → Saf yardımcı fonksiyonlar (bakım motoru, tarih hesapları)
supabase/   → Client, server helpers, types, sql (opsiyonel)
types/      → Tipler (opsiyonel)
```

### Yeni Modül Ekleme

- UI bileşeni → `components/`
- Sayfa → `app/<route>/page.tsx`
- İş mantığı → `lib/`
- Supabase erişimi → `lib/supabaseClient.ts` veya `lib/supabaseServer.ts`

---

## TypeScript / React Kuralları

- TypeScript strict varsay: `any` kullanma. Zorunluysa nedenini yorumla.
- React state minimal: form için uygun state; gereksiz global state ekleme.
- Yan etkiler: `useEffect` bağımlılıkları doğru olmalı.
- Tarih/saat: tek bir yardımcı modül üzerinden yönet (`lib/date.ts` gibi).
- Hata durumları: UI'de kullanıcıya anlaşılır Türkçe mesaj.

---

## UI / Tailwind Kuralları

- Tailwind dışında CSS framework ekleme.
- Mobil öncelikli tasarla (mobile-first).
- Formlar <30 sn veri girişi hedefi: kısa, net label, yardımcı placeholder, validasyon.
- Her sayfa: loading/empty/error state içermeli.

---

## Supabase Kuralları (KRİTİK)

1. RLS her tabloda AÇIK olmalı.
2. Tüm tablolar `user_id` ile kullanıcıya bağlı olmalı.
3. Tüm sorgularda `user_id` filtre şart (server veya client).
4. Service role key ASLA client'a konmaz. Server-side (API route / server action) gerekiyorsa ayrı.
5. Storage bucket private olmalı.
6. Storage erişimi path bazlı user izolasyonu: `/<user_id>/<asset_id>/...`
7. Her yeni tablo için:
   - Create table
   - Index (`user_id`, `created_at` vs)
   - RLS enable
   - Select/insert/update/delete policy (`auth.uid() = user_id`)
   - Gerekiyorsa foreign key'ler

---

## Auth / Route Guard

- Protected route: auth yoksa login'e yönlendir.
- Session kontrolü tutarlı: client komponentlerde gereksiz session polling yapma.
- Reset password akışı Supabase standardına uygun olmalı.

---

## Bakım Motoru / İş Mantığı

- Bakım motoru deterministik olmalı (aynı input → aynı output).
- Edge case'ler:
  - Periyot değişimi
  - Servis erken/geç yapılması
  - Garanti bitiş tarihi yoksa
  - Varlık pasif/arsiv
- Tüm hesaplar unit test olmasa bile en azından lib fonksiyonları izole yaz.

---

## Chart.js Kuralları

- Chart bileşenleri client component olmalı.
- Data mapping ayrı fonksiyonda olsun (`lib/charts.ts`).
- Boş veri durumunda "Veri yok" göster.

---

## PDF / jsPDF Kuralları

- Rapor içerikleri Türkçe.
- Büyük dataset için sayfalama düşün (uzun tablolar).
- Kullanıcı verisini server'dan çekip client'ta pdf üretirken veri erişim yetkileri korunmalı.

---

## ENV / Gizli Bilgi

- `.env`, `.env.local`, `.env.*` repo'ya asla girmez.
- `.gitignore` içinde env dosyaları olmalı.
- Client env sadece `NEXT_PUBLIC_*` ile; secret key yok.

### Zorunlu ENV Örnekleri

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Deploy / Build Kalite Kapıları

Her değişiklikten sonra yerelde:

1. `npm run dev` (manuel smoke test)
2. `npm run build` (derleme kontrolü) → HATA YOKSA commit
3. Kritik sayfalar: login, assets list, asset detail, service log, documents, reports

Vercel deploy'da env değiştiyse: Vercel environment variables güncelle.

---

## PWA / Mobil Yayın Kuralları

- PWA opsiyoneldir; eklenecekse:
  - `manifest.json`
  - Icon set
  - Offline stratejisi (en azından shell cache)
- Mobilde camera/file upload:
  - QR/scan gibi özellik varsa izin akışını düzgün kur.
  - Upload hata/iptal durumlarını yönet.

---

## Çalışma Prensibi (AI)

- Büyük değişiklik yapmadan önce plan çıkar.
- Çok dosyalı patch'lerde diff incelemeden apply etme.
- RLS/Storage policy değişikliklerinde "gevşetme" yok; sadece sıkılaştırma veya doğru izolasyon.
- "Her şeyi refactor et" gibi broad değişiklik yok.

---

## Çıktı Dili

- **UI metinleri**: Türkçe
- **Developer comment'ler**: Türkçe veya İngilizce olabilir
- **Kullanıcı-facing metinler**: Türkçe olmalı

---

*Son Güncelleme: 2026-04-10*
