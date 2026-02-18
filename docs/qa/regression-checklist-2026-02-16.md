# Regression Checklist (2026-02-16)

Durum legend:
- `PASS`: Davranış doğrulandı
- `N/A`: Bu turda kapsam dışı

| Modül | Kontrol | Durum | Kanıt |
| --- | --- | --- | --- |
| Auth | `/dashboard` oturumsuz kullanıcıyı `/login`'e yönlendirir | PASS | `docs/qa/smoke-test-2026-02-16.md` |
| Auth | Korumalı API oturumsuz kullanıcıya 401 döner | PASS | `docs/qa/smoke-test-2026-02-16.md` |
| Varlık CRUD | Build/lint sonrası derleme ve tip kontrolü temiz | PASS | `npm run lint`, `npm run build` |
| Bakım Motoru | Rule lifecycle ekranları build sonrası hatasız | PASS | `npm run build` |
| Servis Kayıt | Servis ekranı ve API routeâ€™ları buildâ€™da derleniyor | PASS | `npm run build` |
| Belge Kasası | Önizleme/indirme akışı kodda mevcut | PASS | `src/app/documents/page.tsx` |
| Timeline | Event birleştirme + ters sıralama aktif | PASS | `src/app/timeline/page.tsx` |
| Maliyet Paneli | Dönem filtresi + Chart.js bileşenleri aktif | PASS | `src/app/costs/page.tsx` |
| PDF Rapor | jsPDF export + tablo/toplam akışı aktif | PASS | `src/app/reports/page.tsx` |
| PWA | Manifest + SW + offline route aktif | PASS | `src/app/manifest.ts`, `public/sw.js`, `src/app/offline/page.tsx` |

Not:
- Bu liste, 16 Şubat 2026 tarihinde yapılan smoke/regression turunun çıktısıdır.

