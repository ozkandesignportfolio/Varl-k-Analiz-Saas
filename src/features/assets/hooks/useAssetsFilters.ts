import { useCallback, useMemo, useState } from "react";
import type {
  AssetFilterMode,
  AssetSortMode,
  AssetViewMode,
  MaintenanceFilterMode,
  WarrantyFilterMode,
} from "@/features/assets/components/assets-view-types";

export type AssetsListQueryOptions = {
  search?: string;
  category?: string;
  sort: AssetSortMode;
  assetFilter?: AssetFilterMode;
  warrantyFilter?: WarrantyFilterMode;
  maintenanceFilter?: MaintenanceFilterMode;
};

export function useAssetsFilters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState<AssetFilterMode>("all");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilterMode>("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilterMode>("all");
  const [sortMode, setSortMode] = useState<AssetSortMode>("updated");
  const [viewMode, setViewMode] = useState<AssetViewMode>("table");

  const listQueryOptions = useMemo<AssetsListQueryOptions>(
    () => ({
      search: searchTerm.trim() ? searchTerm : undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      sort: sortMode,
      assetFilter: assetFilter === "all" ? undefined : assetFilter,
      warrantyFilter: warrantyFilter === "all" ? undefined : warrantyFilter,
      maintenanceFilter: maintenanceFilter === "all" ? undefined : maintenanceFilter,
    }),
    [assetFilter, categoryFilter, maintenanceFilter, searchTerm, sortMode, warrantyFilter],
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        listQueryOptions.search ||
          listQueryOptions.category ||
          listQueryOptions.assetFilter ||
          listQueryOptions.warrantyFilter ||
          listQueryOptions.maintenanceFilter,
      ),
    [listQueryOptions],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter("all");
    setAssetFilter("all");
    setWarrantyFilter("all");
    setMaintenanceFilter("all");
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    assetFilter,
    setAssetFilter,
    warrantyFilter,
    setWarrantyFilter,
    maintenanceFilter,
    setMaintenanceFilter,
    sortMode,
    setSortMode,
    viewMode,
    setViewMode,
    listQueryOptions,
    hasActiveFilters,
    clearFilters,
  };
}
