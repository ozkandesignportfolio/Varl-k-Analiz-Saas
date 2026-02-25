"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  planName: string;
  price: string;
  periodText: string;
  description: ReactNode;
  highlights: string[];
  action: ReactNode;
  featured?: boolean;
  topBadge?: string;
  footnote?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function PricingCard({
  planName,
  price,
  periodText,
  description,
  highlights,
  action,
  featured = false,
  topBadge,
  footnote,
  className,
  style,
}: PricingCardProps) {
  return (
    <article
      className={cn(
        "premium-card relative p-6",
        featured && "border border-indigo-400/55",
        className,
      )}
      style={style}
    >
      {topBadge ? (
        <span className="absolute right-5 top-5 rounded-full border border-indigo-300/40 bg-indigo-500/25 px-3 py-1 text-xs font-semibold text-indigo-100">
          {topBadge}
        </span>
      ) : null}

      <p className={cn("text-xs uppercase tracking-[0.2em]", featured ? "text-indigo-200" : "text-slate-400")}>{planName}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{price}</p>
      <p className={cn("mt-1 text-sm", featured ? "text-slate-200" : "text-slate-300")}>{periodText}</p>
      <div className={cn("mt-1 text-sm", featured ? "text-slate-200" : "text-slate-300")}>{description}</div>

      <ul className={cn("mt-5 space-y-2 text-sm", featured ? "text-slate-100" : "text-slate-200")}>
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="mt-6">{action}</div>
      {footnote ? <div className="mt-3 text-xs leading-relaxed text-muted-foreground/70">{footnote}</div> : null}
    </article>
  );
}
