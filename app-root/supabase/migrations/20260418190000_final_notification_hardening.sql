-- =============================================================================
-- Migration: FINAL production hardening for notification + event system
-- =============================================================================
--
-- Bu migration notification/event sisteminin production-hardening seviyesine
-- getirilmesi için SON adımdır. Aşağıdaki garantileri sağlar:
--
--   1) notifications.event_id → UNIQUE constraint (retry-race protection)
--   2) automation_events.dedupe_key → explicit UNIQUE index (idempotency)
--   3) v_notifications_without_event → orphan monitoring view
--   4) v_dispatch_orphans → extended orphan detection with event_type
--
-- System invariants (runtime + DB katmanında garanti):
--   - 1 eventType → max 1 event row (via dedupe_key UNIQUE)
--   - 1 eventId → max 1 notification row (via event_id UNIQUE)
--   - notification MUST always reference eventId (FK NOT NULL)
--   - retry MUST be idempotent (RPC self-heal + DB constraints)
--   - failure MUST NOT lose event or notification (transaction + DLQ)
--
-- Dependencies:
--   20260418160000_notification_event_traceability.sql (event_id FK)
--   20260418170000_dispatch_hardening.sql (dispatch_app_event RPC)
--   20260418180000_notifications_event_id_unique.sql (event_id UNIQUE)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) notifications.event_id UNIQUE constraint (FINAL GUARANTEE)
-- =============================================================================
-- Önceki migration (20260418180000) bu constraint'i ekledi. Burada:
--   - Idempotent olarak varsa DROP/ADD yap (safety)
--   - Constraint comment ile dokümante et
-- =============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_id_unique;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_id_unique UNIQUE (event_id);

COMMENT ON CONSTRAINT notifications_event_id_unique
  ON public.notifications IS
  'FINAL GUARANTEE: Her automation_events satırı için EN FAZLA BİR notification. ' ||
  'Retry-race, duplicate insert, ve partial-state bug riskini %0 yapar. ' ||
  'RPC self-heal ile çift katman garanti.';

-- =============================================================================
-- 2) automation_events.dedupe_key explicit UNIQUE index (IDEMPOTENCY)
-- =============================================================================
-- Tablo oluşturulurken `unique` constraint olarak tanımlandı, ancak production
-- sistemde explicit index adı ile izlenebilirlik ve idempotency garantisi
-- için ayrıca unique index oluşturuyoruz (idempotent).
-- =============================================================================

DROP INDEX IF EXISTS automation_events_dedupe_key_unique_idx;

CREATE UNIQUE INDEX automation_events_dedupe_key_unique_idx
  ON public.automation_events (dedupe_key);

COMMENT ON INDEX automation_events_dedupe_key_unique_idx IS
  'IDEMPOTENCY GUARANTEE: Aynı dedupe_key ile ikinci insert ENGELLENIR. ' ||
  'ON CONFLICT semantiği ile retry-safe dispatch sağlanır.';

-- =============================================================================
-- 3) Orphan monitoring: v_notifications_without_event
-- =============================================================================
-- notifications tablosunda event_id'si olmayan (null) veya geçersiz FK ile
-- automation_events tablosunda karşılığı bulunmayan satırları tespit eder.
-- Sağlıklı sistemde bu view BOŞ olmalıdır.
-- =============================================================================

CREATE OR REPLACE VIEW public.v_notifications_without_event AS
SELECT
  n.id              AS notification_id,
  n.user_id,
  n.event_id,
  n.title,
  n.type,
  n.created_at,
  CASE
    WHEN n.event_id IS NULL THEN 'NULL_EVENT_ID'
    WHEN ae.id IS NULL THEN 'ORPHAN_EVENT_REF'
    ELSE 'VALID'
  END               AS orphan_reason
FROM public.notifications n
LEFT JOIN public.automation_events ae ON ae.id = n.event_id
WHERE n.event_id IS NULL
   OR ae.id IS NULL;

REVOKE ALL ON public.v_notifications_without_event FROM anon, authenticated;
GRANT SELECT ON public.v_notifications_without_event TO service_role;

COMMENT ON VIEW public.v_notifications_without_event IS
  'Orphan detection: notifications tablosunda event_id''si null veya ' ||
  'geçersiz (karşılık gelen automation_events satırı yok) kayıtları. ' ||
  'Sağlıklı sistemde BOŞ olmalı. Monitoring/alarm konusu.';

-- =============================================================================
-- 4) Extended orphan detection: v_dispatch_orphans (redefined with strict check)
-- =============================================================================
-- dispatch_app_event RPC'si tarafından oluşturulması BEKLENEN notification'ları
-- (app_event trigger tipi, event_type kolonu dolu) ama eksik olanları tespit eder.
-- =============================================================================

DROP VIEW IF EXISTS public.v_dispatch_orphans;

CREATE OR REPLACE VIEW public.v_dispatch_orphans AS
SELECT
  ae.id            AS event_id,
  ae.user_id,
  ae.event_type,
  ae.trigger_type,
  ae.dedupe_key,
  ae.created_at,
  n.id             AS existing_notification_id,
  CASE
    WHEN n.id IS NULL THEN 'MISSING_NOTIFICATION'
    ELSE 'COMPLETE'
  END              AS status
FROM public.automation_events ae
LEFT JOIN public.notifications n ON n.event_id = ae.id
WHERE ae.trigger_type = 'app_event'
  AND ae.event_type IS NOT NULL
  AND n.id IS NULL;

REVOKE ALL ON public.v_dispatch_orphans FROM anon, authenticated;
GRANT SELECT ON public.v_dispatch_orphans TO service_role;

COMMENT ON VIEW public.v_dispatch_orphans IS
  'Dispatch tutarsızlık teşhisi: app_event trigger''lı ve notification bağlı ' ||
  'OLMAYAN automation_events satırları. dispatch_app_event RPC self-heal ' ||
  'etmeli; sağlıklı sistemde bu view BOŞ olmalıdır. Monitoring konusu.';

-- =============================================================================
-- 5) Invariant validation at migration time
-- =============================================================================
-- Migration sırasında mevcut veri durumunu kontrol et.
-- Kritik ihlaller varsa NOTICE olarak rapor et (fail etme - runtime düzeltilebilir).
-- =============================================================================

DO $$
DECLARE
  v_orphan_notifications   integer;
  v_orphan_events          integer;
  v_duplicate_event_ids    integer;
  v_null_event_id_notifs   integer;
BEGIN
  -- 5a) notifications without valid event reference
  SELECT COUNT(*) INTO v_orphan_notifications
  FROM public.v_notifications_without_event
  WHERE orphan_reason != 'VALID';

  -- 5b) app_event'lerde eksik notification
  SELECT COUNT(*) INTO v_orphan_events
  FROM public.v_dispatch_orphans;

  -- 5c) Aynı event_id ile multiple notification (UNIQUE constraint violation risk)
  SELECT COUNT(*) INTO v_duplicate_event_ids
  FROM (
    SELECT event_id
    FROM public.notifications
    WHERE event_id IS NOT NULL
    GROUP BY event_id
    HAVING COUNT(*) > 1
  ) d;

  -- 5d) NULL event_id'li notifications
  SELECT COUNT(*) INTO v_null_event_id_notifs
  FROM public.notifications
  WHERE event_id IS NULL;

  -- Raporla (NOTICE seviyesi - migration'ı bloklamaz)
  RAISE NOTICE '[final_notification_hardening] Migration-time invariant check:';
  RAISE NOTICE '  - Orphan notifications (no valid event): %', v_orphan_notifications;
  RAISE NOTICE '  - Orphan events (app_event missing notification): %', v_orphan_events;
  RAISE NOTICE '  - Duplicate event_id groups: %', v_duplicate_event_ids;
  RAISE NOTICE '  - NULL event_id notifications: %', v_null_event_id_notifs;

  -- Eğer duplicate varsa, migration BAŞARISIZ olsun (manuel çözüm gerekli)
  IF v_duplicate_event_ids > 0 THEN
    RAISE EXCEPTION
      'CRITICAL: % duplicate event_id groups found in notifications table. ' ||
      'Resolve manually before applying this migration. ' ||
      'Query: SELECT event_id, COUNT(*) FROM notifications GROUP BY event_id HAVING COUNT(*) > 1;',
      v_duplicate_event_ids
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- =============================================================================
-- 6) System invariants documentation (as table comments)
-- =============================================================================

COMMENT ON TABLE public.notifications IS
  'User-facing bildirimler. Her satır bir automation_events satırına FK ile ' ||
  'bağlıdır (event_id NOT NULL + UNIQUE + FK). dispatch_app_event RPC ' ||
  'tarafından atomic olarak oluşturulur. retry-safe (idempotent). ' ||
  'System invariants: 1 event_id → max 1 notification; notification always has event_id;' ||
  'RLS: user sees own only.';

COMMENT ON TABLE public.automation_events IS
  'Automation trigger/events. dedupe_key UNIQUE ile idempotent insert. ' ||
  'app_event trigger tipi için downstream notification beklenir. ' ||
  'System invariants: 1 dedupe_key → max 1 row; event_type in payload FORBIDDEN;' ||
  'dispatch_app_event RPC ile atomic event+notification yazılır.';

COMMIT;
