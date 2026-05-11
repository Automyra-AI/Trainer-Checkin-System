import { NextRequest } from "next/server";
import { getCheckIns, getClients } from "@/lib/google-sheets";
import { dashboardStats } from "@/lib/stats";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const [clients, checkIns] = await Promise.all([getClients(), getCheckIns()]);
    const visibleClientIds = new Set(clients.map((client) => client.clientId));
    const visibleCheckIns = checkIns.filter((checkIn) => visibleClientIds.has(checkIn.clientId));
    return ok("Dashboard loaded", {
      clients,
      checkIns: visibleCheckIns,
      stats: dashboardStats(clients, visibleCheckIns)
    });
  } catch (error) {
    return fail(errorMessage(error), 500);
  }
}
