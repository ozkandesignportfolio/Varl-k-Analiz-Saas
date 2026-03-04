import { DashboardPageContainer } from "@/features/dashboard/containers/dashboard-page-container";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  return <DashboardPageContainer searchParams={searchParams} />;
}
