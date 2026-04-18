-- =============================================================================
-- ROLLBACK: 20260418160000_notification_event_traceability
-- -----------------------------------------------------------------------------
-- Manuel uygulanır. Sıra: önce uygulama deploy rollback, sonra bu script.
--
-- Etkisi:
--   1. Index kaldırılır.
--   2. FK + NOT NULL kaldırılır; event_id kolonu düşürülür.
--   3. trigger_type CHECK'i 160000 öncesi hâline döndürülür ('app_event' yok).
--   4. Backfill sırasında oluşturulmuş synthetic anchor row'ları silinir
--      (dedupe_key = 'legacy-notification:*'). ON DELETE CASCADE aktif ancak
--      bu noktada event_id kolonu kalmadığı için CASCADE etkisi yok.
-- =============================================================================

BEGIN;

-- 1) Index
DROP INDEX IF EXISTS public.idx_notifications_event_user;

-- 2) FK + kolon
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_id_fkey;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS event_id;

-- 3) trigger_type CHECK'i eski haline
ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_trigger_type_check;

ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_trigger_type_check
  CHECK (
    trigger_type IN (
      'warranty_30_days',
      'maintenance_7_days',
      'service_log_created',
      'subscription_due',
      'expense_threshold',
      'document_expiry_reminder'
    )
  );

-- 4) Synthetic backfill anchor row'larını sil
DELETE FROM public.automation_events
WHERE dedupe_key LIKE 'legacy-notification:%'
  AND (payload ->> 'legacy_backfill')::boolean IS TRUE;

COMMIT;
