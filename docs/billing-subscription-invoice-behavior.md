# Billing, Subscription, and Invoice Behavior

Bu belge, billing yuzeylerinin beklenen urun davranisini ve operasyonel bagimliliklarini kisa sekilde toplar.

## Ana yuzeyler

- `/billing`
- `/subscriptions`
- `/invoices`
- `/expenses`
- `stripe/checkout`
- `stripe/confirm`
- `stripe/webhook`

## Plan modeli

- Uygulama `free` ve `premium` planlari ile calisir
- `starter`, `pro` ve `elite` metadata kodlari normalize edilir
- Plan limiti backend tarafinda enforce edilir

Free limitleri:

- En fazla 3 varlik
- En fazla 5 belge
- En fazla 3 abonelik
- En fazla 3 fatura olusturma/yukleme

Premium yetenekleri:

- Gelismis analitik
- Otomasyon
- PDF export tasarimi
- Premium medya yukleme

## Subscription davranisi

- Subscription akisi Stripe checkout ile baslar
- Basarili donus sonrasi confirm akisi beklenir
- Kalici durum guncellemesi webhook ile desteklenir
- Source of truth olarak billing tablolari ve webhook event kayitlari izlenmelidir

## Invoice davranisi

- Invoices ayri bir yuzey olarak tutulur
- Free plan'da fatura olusturma/yukleme limiti vardir
- Billing tablolarinin eksik oldugu ortamlarda kontrollu disable davranisi beklenir

## Degrade ve hata davranisi

- Billing schema eksikse API `BILLING_FEATURE_DISABLED` doner
- Stripe secret veya webhook kurulumu eksikse checkout akisi guvenli sekilde tamamlanamaz
- Uygulama billing sorunu yasarken auth, assets ve documents gibi cekirdek akislarin calismasi hedeflenir

## Operasyonel bagimliliklar

- Stripe secret ve webhook secret kurulumu
- Premium price env'i
- `billing_subscriptions`
- `billing_invoices`
- `stripe_webhook_events`
- Canli webhook endpoint eslesmesi

## Bilinen karar noktasi

- PDF export plan kurali ile mevcut UI davranisinin tam hizasi ayrica dogrulanmalidir.

## Minimum smoke test

- [ ] Free hesap billing sayfasini kritik hata olmadan aciyor
- [ ] Free hesap subscription ve invoice limitlerinde dogru engelleniyor
- [ ] Premium checkout oturumu olusturulabiliyor
- [ ] Confirm sonrasi plan durumu beklenen yone gidiyor
- [ ] Webhook yeni event isliyor

## Manual Verification

- Stripe dashboard uzerinde canli webhook teslimatlari
- Uctan uca premium satin alma testi
- Gercek production ortaminda invoice upload olcutleri ve dosya sinirlari

## Ilgili Belgeler

- [PRD.md](./PRD.md)
- [security.md](./security.md)
- [launch-checklist.md](./launch-checklist.md)
- [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)
