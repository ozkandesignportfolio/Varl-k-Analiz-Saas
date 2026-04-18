-- =============================================================================
-- Migration: notifications.event_id UNIQUE (retry-race hardening)
-- =============================================================================
--
-- Amaç:
--   Retry senaryosunda iki paralel dispatch aynı event_id için iki notification
--   oluşturamasın. `dispatch_app_event` RPC'si zaten SELECT ... FOR UPDATE +
--   "notification var mı" self-heal ile korunuyor; bu UNIQUE constraint,
--   RPC dışı (legacy) yazım yollarının veya olası yarışların DB seviyesinde
--   kesin engellenmesini sağlar.
--
-- Not:
--   Hâlihazırda `notifications.event_id` NOT NULL (migration 160000). Burada
--   eksik kalan tek şey UNIQUE'di. FK zaten mevcut.
-- =============================================================================

BEGIN;

-- Güvenlik: kalmış olabilecek duplicate kayıtları tespit et ve fail-fast.
-- (Hiç olmamalı; RPC idempotent yazıyor. Bu blok yalnızca savunma amaçlı.)
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT event_id
    FROM public.notifications
    GROUP BY event_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE(event_id): % duplicate event_id groups found. Resolve manually before applying.',
      dup_count;
  END IF;
END $$;

-- Idempotent: aynı constraint varsa düşür ve tekrar ekle.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_id_unique;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_id_unique UNIQUE (event_id);

COMMENT ON CONSTRAINT notifications_event_id_unique
  ON public.notifications IS
  'Her automation_events satırı için en fazla bir notification. Retry-race koruması (RPC self-heal ile birlikte çift kat garanti).';

COMMIT;
