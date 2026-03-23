"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa/register-sw";
import { PlanProvider } from "@/contexts/PlanContext";
import { isProtectedAppPath } from "@/lib/supabase/protected-routes";

const shouldEnablePlanProvider = (pathname: string | null) => {
  if (!pathname) return false;
  return isProtectedAppPath(pathname);
};

const shouldEnablePwaRegister = (pathname: string | null) => {
  if (!pathname) return false;
  return isProtectedAppPath(pathname);
};

export function ClientProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shouldWrapWithPlanProvider = shouldEnablePlanProvider(pathname);
  const shouldRegisterPwa = shouldEnablePwaRegister(pathname);
  const content = shouldWrapWithPlanProvider ? <PlanProvider>{children}</PlanProvider> : children;

  return (
    <>
      {shouldRegisterPwa ? <PwaRegister /> : null}
      {content}
    </>
  );
}
