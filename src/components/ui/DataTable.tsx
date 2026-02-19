import * as React from "react"
import { InboxIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface DataTableColumn<TData extends Record<string, unknown>> {
  key: keyof TData | string
  header: string
  render?: (row: TData, index: number) => React.ReactNode
  className?: string
  headerClassName?: string
}

export interface DataTableProps<TData extends Record<string, unknown>> {
  columns: DataTableColumn<TData>[]
  data: TData[]
  onRowClick?: (row: TData, index: number) => void
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  if (React.isValidElement(value)) {
    return value
  }

  return String(value)
}

function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
}: DataTableProps<TData>) {
  const isEmpty = data.length === 0

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E293B] bg-[#0E1525]">
      {isEmpty ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="rounded-xl border border-[#1E293B] bg-[#080D1A] p-3">
            <InboxIcon className="h-5 w-5 text-[#94A3B8]" aria-hidden="true" />
          </span>
          <p className="text-sm text-[#94A3B8]">Henüz kayıt yok</p>
          <button
            type="button"
            aria-label="Yeni kayıt ekle"
            className="rounded-xl border border-[#6366F1]/30 bg-[#6366F1]/10 px-4 py-2 text-xs font-medium text-[#C7D2FE] transition hover:bg-[#6366F1]/20"
          >
            Yeni Kayıt Ekle
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#080D1A] text-[10px] uppercase tracking-tight text-[#475569]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left font-semibold",
                      column.headerClassName
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => {
                const rowKey = (row as { id?: React.Key }).id ?? rowIndex

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      "border-b border-[#1E293B] transition",
                      rowIndex % 2 === 1 ? "bg-[#0A1120]" : "bg-transparent",
                      "cursor-pointer hover:bg-[#141D30]"
                    )}
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onRowClick(row, rowIndex)
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    role={onRowClick ? "button" : undefined}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "px-4 py-3 text-sm text-[#E2E8F0]",
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render(row, rowIndex)
                          : normalizeValue(row[column.key as keyof TData])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export { DataTable }
