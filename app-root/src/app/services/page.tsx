import { Suspense } from "react";
import { ServicesPageContainer } from "@/features/services/containers/services-page-container";

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesPageContainer />
    </Suspense>
  );
}
