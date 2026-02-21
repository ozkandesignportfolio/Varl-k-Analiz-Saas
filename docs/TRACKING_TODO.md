# PRD Tracking TODO

| Oncelik | Is | Etkilenen route/sayfa | PRD referansi | Kabul kriteri | Durum |
| --- | --- | --- | --- | --- | --- |
| High | Assets route wiring duzelt | `/assets` | `15.5 Asama 04 - Varlik Yonetimi (CRUD)` | `/assets` route'u `AssetsPageContainer` render eder; liste/ekle/duzenle/sil UI'dan erisilebilir. | `( )` |
| High | Maintenance route wiring duzelt | `/maintenance` | `15.6 Asama 05 - Bakim Kurali ve Tarih Hesaplama Motoru` | `/maintenance` route'u `MaintenancePageContainer` render eder; kural lifecycle UI'dan calisir. | `( )` |
| High | QR akisini UI'dan erisilebilir yap | `/assets`, `/assets/[id]` | `15.16 Asama 15 - QR/Barkod ile Varlik Erisimi` | Liste -> tarama -> detay akisi `/assets` uzerinden canli veriyle uctan uca calisir. | `( )` |
| High | KPI kartlarini canli veriye bagla | `/dashboard` | `8.6 Dashboard Risk Paneli`, `15.7 Asama 06` | Sabit deger kullanilmaz; KPI degerleri `snapshot.metrics` ile birebir ayni olur. | `(x)` |
| Medium | Services listeleme filtre UI ekle | `/services` | `8.4 Servis Gunlugu`, `15.8 Asama 07` | En az varlik + tarih filtresi UI'da gorunur; tablo sonuclari filtreye birebir uyar. | `(x)` |
| Medium | Belge upload resmi akis kararini ver | `/documents` | `8.5 Belge Kasasi`, `15.9 Asama 08`, `18. Acik Sorular` | Tek resmi akis `Upload Documents` (`/documents`) olarak sabitlenir. | `(x)` |
| Medium | Belge upload UI'yi secilen route'ta tamamla | `/documents` | `15.9 Asama 08 - Belge Kasasi ve Dosya Yonetimi` | Upload UI `/documents` route'unda gorunur; dosya + metadata kaydi gercek veride olusur. | `(x)` |
| Medium | Route/IA haritasini periyodik guncelle | `/dashboard`, `/assets`, `/maintenance`, `/services`, `/documents`, `/timeline`, `/expenses`, `/notifications`, `/billing`, `/invoices`, `/costs`, `/reports`, `/settings`, `/pricing`, `/onboarding` | `13. Bilgi Mimarisi (Route Haritasi / IA)` | Menudeki her route icin `fonksiyonel / kaldirilacak / placeholder` status alani dolu olur. | `( )` |
| Medium | Playwright kritik E2E otomasyonu | Kritik akislari kapsayan route'lar | `15.18 Asama 17 - Final Hardening` | Kritik akislara ait Playwright testleri CI'da calisir ve yesil olur. | `( )` |
| Medium | CI RLS negatif test entegrasyonu | CI pipeline | `15.18 Asama 17 - Final Hardening` | `supabase/tests/rls_negative_tests.sql` CI adimi olarak fail/pass kontroluyle calisir. | `( )` |
| Medium | PWA gercek cihaz test turu | Mobil cihazlar + `/offline` | `15.18 Asama 17 - Final Hardening` | Gercek cihazlarda kurulum, offline/online geri donus testleri raporlanir. | `( )` |
| Medium | Sentry (veya esdeger) + alarm kurallari | Tum uygulama | `15.18 Asama 17 - Final Hardening` | Hata izleme aktif, P0/P1 alarm esikleri ve bildirim kanallari tanimli olur. | `( )` |
| Medium | Backup/restore drill | Veritabani + storage | `15.18 Asama 17 - Final Hardening` | Yedek alma + geri donus tatbikati yapilir; sonuc raporu dokumante edilir. | `( )` |
| Low | 7 gun P0/P1 canli izleme kapisi | Production | `15.18 Asama 17 Done kriteri` | Canliya cikistan sonraki ilk 7 gunde P0/P1 olay yok veya RCA ile kapatilmis olur. | `( )` |

