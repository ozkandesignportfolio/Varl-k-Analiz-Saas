-- =============================================================================
-- Migration: Notification System FINAL Production-Grade Hardening
-- =============================================================================
--
-- Bu migration notification + automation event sistemini production-grade
-- seviyeye finalize eder. Mevcut şema ve RPC yapısı değişmez, sadece:
--
--   1) Outbox consistency guarantee (views + safe retry)
--   2) Dead-letter finalization (retry policy: max 3)
--   3) Orphan repair mechanism (safe rehydrate function)
--   4) System invariants documentation
--
-- Tüm değişiklikler idempotent ve backward-compatible.
--
-- Dependencies:
--   20260418170000_dispatch_hardening.sql (dead_letter_events, dispatch_app_event)
--   20260418190000_final_notification_hardening.sql (unique constraints, views)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) OUTBOX CONSISTENCY GUARANTEE
-- =============================================================================
-- Outbox pattern: event yazıldıktan sonra notification async oluşturulur.
-- Bu bölüm "event var ama notification yok" durumunu tespit eder ve
-- idempotent retry için safe query'ler sağlar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a) v_outbox_incomplete: Event var ama notification eksik (retry candidates)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_outbox_incomplete;

CREATE OR REPLACE VIEW public.v_outbox_incomplete AS
SELECT
  ae.id            AS event_id,
  ae.user_id,
  ae.event_type,
  ae.trigger_type,
  ae.dedupe_key,
  ae.payload,
  ae.created_at    AS event_created_at,
  ae.run_after,
  -- Retry safety: notification gerçekten yok mu kontrol et
  NOT EXISTS (
    SELECT 1 FROM public.notifications n 
    WHERE n.event_id = ae.id
  ) AS notification_missing,
  -- Notification metadata reconstruction için payload'dan çıkarılabilir alanlar
  ae.payload->>'asset_name' AS asset_name,
  ae.payload->>'action_href' AS action_href,
  ae.payload->>'email_only' AS email_only
FROM public.automation_events ae
WHERE ae.trigger_type = 'app_event'
  AND ae.event_type IS NOT NULL
  -- Sadece notification gerçekten eksik olanlar
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n 
    WHERE n.event_id = ae.id
  );

REVOKE ALL ON public.v_outbox_incomplete FROM anon, authenticated;
GRANT SELECT ON public.v_outbox_incomplete TO service_role;

COMMENT ON VIEW public.v_outbox_incomplete IS
  'Outbox consistency: Event oluşturuldu ama notification eksik. ' ||
  'Retry worker bu view''den candidate çeker. Sağlıklı sistemde boş olmalı.';

-- -----------------------------------------------------------------------------
-- 1b) Idempotent retry query function
-- -----------------------------------------------------------------------------
-- RPC dışında kalan orphan event'ler için safe retry mekanizması.
-- Idempotent: notification zaten varsa yeni oluşturmaz, event_id döner.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retry_missing_notification(
  p_event_id    uuid,
  p_user_id     uuid,
  p_title       text DEFAULT 'Sistem Bildirimi',
  p_message     text DEFAULT 'Bekleyen bildirim tamamlandı.',
  p_type        text DEFAULT 'Sistem'
)
RETURNS TABLE (
  notification_id uuid,
  created         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif_id uuid;
BEGIN
  -- Idempotency check: notification zaten var mı?
  SELECT n.id INTO v_notif_id
  FROM public.notifications n
  WHERE n.event_id = p_event_id
  LIMIT 1;

  IF v_notif_id IS NOT NULL THEN
    -- Zaten var, idempotent success
    RETURN QUERY SELECT v_notif_id, false;
    RETURN;
  END IF;

  -- Event gerçekten var mı ve bize ait mi?
  IF NOT EXISTS (
    SELECT 1 FROM public.automation_events ae
    WHERE ae.id = p_event_id AND ae.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Event not found or user mismatch: event_id=%, user_id=%', 
      p_event_id, p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Safe insert: notification oluştur
  INSERT INTO public.notifications (
    user_id, event_id, title, message, type, is_read
  ) VALUES (
    p_user_id, p_event_id, p_title, p_message, p_type, false
  )
  ON CONFLICT (event_id) DO NOTHING  -- Race condition safety
  RETURNING id INTO v_notif_id;

  -- Eğer conflict oldu (başka retry başarılı oldu), mevcutu al
  IF v_notif_id IS NULL THEN
    SELECT n.id INTO v_notif_id
    FROM public.notifications n
    WHERE n.event_id = p_event_id;
  END IF;

  RETURN QUERY SELECT v_notif_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_missing_notification(uuid, uuid, text, text, text) 
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_missing_notification(uuid, uuid, text, text, text) 
  TO service_role;

COMMENT ON FUNCTION public.retry_missing_notification(uuid, uuid, text, text, text) IS
  'Idempotent orphan repair: event_id için notification eksikse oluşturur, ' ||
  'varsa mevcut id''yi döner. Race condition safe (ON CONFLICT DO NOTHING).';

-- =============================================================================
-- 2) DEAD-LETTER FINALIZATION
-- =============================================================================
-- Retry policy: max 3 deneme. 
-- Mevcut dead_letter_events tablosu attempt_count ve last_retried_at içeriyor.
-- Bu bölüm retry policy fonksiyonlarını ve monitoring view'lerini ekler.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2a) Retry policy: max 3 attempts check function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_dead_letter_eligible_for_retry(
  p_dead_letter_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dead_letter_events dle
    WHERE dle.id = p_dead_letter_id
      AND dle.attempt_count < 3
      -- Son retry'den en az 5 dk geçmiş olmalı (backoff)
      AND (dle.last_retried_at IS NULL OR dle.last_retried_at < now() - interval '5 minutes')
  );
$$;

REVOKE ALL ON FUNCTION public.is_dead_letter_eligible_for_retry(uuid) 
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_dead_letter_eligible_for_retry(uuid) 
  TO service_role;

COMMENT ON FUNCTION public.is_dead_letter_eligible_for_retry(uuid) IS
  'Retry policy: max 3 attempts, 5min backoff. True = retry allowed.';

-- -----------------------------------------------------------------------------
-- 2b) Increment retry counter function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_dead_letter_retry(
  p_dead_letter_id uuid,
  p_error_message  text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dead_letter_events
  SET attempt_count = attempt_count + 1,
      last_retried_at = now(),
      error_message = COALESCE(p_error_message, error_message)
  WHERE id = p_dead_letter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_dead_letter_retry(uuid, text) 
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_dead_letter_retry(uuid, text) 
  TO service_role;

-- -----------------------------------------------------------------------------
-- 2c) Dead letter monitoring view
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_dead_letter_monitor;

CREATE OR REPLACE VIEW public.v_dead_letter_monitor AS
SELECT
  dle.id,
  dle.user_id,
  dle.event_type,
  dle.dedupe_key,
  dle.stage,
  dle.error_code,
  dle.error_message,
  dle.attempt_count,
  dle.last_retried_at,
  dle.created_at,
  -- Retry eligibility
  CASE 
    WHEN dle.attempt_count >= 3 THEN 'EXHAUSTED'
    WHEN dle.last_retried_at > now() - interval '5 minutes' THEN 'BACKOFF'
    ELSE 'ELIGIBLE'
  END AS retry_status,
  -- Time since creation
  now() - dle.created_at AS age
FROM public.dead_letter_events dle;

REVOKE ALL ON public.v_dead_letter_monitor FROM anon, authenticated;
GRANT SELECT ON public.v_dead_letter_monitor TO service_role;

COMMENT ON VIEW public.v_dead_letter_monitor IS
  'Dead letter monitoring: retry durumu ve eligibility. ' ||
  'retry_status: ELIGIBLE | BACKOFF | EXHAUSTED';

-- =============================================================================
-- 3) ORPHAN REPAIR MECHANISM
-- =============================================================================
-- Tüm orphan durumları için unified view ve repair function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3a) Unified orphan detection view
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_orphan_notifications;

CREATE OR REPLACE VIEW public.v_orphan_notifications AS
SELECT
  'MISSING_NOTIFICATION' AS orphan_type,
  ae.id                 AS event_id,
  ae.user_id,
  ae.event_type,
  ae.dedupe_key,
  ae.created_at,
  ae.payload,
  NULL                  AS notification_id,
  ae.run_after
FROM public.automation_events ae
WHERE ae.trigger_type = 'app_event'
  AND ae.event_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n WHERE n.event_id = ae.id
  )

UNION ALL

SELECT
  'NULL_EVENT_ID' AS orphan_type,
  NULL              AS event_id,
  n.user_id,
  NULL              AS event_type,
  NULL              AS dedupe_key,
  n.created_at,
  NULL              AS payload,
  n.id              AS notification_id,
  NULL              AS run_after
FROM public.notifications n
WHERE n.event_id IS NULL;

REVOKE ALL ON public.v_orphan_notifications FROM anon, authenticated;
GRANT SELECT ON public.v_orphan_notifications TO service_role;

COMMENT ON VIEW public.v_orphan_notifications IS
  'Unified orphan detection: MISSING_NOTIFICATION (event var, notification yok) ' ||
  'veya NULL_EVENT_ID (notification var ama event_id null).';

-- -----------------------------------------------------------------------------
-- 3b) Safe rehydrate function (orphan repair)
-- -----------------------------------------------------------------------------
-- MISSING_NOTIFICATION durumunu repair eder. Idempotent, race-safe.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rehydrate_missing_notification(
  p_event_id uuid
)
RETURNS TABLE (
  notification_id uuid,
  repaired        boolean,
  message         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event       public.automation_events%ROWTYPE;
  v_notif_id    uuid;
  v_title       text;
  v_message     text;
  v_type        text;
BEGIN
  -- Event'i al
  SELECT * INTO v_event
  FROM public.automation_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT null::uuid, false, 'Event not found: ' || p_event_id::text;
    RETURN;
  END IF;

  -- Notification zaten var mı kontrol et (idempotency)
  SELECT n.id INTO v_notif_id
  FROM public.notifications n
  WHERE n.event_id = p_event_id;

  IF v_notif_id IS NOT NULL THEN
    RETURN QUERY SELECT v_notif_id, false, 'Notification already exists';
    RETURN;
  END IF;

  -- Payload'dan veya event_type'dan title/message çıkar
  v_title := COALESCE(
    v_event.payload->>'title',
    CASE v_event.event_type
      WHEN 'ASSET_CREATED' THEN 'Varlık oluşturuldu'
      WHEN 'ASSET_UPDATED' THEN 'Varlık güncellendi'
      WHEN 'USER_WELCOME' THEN 'Hoş geldiniz'
      ELSE 'Sistem Bildirimi'
    END
  );
  
  v_message := COALESCE(
    v_event.payload->>'message',
    'Bekleyen bildirim otomatik tamamlandı.'
  );
  
  v_type := COALESCE(
    v_event.payload->>'type',
    'Sistem'
  );

  -- Safe insert
  INSERT INTO public.notifications (
    user_id, event_id, title, message, type, is_read
  ) VALUES (
    v_event.user_id, p_event_id, v_title, v_message, v_type, false
  )
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_notif_id;

  -- Race condition: başkası oluşturduysa al
  IF v_notif_id IS NULL THEN
    SELECT n.id INTO v_notif_id
    FROM public.notifications n
    WHERE n.event_id = p_event_id;
    RETURN QUERY SELECT v_notif_id, false, 'Race condition: notification created by concurrent process';
  ELSE
    RETURN QUERY SELECT v_notif_id, true, 'Notification rehydrated successfully';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rehydrate_missing_notification(uuid) 
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rehydrate_missing_notification(uuid) 
  TO service_role;

COMMENT ON FUNCTION public.rehydrate_missing_notification(uuid) IS
  'Orphan repair: MISSING_NOTIFICATION durumunu idempotent şekilde düzeltir. ' ||
  'Race-safe (ON CONFLICT DO NOTHING). notification_id + repaired + message döner.';

-- =============================================================================
-- 4) SYSTEM INVARIANTS DOCUMENTATION
-- =============================================================================
-- Sistem garantilerini DB yorumları olarak dokümante et.
-- =============================================================================

COMMENT ON TABLE public.notifications IS
  'User-facing bildirimler. SYSTEM INVARIANTS: ' ||
  '1) 1 event_id → max 1 notification (UNIQUE constraint), ' ||
  '2) event_id NOT NULL (FK to automation_events), ' ||
  '3) RLS: user sees own only. ' ||
  'OUTBOX: dispatch_app_event RPC ile atomic oluşturulur. ' ||
  'REPAIR: v_orphan_notifications + rehydrate_missing_notification() ile.';

COMMENT ON TABLE public.automation_events IS
  'Automation events. SYSTEM INVARIANTS: ' ||
  '1) 1 dedupe_key → max 1 event (UNIQUE index), ' ||
  '2) event_type immutable (payload''a yazılmaz - CHECK constraint), ' ||
  '3) app_event trigger → downstream notification beklenir. ' ||
  'IDEMPOTENCY: ON CONFLICT (dedupe_key) DO NOTHING. ' ||
  'REPAIR: v_outbox_incomplete, retry_missing_notification() veya rehydrate_missing_notification().';

COMMENT ON TABLE public.dead_letter_events IS
  'Dispatch failures (DLQ). RETRY POLICY: max 3 attempts, 5min backoff. ' ||
  'attempt_count + last_retried_at ile track edilir. ' ||
  'REPAIR: is_dead_letter_eligible_for_retry() + increment_dead_letter_retry().';

-- =============================================================================
-- 5) MIGRATION VALIDATION
-- =============================================================================
-- Migration sonunda mevcut durumu raporla.
-- =============================================================================

DO $$
DECLARE
  v_outbox_incomplete integer;
  v_orphans           integer;
  v_dead_letter_total integer;
  v_dead_letter_eligible integer;
BEGIN
  -- Outbox incomplete
  SELECT COUNT(*) INTO v_outbox_incomplete
  FROM public.v_outbox_incomplete;

  -- Orphans
  SELECT COUNT(*) INTO v_orphans
  FROM public.v_orphan_notifications;

  -- Dead letter
  SELECT COUNT(*), COUNT(*) FILTER (WHERE retry_status = 'ELIGIBLE')
  INTO v_dead_letter_total, v_dead_letter_eligible
  FROM public.v_dead_letter_monitor;

  RAISE NOTICE '[notification_system_finalize] Migration-time status:';
  RAISE NOTICE '  - Outbox incomplete (event var, notification yok): %', v_outbox_incomplete;
  RAISE NOTICE '  - Total orphans: %', v_orphans;
  RAISE NOTICE '  - Dead letter total: %, eligible for retry: %', v_dead_letter_total, v_dead_letter_eligible;
END $$;

COMMIT;
