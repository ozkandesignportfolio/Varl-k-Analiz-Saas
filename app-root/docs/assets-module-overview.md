# Assets Module Overview

Bu belge, assets modulu icin urun siniri, veri modeli ve operasyonel beklentileri ozetler.

## Kapsam

Assets modulu kullanicinin sahip oldugu varliklari listeleme, detay gorme ve ilgili medya/belgeleri baglama akislarini kapsar.

Ana yuzeyler:

- `/assets`
- `/assets/[id]`
- asset list API'leri
- asset media upload akisleri

## Desteklenen ana alanlar

- Ad ve temel tanimlayicilar
- QR kod
- Satin alma fiyati
- Garanti tarihi
- Fotograf

Ek medya:

- `asset_media` tablosu
- `asset-media` bucket'i
- Beklenen path: `<org_id>/<user_id>/<asset_id>/<type>/<file>`

## Davranis beklentileri

- Listeleme filtre, siralama ve cursor tabanli sayfalama destekler
- Asset detail ekranlari ilgili servis, timeline ve belge akislarina baglanir
- Free plan limitleri backend tarafinda enforce edilir
- RLS kullaniciyi kendi verisi ile sinirlar

## Bagli moduller

- Belgeler
- Servis kayitlari
- Bakim kurallari
- Timeline
- Dashboard ve cost skorlari

## Operasyonel riskler

- Asset media bucket policy veya path uyumsuzlugu upload hatasi uretir
- Migration drift assets listeleme veya RPC katmanini bozabilir
- Worker ve enrichment kapali olsa bile temel assets CRUD akislarinin calismasi beklenir

## Minimum smoke test

- [ ] Assets listesi aciliyor
- [ ] Filtre ve siralama calisiyor
- [ ] En az bir asset detail sayfasi aciliyor
- [ ] Asset media upload/download basarili
- [ ] Asset ile bagli belge veya servis linkleri bozuk degil

## Manual Verification

- Gercek production bucket policy gorunurlugu
- Buyuk dosya ve yavas ag senaryosunda media upload davranisi
- QR kod akislarinin gercek cihaz kamerasi ile testi

## Ilgili Belgeler

- [PRD.md](./PRD.md)
- [architecture.md](./architecture.md)
- [supabase/README.md](./supabase/README.md)
- [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)
