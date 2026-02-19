import * as React from "react"

import { cn } from "@/lib/utils"

interface FieldBaseProps {
  label?: string
  error?: string
  containerClassName?: string
  labelClassName?: string
}

const baseFieldClass =
  "w-full rounded-xl border border-[#1E293B] bg-[#080D1A] px-4 py-2.5 text-sm text-[#F1F5F9] transition outline-none placeholder:text-[#475569] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30"

const errorFieldClass = "border-red-500/50 text-red-400 focus:border-red-500/60"

const baseLabelClass =
  "mb-1 block text-xs uppercase tracking-tight text-[#94A3B8]"

function mergeDescribedBy(
  existing: string | undefined,
  errorId: string | undefined
) {
  return [existing, errorId].filter(Boolean).join(" ") || undefined
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    FieldBaseProps {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      id,
      className,
      containerClassName,
      labelClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className={cn(baseLabelClass, labelClassName)}>
            {label}
          </label>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          className={cn(baseFieldClass, error ? errorFieldClass : "", className)}
          {...props}
          aria-label={props["aria-label"] ?? label}
          aria-invalid={props["aria-invalid"] ?? Boolean(error)}
          aria-describedby={mergeDescribedBy(props["aria-describedby"], errorId)}
        />
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = "Input"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    FieldBaseProps {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      id,
      className,
      containerClassName,
      labelClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const selectId = id ?? generatedId
    const errorId = error ? `${selectId}-error` : undefined

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label htmlFor={selectId} className={cn(baseLabelClass, labelClassName)}>
            {label}
          </label>
        ) : null}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            baseFieldClass,
            "pr-10",
            error ? errorFieldClass : "",
            className
          )}
          {...props}
          aria-label={props["aria-label"] ?? label}
          aria-invalid={props["aria-invalid"] ?? Boolean(error)}
          aria-describedby={mergeDescribedBy(props["aria-describedby"], errorId)}
        />
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = "Select"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldBaseProps {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      id,
      className,
      containerClassName,
      labelClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const textareaId = id ?? generatedId
    const errorId = error ? `${textareaId}-error` : undefined

    return (
      <div className={cn("w-full", containerClassName)}>
        {label ? (
          <label htmlFor={textareaId} className={cn(baseLabelClass, labelClassName)}>
            {label}
          </label>
        ) : null}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            baseFieldClass,
            "min-h-[110px] resize-y",
            error ? errorFieldClass : "",
            className
          )}
          {...props}
          aria-label={props["aria-label"] ?? label}
          aria-invalid={props["aria-invalid"] ?? Boolean(error)}
          aria-describedby={mergeDescribedBy(props["aria-describedby"], errorId)}
        />
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    )
  }
)

Textarea.displayName = "Textarea"

function FormLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn(baseLabelClass, className)} {...props} />
}

export { FormLabel, Input, Select, Textarea }
