# Lokal Gelistirme

## Gereksinimler

- Node.js 20.x
- npm
- Erisilebilir bir Supabase projesi

## Kurulum

```bash
npm ci
```

Ardindan `.env.local` olustur. Alanlar icin [environment.md](./environment.md) dosyasini kullan.

Minimum lokal degiskenler:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

## Uygulamayi Calistirma

Gelistirme:

```bash
npm run dev
```

Production-benzeri lokal calisma:

```bash
npm run build
npm run start -- -p 3100
```

`dev` scripti bilincli olarak `next dev --webpack` kullanir.

## Ilk Kontroller

- `/login` aciliyor mu
- Giris sonrasi `/dashboard` aciliyor mu
- `/assets`, `/services` ve `/reports` sayfalari veri cekebiliyor mu
- E-posta dogrulamasi eksik kullanici korumali alanlara giremiyor mu

## Opsiyonel Servisler

Asagidaki alanlar ek env ve servis kurulumuna baglidir:

- Stripe checkout
- Sentry
- OpenAI destekli tahmin veya enrichment
- Supabase Edge Functions tabanli otomasyon

## Ilgili Belgeler

- Ortam degiskenleri: [environment.md](./environment.md)
- Supabase kurulum: [supabase.md](./supabase.md)
- Worker ve otomasyon: [supabase-automation.md](./supabase-automation.md)
