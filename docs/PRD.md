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
Kullanici mevcutta bakım ve garanti takibini daginik sekilde yapiyor:
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
- Birden fazla cihaz/varlık sahibi kullanicilar

Ikincil segment (MVP sonrasi):
- Kucuk isletme sahipleri
- Kiraya veren ev sahipleri

## 5. Hedefler ve Basari Kriterleri
### 5.1 Urun hedefleri
- Kullaniciya ilk 10 dakikada deger gostermek.
- Varlık basina bakım periyodu tanimlatmak.
- Gecikmiş bakım ve garanti riskini gorunur kilmak.

### 5.2 KPI tanimlari
- `signup_to_asset_rate` = varlık ekleyen yeni kullanici / kayıt olan yeni kullanici
  Hedef: %60+
- `asset_to_rule_rate` = en az 1 bakım kurali tanimlayan varlık / toplam varlık
  Hedef: %70+
- `d7_retention` = 7. günde geri donen kullanici / kayıt olan kullanici
  Hedef: %25+
- `service_log_rate` = servis logu oluşturan aktif kullanici / aktif kullanici
  Hedef: %40+
- `free_to_pro_rate` (MVP sonrasi)
  Hedef: %3-5

## 6. Kapsam
### 6.1 MVP kapsaminda
- Auth: register, login, şifre sifirlama, session guard
- Varlık CRUD
- Bakım kurali ve next_due hesaplama
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
- Gelismis push provider yönetimi (FCM/APNS/OneSignal gelismis segmentasyon)
- Arac km tabanli dinamik motor

## 7. Kullanici Akislari (E2E)
### 7.1 Ilk kurulum akışı
1. Kullanici kayıt olur.
2. Email doğrulama (opsiyonel, ayara bagli).
3. Ilk varligi ekler.
4. Bakım periyodu girer.
5. Sistem next_due hesaplar.
6. Dashboard risk kartlari olusur.

### 7.2 Servis sonrasi akışı
1. Kullanici servis logu ekler.
2. Log bir kurala bagliysa ilgili kuralin `last_service_date` ve `next_due_date` alanlari güncellenir.
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
- Kullanici sadece kendi verisini gorur (RLS).

### 8.2 Varlık CRUD
Gereksinimler:
- Listele, ekle, düzenle, sil
- Alanlar: ad, kategori, marka/model, satin alma, garanti bitis, seri no, not, fotograf

Kabul kriterleri:
- Yeni varlık ekleme formu mobilde 30 saniye altinda tamamlanabilir.
- Silinen varliga bagli kurallar/loglar iliski kurallarina göre temizlenir.

### 8.3 Bakım Motoru
Gereksinimler:
- Interval girişi (gün/hafta/ay/yıl)
- `next_due_date` hesaplama
- Kural düzenleme
- Servis sonrasi otomatik reset

Kabul kriterleri:
- Her aktif kural icin gecerli bir `next_due_date` bulunur.
- Servis logu eklendiginde ilgili kural tarihi doğru ileri tasinir.

### 8.4 Servis Günlugu
Gereksinimler:
- Servis turu, tarih, maliyet, sağlayıcı, not
- Varlıkla iliski
- Kuralla iliski (opsiyonel)

Kabul kriterleri:
- Maliyet 0 veya pozitif olmali.
- Servis logu timeline ve maliyet panelinde gorunmeli.

### 8.5 Belge Kasasi
Gereksinimler:
- Private bucket yukleme
- Belge tipleri (garanti, fatura, servis formu, diger)
- Servis logüna baglama (opsiyonel)

Kabul kriterleri:
- Kullanici yalnizca kendi klasorundeki dosyalari okuyabilir/yazabilir/silebilir.
- Belge metadatasi `documents` tablosunda tutulur.

### 8.6 Dashboard Risk Paneli
Gereksinimler:
- Yaklasan bakım (or: 7 gün icinde)
- Gecikmiş bakım
- Yaklasan garanti bitisi (or: 30 gün)

Kabul kriterleri:
- Sorgular kullanici bazli ve performansli calisir.
- Kartlar en az adet ve kritik liste bilgisi gosterir.

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
- Kategori/varlık bazli dagilim

Kabul kriterleri:
- Grafikler servis log verisiyle uyumlu olmali.
- Filtre degisince özet degerler güncellenmeli.

### 8.9 PDF Rapor
Gereksinimler:
- Secili tarih araliginda varlık + servis + maliyet özeti
- Indirilebilir PDF

Kabul kriterleri:
- Rapor basliginda tarih araligi ve kullanici bilgisi bulunur.
- Tablo toplamlari panel degerleriyle tutarli olmali.

### 8.10 Otomasyon Motoru (Trigger -> Action)
Gereksinimler:
- Trigger'lar:
  - Garanti bitisine 30 gün kala
  - Bakım due tarihine 7 gün kala
  - Yeni servis logu girildiginde
- Action'lar:
  - Email gonderimi
  - Push notification gonderimi
  - PDF rapor üretimi ve belge kasasina kayıt
- Event queue yapisi:
  - DB trigger/scheduler event'i `automation_events` tablosuna yazar
  - Event bazli action listesi `automation_events.actions` alaninda tutulur
  - `automation-dispatcher` Edge Function `claim_automation_events` RPC ile event claim edip action'lari isler
  - Action sonuc/hatasi `automation_events.action_results` ve `last_error` alanlarina yazilir

Kabul kriterleri:
- `service_logs` insert sonrasi en gec 5 saniyede `service_log_created` event'i `pending` olarak kuyruga dusmeli.
- Günluk tarama calistiginda ilgili kayıtlar icin tekil (`dedupe_key`) event olusmali.
- En az bir action basarisizsa event `failed`, tum actionlar basariliysa `completed` olmalidir.
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
- Her varlık bir kullaniciya aittir.
- Her bakım kurali tek bir varliga baglidir.
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
- Mobil once tasarim (375px+)
- Ilk ekran yukleme hedefi: p75 < 2.5sn
- Form giriş suresi: temel varlık kaydı < 30sn
- Minimum erisilebilirlik: semantik etiketler, kontrast, odaklanabilir alanlar
- PWA uyumlulugu (MVP sonunda)

## 13. Bilgi Mimarisi (Route Haritasi)
- `/` : landing
- `/login`, `/register`
- `/dashboard`
- `/assets`
- `/services`
- `/documents`
- `/timeline`
- `/costs`
- `/billing`
- `/reports`

## 14. Analitik Event Plani
- `auth_signup_completed`
- `asset_created`
- `maintenance_rule_created`
- `service_log_created`
- `document_uploaded`
- `report_exported_pdf`

Her event minimum alanlari:
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
- `(x)` Yetkisiz kullanici veri okuyamaz.
- `(x)` Yetkili kullanici sadece kendi verisini okur.

### 15.4 `(x)` Asama 03 - Kimlik Doğrulama (Auth) Modulu
Adimlar:
1. `(x)` Register UI + action
2. `(x)` Login UI + action
3. `(x)` Forgot/reset password
4. `(x)` Session guard middleware
5. `(x)` Protected routes

Done kriteri:
- `(x)` Auth akislari E2E calisir.

### 15.5 `(x)` Asama 04 - Varlık Yönetimi (CRUD)
Adimlar:
1. `(x)` Varlık listeleme
2. `(x)` Varlık oluşturma formu
3. `(x)` Güncelleme ve silme
4. `(x)` Fotograf yukleme entegrasyonu
5. `(x)` Form validasyonlari

Done kriteri:
- `(x)` Tam CRUD işlemleri mobilde sorunsuz.

### 15.6 `(x)` Aşama 05 - Bakım Kuralı ve Tarih Hesaplama Motoru
Adimlar:
1. `(x)` Kural oluşturma ekranı
2. `(x)` Interval -> `next_due` hesap servisi
3. `(x)` Kural düzenleme/pasif etme
4. `(x)` Servis sonrası tarih reset mekanizması

Done kriteri:
- `(x)` Rule lifecycle bug'sız tamamlanır.

### 15.7 `(x)` Aşama 06 - Dashboard Risk ve Uyarı Modülü
Adimlar:
1. `(x)` Yaklaşan bakım sorgusu
2. `(x)` Gecikmiş bakım sorgusu
3. `(x)` Garanti bitiş sorgusu
4. `(x)` Risk kart UI

Done kriteri:
- `(x)` Kart sayıları veriyle birebir uyumlu.

### 15.8 `(x)` Asama 07 - Servis Kayıt ve Gecmis Modulu
Adimlar:
1. `(x)` Servis formu
2. `(x)` Maliyet alani + para birimi
3. `(x)` Listeleme + filtre
4. `(x)` Kural ilişkisi

Done kriteri:
- `(x)` Log eklendiginde maliyet paneli etkilenir.

### 15.9 `(x)` Asama 08 - Belge Kasasi ve Dosya Yönetimi
Adimlar:
1. `(x)` Private bucket entegrasyonu
2. `(x)` Upload UI
3. `(x)` Belge metadata kaydı
4. `(x)` Onizleme/indirme

Done kriteri:
- `(x)` Kullanici sadece kendi dosyalarina erisir.

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
3. `(x)` Donem filtresi

Done kriteri:
- `(x)` Toplamlar servis log tablosuyla tutarli.

### 15.12 `(x)` Asama 11 - PDF Raporlama ve Disa Aktarim
Adimlar:
1. `(x)` Rapor içerik semasi
2. `(x)` Tablo + toplamlar
3. `(x)` jsPDF export

Done kriteri:
- `(x)` Uretilen PDF icin QA kontrol listesi gecer.

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
- `(x)` Canliya çıkış oncesi checklist %100 tamam.

### 15.15 `(x)` Asama 14 - Premium UI Revamp (Landing + Panel)
Adimlar:
1. `(x)` Landing page premium gradyan tasarim
2. `(x)` Ücretsiz (3 varlık) + Premium (149 TL sınırsız) plan kurgusu
3. `(x)` Dashboard/menu icin ortak shell ve kart dili
4. `(x)` Diger operasyon sayfalarini ayni tasarima tasima
5. `(x)` Mobil uyumlu menu gecisleri

Done kriteri:
- `(x)` Landing ve panel sayfalari tek tasarim sistemiyle tutarli calisir.

### 15.16 `(x)` Asama 15 - QR/Barkod ile Varlık Erisimi
Adimlar:
1. `(x)` Varlık listesinde QR tarama butonu
2. `(x)` Mobil cihaz kamerasi ile QR/barkod tarama modalı
3. `(x)` Taranan kod ile varlık detay sayfasina yonlendirme
4. `(x)` Supabase `assets` tablosuna benzersiz `qr_code` alani ekleme
5. `(x)` QR koda göre varlık sorgulama ve detay acilisi

Done kriteri:
- `(x)` QR tarama akışı uctan uca calisir (liste -> tarama -> detay).

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
3. `( )` Gerçek cihazlarda PWA kurulum + offline/online geri dönüş test turu
4. `( )` Uygulama hata izleme (Sentry veya eşdeğer) + alarm kuralları
5. `( )` Veritabanı yedek/geri-dönüş tatbikatı ve raporlama

Done kriteri:
- `( )` Canlıya çıktıktan sonra ilk 7 gün P0/P1 hata olmadan izleme tamamlanır.

## 16. Test Stratejisi
- Unit: tarih hesaplama, maliyet toplamlari
- Integration: auth + CRUD + RLS
- E2E: kayıt -> varlık -> kural -> servis -> belge -> rapor
- UAT: 5 kullanici ile gercek senaryo doğrulama

## 17. Riskler ve Azaltma Plani
- Reminder app ile karisma
  Azaltma: landing'de "servis + garanti + belge kaniti" mesajini netlestir.
- Feature creep
  Azaltma: MVP disi talepler backlog'a alinip sprint disina atilir.
- Dusuk aktivasyon
  Azaltma: onboarding'i 3 adimda sinirla, ornek veri secenegi ekle.

## 18. Acik Sorular
- Ilk surumde coklu para birimi gerekli mi? (onerilen: hayir)

## 19. Çıkış Kriterleri (MVP Launch Gate)
- Auth + CRUD + Bakım motoru + Servis + Belge + Dashboard + PDF calisir.
- RLS ve storage policy testleri gecer.
- Kritik hatalar (P0/P1) kapatilir.
- KPI ölçüm eventleri canliya alinmis olur.


