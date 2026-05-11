import { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { fail, errorMessage } from "@/lib/api-response";
import { createClientHistoryWorkbook } from "@/lib/excel-export";
import { getCheckIns, getClients } from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const [clients, checkIns] = await Promise.all([getClients(true), getCheckIns()]);
    const workbook = createClientHistoryWorkbook(clients, checkIns);
    const filename = `client-checkin-history-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(workbook, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail(errorMessage(error), 500);
  }
}
