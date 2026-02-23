import {
  DashboardPageContainer,
  type DashboardPageSearchParams,
} from "@/features/dashboard/containers/dashboard-page-container";

export default function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardPageSearchParams;
}) {
  return <DashboardPageContainer searchParams={searchParams} />;
}
