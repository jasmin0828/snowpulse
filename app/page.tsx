import { loadDashboardData } from "../src/lib/dashboard/data.ts";
import Dashboard from "./_components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await loadDashboardData();
  return <Dashboard data={data} />;
}
