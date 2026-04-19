"use client";

import { memo } from "react";
import { Topbar } from "@/components/layout/Topbar";

type AppHeaderProps = {
  title: string;
  breadcrumb: string;
  userEmail?: string | null;
  userId?: string | null;
};

export const AppHeader = memo(function AppHeader({ title, breadcrumb, userEmail, userId }: AppHeaderProps) {
  return <Topbar title={title} breadcrumb={breadcrumb} userEmail={userEmail} userId={userId} />;
});
