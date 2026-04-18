-- =============================================================================
-- ROLLBACK: 20260418150000_event_type_column_promotion
-- -----------------------------------------------------------------------------
-- Bu script OTOMATIK çalışmaz. Sadece acil geri alma durumunda MANUEL uygulanır.
-- Yürütme sırası: önce uygulama deploy'u geri alınır, SONRA bu script çalıştırılır.
--
-- Etki:
--   1. `automation_events.event_type` kolonundaki değerler payload'a
--      `payload.event_type` JSON anahtarı olarak geri taşınır (140000 migration
--      sonrası durumuna eşdeğer).
--   2. Yeni CHECK kaldırılır; 140000 versiyonundaki payload-tabanlı CHECK'ler
--      yeniden oluşturulur.
--   3. `event_type` kolonu ve ilişkili index düşürülür.
--   4. `notification_kind` legacy anahtarı GERİ dönmez — 140000 migration'u
--      bunu zaten temizlemişti; bu rollback yalnızca 150000'i geri alır.
-- =============================================================================

BEGIN;

-- 1) Kolondan payload'a geri yazım (event_type null ise dokunma).
UPDATE public.automation_events
SET payload = jsonb_set(
  payload,
  '{event_type}',
  to_jsonb(event_type::text),
  true
)
WHERE event_type IS NOT NULL;

-- 2) Yeni CHECK'i düşür.
ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_payload_no_event_identity_keys;

-- 3) 140000 versiyonundaki payload-tabanlı CHECK'leri yeniden ekle.
ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_event_type_valid
  CHECK (
    NOT (payload ? 'event_type')
    OR (payload ->> 'event_type') IN (
      'ASSET_CREATED', 'ASSET_UPDATED', 'USER_WELCOME', 'TEST_NOTIFICATION'
    )
  );

ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_no_legacy_notification_kind
  CHECK (NOT (payload ? 'notification_kind'));

-- 4) Index ve kolonu düşür.
DROP INDEX IF EXISTS public.idx_automation_events_user_event_type;

ALTER TABLE public.automation_events
  DROP COLUMN IF EXISTS event_type;

-- 5) Enum tipini KORU — 140000 migration'u oluşturmuştu ve o migration
--    hâlâ aktif sayılır. Enum drop edilirse 140000 rollback'i ile birlikte
--    kaldırılmalıdır (bu script 140000'i etkilemez).

COMMIT;
