# AssetCare PRD (MVP v1.0)

## 1. Belge Amaci
Bu dokuman, AssetCare MVP urununun kapsamini, gereksinimlerini, veri modelini ve gelistirme adimlarini eksiksiz ve sirali bicimde tanimlar.

## 2. Urun Tanimi
AssetCare, ev ve bireysel varlıklarin bakım, garanti, servis ve belge sureclerini tek panelde takip etmeyi saglayan web tabanli bir SaaS urunudur.

Urun vaadi:
- Bakımi unutma.
- Garanti kaybetme.
- Servis gecmisini kanitla.

## 3. Problem Tanimi
Kullanıcı mevcutta bakım ve garanti takibini daginik sekilde yapiyor:
- Reminder uygulamasi: baglamsiz.
- Excel/not: otomasyonsuz.
- Marka uygulamasi: parcali.
- Genel AI araclari: kalici kayıt ve surec hafizasi zayif.

Sonuc:
- Garanti hakki kaybi
- Gecikmiş bakım
- Belge kaybi
- Kontrolsuz servis maliyeti

## 4. Hedef Kitle
MVP birincil segment:
- Bireysel ev sahipleri
- Birden fazla cihaz/varlık sahibi kullanıcılar

Ikincil segment (MVP sonrasi):
- Kucuk isletme sahipleri
- Kiraya veren ev sahipleri

## 5. Hedefler ve Başarı Kriterleri
### 5.1 Urun hedefleri
- Kullanıcıya ilk 10 dakikada deger gostermek.
- Varlık basina bakım periyodu tanimlatmak.
- Gecikmiş bakım ve garanti riskini gorunur kilmak.

### 5.2 KPI tanimlari
- `signup_to_asset_rate` = varlık ekleyen yeni kullanıcı / kayıt olan yeni kullanıcı
  Hedef: %60+
- `asset_to_rule_rate` = en az 1 bakım kuralı tanimlayan varlık / toplam varlık
  Hedef: %70+
- `d7_retention` = 7. günde geri donen kullanıcı / kayıt olan kullanıcı
  Hedef: %25+
- `service_log_rate` = servis logu oluşturan aktif kullanıcı / aktif kullanıcı
  Hedef: %40+
- `free_to_pro_rate` (MVP sonrasi)
  Hedef: %3-5

## 6. Kapsam
### 6.1 MVP kapsaminda
- Auth: register, login, şifre sifirlama, session guard
- Varlık CRUD
- Bakım kuralı ve next_due hesaplama
- Servis log kaydı
- Belge kasasi (private storage)
- Dashboard risk paneli
- Timeline
- Maliyet paneli
- Fatura abonelikleri ve abonelik takibi
- PDF rapor export
- Otomasyon motoru (Supabase event): garanti 30 gün kala, bakım 7 gün kala, yeni servis girişinde action calistirma

### 6.2 Kapsam disi (MVP harici)
- IoT cihaz entegrasyonu
- AI OCR
- Takim/ortak hesap paylasimi
- Gelişmiş push provider yönetimi (FCM/APNS/OneSignal gelişmiş segmentasyon)
- Arac km tabanli dinamik motor

## 7. Kullanıcı Akislari (E2E)
### 7.1 Ilk kurulum akışı
1. Kullanıcı kayıt olur.
2. Email doğrulama (opsiyonel, ayara bağlı).
3. Ilk varligi ekler.
4. Bakım periyodu girer.
5. Sistem next_due hesaplar.
6. Dashboard risk kartlari olusur.

### 7.2 Servis sonrasi akışı
1. Kullanıcı servis logu ekler.
2. Log bir kurala bagliysa ilgili kuralın `last_service_date` ve `next_due_date` alanları güncellenir.
3. Fatura/servis belgesi private storage'a yuklenir.
4. Timeline ve maliyet paneli aninda güncellenir.

## 8. Fonksiyonel Gereksinimler ve Kabul Kriterleri
### 8.1 Auth
Gereksinimler:
- Email/şifre ile kayıt
- Login/logout
- Şifre sifirlama
- Korumali route yapisi

Kabul kriterleri:
- Oturum yoksa korumali sayfalar login'e yonlendirir.
- Kullanıcı sadece kendi verisini gorur (RLS).

### 8.2 Varlik CRUD
Gereksinimler:
- Listele, ekle, duzenle, sil
- Alanlar: ad, kategori, marka/model, satin alma, garanti bitis, seri no, not, fotograf

Kabul kriterleri:
- `/assets` route'u dogrudan `AssetsPageContainer` render etmelidir (sadece `AppShell` kabul edilmez).
- Varlik listele/ekle/duzenle/sil adimlari UI'dan erisilebilir olmalidir.
- CRUD islem sonucu dashboard ve bagli listelerde gercek veriyle gorulmelidir.
### 8.3 Bakim Motoru
Gereksinimler:
- Interval girisi (gun/hafta/ay/yil)
- `next_due_date` hesaplama
- Kural duzenleme
- Servis sonrasi otomatik reset

Kabul kriterleri:
- `/maintenance` route'u dogrudan `MaintenancePageContainer` render etmelidir (sadece `AppShell` kabul edilmez).
- Her aktif kural icin gecerli bir `next_due_date` bulunur.
- Servis logu eklendiginde ilgili kural tarihi gercek veriyle dogru ileri tasinir.
### 8.4 Servis Gunlugu
Gereksinimler:
- Servis turu, tarih, maliyet, saglayici, not
- Varlikla iliski
- Kuralla iliski (opsiyonel)
- Listeleme + filtre (en az varlik ve tarih)

Kabul kriterleri:
- Maliyet 0 veya pozitif olmali.
- Servis listeleme ekraninda filtre UI gorunmeli ve sonuc tablosuna uygulanmalidir.
- Servis logu timeline ve maliyet panelinde gercek veriyle gorunmeli.
### 8.5 Belge Kasasi
Gereksinimler:
- Private bucket yukleme
- Belge tipleri (garanti, fatura, servis formu, diger)
- Servis loguna baglama (opsiyonel)
- Resmi upload akisi karari: `(x)` Upload Documents (`/documents`), `( )` Services

Kabul kriterleri:
- Secilen resmi upload akisi tek route'ta netlestirilmis olmali ve UI'dan erisilebilir olmalidir.
- Kullanici yalnizca kendi klasorundeki dosyalari okuyabilir/yazabilir/silebilir.
- Belge metadatasi `documents` tablosunda tutulur.
### 8.6 Dashboard Risk Paneli
Gereksinimler:
- Yaklasan bakim (or: 7 gun icinde)
- Gecikmis bakim
- Yaklasan garanti bitisi (or: 30 gun)
- KPI kartlari canli veriyle beslenir

Kabul kriterleri:
- Sorgular kullanici bazli ve performansli calisir.
- Kartlar en az adet ve kritik liste bilgisi gosterir.
- Sabit deger kabul edilmez; KPI kart degerleri `snapshot.metrics` ile birebir ayni olmalidir.
### 8.7 Timeline
Gereksinimler:
- Varlık olaylari + servis loglari + belge yuklemeleri birlestirilir.
- Ters kronolojik siralama

Kabul kriterleri:
- En yeni olay en ustte.
- Event tipine göre etiketlenmis gorunum.

### 8.8 Maliyet Paneli
Gereksinimler:
- Toplam maliyet
- Son 12 ay maliyet
- Kategori/varlık bazli dağılım

Kabul kriterleri:
- Grafikler servis log verisiyle uyumlu olmali.
- Filtre degisince özet degerler güncellenmeli.

### 8.9 PDF Rapor
Gereksinimler:
- Seçili tarih araliginda varlık + servis + maliyet özeti
- Indirilebilir PDF

Kabul kriterleri:
- Rapor basliginda tarih araligi ve kullanıcı bilgisi bulunur.
- Tablo toplamlari panel degerleriyle tutarli olmali.

### 8.10 Otomasyon Motoru (Trigger -> Action)
Gereksinimler:
- Trigger'lar:
  - Garanti bitişine 30 gün kala
  - Bakım due tarihine 7 gün kala
  - Yeni servis logu girildiginde
- Action'lar:
  - Email gonderimi
  - Push notification gonderimi
  - PDF rapor üretimi ve belge kasasina kayıt
- Event queue yapisi:
  - DB trigger/scheduler event'i `automation_events` tablosuna yazar
  - Event bazli action listesi `automation_events.actions` alanında tutulur
  - `automation-dispatcher` Edge Function `claim_automation_events` RPC ile event claim edip action'lari isler
  - Action sonuc/hatasi `automation_events.action_results` ve `last_error` alanlarina yazilir

Kabul kriterleri:
- `service_logs` insert sonrasi en gec 5 saniyede `service_log_created` event'i `pending` olarak kuyruga dusmeli.
- Günluk tarama calistiginda ilgili kayıtlar için tekil (`dedupe_key`) event olusmali.
- En az bir action başarısizsa event `failed`, tum actionlar başarıliysa `completed` olmalidir.
- PDF action'i calistiginda `documents` tablosunda kayıt ve private storage dosyasi olusmalidir.

### 8.11 Fatura Abonelikleri ve Abonelik Takibi
Gereksinimler:
- Abonelik kaydı oluşturma (sağlayıcı, plan, döngü, tutar, sonraki tahsilat tarihi)
- Abonelik durum yönetimi (aktif/duraklatıldı/iptal)
- Fatura kaydı oluşturma (fatura tarihi, vade, vergi, toplam, ödeme durumu)
- Abonelik bazlı fatura geçmişi ve özet metrikler

Kabul kriterleri:
- Kullanıcı yalnızca kendi abonelik ve fatura kayıtlarını görebilir (RLS).
- Aylık eşdeğer toplam tutar doğru hesaplanır (yıllık planlar /12).
- Gecikmiş ve bekleyen fatura sayıları durum alanıyla tutarlı olur.

## 9. Is Kurallari
- Her varlık bir kullanıcıya aittir.
- Her bakım kuralı tek bir varliga baglidir.
- Servis logu varliga baglidir; kurala baglanmasi opsiyoneldir.
- Belge varliga baglidir; servis logüna baglanmasi opsiyoneldir.
- Tum ana tablolarda RLS zorunludur.
- Storage path standardi: `<user_id>/<asset_id>/<filename>`.

## 10. Veri Modeli (MVP)
### 10.1 assets
- `id` uuid pk
- `user_id` uuid fk auth.users
- `name`, `category` zorunlu
- `brand`, `model`, `purchase_date`, `warranty_end_date`, `serial_number`, `notes`, `photo_path`
- `created_at`, `updated_at`

### 10.2 maintenance_rules
- `id`, `asset_id`, `user_id`
- `title`
- `interval_value` > 0
- `interval_unit` enum: day/week/month/year
- `last_service_date`, `next_due_date`
- `is_active`
- `created_at`, `updated_at`

### 10.3 service_logs
- `id`, `asset_id`, `user_id`
- `rule_id` nullable
- `service_type`, `service_date`
- `cost` numeric >= 0
- `provider`, `notes`
- `created_at`

### 10.4 documents
- `id`, `asset_id`, `user_id`
- `service_log_id` nullable
- `document_type`, `file_name`, `storage_path`
- `file_size`, `uploaded_at`

### 10.5 push_subscriptions
- `id`, `user_id`
- `token`, `platform`, `is_active`
- `created_at`, `updated_at`

### 10.6 automation_events
- `id`, `user_id`
- `asset_id`, `rule_id`, `service_log_id` nullable baglantilar
- `trigger_type` enum: warranty_30_days / maintenance_7_days / service_log_created
- `actions` text[]: email / push_notification / pdf_report (`push` geriye uyumluluk)
- `payload`, `action_results`
- `status` enum: pending / processing / completed / failed
- `dedupe_key`, `run_after`, `created_at`, `processed_at`, `last_error`

### 10.7 billing_subscriptions
- `id`, `user_id`
- `provider_name`, `subscription_name`, `plan_name`
- `billing_cycle` enum: monthly/yearly
- `amount`, `currency`, `next_billing_date`
- `auto_renew`, `status` enum: active/paused/cancelled
- `notes`, `created_at`, `updated_at`

### 10.8 billing_invoices
- `id`, `user_id`, `subscription_id`
- `invoice_no`, `issued_at`, `due_date`, `paid_at`
- `amount`, `tax_amount`, `total_amount`
- `status` enum: pending/paid/overdue/cancelled
- `file_path`, `created_at`

## 11. Guvenlik ve Uyumluluk
- Supabase Auth + RLS ile tenant izolasyonu
- Storage bucket private
- HTTPS zorunlu (deploy ortami)
- Kritik işlemler server tarafinda doğrulanir
- Hassas anahtarlar sadece env/secrets ile tutulur

## 12. Fonksiyonel Olmayan Gereksinimler
- Mobil önce tasarim (375px+)
- Ilk ekran yukleme hedefi: p75 < 2.5sn
- Form giriş suresi: temel varlık kaydı < 30sn
- Minimum erisilebilirlik: semantik etiketler, kontrast, odaklanabilir alanlar
- PWA uyumlulugu (MVP sonunda)

## 13. Bilgi Mimarisi (Route Haritasi / IA)
| Route | Menu | Durum | Not |
| --- | --- | --- | --- |
| `/` | Hayir | Fonksiyonel | Landing |
| `/login`, `/register` | Hayir | Fonksiyonel | Auth |
| `/dashboard` | Evet | Fonksiyonel | KPI kartlari `snapshot.metrics` ile canli veriye bagli |
| `/assets` | Evet | Fonksiyonel | `AssetsPageContainer` bagli; listeleme + QR tarama akisi aktif |
| `/maintenance` | Evet | Fonksiyonel | `MaintenancePageContainer` bagli; kural olusturma/duzenleme/pasif etme akisi aktif |
| `/services` | Evet | Fonksiyonel | Listeleme + filtre UI aktif (varlik + tarih) |
| `/documents` | Evet | Fonksiyonel | Upload Documents formu + liste/ozet + onizleme/indirme aktif |
| `/timeline` | Evet | Fonksiyonel | |
| `/expenses` | Evet | Fonksiyonel | |
| `/notifications` | Evet | Placeholder | MVP disi / placeholder |
| `/billing` | Evet | Fonksiyonel | |
| `/invoices` | Evet | Placeholder | MVP disi / placeholder |
| `/costs` | Evet | Fonksiyonel | |
| `/reports` | Evet | Fonksiyonel | |
| `/settings` | Evet | Placeholder | MVP disi / placeholder |
| `/pricing` | Hayir | Fonksiyonel | Planlama / paket sayfasi |
| `/onboarding` | Hayir | MVP disi / placeholder | Menuye bagli degil |
## 14. Analitik Event Plani
- `auth_signup_completed`
- `asset_created`
- `maintenance_rule_created`
- `service_log_created`
- `document_uploaded`
- `report_exported_pdf`

Her event minimum alanları:
- `user_id`
- `timestamp`
- `source_page`

## 15. Gelistirme Asamalari (Eksiksiz ve Sirali)
Not: Asamalar birbirine bagimlidir. Bir asama kapanmadan sonraki asamaya gecilmez.

Durum Göstergesi:
- `(x)` Tamamlandi
- `( )` Planli / Siradaki

### 15.1 `(x)` Asama 00 - Urun Kapsami ve Domain Kurallari
Adimlar:
1. `(x)` Kategori listesi netlestirme
2. `(x)` Servis turleri listesi
3. `(x)` Belge tipleri listesi
4. `(x)` Periyot kurallari ve risk esikleri

Done kriteri:
- `(x)` Kararlar PRD icinde sabitlendi.

### 15.2 `(x)` Asama 01 - Proje Kurulumu ve Gelistirme Altyapisi
Adimlar:
1. `(x)` Next.js + TypeScript + Tailwind kurulumu
2. `(x)` CI pipeline (lint + build)
3. `(x)` Env template dosyalari
4. `(x)` Temel route iskeleti

Done kriteri:
- `(x)` `npm run lint` yesil.
- `(x)` `npm run build` yesil.

### 15.3 `(x)` Asama 02 - Supabase Projesi ve Veritabani Kurulumu
Adimlar:
1. `(x)` Supabase proje oluşturma ve baglama
2. `(x)` SQL migrationlari Supabase ortaminda calistirma
3. `(x)` RLS policy aktivasyonunu canli veritabaninda doğrulama
4. `(x)` Private storage policy doğrulama
5. `(x)` Seed test verisi yukleme

Not:
- `(x)` Migration dosyalari hazirlandi (`supabase/migrations/20260215183000_init.sql`, `supabase/migrations/20260215183500_storage.sql`).
- `(x)` Canli doğrulama tamamlandi (RLS izolasyonu, storage policy, check constraint testleri, seed yukleme).

Done kriteri:
- `(x)` Yetkisiz kullanıcı veri okuyamaz.
- `(x)` Yetkili kullanıcı sadece kendi verisini okur.

### 15.4 `(x)` Asama 03 - Kimlik Doğrulama (Auth) Modulu
Adimlar:
1. `(x)` Register UI + action
2. `(x)` Login UI + action
3. `(x)` Forgot/reset password
4. `(x)` Session guard middleware
5. `(x)` Protected routes

Done kriteri:
- `(x)` Auth akislari E2E calisir.

### 15.5 `(x)` Asama 04 - Varlik Yonetimi (CRUD)
Adimlar:
1. `(x)` Varlik listeleme (`/assets` route'u `AssetsPageContainer` bagli)
2. `(x)` Varlik olusturma formu
3. `(x)` Guncelleme ve silme
4. `(x)` Fotograf yukleme entegrasyonu
5. `(x)` Form validasyonlari

Done kriteri:
- `(x)` `/assets` route'u container'a bagli, CRUD akislari UI'dan erisilebilir ve sonuclar gercek veride gorunur.
### 15.6 `(x)` Asama 05 - Bakim Kurali ve Tarih Hesaplama Motoru
Adimlar:
1. `(x)` Kural olusturma ekrani (`/maintenance` route'u `MaintenancePageContainer` bagli)
2. `(x)` Interval -> `next_due` hesap servisi
3. `(x)` Kural duzenleme/pasif etme
4. `(x)` Servis sonrasi tarih reset mekanizmasi

Done kriteri:
- `(x)` `/maintenance` route'u container'a bagli, kural lifecycle UI'dan erisilebilir, `next_due` hesaplari gercek veriyle dogrulanir.
### 15.7 `(x)` Asama 06 - Dashboard Risk ve Uyari Modulu
Adimlar:
1. `(x)` Yaklasan bakim sorgusu
2. `(x)` Gecikmis bakim sorgusu
3. `(x)` Garanti bitis sorgusu
4. `(x)` Risk kart UI

Not:
- `(x)` KPI kartlari `snapshot.metrics` ile canli veri baglantisina alindi; sabit deger kaldirildi.

Done kriteri:
- `(x)` Sabit deger kabul edilmez; dashboard KPI kartlari `snapshot.metrics` ile birebir uyumlu olmalidir.
### 15.8 `(x)` Asama 07 - Servis Kayit ve Gecmis Modulu
Adimlar:
1. `(x)` Servis formu
2. `(x)` Maliyet alani + para birimi
3. `(x)` Listeleme + filtre (Regresyon: filtre UI eksik)
4. `(x)` Kural iliskisi

Done kriteri:
- `(x)` Servis listeleme ekraninda filtre UI gorunur ve filtreleme gercek veriye birebir uygulanir.
### 15.9 `(x)` Asama 08 - Belge Kasasi ve Dosya Yonetimi
Adimlar:
1. `(x)` Private bucket entegrasyonu
2. `(x)` Upload UI (`/documents` uzerinden erisilebilir)
3. `(x)` Belge metadata kaydi
4. `(x)` Onizleme/indirme
5. `(x)` Resmi upload akisi karari: `Upload Documents` (`/documents`)

Done kriteri:
- `(x)` Secilen resmi upload route'unda upload UI erisilebilir olmali, dosya + metadata gercek veride olusmali.
### 15.10 `(x)` Asama 09 - Timeline ve Olay Akışı
Adimlar:
1. `(x)` Event birlestirme sorgusu
2. `(x)` Ters tarih siralama
3. `(x)` Event tip badge UI

Done kriteri:
- `(x)` Tum olaylar tek akista gorunur.

### 15.11 `(x)` Asama 10 - Maliyet Analizi Paneli
Adimlar:
1. `(x)` Toplam ve yıllik maliyet hesaplari
2. `(x)` Grafikler (Chart.js)
3. `(x)` Dönem filtresi

Done kriteri:
- `(x)` Toplamlar servis log tablosuyla tutarli.

### 15.12 `(x)` Asama 11 - PDF Raporlama ve Disa Aktarim
Adimlar:
1. `(x)` Rapor içerik semasi
2. `(x)` Tablo + toplamlar
3. `(x)` jsPDF export

Done kriteri:
- `(x)` Uretilen PDF için QA kontrol listesi gecer.

### 15.13 `(x)` Asama 12 - Mobil Optimizasyon ve PWA Hazirligi
Adimlar:
1. `(x)` Responsive test turlari
2. `(x)` Mobile layout iyılestirmeleri
3. `(x)` PWA manifest ve iconlar
4. `(x)` Offline fallback sayfasi (temel)

Done kriteri:
- `(x)` Mobilde kritik akislarda UI kirilmasi yok.

### 15.14 `(x)` Asama 13 - QA, Guvenlik ve Yayina Hazirlik
Adimlar:
1. `(x)` Smoke test
2. `(x)` Regression checklist
3. `(x)` RLS negatif testleri
4. `(x)` Performans temel ölçümler
5. `(x)` Release notes

Done kriteri:
- `(x)` Canliya çıkış öncesi checklist %100 tamam.

### 15.15 `(x)` Asama 14 - Premium UI Revamp (Landing + Panel)
Adimlar:
1. `(x)` Landing page premium gradyan tasarim
2. `(x)` Ücretsiz (3 varlık) + Premium (149 TL sınırsız) plan kurgusu
3. `(x)` Dashboard/menu için ortak shell ve kart dili
4. `(x)` Diger operasyon sayfalarini ayni tasarima tasima
5. `(x)` Mobil uyumlu menu gecisleri

Done kriteri:
- `(x)` Landing ve panel sayfalari tek tasarim sistemiyle tutarli calisir.

### 15.16 `(x)` Asama 15 - QR/Barkod ile Varlik Erisimi
Adimlar:
1. `(x)` Varlik listesinde QR tarama butonu (`/assets` route'u container'a bagli)
2. `(x)` Mobil cihaz kamerasi ile QR/barkod tarama modali
3. `(x)` Taranan kod ile varlik detay sayfasina yonlendirme
4. `(x)` Supabase `assets` tablosuna benzersiz `qr_code` alani ekleme
5. `(x)` QR koda gore varlik sorgulama ve detay acilisi

Done kriteri:
- `(x)` `/assets` uzerinden QR tarama akisi UI'dan uctan uca erisilebilir olmali (liste -> tarama -> detay) ve gercek veriyle calismalidir.
### 15.17 `(x)` Aşama 16 - Fatura Abonelikleri ve Abonelik Takibi
Adımlar:
1. `(x)` Abonelikler menü bağlantısı ve korumalı route eklendi
2. `(x)` Abonelik kayıt ekranı (sağlayıcı, plan, döngü, tutar, durum)
3. `(x)` Fatura kayıt ekranı (tutar, vergi, toplam, ödeme durumu)
4. `(x)` Abonelik/fatura özet kartları ve geçmiş tablosu
5. `(x)` Supabase migration + RLS politikaları

Done kriteri:
- `(x)` Abonelik ve fatura takibi kullanıcı bazlı, uçtan uca çalışır.

### 15.18 `( )` Aşama 17 - Final Hardening ve Canlı İzleme
Adımlar:
1. `( )` Kritik akışlar için Playwright E2E otomasyon testleri
2. `( )` `supabase/tests/rls_negative_tests.sql` senaryosunu CI pipeline'a bağlama
3. `( )` Gerçek cihazlarda PWA kurulum + offline/online geri dönüş test türü
4. `( )` Uygulama hata izleme (Sentry veya eşdeğer) + alarm kuralları
5. `( )` Veritabanı yedek/geri-dönüş tatbikatı ve raporlama

Done kriteri:
- `(x)` Canlıya çıktıktan sonra ilk 7 gün P0/P1 hata olmadan izleme tamamlanır.

## 16. Test Stratejisi
- Unit: tarih hesaplama, maliyet toplamlari
- Integration: auth + CRUD + RLS
- E2E: kayıt -> varlık -> kural -> servis -> belge -> rapor
- UAT: 5 kullanıcı ile gercek senaryo doğrulama

## 17. Riskler ve Azaltma Plani
- Reminder app ile karisma
  Azaltma: landing'de "servis + garanti + belge kaniti" mesajini netlestir.
- Feature creep
  Azaltma: MVP disi talepler backlog'a alinip sprint disina atilir.
- Dusuk aktivasyon
  Azaltma: onboarding'i 3 adimda sinirla, ornek veri secenegi ekle.

## 18. Acik Sorular
- Ilk surumde coklu para birimi gerekli mi? (onerilen: hayir)
- Belge upload resmi akis karari: `Upload Documents` (`/documents`) olarak sabitlendi. `(x)`
## 19. Çıkış Kriterleri (MVP Launch Gate)
- Auth + CRUD + Bakım motoru + Servis + Belge + Dashboard + PDF calisir.
- RLS ve storage policy testleri gecer.
- Kritik hatalar (P0/P1) kapatilir.
- KPI ölçüm eventleri canliya alinmis olur.

