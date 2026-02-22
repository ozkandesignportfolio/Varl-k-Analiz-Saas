"use client";

import type {
  NotificationStatus,
  NotificationType,
} from "@/features/notifications/data/mock-notifications";

export type DateRangeFilter = 7 | 30 | 90;
export type TypeFilter = NotificationType | "Tümü";
export type StatusFilter = NotificationStatus | "Tümü";

type NotificationsFiltersProps = {
  query: string;
  type: TypeFilter;
  status: StatusFilter;
  dateRange: DateRangeFilter;
  onQueryChange: (value: string) => void;
  onTypeChange: (value: TypeFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
  onDateRangeChange: (value: DateRangeFilter) => void;
};

const INPUT_CLASS_NAME =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-300";

export function NotificationsFilters({
  query,
  type,
  status,
  dateRange,
  onQueryChange,
  onTypeChange,
  onStatusChange,
  onDateRangeChange,
}: NotificationsFiltersProps) {
  return (
    <section className="premium-card border-white/10 bg-white/[0.02] p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Arama</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className={INPUT_CLASS_NAME}
            placeholder="Bildirim metninde ara"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Tür</span>
          <select
            value={type}
            onChange={(event) => onTypeChange(event.target.value as TypeFilter)}
            className={INPUT_CLASS_NAME}
          >
            <option value="Tümü">Tümü</option>
            <option value="Bakım">Bakım</option>
            <option value="Garanti">Garanti</option>
            <option value="Belge">Belge</option>
            <option value="Ödeme">Ödeme</option>
            <option value="Sistem">Sistem</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Durum</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
            className={INPUT_CLASS_NAME}
          >
            <option value="Tümü">Tümü</option>
            <option value="Okundu">Okundu</option>
            <option value="Okunmadı">Okunmadı</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Tarih</span>
          <select
            value={String(dateRange)}
            onChange={(event) => onDateRangeChange(Number(event.target.value) as DateRangeFilter)}
            className={INPUT_CLASS_NAME}
          >
            <option value="7">Son 7 gün</option>
            <option value="30">Son 30 gün</option>
            <option value="90">Son 90 gün</option>
          </select>
        </label>
      </div>
    </section>
  );
}

