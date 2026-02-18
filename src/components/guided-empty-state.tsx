import Link from "next/link";
import type { ReactNode } from "react";

type GuidedEmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type GuidedEmptyStateProps = {
  title: string;
  description: string;
  primaryAction: GuidedEmptyStateAction;
  secondaryAction?: GuidedEmptyStateAction;
  extra?: ReactNode;
};

const primaryClassName =
  "rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90";

const secondaryClassName =
  "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10";

export function GuidedEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  extra,
}: GuidedEmptyStateProps) {
  return (
    <article className="rounded-2xl border border-dashed border-sky-200/25 bg-sky-300/5 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-sky-200/80">Onboarding</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-200">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton action={primaryAction} className={primaryClassName} />
        {secondaryAction ? <ActionButton action={secondaryAction} className={secondaryClassName} /> : null}
      </div>

      {extra ? <div className="mt-4 text-xs text-slate-300">{extra}</div> : null}
    </article>
  );
}

type ActionButtonProps = {
  action: GuidedEmptyStateAction;
  className: string;
};

function ActionButton({ action, className }: ActionButtonProps) {
  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}