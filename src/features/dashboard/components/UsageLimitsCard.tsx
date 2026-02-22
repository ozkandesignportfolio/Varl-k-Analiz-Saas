import Link from "next/link";
import { Crown } from "lucide-react";

export type UsageLimitItem = {
  id: string;
  label: string;
  used: number;
  limit: number | null;
};

type UsageLimitsCardProps = {
  planLabel: string;
  isPremium: boolean;
  items: UsageLimitItem[];
};

const calculatePercent = (used: number, limit: number | null) => {
  if (limit === null || limit <= 0) return 100;
  const ratio = Math.max(0, used) / limit;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
};

export function UsageLimitsCard({ planLabel, isPremium, items }: UsageLimitsCardProps) {
  return (
    <aside className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(165deg,rgba(10,22,44,0.95),rgba(11,18,35,0.88))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.36)]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#90A6C4]">Kullanim</p>
          <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">{planLabel} Plani</h2>
        </div>
        <span className="inline-flex rounded-full border border-[#3A5478] bg-[#132B4B] px-2.5 py-1 text-xs font-semibold text-[#D8E6FC]">
          {isPremium ? "Sınırsız" : "Deneme"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const percentage = calculatePercent(item.used, item.limit);
          const isNearLimit = item.limit !== null && percentage >= 80;
          const isAtLimit = item.limit !== null && percentage >= 100;

          return (
            <article key={item.id} className="rounded-xl border border-[#314866] bg-[#0F1E37]/75 p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#E8F1FF]">{item.label}</span>
                <span className="text-xs text-[#9FB2CE]">
                  {item.used}/{item.limit ?? "∞"}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#091122]">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    isAtLimit
                      ? "bg-gradient-to-r from-rose-400 to-rose-500"
                      : isNearLimit
                        ? "bg-gradient-to-r from-amber-300 to-amber-500"
                        : "bg-gradient-to-r from-[#63B5FF] to-[#84D6C4]"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-[#9FB2CE]">
        Premium ile tum limitleri kaldırin ve otomasyon ile raporlamayi tam kapasiteye tasiyin.
      </p>

      <Link
        href="/pricing"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-[linear-gradient(120deg,rgba(251,191,36,0.28),rgba(245,158,11,0.32))] px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-[linear-gradient(120deg,rgba(251,191,36,0.35),rgba(245,158,11,0.4))]"
      >
        <Crown className="size-4" aria-hidden />
        Premium&apos;a Gec
      </Link>
    </aside>
  );
}

