/**
 * DB ROW → DTO MAPPER
 * ---------------------------------------------------------------------------
 * Presenter katmanı DB şemasından tamamen bağımsızdır. Sorgular aşağıdaki
 * `AutomationEventQueryRow` şeklinde minimal bir satır döner (Supabase select
 * sonucu veya JOIN projeksiyonu). Bu modül onu canonical
 * `AutomationEventNotificationInput` DTO'suna çevirir. Presenter yalnızca DTO'yu
 * tüketir; `payload` içinden event kimliği OKUMAZ, `event_type` her zaman tipli
 * kolondan (veya JOIN'le verilmiş alandan) türetilir.
 *
 * Bu ayrım DB şema değişikliklerinin presenter'a sızmasını engeller.
 */

import { AppEventType } from "@/lib/events/app-event";
import type { AutomationEventNotificationInput } from "./notification-presenter";

/**
 * Supabase sorgularının döndüğü minimal satır şekli. Event kimliği yalnızca
 * `event_type` (tipli kolon) üzerinden gelir.
 */
export type AutomationEventQueryRow = {
  id: string;
  asset_id: string | null;
  trigger_type: string;
  event_type: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

/**
 * Presenter için bir notification satırı da gerekiyorsa (ör. `notifications`
 * tablosundan JOIN ile gelen alanlar). `status` önceliği: `notifications.is_read`
 * varsa ondan; yoksa automation_events.status.
 */
export type NotificationJoinRow = {
  id: string;
  is_read: boolean | null;
  created_at: string;
};

const isKnownAppEventType = (value: string): value is AppEventType =>
  (Object.values(AppEventType) as string[]).includes(value);

/**
 * DB satırını presenter'ın tükettiği DTO'ya çevirir. `payload` referansı geçer
 * ama presenter event kimliği için ASLA payload okumaz; `appEventType` alanı
 * tek kaynaktır ve tipli kolondan türetilir.
 */
export const mapAutomationEventRow = (
  row: AutomationEventQueryRow,
  join?: NotificationJoinRow,
): AutomationEventNotificationInput => ({
  id: join?.id ?? row.id,
  assetId: row.asset_id,
  triggerType: row.trigger_type,
  appEventType: row.event_type && isKnownAppEventType(row.event_type) ? row.event_type : null,
  payload: row.payload,
  status: join?.is_read != null ? (join.is_read ? "completed" : "pending") : row.status,
  createdAt: join?.created_at ?? row.created_at,
});
