"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type AssetFormSelectOption = {
  label: string;
  value: string;
};

type AssetFormSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: AssetFormSelectOption[];
  ariaLabelledBy?: string;
  className?: string;
  dataTestId?: string;
};

const triggerClassName =
  "flex h-auto min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#08162F] px-4 py-2.5 text-left text-sm text-slate-100 outline-none transition focus:border-sky-400";

const contentClassName =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-[90] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-sky-200/10 bg-[#08162F] p-1 shadow-[0_24px_70px_rgba(2,8,23,0.6)]";

const itemClassName =
  "relative flex w-full cursor-default items-center rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition select-none data-[highlighted]:bg-sky-400/20 data-[highlighted]:text-sky-100 data-[state=checked]:bg-sky-400/16 data-[state=checked]:text-sky-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function AssetFormSelect({
  value,
  onValueChange,
  options,
  ariaLabelledBy,
  className,
  dataTestId,
}: AssetFormSelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-labelledby={ariaLabelledBy}
        className={cn(triggerClassName, className)}
        data-testid={dataTestId}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="shrink-0 text-sky-100/80">
          <ChevronDownIcon className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={contentClassName} position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1">
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className={itemClassName}>
                <span className="pointer-events-none absolute right-3 flex items-center text-sky-100">
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
