import type { ReactNode } from "react";

type ServiceDeleteDialogProps = {
  className: string;
  children: ReactNode;
  onConfirm: () => void;
  message?: string;
};

export function ServiceDeleteDialog({
  className,
  children,
  onConfirm,
  message = "Bu servis kaydını silmek istiyor musunuz?",
}: ServiceDeleteDialogProps) {
  return (
    <button
      type="button"
      onClick={() => {
        const ok = window.confirm(message);
        if (ok) {
          onConfirm();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}
