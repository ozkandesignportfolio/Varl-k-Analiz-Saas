"use client";

import { Topbar } from "@/components/layout/Topbar";

type AppHeaderProps = {
  title: string;
  breadcrumb: string;
  userEmail?: string | null;
};

export function AppHeader({ title, breadcrumb, userEmail }: AppHeaderProps) {
  return <Topbar title={title} breadcrumb={breadcrumb} userEmail={userEmail} />;
}
