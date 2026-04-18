-- ROLLBACK: 20260418180000_notifications_event_id_unique
-- UNIQUE constraint'i düşürür. NOT NULL + FK korunur.

BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_id_unique;

COMMIT;
