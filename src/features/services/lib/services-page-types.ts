import type { ServiceLogFormAssetOption } from "@/features/services/components/service-log-form";
import type { ServiceLogTableRow } from "@/features/services/components/service-log-table";

export type AssetOption = ServiceLogFormAssetOption;

export type AssetOptionRow = {
  id: string;
  name: string;
  category: string | null;
  serial_number: string | null;
};

export type RuleOption = {
  id: string;
  asset_id: string;
  title: string;
  is_active: boolean;
  next_due_date: string;
};

export type ServiceRow = ServiceLogTableRow;

export type ServiceLogsCursor = {
  createdAt: string;
  id: string;
};

export type ServiceLogsPageResponse = {
  rows: ServiceRow[];
  nextCursor: ServiceLogsCursor | null;
  hasMore: boolean;
};
