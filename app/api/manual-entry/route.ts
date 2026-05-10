import { NextRequest } from "next/server";
import { appendCheckIn, getClient, updateClient } from "@/lib/google-sheets";
import { dateKey, nowIso } from "@/lib/date";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";
import { manualEntrySchema } from "@/lib/validation";
import { nextRemainingSessions } from "@/lib/session-balance";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = manualEntrySchema.parse(await request.json());
    const client = await getClient(payload.clientId);
    if (!client || client.status === "deleted") return fail("Client not found", 404);

    const timestamp = payload.timestamp ?? nowIso();
    const sessionsRemaining = nextRemainingSessions(client, payload.type);
    const checkIn = {
      clientId: client.clientId,
      name: client.name,
      timestamp,
      date: dateKey(new Date(timestamp)),
      manualOverride: true,
      type: payload.type,
      sessionsRemaining
    };

    await appendCheckIn(checkIn);
    await updateClient(client.clientId, { remainingSessions: sessionsRemaining });
    return ok("Manual entry recorded", { checkIn }, 201);
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
