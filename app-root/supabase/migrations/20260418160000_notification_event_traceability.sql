-- =============================================================================
-- Migration: Full event traceability for notifications
-- =============================================================================
--
-- Amaç:
--   Her `notifications` satırının, kendisini tetikleyen `automation_events`
--   satırına FK üzerinden izlenebilir olmasını garanti etmek. Orphan
--   (anchor'sız) notification yaratılamaz.
--
-- Değişiklikler:
--   1. `automation_events.trigger_type` CHECK'ine `'app_event'` eklenir —
--      AppEventType üzerinden dispatch edilen ama özel bir automation rule
--      trigger'ı olmayan event'ler (USER_WELCOME, TEST_NOTIFICATION) için.
--   2. Legacy notifications için synthetic automation_events anchor satırları
--      oluşturulur (1:1 backfill).
--   3. `notifications.event_id UUID` kolonu eklenir; NOT NULL; FK REFERENCES
--      automation_events(id) ON DELETE CASCADE.
--   4. Index: (event_id, user_id) — traceability sorguları için.
--
-- Bağımlılıklar:
--   - `20260418150000_event_type_column_promotion.sql` (event_type tipli
--     kolonu ve payload CHECK'ini kurdu).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) trigger_type CHECK'ini genişlet: 'app_event' eklendi.
--    Bu değer, AppEventType üzerinden dispatch edilen ve özel automation
--    domain trigger'ı olmayan event'ler için anchor row yaratmakta kullanılır.
-- -----------------------------------------------------------------------------
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
      'document_expiry_reminder',
      'app_event'
    )
  );

-- -----------------------------------------------------------------------------
-- 2) notifications.event_id kolonu (önce nullable — backfill için).
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id uuid;

COMMENT ON COLUMN public.notifications.event_id IS
  'Traceability: bu notification''ı tetikleyen automation_events satırı. NOT NULL + FK ile orphan notification yaratılması engellenir.';

-- -----------------------------------------------------------------------------
-- 3) Backfill: anchor'ı olmayan her notification için synthetic
--    automation_events satırı oluştur ve event_id'yi doldur.
--
--    Strateji: CTE ile notification başına 1 anchor insert edip RETURNING
--    üzerinden eşle. dedupe_key deterministik: 'legacy-notification:<id>'.
--    payload içinde event_type/notification_kind YAZILMAZ (CHECK yasaklıyor);
--    event kimliği, kolon seviyesinde NULL kalır (DB-domain trigger sayılır).
-- -----------------------------------------------------------------------------
WITH created_anchors AS (
  INSERT INTO public.automation_events (
    user_id,
    trigger_type,
    event_type,
    actions,
    payload,
    dedupe_key,
    status,
    created_at,
    processed_at,
    run_after
  )
  SELECT
    n.user_id,
    'app_event',
    NULL::public.app_event_type,
    ARRAY[]::text[],
    jsonb_build_object(
      'legacy_backfill', true,
      'backfilled_from_notification_id', n.id
    ),
    'legacy-notification:' || n.id::text,
    'completed',
    n.created_at,
    n.created_at,
    n.created_at
  FROM public.notifications n
  WHERE n.event_id IS NULL
  -- Idempotency: aynı migration tekrar çalıştırılırsa daha önce oluşmuş
  -- anchor row'ları atla.
  AND NOT EXISTS (
    SELECT 1
    FROM public.automation_events ae
    WHERE ae.dedupe_key = 'legacy-notification:' || n.id::text
  )
  RETURNING
    id AS anchor_id,
    (payload ->> 'backfilled_from_notification_id')::uuid AS notification_id
)
UPDATE public.notifications n
SET event_id = ca.anchor_id
FROM created_anchors ca
WHERE n.id = ca.notification_id;

-- Aynı migration tekrar çalıştırılırsa CTE boş dönebilir. İkinci geçiş için
-- dedupe_key üzerinden doğrudan bağla.
UPDATE public.notifications n
SET event_id = ae.id
FROM public.automation_events ae
WHERE n.event_id IS NULL
  AND ae.dedupe_key = 'legacy-notification:' || n.id::text;

-- -----------------------------------------------------------------------------
-- 4) NOT NULL + FK
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_id_fkey
  FOREIGN KEY (event_id)
  REFERENCES public.automation_events(id)
  ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 5) Index: (event_id, user_id) — traceability JOIN'leri ve user-scoped
--    filtre için.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_event_user
  ON public.notifications (event_id, user_id);

-- -----------------------------------------------------------------------------
-- 6) Invariant assertion: orphan kalmamalı.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.notifications n
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_events ae WHERE ae.id = n.event_id
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Traceability invariant violated: % orphan notifications detected after backfill',
      orphan_count;
  END IF;
END $$;

COMMIT;
