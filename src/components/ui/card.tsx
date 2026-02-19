import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariantClasses = {
  default: "border border-[#1E293B] bg-[#0E1525]",
  metric:
    "relative overflow-hidden border border-[#1E293B] bg-[#0E1525] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-[#6366F1] before:to-[#8B5CF6]",
  glass: "border border-white/[0.08] bg-white/[0.03] backdrop-blur-md",
  danger: "border border-red-500/30 bg-red-500/[0.05]",
  warning: "border border-amber-500/30 bg-amber-500/[0.05]",
} as const;

type CardVariant = keyof typeof cardVariantClasses;

type CardProps = React.ComponentProps<"div"> & {
  variant?: CardVariant;
};

function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn("flex flex-col gap-6 rounded-2xl p-6 text-[#F1F5F9]", cardVariantClasses[variant], className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("leading-none font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center px-6 [.border-t]:pt-6", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
