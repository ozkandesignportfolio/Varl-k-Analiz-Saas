"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DashboardDateRangeDays } from "@/features/dashboard/api/dashboard-queries";

type DateRangeSelectorProps = {
  selectedRange: DashboardDateRangeDays;
};

type PresetOption = {
  label: string;
  days: DashboardDateRangeDays;
};

const PRESETS: PresetOption[] = [
  { label: "Son 7 gün", days: 7 },
  { label: "Son 30 gün", days: 30 },
  { label: "Son 90 gün", days: 90 },
];

const RANGE_STORAGE_KEY = "assetly:dashboard-range";

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateStr: string) => {
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const DateRangeSelector = memo(function DateRangeSelector({
  selectedRange,
}: DateRangeSelectorProps) {
  const router = useRouter();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isCustomActive, setIsCustomActive] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => formatDateForInput(new Date()), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRange = window.localStorage.getItem(RANGE_STORAGE_KEY);
      if (savedRange) {
        const parsed = Number(savedRange);
        if ((parsed === 7 || parsed === 30 || parsed === 90) && parsed !== selectedRange) {
          // Sync URL with stored preference on first load
        }
      }
    }
  }, [selectedRange]);

  const handlePresetClick = useCallback(
    (days: DashboardDateRangeDays) => {
      setIsCustomActive(false);
      setIsCustomOpen(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RANGE_STORAGE_KEY, String(days));
      }
      router.push(`/dashboard?range=${days}`);
    },
    [router],
  );

  const handleCustomApply = useCallback(() => {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;

    const diffMs = to.getTime() - from.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

    let closest: DashboardDateRangeDays = 30;
    if (diffDays <= 10) closest = 7;
    else if (diffDays <= 60) closest = 30;
    else closest = 90;

    setIsCustomActive(true);
    setIsCustomOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RANGE_STORAGE_KEY, String(closest));
    }
    router.push(`/dashboard?range=${closest}`);
  }, [customFrom, customTo, router]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsCustomOpen(false);
      }
    };
    if (isCustomOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCustomOpen]);

  const activeLabel = useMemo(() => {
    if (isCustomActive && customFrom && customTo) {
      return `${formatDateDisplay(customFrom)} – ${formatDateDisplay(customTo)}`;
    }
    const preset = PRESETS.find((p) => p.days === selectedRange);
    return preset?.label ?? `Son ${selectedRange} gün`;
  }, [isCustomActive, customFrom, customTo, selectedRange]);

  return (
    <div className="relative inline-flex items-center gap-1">
      <div className="inline-flex items-center gap-1 rounded-xl border border-[#2A3E5F] bg-[#0D1B33]/70 p-1">
        <CalendarDays className="mx-1.5 size-4 text-[#86A3C8]" aria-hidden />
        {PRESETS.map((preset) => {
          const isActive = selectedRange === preset.days && !isCustomActive;
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => handlePresetClick(preset.days)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "border border-[#42608A] bg-[#173155] text-[#EAF2FF] shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                  : "border border-transparent text-[#9CB0CE] hover:bg-[#132A4A] hover:text-[#F1F5F9]"
              }`}
            >
              {preset.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsCustomOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
            isCustomActive
              ? "border border-[#42608A] bg-[#173155] text-[#EAF2FF] shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
              : "border border-transparent text-[#9CB0CE] hover:bg-[#132A4A] hover:text-[#F1F5F9]"
          }`}
        >
          {isCustomActive ? activeLabel : "Özel"}
          <ChevronDown
            className={`size-3.5 transition-transform duration-200 ${isCustomOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      <AnimatePresence>
        {isCustomOpen ? (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-[#2B3E5B] bg-[#0A162A]/95 p-4 shadow-[0_16px_40px_rgba(2,8,20,0.6)] backdrop-blur-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9BB0CD]">
                Özel Tarih Aralığı
              </p>
              <button
                type="button"
                onClick={() => setIsCustomOpen(false)}
                className="rounded-md p-1 text-[#8FA6C7] transition hover:bg-white/5 hover:text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="custom-from" className="mb-1 block text-xs text-[#9FB2CE]">
                  Başlangıç
                </label>
                <input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#314B6D] bg-[#0E1E37] px-3 py-2 text-sm text-[#E8F1FF] outline-none transition focus:border-[#42608A] focus:ring-1 focus:ring-[#38BDF8]/30"
                />
              </div>
              <div>
                <label htmlFor="custom-to" className="mb-1 block text-xs text-[#9FB2CE]">
                  Bitiş
                </label>
                <input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-[#314B6D] bg-[#0E1E37] px-3 py-2 text-sm text-[#E8F1FF] outline-none transition focus:border-[#42608A] focus:ring-1 focus:ring-[#38BDF8]/30"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="w-full rounded-lg border border-[#42608A] bg-[#173155] px-3 py-2 text-sm font-semibold text-[#EAF2FF] transition hover:bg-[#1D4275] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Uygula
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
