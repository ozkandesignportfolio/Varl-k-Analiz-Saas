# Smoke Test Raporu (2026-02-16)

Ortam:
- İşletim sistemi: Windows (PowerShell)
- Uygulama modu: `next start` (production build)
- Port: `4310`

Çalıştırılan komutlar:
1. `npm run lint`
2. `npm run build`
3. `npm run start -- -p 4310`

Sonuç özeti:
- `lint`: Başarılı
- `build`: Başarılı
- Kritik route smoke sonuçları:

| Route | Beklenen | Sonuç | Süre (ms) |
| --- | --- | --- | ---: |
| `/` | 200 | 200 | 58.3 |
| `/login` | 200 | 200 | 29.2 |
| `/register` | 200 | 200 | 31.6 |
| `/offline` | 200 | 200 | 25.1 |
| `/manifest.webmanifest` | 200 | 200 | 38.0 |
| `/dashboard` | 307 (auth redirect) | 307 | 24.1 |
| `/api/service-logs` | 401 (auth guard) | 401 | 66.2 |

Değerlendirme:
- Kritik route'larda beklenen HTTP davranışı doğrulandı.
- Auth koruması ve API yetkisiz erişim engeli smoke seviyesinde çalışıyor.
