import type { ReactNode } from "react";

type AssetDeleteDialogProps = {
  className: string;
  children: ReactNode;
  onConfirm: () => void;
  message?: string;
};

export function AssetDeleteDialog({
  className,
  children,
  onConfirm,
  message = "Bu varlığı silmek istiyor musunuz?",
}: AssetDeleteDialogProps) {
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
