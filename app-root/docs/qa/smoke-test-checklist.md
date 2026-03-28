# Smoke Test Checklist

Bu checklist, release sonrasi veya staging ortaminda 10-20 dakikalik hizli guven testi icindir.

## Hazirlik

- [ ] Test ortami dogru URL'de
- [ ] Bir free ve bir premium test hesabi hazir
- [ ] Supabase, Stripe ve Sentry env'leri yuklu

## Auth

- [ ] `/login` aciliyor
- [ ] Free hesap ile giris basarili
- [ ] Premium hesap ile giris basarili
- [ ] Dogrulanmamis hesap korumali alana giremiyor

## Dashboard

- [ ] `/dashboard` aciliyor
- [ ] Ozet kartlari veya temel veri yukleniyor
- [ ] Kritik console/server hata sinyali yok

## Assets ve bagli akislar

- [ ] `/assets` listesi aciliyor
- [ ] Bir asset detail sayfasi aciliyor
- [ ] Asset media veya fotograf goruntulenebiliyor
- [ ] Asset ile bagli servis/timeline linki kirik degil

## Documents

- [ ] Belge listesi aciliyor
- [ ] En az bir belge goruntuleme veya indirme akisi calisiyor

## Maintenance ve notifications

- [ ] `/maintenance` aciliyor
- [ ] `/timeline` aciliyor
- [ ] `/notifications` listeleme calisiyor

## Reports ve analytics

- [ ] `/reports` aciliyor
- [ ] Tarih araligi secimi veri cekiyor
- [ ] Premium hesapta analytics/cost ekranlari aciliyor

## Billing

- [ ] `/billing`, `/subscriptions` ve `/invoices` kritik hata vermiyor
- [ ] Free hesap limit davranisi beklenen sekilde
- [ ] Premium checkout baslatilabiliyor veya canli ortamda kontrollu dogrulaniyor

## Operasyonel sinyaller

- [ ] Sentry'de yeni fatal hata dalgasi yok
- [ ] Stripe webhook son event'lerde hata birikmiyor
- [ ] Worker/cron durumunda beklenmeyen durma yok

## Fail kabul edilen sinyaller

- Login veya dashboard acilmiyor
- Assets veya billing sayfasi 500 veriyor
- RLS nedeniyle dogru kullanici kendi verisini okuyamiyor
- Stripe checkout veya webhook tamamen bozuk
- Production hata orani release sonrasi hizla yukseliyor

## Manual Verification

- Gercek odeme yontemi ile checkout
- Gercek dosya yukleme ve buyuk dosya davranisi
- Mobil cihaz/PWA davranisi
