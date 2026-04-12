# Assetly PRD

## Amac

ASSETLY , kullanicinin varlik, servis, belge, gider ve abonelik kayitlarini tek panelde yonetmesini saglayan bir SaaS uygulamasidir.

Bu belge, 2026-03-16 itibariyla repoda gorulen aktif kapsamı ozetler.

## Aktif Urun Modulleri

### Kimlik dogrulama ve hesap

- E-posta/parola ile kayit, giris, sifre sifirlama ve e-posta dogrulama akislari vardir.
- `middleware.ts` korumali sayfalari oturumsuz kullanicilar icin `/login` rotasina yonlendirir.
- API tarafinda `requireRouteUser` hem oturum hem de e-posta dogrulamasini tekrar kontrol eder.

### Dashboard

- `/dashboard` ozeti varlik, servis, belge ve billing verilerini birlestirir.
- Dashboard ve panel health tarafinda DB RPC ve cache katmani kullanilir.

### Varliklar

- `/assets` ve `/assets/[id]` uzerinden varlik listeleme ve detay akislari vardir.
- API listesi filtre, siralama ve cursor tabanli sayfalama destekler.
- QR kod, satin alma fiyatı, garanti tarihi ve fotograf alani desteklenir.
- Ek medya yukleme `asset_media` tablosu ve `asset-media` bucket'i ile calisir.

### Servis, bakim ve timeline

- Servis kayitlari ve bakim kurallari ayri akislarda tutulur.
- `/maintenance` yaklasan ve geciken kurallari gosterir.
- `/timeline` varlika bagli olay akisini toplar.
- `maintenance-predictions` API'si heuristic veya OpenAI destekli tahmin uretebilir.

### Belgeler

- Belgeler private storage modelinde tutulur.
- API ve storage policy'leri kullaniciyi kendi klasoru ile sinirlar.

### Giderler, abonelikler ve faturalar

- `/expenses`, `/subscriptions`, `/invoices` ve `/billing` ekranlari mevcuttur.
- Billing tabloları eksikse API kontrollu bicimde `BILLING_FEATURE_DISABLED` doner.
- Stripe checkout, confirm ve webhook route'lari repoda vardir.

### Raporlar ve export

- `/reports` servis ve belge verilerini tarih araligina gore toplar.
- PDF export istemci tarafinda jsPDF ile uretilir.
- Rapor ekraninda Turkce metin butunlugu icin metin kontrolu vardir.

### Bildirimler

- `/notifications` ekrani `automation_events` kayitlarini listeleyip filtreler.
- Okundu isaretleme ve silme aksiyonlari ayni tablo uzerinden calisir.

### Maliyet ve skor

- `/costs` sayfasi servis maliyet trendleri, yillik karsilastirma ve oran bazli skor gosterir.
- Bu ekran premium analitik ozelligine baglidir.

## Plan Modeli

- Uygulama davranisi `free` ve `premium` profil planlari uzerinden calisir.
- Metadata tarafinda `starter`, `pro` ve `elite` kodlari normalize edilir.
- Free limitleri backend tarafinda enforce edilir:
  - En fazla 3 varlik
  - En fazla 5 belge
  - En fazla 3 abonelik
  - En fazla 3 fatura olusturma/yukleme
- Premium ozellikleri:
  - Gelismis analitik
  - Otomasyon
  - PDF export tasarimi
  - Premium medya yukleme

## Operasyonel Bagimliliklar

- Supabase migrationlarinin eksiksiz uygulanmis olmasi
- Stripe secret ve webhook kurulumu
- Sentry DSN ve sourcemap upload kurulumu
- Supabase Edge Functions deploy'u
- Backup/PITR ve restore pratiği

## Mevcut Acik Noktalar

- Plan config PDF export'u premium ozelligi olarak tanimliyor, ancak `src/features/reports/containers/reports-page-container.tsx` export butonuna su anda `canExportPdfReports` degerini sabit acik geciyor. Bu urun kuralinin manuel olarak netlestirilmesi gerekir.

## Kapsam Disi

- Cok kiracili ekip/workspace paylasimi
- SMS veya WhatsApp bildirim kanali
- IoT cihaz entegrasyonu
- Repo icinde tam deploy pipeline tanimi
