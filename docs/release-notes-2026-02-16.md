# Release Notes - 2026-02-16

Sürüm kapsamı:
- Aşama 08: Belge kasası önizleme/indirme
- Aşama 09: Timeline event birleştirme + ters tarih sıralama
- Aşama 10: Maliyet analizi (dönem filtresi + Chart.js)
- Aşama 11: PDF raporlama (jsPDF export)
- Aşama 12: Mobil optimizasyon + PWA hazırlığı
- Aşama 13: QA/Güvenlik/Yayıma hazırlık dokümantasyonu

## Yeni özellikler
1. Belgelerde `Önizle` ve `İndir` aksiyonları eklendi.
2. Timeline ekranında varlık/servis/belge olayları tek akışta ve ters kronolojik sıralandı.
3. Maliyet ekranında dönem filtresi, aylık trend ve yıllık toplam Chart.js grafikleri eklendi.
4. Rapor ekranında tarih aralığına göre özet + tablolar + PDF dışa aktarım eklendi.
5. PWA altyapısı eklendi:
   - `manifest.webmanifest`
   - PWA ikon seti
   - temel service worker cache stratejisi
   - çevrimdışı fallback sayfası (`/offline`)

## Güvenlik
1. Korumalı route ve API endpoint davranışları smoke test ile doğrulandı.
2. RLS negatif testleri için çalıştırılabilir SQL senaryosu eklendi:
   - `supabase/tests/rls_negative_tests.sql`

## Kalite kapıları
1. `npm run lint`: başarılı
2. `npm run build`: başarılı

## QA dokümanları
1. `docs/qa/smoke-test-2026-02-16.md`
2. `docs/qa/regression-checklist-2026-02-16.md`
3. `docs/qa/rls-negative-tests-2026-02-16.md`
4. `docs/qa/performance-baseline-2026-02-16.md`
