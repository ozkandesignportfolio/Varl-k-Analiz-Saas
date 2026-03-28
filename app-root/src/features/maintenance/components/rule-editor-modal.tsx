"use client";

import { CircleHelp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateNextDueDate } from "@/lib/maintenance/next-due";
import type {
  MaintenanceAssetOption,
  RuleEditorValues,
} from "@/features/maintenance/components/types";

type RuleEditorModalProps = {
  open: boolean;
  mode: "create" | "edit";
  assets: MaintenanceAssetOption[];
  initialValues: RuleEditorValues;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RuleEditorValues) => Promise<void>;
};

const intervalUnitOptions: { value: RuleEditorValues["intervalUnit"]; label: string }[] = [
  { value: "day", label: "Gün" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Ay" },
  { value: "year", label: "Yıl" },
];

const titleTemplates = [
  "Filtre Değişimi",
  "Genel Bakım",
  "Temizlik",
  "Kalibrasyon",
  "Yazılım Güncelleme",
];

export function RuleEditorModal({
  open,
  mode,
  assets,
  initialValues,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: RuleEditorModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<RuleEditorValues>(() => initialValues);

  const canGoStepTwo = form.assetId.trim().length > 0 && form.title.trim().length > 0;

  const duePreview = useMemo(() => {
    const parsedInterval = Number(form.intervalValue);
    if (!Number.isInteger(parsedInterval) || parsedInterval <= 0) {
      return "Periyot değeri girin";
    }

    try {
      const nextDate = calculateNextDueDate({
        baseDate: form.lastServiceDate,
        intervalValue: parsedInterval,
        intervalUnit: form.intervalUnit,
      });
      return formatDateTR(nextDate);
    } catch {
      return "Tarih hesaplanamadı";
    }
  }, [form.intervalUnit, form.intervalValue, form.lastServiceDate]);

  const canSubmit =
    canGoStepTwo &&
    Number.isInteger(Number(form.intervalValue)) &&
    Number(form.intervalValue) > 0 &&
    form.lastServiceDate.trim().length > 0;

  const title = mode === "create" ? "Yeni Kural" : "Kuralı Düzenle";
  const submitText = mode === "create" ? "Kuralı Oluştur" : "Değişiklikleri Kaydet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-[0_22px_52px_rgba(2,6,23,0.6)]"
        data-testid="rule-editor-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-100">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-300">
            2 adımda kural oluşturun ve sonraki bakım tarihini otomatik hesaplayın.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <StepBadge isActive={step === 1} label="1. Varlık ve isim" />
            <StepBadge isActive={step === 2} label="2. Periyot ve başlangıç" />
          </div>

          {step === 1 ? (
            <section className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Varlık</span>
                <select
                  value={form.assetId}
                  onChange={(event) => setForm((prev) => ({ ...prev, assetId: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-600/90 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  data-testid="rule-asset-select"
                >
                  <option value="">Varlık seçin</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Kural adı</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Örn: Filtre Değişimi"
                  className="h-10 w-full rounded-lg border border-slate-600/90 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  data-testid="rule-title-input"
                />
              </label>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Hazır şablonlar</p>
                <div className="flex flex-wrap gap-2">
                  {titleTemplates.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, title: template }))}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        form.title === template
                          ? "border-sky-400/70 bg-sky-500/15 text-sky-100"
                          : "border-slate-600/80 bg-slate-900 text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[auto_110px_140px] sm:items-end">
                <p className="text-sm text-slate-300">Her</p>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.intervalValue}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      intervalValue: event.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-600/90 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  data-testid="rule-interval-value-input"
                />
                <select
                  value={form.intervalUnit}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      intervalUnit: event.target.value as RuleEditorValues["intervalUnit"],
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-600/90 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  data-testid="rule-interval-unit-select"
                >
                  {intervalUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-300">Başlangıç tarihi</span>
                <input
                  type="date"
                  value={form.lastServiceDate}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      lastServiceDate: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-600/90 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
                  data-testid="rule-start-date-input"
                />
              </label>

              <div className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                Sonraki bakım: <strong>{duePreview}</strong>
              </div>

              <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={form.autoResetOnService}
                    disabled
                    readOnly
                    className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800"
                  />
                  <span className="text-sm text-slate-200">
                    Servis kaydı eklendiğinde otomatik sıfırla
                  </span>
                  <span
                    title="Bu davranış mevcut backend akışıyla standart olarak açıktır ve kural bağlı servis kaydında baz tarihi otomatik günceller."
                    className="mt-0.5 text-slate-400"
                  >
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </label>
              </div>
            </section>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (step === 1) {
                onOpenChange(false);
                return;
              }
              setStep(1);
            }}
            className="h-9 rounded-lg border border-slate-500/80 px-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            {step === 1 ? "Vazgeç" : "Geri"}
          </button>

          {step === 1 ? (
            <button
              type="button"
              disabled={!canGoStepTwo}
              onClick={() => setStep(2)}
              className="h-9 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="rule-next-step-button"
            >
              Devam Et
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSubmit || isSubmitting}
              onClick={async () => {
                await onSubmit({
                  ...form,
                  title: form.title.trim(),
                  autoResetOnService: true,
                });
              }}
              className="h-9 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="rule-save-button"
            >
              {isSubmitting ? "Kaydediliyor..." : submitText}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepBadge({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 ${
        isActive
          ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
          : "border-slate-600/80 bg-slate-900 text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}

function formatDateTR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}
