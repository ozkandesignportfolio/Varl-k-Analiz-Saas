-- =============================================================================
-- Migration: Production hardening of app-event dispatch pipeline
-- =============================================================================
--
-- Bu migration üç şeyi birden getirir (hepsi idempotent):
--
--   1) public.dispatch_app_event(...) RPC
--      Atomic event + notification insert. Önceki kısmi başarısızlıkları
--      self-heal eder: "event var ama bağlı notification yok" durumunu tespit
--      edip eksik notification'ı tamamlar. Bu, mevcut servisin iki ayrı
--      round-trip'le yaptığı işlemde retry-sonrası kaybolan notification
--      bug'ını kapatır.
--
--   2) public.dead_letter_events tablosu
--      Dispatch'in kalıcı hatalarının (retry kotası aşıldı / deterministik
--      hata) depolandığı DLQ. Service role dışında erişim yok.
--
--   3) public.v_dispatch_orphans VIEW
--      Tutarsızlık teşhisi: app_event trigger tipli ama bağlı notification'ı
--      olmayan automation_events satırları. Self-heal RPC bu kümeyi çalışma
--      zamanında boşaltır; view monitoring + alarm için kalıcı tanıdır.
--
-- Bağımlılıklar:
--   20260418150000_event_type_column_promotion.sql  (event_type kolonu)
--   20260418160000_notification_event_traceability.sql (event_id FK, 'app_event')
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) dead_letter_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dead_letter_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      public.app_event_type,
  dedupe_key      text,
  trigger_type    text,
  stage           text NOT NULL CHECK (stage IN (
                      'VALIDATE',
                      'PERSIST_EVENT',
                      'CREATE_NOTIFICATION',
                      'SIDE_EFFECTS',
                      'COMPLETE'
                  )),
  error_code      text,
  error_message   text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count   integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  route           text,
  method          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_retried_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_events_user_created
  ON public.dead_letter_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_events_dedupe
  ON public.dead_letter_events (dedupe_key);

ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;

-- Service role only. Anon/authenticated bu tabloya ERIŞMEZ; dead letter
-- kayıtları operatör/otomasyon konusudur.
REVOKE ALL ON public.dead_letter_events FROM anon, authenticated;

COMMENT ON TABLE public.dead_letter_events IS
  'Dispatch pipeline kalıcı hataları (DLQ). Service role dışında erişim yok.';

-- -----------------------------------------------------------------------------
-- 2) dispatch_app_event(...) — atomic + retry-safe + idempotent
--
-- Pipeline:
--   a) automation_events UPSERT (ON CONFLICT (dedupe_key) DO NOTHING)
--      - Yeni satır → event_inserted=true
--      - Duplicate → SELECT FOR UPDATE ile mevcut satır kilitlenir (concurrent
--        çağrılar arasında retry sırası korunur).
--   b) Notification parametreleri verildiyse:
--      - event_id'e zaten bağlı bir notification varsa mevcut id döner
--        (retry self-heal).
--      - Yoksa insert eder ve notification_created=true döner.
--   c) Tek transaction. Herhangi bir adım hata verirse tüm blok geri alınır.
--
-- Notification parametreleri NULL geçilirse (cron kaynaklı DB-domain event'ler)
-- sadece automation_events kısmı yazılır. Bu, eski cron emit_* fonksiyonlarıyla
-- uyumlu davranışı korur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_app_event(
  p_user_id                    uuid,
  p_dedupe_key                 text,
  p_trigger_type               text,
  p_event_type                 public.app_event_type DEFAULT NULL,
  p_asset_id                   uuid                  DEFAULT NULL,
  p_rule_id                    uuid                  DEFAULT NULL,
  p_service_log_id             uuid                  DEFAULT NULL,
  p_actions                    text[]                DEFAULT ARRAY[]::text[],
  p_payload                    jsonb                 DEFAULT '{}'::jsonb,
  p_run_after                  timestamptz           DEFAULT now(),
  p_notification_title         text                  DEFAULT NULL,
  p_notification_message       text                  DEFAULT NULL,
  p_notification_type          text                  DEFAULT NULL,
  p_notification_source        text                  DEFAULT NULL,
  p_notification_action_href   text                  DEFAULT NULL,
  p_notification_action_label  text                  DEFAULT NULL
)
RETURNS TABLE (
  event_id              uuid,
  notification_id       uuid,
  event_inserted        boolean,
  notification_created  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id       uuid;
  v_inserted       boolean := false;
  v_notif_id       uuid;
  v_notif_created  boolean := false;
  v_has_notif      boolean;
BEGIN
  -- Defansif validasyon (DB seviyesinde; servis katı zaten kontrol ediyor).
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'dispatch_app_event: p_user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_dedupe_key IS NULL OR length(btrim(p_dedupe_key)) = 0 THEN
    RAISE EXCEPTION 'dispatch_app_event: p_dedupe_key is required' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'event_type' OR p_payload ? 'notification_kind' THEN
    RAISE EXCEPTION
      'dispatch_app_event: payload must not contain legacy event identity keys'
      USING ERRCODE = '22023';
  END IF;

  -- Adım (a): Idempotent event insert
  INSERT INTO public.automation_events (
    user_id, asset_id, rule_id, service_log_id,
    trigger_type, event_type, actions, payload,
    dedupe_key, run_after
  )
  VALUES (
    p_user_id, p_asset_id, p_rule_id, p_service_log_id,
    p_trigger_type, p_event_type, p_actions, p_payload,
    p_dedupe_key, p_run_after
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    -- Duplicate. Mevcut satırı kilitle — paralel retry'lar notification
    -- oluşturmada yarış oluşturmasın.
    SELECT id
      INTO v_event_id
      FROM public.automation_events
     WHERE dedupe_key = p_dedupe_key
       FOR UPDATE;

    IF v_event_id IS NULL THEN
      -- Pratik olarak ulaşılamaz (UNIQUE + ON CONFLICT sonrası), yine de
      -- loud fail:
      RAISE EXCEPTION
        'dispatch_app_event: could not resolve event_id for dedupe_key=%',
        p_dedupe_key
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Adım (b): Notification — parametreler verildiyse
  IF p_notification_title IS NOT NULL
     AND p_notification_message IS NOT NULL
     AND p_notification_type IS NOT NULL THEN

    -- Self-heal: aynı event_id için notification zaten var mı?
    SELECT id
      INTO v_notif_id
      FROM public.notifications
     WHERE event_id = v_event_id
     LIMIT 1;

    v_has_notif := v_notif_id IS NOT NULL;

    IF NOT v_has_notif THEN
      INSERT INTO public.notifications (
        user_id, event_id, title, message, type,
        source, action_href, action_label, is_read
      )
      VALUES (
        p_user_id, v_event_id,
        p_notification_title, p_notification_message, p_notification_type,
        p_notification_source, p_notification_action_href, p_notification_action_label,
        false
      )
      RETURNING id INTO v_notif_id;

      v_notif_created := true;
    END IF;
  END IF;

  RETURN QUERY SELECT v_event_id, v_notif_id, v_inserted, v_notif_created;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_app_event(
  uuid, text, text, public.app_event_type, uuid, uuid, uuid,
  text[], jsonb, timestamptz, text, text, text, text, text, text
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dispatch_app_event(
  uuid, text, text, public.app_event_type, uuid, uuid, uuid,
  text[], jsonb, timestamptz, text, text, text, text, text, text
) TO service_role;

COMMENT ON FUNCTION public.dispatch_app_event(
  uuid, text, text, public.app_event_type, uuid, uuid, uuid,
  text[], jsonb, timestamptz, text, text, text, text, text, text
) IS
  'Atomic app-event dispatch: upserts automation_events (idempotent via dedupe_key) '
  've opsiyonel olarak bağlı notification''ı oluşturur. Retry sonrası eksik '
  'notification''ı self-heal eder. Yalnızca service_role çağırabilir.';

-- -----------------------------------------------------------------------------
-- 3) v_dispatch_orphans — tutarsızlık teşhis görünümü
--
-- 'app_event' trigger'lı ve bir AppEventType kolon değerine sahip satırlar
-- downstream notification bekler. Self-heal RPC yaşayan sistemde bu kümeyi
-- boş tutar; boş olmaması monitoring/alarm konusudur.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_dispatch_orphans AS
SELECT
  ae.id            AS event_id,
  ae.user_id,
  ae.event_type,
  ae.trigger_type,
  ae.dedupe_key,
  ae.created_at
FROM public.automation_events ae
WHERE ae.trigger_type = 'app_event'
  AND ae.event_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n WHERE n.event_id = ae.id
  );

REVOKE ALL ON public.v_dispatch_orphans FROM anon, authenticated;
GRANT SELECT ON public.v_dispatch_orphans TO service_role;

COMMENT ON VIEW public.v_dispatch_orphans IS
  'Dispatch tutarsızlık teşhisi: app_event trigger''lı ve notification bağlı '
  'olmayan automation_events satırları. Sağlıklı sistemde boş olmalı.';

-- -----------------------------------------------------------------------------
-- 4) Invariant check: migration sonunda mevcut ORPHAN rowları rapor et.
--    Fail ETMEZ — mevcut legacy 'app_event' anchorları henüz notification
--    ile eşlenmiş değilse bu bir runtime durumudur, migration hatası değil.
--    Ancak log'a düşer; operatör monitör edebilir.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM public.v_dispatch_orphans;
  RAISE NOTICE '[dispatch_hardening] dispatch_orphans_at_migration=%', orphan_count;
END $$;

COMMIT;
