import { NextRequest } from "next/server";
import { appendCheckIn, deleteCheckIn, getClient, updateClient } from "@/lib/google-sheets";
import { checkInSchema, deleteCheckInSchema } from "@/lib/validation";
import { dateKey, nowIso } from "@/lib/date";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";
import { nextRemainingSessions } from "@/lib/session-balance";

export async function POST(request: NextRequest) {
  try {
    const payload = checkInSchema.parse(await request.json());
    const client = await getClient(payload.clientId);

    if (!client || client.status === "deleted") return fail("Client not found", 404);
    if (client.status !== "active") return fail("Client is disabled", 403);

    const today = dateKey();
    const type = "qr_checkin" as const;
    const sessionsRemaining = nextRemainingSessions(client, type);
    const checkIn = {
      clientId: client.clientId,
      name: client.name,
      timestamp: nowIso(),
      date: today,
      manualOverride: false,
      type,
      sessionsRemaining
    };

    await appendCheckIn(checkIn);
    await updateClient(client.clientId, { remainingSessions: sessionsRemaining });
    return ok("Check-in recorded", { checkIn, duplicate: false }, 201);
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = deleteCheckInSchema.parse(await request.json());
    const checkIn = await deleteCheckIn(payload);
    if (!checkIn) return fail("Check-in not found", 404);
    return ok("Check-in deleted", { checkIn });
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
