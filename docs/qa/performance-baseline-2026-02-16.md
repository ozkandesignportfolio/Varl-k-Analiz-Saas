# Performans Temel Ölçümler (2026-02-16)

## 1) Build çıktısı
- Komut: `npm run build`
- Derleme sonucu: başarılı
- Öne çıkan ölçümler:
  - `Compiled successfully in 6.7s`
  - `Generating static pages (24/24) in 774.1ms`

## 2) Route yanıt süreleri (yerel prod)
- Komut: `npm run start -- -p 4311`
- Ölçüm yöntemi: her route için 5 istek, ortalama/min/max ms

| Route | HTTP | Avg (ms) | Min (ms) | Max (ms) |
| --- | --- | ---: | ---: | ---: |
| `/` | 200 | 24.8 | 20.6 | 36.0 |
| `/login` | 200 | 18.1 | 17.5 | 19.1 |
| `/offline` | 200 | 17.1 | 15.6 | 19.6 |
| `/manifest.webmanifest` | 200 | 19.2 | 15.0 | 31.3 |
| `/dashboard` | 307 | 15.9 | 14.4 | 17.8 |
| `/api/service-logs` | 401 | 7.5 | 2.5 | 26.7 |

Değerlendirme:
- Mobil/PWA için eklenen route'lar (`/offline`, `/manifest.webmanifest`) düşük gecikmeyle yanıt veriyor.
- Auth guard davranışı performans ölçümünde beklenen HTTP kodlarıyla tutarlı.
