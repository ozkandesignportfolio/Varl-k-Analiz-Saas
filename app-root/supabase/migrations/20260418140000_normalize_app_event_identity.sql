-- =============================================================================
-- Migration: Normalize notification/automation event identity
-- =============================================================================
--
-- Amaç:
--   Uygulama event kimliğini (AppEventType) tek kaynak haline getirmek.
--   Daha önce `automation_events.payload` içinde `notification_kind` alanı
--   (`"asset_created" | "asset_updated"`) ayrı bir kelime sistemi olarak
--   tutuluyordu. Bu alan siliniyor ve yerine `event_type` alanı
--   `AppEventType` enum string değerleriyle (`"ASSET_CREATED" | "ASSET_UPDATED"`)
--   geri doldurularak yazılıyor.
--
-- Sözleşme:
--   - Backend'de event kimliği için YALNIZCA `AppEventType` değerleri yazılır.
--   - `payload.notification_kind` alanı yasak; okunmaz, yazılmaz.
--   - Yeni event türleri eklendiğinde `AppEventType`'a eklenir ve aynı kural
--     geçerlidir (payload.event_type === AppEventType.X).
--
-- Geri dönüş:
--   Bu migration geri alınırsa: `payload.event_type` alanı silinir ve
--   `notification_kind` tekrar backfill edilmez (legacy uyum istenirse
--   rollback script'i ayrıca yazılmalıdır).
-- =============================================================================

BEGIN;

-- 1) AppEventType enum değerlerini DB tarafında tek noktada tutalım.
--    Bu CHECK constraint için referans görevi görür; ileride yeni event
--    eklendiğinde burası da güncellenir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_event_type') THEN
    CREATE TYPE app_event_type AS ENUM (
      'ASSET_CREATED',
      'ASSET_UPDATED',
      'USER_WELCOME',
      'TEST_NOTIFICATION'
    );
  END IF;
END $$;

-- 2) Backfill: eski notification_kind değerlerini yeni event_type alanına
--    AppEventType enum karşılığıyla yaz. Yalnızca iki legacy değer tanımlı:
--    "asset_created" -> "ASSET_CREATED", "asset_updated" -> "ASSET_UPDATED".
UPDATE automation_events
SET payload = jsonb_set(
  payload - 'notification_kind',
  '{event_type}',
  to_jsonb(
    CASE payload ->> 'notification_kind'
      WHEN 'asset_created' THEN 'ASSET_CREATED'
      WHEN 'asset_updated' THEN 'ASSET_UPDATED'
    END
  ),
  true
)
WHERE payload ? 'notification_kind'
  AND payload ->> 'notification_kind' IN ('asset_created', 'asset_updated');

-- 3) Geriye kalan (bilinmeyen) notification_kind varsa: event_type'a map
--    edilemeyen her kayıttan alan güvenli biçimde kaldırılır. Paralel kelime
--    sistemine tolerans yok.
UPDATE automation_events
SET payload = payload - 'notification_kind'
WHERE payload ? 'notification_kind';

-- 4) CHECK constraint: artık payload içinde yalnızca geçerli AppEventType
--    değerleri yazılabilir. Alan opsiyonel (bazı trigger'lar event_type
--    taşımaz — ör. cron kaynaklı "maintenance_7_days" gibi DB-domain trigger'ları).
ALTER TABLE automation_events
  DROP CONSTRAINT IF EXISTS automation_events_event_type_valid;

ALTER TABLE automation_events
  ADD CONSTRAINT automation_events_event_type_valid
  CHECK (
    NOT (payload ? 'event_type')
    OR (payload ->> 'event_type') IN (
      'ASSET_CREATED',
      'ASSET_UPDATED',
      'USER_WELCOME',
      'TEST_NOTIFICATION'
    )
  );

-- 5) notification_kind alanının bir daha asla yazılmaması için CHECK:
ALTER TABLE automation_events
  DROP CONSTRAINT IF EXISTS automation_events_no_legacy_notification_kind;

ALTER TABLE automation_events
  ADD CONSTRAINT automation_events_no_legacy_notification_kind
  CHECK (NOT (payload ? 'notification_kind'));

COMMIT;
