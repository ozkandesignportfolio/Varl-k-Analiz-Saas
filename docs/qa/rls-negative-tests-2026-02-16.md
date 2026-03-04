# RLS Negatif Test Notu (2026-02-16)

Dosya:
- `supabase/tests/rls_negative_tests.sql`

Kapsam:
- Cross-user `SELECT` erişimi (assets, maintenance_rules, service_logs, documents, billing_subscriptions, billing_invoices)
- Cross-user `UPDATE` ve `DELETE` denemeleri
- `WITH CHECK` ihlali (başka kullanıcı adına `INSERT`)

Çalıştırma:
1. Supabase SQL Editor açılır.
2. `supabase/tests/rls_negative_tests.sql` içeriği çalıştırılır.
3. Script sonunda `RLS negatif testleri başarıyla geçti.` mesajı beklenir.

Playwright RLS negatif API testi:
1. Aşağıdaki env değişkenleri set edilir:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Uygulama ayağa kaldırılır (`npm run dev` veya `npm run start -- -p 3000`).
3. `npm run test:rls:negative` çalıştırılır.

Notlar:
- Script transaction + `ROLLBACK` ile çalışır, kalıcı veri bırakmaz.
- En az iki auth kullanıcısı yoksa script bilinçli olarak hata verir.
