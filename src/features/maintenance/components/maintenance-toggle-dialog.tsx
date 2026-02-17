import type { ReactNode } from "react";

type MaintenanceToggleDialogProps = {
  className: string;
  children: ReactNode;
  onToggle: () => void;
};

export function MaintenanceToggleDialog({
  className,
  children,
  onToggle,
}: MaintenanceToggleDialogProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
    >
      {children}
    </button>
  );
}
