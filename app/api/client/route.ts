import { NextRequest } from "next/server";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";
import { clientMutationSchema } from "@/lib/validation";
import { updateClient } from "@/lib/google-sheets";

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = clientMutationSchema.parse(await request.json());
    const client = await updateClient(payload.clientId, {
      name: payload.name,
      status: payload.status,
      totalSessions: payload.totalSessions,
      remainingSessions: payload.remainingSessions
    });
    if (!client) return fail("Client not found", 404);
    return ok("Client updated", { client });
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return fail("Missing clientId", 400);
    const client = await updateClient(clientId, { status: "deleted" });
    if (!client) return fail("Client not found", 404);
    return ok("Client deleted", { client });
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
