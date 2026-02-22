export type WarrantyState = "active" | "expiring" | "expired";

export type MaintenanceState = "none" | "scheduled" | "upcoming" | "overdue";

export type AssetState = "active" | "passive";

export type AssetViewMode = "table" | "grid";

export type AssetSortMode = "updated" | "cost" | "score";

export type WarrantyFilterMode = "all" | WarrantyState;

export type MaintenanceFilterMode = "all" | "upcoming" | "overdue";

export type AssetFilterMode = "all" | AssetState;

export type AssetDashboardRow = {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
  warrantyState: WarrantyState;
  maintenanceState: MaintenanceState;
  assetState: AssetState;
  nextMaintenanceDate: string | null;
  lastServiceDate: string | null;
  documentCount: number;
  totalCost: number;
  score: number;
};

export type AssetActivityItem = {
  id: string;
  serviceType: string;
  serviceDate: string;
  cost: number;
};
