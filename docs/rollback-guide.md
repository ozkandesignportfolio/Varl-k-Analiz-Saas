# Rollback Guide

Bu runbook, canli deploy sonrasi kritik bir regresyonda en hizli ve en dusuk riskli geri donus yolunu ozetler.

## Ne zaman rollback yapilir

- Login, dashboard veya assets acilmiyorsa
- RLS, rate limit veya billing akislari beklenmedik sekilde bozulduysa
- Stripe webhook veya checkout hatasi gelir kaybina yol aciyorsa
- Hata orani hizla artiyor ve kisa surede hotfix guvenli degilse

## Ilk 5 dakika

1. Incident sahibi belirlenir.
2. Yeni deploy/promote islemi durdurulur.
3. Etki alani secilir: sadece app, app + secret, app + data.
4. Mevcut hata sinyalleri kayda gecirilir: Sentry, panel health, webhook failures.

## Tercih sirasi

1. Son stabil app release'ine don.
2. Gerekliyse son secret/config degisikliklerini geri al.
3. Sadece veri bozulmasi varsa restore/PITR yoluna git.

## Senaryo bazli geri donus

### 1. App release regresyonu

- Son bilinen saglikli build/release'e don
- Deploy sonrasi `qa/smoke-test-checklist.md` icindeki kritik akislari tekrar kos
- Sentry hata oraninin dusmesini bekle

### 2. Secret veya entegrasyon regresyonu

- Son calisan env setine don
- Stripe webhook secret ve price env'lerini tekrar dogrula
- Worker secret'larini ve panel health secret'ini kontrol et

### 3. Billing incident'i

- Checkout akisini gecici olarak durdur veya rollout'u geri al
- Stripe webhook event backlog'unu gozle
- `billing_subscriptions` ve `billing_invoices` tablolarinda yeni hata birikimini kontrol et

### 4. Worker/automation incident'i

- `automation-dispatcher` cron'unu gecici olarak kapat
- Gerekirse `media-enrichment` tetiklerini durdur
- Ana CRUD akislarinin workersiz calistigini smoke test ile dogrula

### 5. Veri/migration incident'i

- Migration drift veya yikici veri degisikligi varsa Supabase restore/PITR karari al
- App-only sorunlarda restore uygulama
- Restore sonrasi RLS, dashboard ve billing kritik akislari tekrar dogrula

## Rollback sonrasi minimum dogrulama

- [ ] `/login`
- [ ] `/dashboard`
- [ ] `/assets`
- [ ] `/subscriptions` veya `/billing`
- [ ] Stripe webhook yeni event kabul ediyor
- [ ] Yeni Sentry fatal hata dalgasi yok

## Manual Verification

- Hosting provider icin exact rollback/promote adimlari
- Supabase restore/PITR yetkisi olan kisi
- Stripe canli modda checkout'u gecici kapatma proseduru
- Incident duyuru kanali ve durum sayfasi guncellemesi

## Ilgili Belgeler

- [launch-checklist.md](./launch-checklist.md)
- [monitoring-guide.md](./monitoring-guide.md)
- [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)
