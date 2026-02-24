"use client";

import type { FormEvent } from "react";
import { EXPENSES_TEXT } from "@/constants/ui-text";

export type ExpenseFormAssetOption = {
  id: string;
  name: string;
};

type ExpenseFormProps = {
  assets: ExpenseFormAssetOption[];
  selectedAssetId: string;
  onSelectedAssetIdChange: (assetId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  inputClassName: string;
};

export function ExpenseForm({
  assets,
  selectedAssetId,
  onSelectedAssetIdChange,
  onSubmit,
  isSubmitting,
  inputClassName,
}: ExpenseFormProps) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">{EXPENSES_TEXT.formTitle}</h2>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formAssetLabel}</span>
          <select
            value={selectedAssetId}
            onChange={(event) => onSelectedAssetIdChange(event.target.value)}
            className={inputClassName}
          >
            <option value="" className="bg-slate-900">
              {EXPENSES_TEXT.formAssetContinueWithoutSelection}
            </option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id} className="bg-slate-900">
                {asset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formTitleLabel}</span>
          <input name="title" required className={inputClassName} placeholder={EXPENSES_TEXT.formTitlePlaceholder} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formCategoryLabel}</span>
          <input
            name="category"
            required
            className={inputClassName}
            placeholder={EXPENSES_TEXT.formCategoryPlaceholder}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formAmountLabel}</span>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className={inputClassName}
            placeholder="0.00"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formCurrencyLabel}</span>
          <select name="currency" defaultValue="TRY" className={inputClassName}>
            <option value="TRY" className="bg-slate-900">
              TRY
            </option>
            <option value="USD" className="bg-slate-900">
              USD
            </option>
            <option value="EUR" className="bg-slate-900">
              EUR
            </option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formDateLabel}</span>
          <input
            name="expenseDate"
            type="date"
            required
            className={inputClassName}
            placeholder={EXPENSES_TEXT.formDatePlaceholder}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-slate-300">{EXPENSES_TEXT.formNoteLabel}</span>
          <textarea name="notes" rows={3} className={inputClassName} placeholder={EXPENSES_TEXT.formNotePlaceholder} />
        </label>

        <div className="sm:col-span-2 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isSubmitting ? EXPENSES_TEXT.formSubmitPending : EXPENSES_TEXT.formSubmitDefault}
          </button>
        </div>
      </form>
    </section>
  );
}


