"use client";

import { useEffect, useState } from "react";

export type NotificationFrequency = "Anında" | "Günlük özet" | "Haftalık özet";

export type NotificationPrefsState = {
  maintenance: boolean;
  warranty: boolean;
  document: boolean;
  documentExpiry: boolean;
  service: boolean;
  payment: boolean;
  system: boolean;
  inApp: boolean;
  email: boolean;
  frequency: NotificationFrequency;
};

export type NotificationReminderDaysState = {
  maintenanceDaysBefore: number;
  warrantyDaysBefore: number;
  documentDaysBefore: number;
  billingDaysBefore: number;
};

type ReminderField = keyof NotificationReminderDaysState;

type NotificationPrefsProps = {
  value: NotificationPrefsState;
  reminderDays: NotificationReminderDaysState;
  onChange: (nextValue: NotificationPrefsState) => void;
  onReminderDaysChange: (nextValue: NotificationReminderDaysState) => void;
  isSaving?: boolean;
};

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

function ToggleRow({ label, description, checked, disabled, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
          checked ? "border-emerald-300/40 bg-emerald-400/30" : "border-white/15 bg-white/10"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

const FREQUENCY_OPTIONS: NotificationFrequency[] = ["Anında", "Günlük özet", "Haftalık özet"];
const REMINDER_DAY_MIN = 0;
const REMINDER_DAY_MAX = 365;
const REMINDER_FIELDS: Array<{
  key: ReminderField;
  label: string;
  description: string;
}> = [
  {
    key: "maintenanceDaysBefore",
    label: "Bakim",
    description: "Planli bakim icin kac gun once hatirlatma gonderilsin.",
  },
  {
    key: "warrantyDaysBefore",
    label: "Garanti",
    description: "Garanti bitisi icin kac gun once hatirlatma gonderilsin.",
  },
  {
    key: "documentDaysBefore",
    label: "Belge",
    description: "Belge gecerlilik tarihi icin kac gun once hatirlatma gonderilsin.",
  },
  {
    key: "billingDaysBefore",
    label: "Odeme",
    description: "Tahsilat veya yenileme tarihi icin kac gun once hatirlatma gonderilsin.",
  },
];

const createReminderDraft = (value: NotificationReminderDaysState): Record<ReminderField, string> => ({
  maintenanceDaysBefore: String(value.maintenanceDaysBefore),
  warrantyDaysBefore: String(value.warrantyDaysBefore),
  documentDaysBefore: String(value.documentDaysBefore),
  billingDaysBefore: String(value.billingDaysBefore),
});

const createReminderErrors = (): Record<ReminderField, string> => ({
  maintenanceDaysBefore: "",
  warrantyDaysBefore: "",
  documentDaysBefore: "",
  billingDaysBefore: "",
});

const parseReminderInput = (value: string) => {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return { value: null, error: "0 ile 365 arasinda tam sayi girin." };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < REMINDER_DAY_MIN || parsed > REMINDER_DAY_MAX) {
    return { value: null, error: "0 ile 365 arasinda tam sayi girin." };
  }

  return { value: parsed, error: "" };
};

export function NotificationPrefs({
  value,
  reminderDays,
  onChange,
  onReminderDaysChange,
  isSaving = false,
}: NotificationPrefsProps) {
  const [reminderDraft, setReminderDraft] = useState<Record<ReminderField, string>>(
    createReminderDraft(reminderDays),
  );
  const [reminderErrors, setReminderErrors] = useState<Record<ReminderField, string>>(
    createReminderErrors(),
  );

  useEffect(() => {
    setReminderDraft(createReminderDraft(reminderDays));
  }, [
    reminderDays.billingDaysBefore,
    reminderDays.documentDaysBefore,
    reminderDays.maintenanceDaysBefore,
    reminderDays.warrantyDaysBefore,
  ]);

  const commitReminderField = (field: ReminderField) => {
    const result = parseReminderInput(reminderDraft[field]);

    if (result.error || result.value === null) {
      setReminderErrors((current) => ({
        ...current,
        [field]: result.error,
      }));
      return;
    }

    setReminderErrors((current) => ({
      ...current,
      [field]: "",
    }));
    setReminderDraft((current) => ({
      ...current,
      [field]: String(result.value),
    }));

    if (reminderDays[field] === result.value) {
      return;
    }

    onReminderDaysChange({
      ...reminderDays,
      [field]: result.value,
    });
  };

  return (
    <section className="space-y-4">
      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-lg font-semibold text-white">Bildirim Tercihleri</h3>
        <p className="mt-1 text-sm text-slate-300">
          Bakım, garanti, belge, servis ve ödeme akışlarında hangi uyarıları görmek istediğinizi buradan belirleyin.
        </p>
        {isSaving ? <p className="mt-1 text-xs text-sky-200">Tercihler kaydediliyor...</p> : null}

        <div className="mt-4 grid gap-2">
          <ToggleRow
            label="Bakım hatırlatmaları"
            description="Planlı bakım tarihi yaklaşan varlıklar için hatırlatma göster."
            checked={value.maintenance}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, maintenance: !value.maintenance })}
          />
          <ToggleRow
            label="Garanti bitiş uyarıları"
            description="Garanti süresi kritik eşiğe geldiğinde bilgilendir."
            checked={value.warranty}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, warranty: !value.warranty })}
          />
          <ToggleRow
            label="Belge eksikliği uyarıları"
            description="Eksik garanti belgesi, fatura veya servis formu kayıtlarını hatırlat."
            checked={value.document}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, document: !value.document })}
          />
          <ToggleRow
            label="Belge süresi / geçerlilik uyarıları"
            description="Takip edilen belgelerin süre sonu veya kritik tarihlerini bildir."
            checked={value.documentExpiry}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, documentExpiry: !value.documentExpiry })}
          />
          <ToggleRow
            label="Servis kayıt uyarıları"
            description="Yeni servis kaydı açıldığında veya servis işlemi takip gerektirdiğinde haber ver."
            checked={value.service}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, service: !value.service })}
          />
          <ToggleRow
            label="Abonelik / fatura hatırlatmaları"
            description="Yaklaşan tahsilat, yenileme ve son ödeme tarihlerini hatırlat."
            checked={value.payment}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, payment: !value.payment })}
          />
          <ToggleRow
            label="Sistem / genel bilgilendirmeler"
            description="Panel güncellemeleri ve genel bilgilendirmeleri paylaş."
            checked={value.system}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, system: !value.system })}
          />
        </div>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Hatirlatma Gunleri</h4>
        <p className="mt-1 text-sm text-slate-400">
          Her bildirim tipi icin kac gun once hatirlatma gonderilecegini belirleyin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {REMINDER_FIELDS.map((field) => (
            <label
              key={field.key}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
            >
              <span className="text-sm font-medium text-white">{field.label}</span>
              <p className="mt-1 text-xs text-slate-400">{field.description}</p>
              <input
                type="number"
                min={REMINDER_DAY_MIN}
                max={REMINDER_DAY_MAX}
                step={1}
                inputMode="numeric"
                value={reminderDraft[field.key]}
                disabled={isSaving}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setReminderDraft((current) => ({
                    ...current,
                    [field.key]: nextValue,
                  }));
                  setReminderErrors((current) => ({
                    ...current,
                    [field.key]: "",
                  }));
                }}
                onBlur={() => commitReminderField(field.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-300 disabled:opacity-70"
              />
              {reminderErrors[field.key] ? (
                <p className="mt-2 text-xs text-rose-200">{reminderErrors[field.key]}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">0 sadece vade gunu, 3 varsayilan degerdir.</p>
              )}
            </label>
          ))}
        </div>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Kanallar</h4>
        <div className="mt-3 grid gap-2">
          <ToggleRow
            label="Uygulama içi"
            description="Bildirimleri panel içindeki bildirim merkezi üzerinden göster."
            checked={value.inApp}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, inApp: !value.inApp })}
          />
          <ToggleRow
            label="E-posta"
            description="Kritik uyarıları ve özetleri e-posta üzerinden de gönder."
            checked={value.email}
            disabled={isSaving}
            onToggle={() => onChange({ ...value, email: !value.email })}
          />
        </div>
      </article>

      <article className="premium-card border-white/10 bg-white/[0.02] p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">Frekans</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = value.frequency === option;
            return (
              <button
                key={option}
                type="button"
                disabled={isSaving}
                onClick={() => onChange({ ...value, frequency: option })}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  selected
                    ? "border-sky-300/45 bg-sky-300/15 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                } ${isSaving ? "cursor-not-allowed opacity-70" : ""}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </article>
    </section>
  );
}
