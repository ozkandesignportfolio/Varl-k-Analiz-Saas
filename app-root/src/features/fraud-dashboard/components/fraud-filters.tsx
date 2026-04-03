"use client";

import type { ChangeEvent } from "react";
import { Card } from "@/components/ui/card";
import { FRAUD_DASHBOARD_EVENT_TYPES, type FraudStatsFilters } from "@/lib/fraud/types";

type FraudFiltersProps = {
  filters: FraudStatsFilters;
  onChange: (nextFilters: FraudStatsFilters) => void;
};

const inputClassName =
  "w-full rounded-xl border border-white/10 bg-[#08101C] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400";
const labelClassName = "text-xs font-medium uppercase tracking-[0.16em] text-slate-500";

export function FraudFilters({ filters, onChange }: FraudFiltersProps) {
  const updateField =
    <T extends keyof FraudStatsFilters>(field: T) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const rawValue = event.target.value;
      const nextValue =
        field === "limit" || field === "riskMin" || field === "riskMax" || field === "windowHours"
          ? Number(rawValue)
          : rawValue;

      onChange({
        ...filters,
        [field]: nextValue,
      });
    };

  return (
    <Card className="gap-5 border-white/10 bg-[#09111F]/90 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Fraud Filters</h2>
          <p className="mt-1 text-sm text-slate-400">Slice signup telemetry by identity, risk window, and normalized outcome.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="space-y-2">
          <span className={labelClassName}>Email</span>
          <input className={inputClassName} value={filters.email} onChange={updateField("email")} placeholder="user@company.com" />
        </label>

        <label className="space-y-2">
          <span className={labelClassName}>IP</span>
          <input className={inputClassName} value={filters.ip} onChange={updateField("ip")} placeholder="203.0.113.42" />
        </label>

        <label className="space-y-2">
          <span className={labelClassName}>Event Type</span>
          <select className={inputClassName} value={filters.eventType} onChange={updateField("eventType")}>
            {FRAUD_DASHBOARD_EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType === "all" ? "All events" : eventType}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className={labelClassName}>Min Risk</span>
          <input className={inputClassName} type="number" min={0} max={100} value={filters.riskMin} onChange={updateField("riskMin")} />
        </label>

        <label className="space-y-2">
          <span className={labelClassName}>Max Risk</span>
          <input className={inputClassName} type="number" min={0} max={100} value={filters.riskMax} onChange={updateField("riskMax")} />
        </label>

        <label className="space-y-2">
          <span className={labelClassName}>Window (Hours)</span>
          <input className={inputClassName} type="number" min={1} max={720} value={filters.windowHours} onChange={updateField("windowHours")} />
        </label>
      </div>
    </Card>
  );
}
