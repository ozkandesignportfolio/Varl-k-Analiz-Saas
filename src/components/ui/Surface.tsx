import type { ReactNode } from "react";

type SurfaceProps = {
  children: ReactNode;
  title?: string;
  desc?: string;
};

export default function Surface({ children, title, desc }: SurfaceProps) {
  return (
    <div className="auth-metric-card rounded-xl border p-4">
      {title ? <h3 className="auth-card-title text-base font-semibold">{title}</h3> : null}
      {desc ? <p className="auth-card-subtitle mt-1 text-sm">{desc}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
