import { ArrowUpDown, LayoutGrid, Search, Table2 } from "lucide-react";
import type {
  AssetFilterMode,
  AssetSortMode,
  AssetViewMode,
  MaintenanceFilterMode,
  WarrantyFilterMode,
} from "@/features/assets/components/assets-view-types";

type AssetsFilterBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  assetFilter: AssetFilterMode;
  onAssetFilterChange: (value: AssetFilterMode) => void;
  warrantyFilter: WarrantyFilterMode;
  onWarrantyFilterChange: (value: WarrantyFilterMode) => void;
  maintenanceFilter: MaintenanceFilterMode;
  onMaintenanceFilterChange: (value: MaintenanceFilterMode) => void;
  sortMode: AssetSortMode;
  onSortModeChange: (value: AssetSortMode) => void;
  viewMode: AssetViewMode;
  onViewModeChange: (value: AssetViewMode) => void;
  categories: string[];
};

const filterSelectClassName =
  "min-h-10 rounded-xl border border-white/15 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400";

const toggleClassName =
  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition";

export function AssetsFilterBar({
  searchTerm,
  onSearchTermChange,
  categoryFilter,
  onCategoryFilterChange,
  assetFilter,
  onAssetFilterChange,
  warrantyFilter,
  onWarrantyFilterChange,
  maintenanceFilter,
  onMaintenanceFilterChange,
  sortMode,
  onSortModeChange,
  viewMode,
  onViewModeChange,
  categories,
}: AssetsFilterBarProps) {
  return (
    <section className="premium-card p-4">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/70 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Varlık adı veya seri numarası ara"
            className="h-10 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>

        <select
          value={categoryFilter}
          onChange={(event) => onCategoryFilterChange(event.target.value)}
          className={filterSelectClassName}
        >
          <option value="all">Tüm kategoriler</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={assetFilter}
          onChange={(event) => onAssetFilterChange(event.target.value as AssetFilterMode)}
          className={filterSelectClassName}
        >
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>

        <select
          value={warrantyFilter}
          onChange={(event) => onWarrantyFilterChange(event.target.value as WarrantyFilterMode)}
          className={filterSelectClassName}
        >
          <option value="all">Tüm garanti durumları</option>
          <option value="active">Aktif</option>
          <option value="expiring">Bitiyor</option>
          <option value="expired">Bitti</option>
        </select>

        <select
          value={maintenanceFilter}
          onChange={(event) => onMaintenanceFilterChange(event.target.value as MaintenanceFilterMode)}
          className={filterSelectClassName}
        >
          <option value="all">Tüm bakım durumları</option>
          <option value="upcoming">Yaklaşan</option>
          <option value="overdue">Gecikmiş</option>
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/70 px-3">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <select
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as AssetSortMode)}
            className="h-10 bg-transparent text-sm text-slate-100 outline-none"
          >
            <option value="updated">Son güncellenen</option>
            <option value="cost">Maliyet</option>
            <option value="score">Skor</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <div className="inline-flex rounded-xl border border-white/15 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`${toggleClassName} ${
              viewMode === "table"
                ? "border-sky-300/35 bg-sky-300/15 text-sky-100"
                : "border-transparent text-slate-300 hover:text-slate-100"
            }`}
          >
            <Table2 className="h-4 w-4" />
            Liste
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={`${toggleClassName} ${
              viewMode === "grid"
                ? "border-sky-300/35 bg-sky-300/15 text-sky-100"
                : "border-transparent text-slate-300 hover:text-slate-100"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kartlar
          </button>
        </div>
      </div>
    </section>
  );
}
