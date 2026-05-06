import { NextRequest } from "next/server";
import { getCheckIns, getClient } from "@/lib/google-sheets";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return fail("Missing clientId", 400);
    const client = await getClient(clientId);
    if (!client) return fail("Client not found", 404);
    const checkIns = (await getCheckIns()).filter((entry) => entry.clientId === clientId);
    return ok("Client history loaded", { client, checkIns });
  } catch (error) {
    return fail(errorMessage(error), 500);
  }
}
