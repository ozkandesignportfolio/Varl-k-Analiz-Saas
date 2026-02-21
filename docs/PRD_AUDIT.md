# PRD Audit (PRD <-> Kod Karsilastirmasi)

## A) Dogrulananlar
- `/assets` route'u su an yalnizca `AppShell` render ediyor; `AssetsPageContainer` route'a bagli degil.
- `/maintenance` route'u su an yalnizca `AppShell` render ediyor; `MaintenancePageContainer` route'a bagli degil.
- QR tarama akisi container tarafinda mevcut ama `/assets` route wiring eksigi nedeniyle UI'dan uctan uca erisilemiyor.
- `/documents` ekrani liste/ozet/indirme + upload formu sagliyor.
- Resmi upload akisi `Upload Documents` olarak `/documents` route'unda calisiyor.
- Servis ekraninda "listeleme + filtre" iddiasi var, filtre UI yok.
- Dashboard KPI kartlarinda sabit deger (`METRIC_CARD_VALUES`) kullaniliyor; canli metrik baglantisi tamam degil.
- Route haritasi eksik: `/expenses`, `/invoices`, `/pricing`, `/onboarding` PRD IA listesinde yoktu.

## B) Tutarsiz / Supheli Bulgular
1. "Varlik CRUD tamamlandi" isareti route wiring ile uyumlu degil (`/assets` bos shell).
2. "Bakim motoru tamamlandi" isareti route wiring ile uyumlu degil (`/maintenance` bos shell).
3. "QR tarama uctan uca" isareti route erisilebilirligiyle uyumsuz.
4. Belge upload UI konumu net: resmi akis `/documents` uzerinde.
5. "Servis listeleme + filtre" iddiasinda filtre UI eksigi var.
6. "Dashboard KPI canli veri" iddiasi sabit kart degerleriyle uyumsuz.
7. Route/IA bolumu guncel route setini yansitmiyor.

## C) Aksiyon Listesi (Oncelik + Kabul Kriteri)
| Oncelik | Aksiyon | Kabul kriteri |
| --- | --- | --- |
| High | `/assets` route wiring duzeltmesi | `/assets` route'u `AssetsPageContainer` render eder; CRUD UI'dan erisilebilir ve DB verisiyle dogrulanir. |
| High | `/maintenance` route wiring duzeltmesi | `/maintenance` route'u `MaintenancePageContainer` render eder; kural lifecycle UI'dan erisilebilir. |
| High | QR akisini route uzerinden dogrulama | Liste -> tarama -> detay akisi `/assets` uzerinden canli veriyle calisir. |
| High | Dashboard KPI canli veri baglantisi | KPI kartlarinda sabit deger kullanilmaz; degerler `snapshot.metrics` ile birebir ayni olur. |
| Medium | Belge upload resmi akis karari | Tamamlandi: resmi akis `Upload Documents` (`/documents`) olarak sabitlendi. |
| Medium | Upload UI'nin secilen route'ta standardizasyonu | Tamamlandi: `/documents` route'unda upload UI ve dosya+metadata olusumu aktif. |
| Medium | Servis filtre UI ekleme/dogrulama | En az varlik ve tarih filtresi UI'da gorunur; sonuc listesi filtreye birebir uyar. |
| Medium | IA/Route haritasi guncel tutma | Menude gorunen her route icin fonksiyonel/kaldirilacak/placeholder statusu PRD'de bulunur. |
| Low | Placeholder route temizligi | MVP disi route'lar menu disina alinmis veya acikca placeholder etiketlenmis olur. |

## D) Onerilen PRD Revizyon Plani
1. Asama 04, 05, 06, 07, 08, 15 maddelerinde gercek durumla uyumsuz `(x)` isaretlerini `( )` olarak geri cek.
2. Her ilgili done kriterini "route'a bagli + UI'dan erisilebilir + gercek veriyle dogrulanir" formatina donustur.
3. Belge upload icin tek resmi akis karari PRD'de `/documents` olarak sabitlendi.
4. Dashboard KPI bolumune "sabit deger kabul edilmez" notunu zorunlu kalite kapisi olarak ekle.
5. Route Haritasi/IA bolumunu menu odakli tabloya cevir; tum menu route'larina durum alani ekle.
6. Final Hardening asamasindaki kalan maddeleri (Playwright, CI RLS negatif test, PWA gercek cihaz, Sentry, backup drill, 7 gun P0/P1 izleme) takip dosyasina bagla.

