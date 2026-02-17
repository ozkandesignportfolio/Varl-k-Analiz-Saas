import { KpiTrendDashboard } from "@/components/kpi/kpi-trend-dashboard";

export type DashboardChartAssetRow = {
  id: string;
  name: string;
  category: string;
  warranty_end_date: string | null;
};

export type DashboardChartServiceLogRow = {
  id: string;
  asset_id: string;
  rule_id: string | null;
  service_type: string;
  service_date: string;
  cost: number;
};

export type DashboardChartRuleRow = {
  id: string;
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

type DashboardChartsSectionProps = {
  assets: DashboardChartAssetRow[];
  serviceLogs: DashboardChartServiceLogRow[];
  rules: DashboardChartRuleRow[];
  isLoading: boolean;
};

export function DashboardChartsSection({
  assets,
  serviceLogs,
  rules,
  isLoading,
}: DashboardChartsSectionProps) {
  return <KpiTrendDashboard assets={assets} serviceLogs={serviceLogs} rules={rules} isLoading={isLoading} />;
}
