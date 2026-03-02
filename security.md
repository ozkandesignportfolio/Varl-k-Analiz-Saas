# Security Review - AssetCare (Active Issues Only)

Bu doküman, kod tabanının statik incelemesi ve yerel bağımlılık taraması (`npm audit`) ile hazırlandı.
Dinamik pentest, runtime cloud konfig denetimi ve prod verisi ile doğrulama yapılmadı.

## Scope

- Uygulama kodu: `src/`, `middleware.ts`
- Supabase: `supabase/migrations/`, `supabase/functions/`
- Konfig ve artefaktlar: `package.json`, `testsprite_tests/tmp/config.json`

## Open / Unverified Items

- **M-02 (Medium): DB rate-limit RPC eksik / doğrulanmadı.** `public.take_api_rate_limit_token` DB'de bulunamadığında uygulama memory limiter fallback kullanıyor; serverless ortamda instance bazlı state nedeniyle rate-limit tutarlılığı ve güvenilirliği zayıflıyor.
  Doğrulama SQL (var/yok kontrolü):

```sql
select exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'take_api_rate_limit_token'
) as take_api_rate_limit_token_exists;
```

  Remediation: `20260228183000_api_rate_limit_leaky_bucket.sql` migration'ını hedef DB'ye uygula; ardından subject pinning düzeltmesini ekle (`authenticated` çağrıda `p_subject = auth.uid()` zorunlu).

- **Operational (High): Backup/restore drill tamamlanmadı (doğrulanmamış).** Geri yükleme prosedürü test edilmediği için gerçek incident anında RPO/RTO hedeflerinin karşılanıp karşılanmayacağı belirsiz.
  Supabase Dashboard kontrol listesi: PITR/backup durumu aktif mi, son başarılı backup zamanı nedir, restore point listesi erişilebilir mi, staging'e test restore yapılıp veri bütünlüğü doğrulandı mı.

- **Operational (Medium): Supabase CLI migration push kararsızlığı/timeout gözlemlendi (doğrulanmamış).** Migration'ların eksik uygulanma riski nedeniyle ortamlar arası şema drift oluşabilir.
  Mitigation: kritik migration'ları Supabase SQL Editor üzerinden doğrudan uygula; sonrasında migration geçmişini ve hedef şema objelerini DB üzerinde doğrula.

## Prioritized Remediation Plan

1. `public.take_api_rate_limit_token` varlığını SQL ile doğrula; yoksa `20260228183000_api_rate_limit_leaky_bucket.sql` migration'ını uygula.
2. Rate-limit fonksiyonunda subject pinning uygula (`authenticated` için `p_subject = auth.uid()`).
3. Backup/restore drill çalıştır: test restore, veri bütünlüğü doğrulaması ve ölçülen RPO/RTO kaydı.
4. CLI timeout yaşanan ortamlarda kritik migration'ları SQL Editor ile uygula ve migration geçmişini doğrula.

