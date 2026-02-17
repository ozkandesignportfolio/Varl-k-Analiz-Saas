export type TriggerType = "warranty_30_days" | "maintenance_7_days" | "service_log_created";
export type ActionType = "email" | "push" | "push_notification" | "pdf_report";

export type AutomationEvent = {
  id: string;
  user_id: string;
  asset_id: string | null;
  rule_id: string | null;
  service_log_id: string | null;
  trigger_type: TriggerType;
  actions: ActionType[];
  payload: Record<string, unknown>;
};

export function buildMessage(event: AutomationEvent): { title: string; body: string } {
  const assetName = String(event.payload?.asset_name ?? "Varlik");
  const ruleTitle = String(event.payload?.rule_title ?? "Bakim kurali");
  const serviceType = String(event.payload?.service_type ?? "Servis");
  const serviceDate = String(event.payload?.service_date ?? "");

  if (event.trigger_type === "warranty_30_days") {
    const warrantyEndDate = String(event.payload?.warranty_end_date ?? "");
    return {
      title: "Garanti bitisine 30 gun kaldi",
      body: `${assetName} icin garanti bitis tarihi: ${warrantyEndDate}.`,
    };
  }

  if (event.trigger_type === "maintenance_7_days") {
    const nextDueDate = String(event.payload?.next_due_date ?? "");
    return {
      title: "Bakim tarihine 7 gun kaldi",
      body: `${assetName} / ${ruleTitle} icin hedef tarih: ${nextDueDate}.`,
    };
  }

  return {
    title: "Yeni servis kaydi olusturuldu",
    body: `${assetName} icin ${serviceType} kaydi olusturuldu (${serviceDate}).`,
  };
}
