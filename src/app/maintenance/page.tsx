import { Suspense } from "react";
import { MaintenancePageContainer } from "@/features/maintenance/containers/maintenance-page-container";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MaintenancePageContainer />
    </Suspense>
  );
}
