import type { IntervalUnit } from "@/lib/maintenance/next-due";

export type MaintenanceAssetOption = {
  id: string;
  name: string;
};

export type RuleEditorValues = {
  assetId: string;
  title: string;
  intervalValue: string;
  intervalUnit: IntervalUnit;
  lastServiceDate: string;
  autoResetOnService: boolean;
};

export type MaintenanceRuleView = {
  id: string;
  assetId: string;
  assetName: string;
  title: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  intervalLabel: string;
  lastServiceDate: string | null;
  nextDueDate: string;
  isActive: boolean;
  daysToDue: number;
  dueTone: "safe" | "soon" | "overdue" | "passive";
};

export type RuleStatusFilter = "all" | "active" | "passive";

export type RulePeriodFilter = "all" | IntervalUnit;
