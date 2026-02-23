import type { ComponentProps } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelSurfaceProps = ComponentProps<"div">;

export function PanelSurface({ className, ...props }: PanelSurfaceProps) {
  return (
    <Card
      className={cn("auth-content-panel auth-shell-card gap-4 rounded-3xl border px-6 py-6", className)}
      {...props}
    />
  );
}
