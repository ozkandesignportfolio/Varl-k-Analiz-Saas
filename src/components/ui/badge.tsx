import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeBaseClasses =
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden"

const badgeVariantClasses = {
  default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
  secondary: "bg-muted text-foreground [a&]:hover:bg-muted/80",
  destructive: "bg-red-600 text-white [a&]:hover:bg-red-600/90",
  outline: "border-border/60 text-foreground [a&]:hover:bg-muted/30",
  ghost: "[a&]:hover:bg-muted/30",
  link: "text-primary underline-offset-4 [a&]:hover:underline",
} as const

type BadgeVariant = keyof typeof badgeVariantClasses

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  {
    variant?: BadgeVariant
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeBaseClasses, badgeVariantClasses[variant], className)}
      {...props}
    />
  )
}

export { Badge }
