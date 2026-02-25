import { memo } from "react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";

function ListViewComponent({ rows }: PanelPreviewViewProps) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <article
          key={`${row.title}-${row.date}`}
          className="rounded-xl border border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_38%)] px-4 py-3 shadow-[0_8px_20px_rgb(5_10_24_/_24%)]"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--auth-foreground)]">{row.title}</p>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{row.badge}</span>
          </div>
          <p className="text-xs text-[var(--auth-muted)]">{row.detail}</p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--auth-muted)]">
            <span>{row.date}</span>
            <span className="font-semibold text-primary">{row.amount}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export const ListView = memo(ListViewComponent);
ListView.displayName = "ListView";
