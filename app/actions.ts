"use server";

import { loadDashboardData } from "../src/lib/dashboard/data.ts";
import type { DashboardData } from "../src/lib/dashboard/types.ts";

export async function scanAvalancheL1s(): Promise<DashboardData> {
  return loadDashboardData();
}
