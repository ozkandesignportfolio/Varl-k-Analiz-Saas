-- =============================================================================
-- Migration: Promote event identity from JSON payload to typed column
-- =============================================================================
--
-- Amaç (fully normalized event identity):
--   `automation_events.payload` içindeki JSON anahtarı (`event_type`) tipli bir
--   kolon olarak promote edilir: `automation_events.event_type app_event_type`.
--   Eski `notification_kind` anahtarı ile geçici `event_type` JSON anahtarı
--   payload'dan tamamen silinir. Bundan sonra event kimliği YALNIZCA kolon
--   üzerinden okunur/yazılır; kod tarafında legacy fallback yoktur.
--
-- Normalleşme kuralları (zorlama: DB constraint'leri):
--   1. `event_type` değerleri yalnızca `public.app_event_type` enum'undan olur.
--   2. Payload JSON'u ne `event_type` ne `notification_kind` anahtarı taşıyabilir.
--   3. `notifications` tablosunda zaten payload/notification_kind kolonu yok —
--      bu tablo için ek normalleşme gerekmiyor; uyum notu aşağıda.
--
-- Önceki migration bağımlılığı:
--   `20260418140000_normalize_app_event_identity.sql` — `app_event_type` enum
--   tipini ve payload üzerinde geçici CHECK'leri oluşturmuştu. Bu migration
--   o CHECK'leri kaldırıp kalıcı kolon + kalıcı CHECK ile değiştirir.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Tipli kolon: event_type
-- -----------------------------------------------------------------------------
-- Enum zaten 20260418140000 migration'ında oluşturuldu; emniyet amaçlı tekrar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_event_type') THEN
    CREATE TYPE public.app_event_type AS ENUM (
      'ASSET_CREATED',
      'ASSET_UPDATED',
      'USER_WELCOME',
      'TEST_NOTIFICATION'
    );
  END IF;
END $$;

ALTER TABLE public.automation_events
  ADD COLUMN IF NOT EXISTS event_type public.app_event_type;

COMMENT ON COLUMN public.automation_events.event_type IS
  'Application event identity. Single source of truth — mirrors AppEventType enum in TypeScript. Null for DB-domain triggers (ör. cron maintenance_7_days) that have no app event counterpart.';

-- -----------------------------------------------------------------------------
-- 2) Backfill: payload -> kolon
--    Öncelik payload.event_type (140000 migration sonrası üretilen); ek olarak
--    hâlâ kalabilecek legacy notification_kind değerleri de ikinci kaynak.
-- -----------------------------------------------------------------------------
UPDATE public.automation_events
SET event_type = (payload ->> 'event_type')::public.app_event_type
WHERE event_type IS NULL
  AND payload ? 'event_type'
  AND (payload ->> 'event_type') IN (
    'ASSET_CREATED', 'ASSET_UPDATED', 'USER_WELCOME', 'TEST_NOTIFICATION'
  );

UPDATE public.automation_events
SET event_type = CASE payload ->> 'notification_kind'
    WHEN 'asset_created' THEN 'ASSET_CREATED'::public.app_event_type
    WHEN 'asset_updated' THEN 'ASSET_UPDATED'::public.app_event_type
  END
WHERE event_type IS NULL
  AND payload ? 'notification_kind'
  AND (payload ->> 'notification_kind') IN ('asset_created', 'asset_updated');

-- -----------------------------------------------------------------------------
-- 3) Payload temizliği: her iki legacy anahtar da kaldırılır.
--    Artık event identity JSON içinde tutulmuyor.
-- -----------------------------------------------------------------------------
UPDATE public.automation_events
SET payload = payload - 'event_type' - 'notification_kind'
WHERE payload ?| ARRAY['event_type', 'notification_kind'];

-- -----------------------------------------------------------------------------
-- 4) Index: event_type ile sık sorgulama için partial index (null'ları dışla)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_automation_events_user_event_type
  ON public.automation_events (user_id, event_type, created_at DESC)
  WHERE event_type IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5) CHECK / Validation constraints
--
--    - Önceki payload-tabanlı CHECK'ler kaldırılır (kolon tipli enum zaten
--      değerleri zorluyor).
--    - Yeni CHECK: payload'da event_type veya notification_kind anahtarı
--      OLMAYACAK. Dual schema imkansız.
-- -----------------------------------------------------------------------------
ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_event_type_valid;

ALTER TABLE public.automation_events
  DROP CONSTRAINT IF EXISTS automation_events_no_legacy_notification_kind;

ALTER TABLE public.automation_events
  ADD CONSTRAINT automation_events_payload_no_event_identity_keys
  CHECK (NOT (payload ?| ARRAY['event_type', 'notification_kind']));

-- -----------------------------------------------------------------------------
-- 6) Geçmişe dönük sanity: kolonda geçerli olmayan değerlere yer yok
--    (enum type zaten enforce eder; defansif olarak aşağıdaki assert'i çalıştırıp
--     tanımsız kayıt varsa migration erken fail eder).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.automation_events
  WHERE payload ?| ARRAY['event_type', 'notification_kind'];

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration invariant violated: % rows still carry legacy event keys in payload', invalid_count;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- notifications tablosu hakkında uyum notu
-- -----------------------------------------------------------------------------
-- notifications tablosunda `payload` kolonu veya `notification_kind` alanı
-- bulunmuyor (bkz. 20260415200000_unified_user_onboarding.sql). Dolayısıyla bu
-- tabloda kaldırılacak legacy alan yoktur. In-app notification'ların event
-- kimliği, üreten automation_event üzerinden (JOIN veya source_id referansı
-- ile) alınır. Bu sözleşme ayrı bir migration gerektirmez.
-- =============================================================================
