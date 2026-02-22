"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SettingsTab =
  | "profile"
  | "notification-preferences"
  | "plan-usage"
  | "security"
  | "organization";

type SettingsTabsProps = {
  value: SettingsTab;
  onValueChange: (nextTab: SettingsTab) => void;
  children: ReactNode;
};

const TAB_ITEMS: { value: SettingsTab; label: string }[] = [
  { value: "profile", label: "Profil" },
  { value: "notification-preferences", label: "Bildirim Tercihleri" },
  { value: "plan-usage", label: "Plan & Kullanım" },
  { value: "security", label: "Güvenlik" },
  { value: "organization", label: "Organizasyon" },
];

const isSettingsTab = (value: string): value is SettingsTab =>
  TAB_ITEMS.some((item) => item.value === value);

export function SettingsTabs({ value, onValueChange, children }: SettingsTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (isSettingsTab(next)) {
          onValueChange(next);
        }
      }}
      className="space-y-4"
    >
      <TabsList
        variant="line"
        className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-2"
      >
        {TAB_ITEMS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-lg px-3 py-2 text-xs text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {children}
    </Tabs>
  );
}

