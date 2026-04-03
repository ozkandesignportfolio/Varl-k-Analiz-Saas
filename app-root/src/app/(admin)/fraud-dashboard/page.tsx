import { FraudDashboardPage } from "@/features/fraud-dashboard/fraud-dashboard-page";
import { requireAdminPageAccess } from "@/lib/auth/admin-access";

export const dynamic = "force-dynamic";

export default async function FraudDashboardRoute() {
  await requireAdminPageAccess();

  return <FraudDashboardPage />;
}
