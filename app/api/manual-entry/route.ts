import { NextRequest } from "next/server";
import { appendCheckIn, getClient } from "@/lib/google-sheets";
import { dateKey, nowIso } from "@/lib/date";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";
import { manualEntrySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = manualEntrySchema.parse(await request.json());
    const client = await getClient(payload.clientId);
    if (!client || client.status === "deleted") return fail("Client not found", 404);

    const timestamp = payload.timestamp ?? nowIso();
    const checkIn = {
      clientId: client.clientId,
      name: client.name,
      timestamp,
      date: dateKey(new Date(timestamp)),
      manualOverride: true
    };

    await appendCheckIn(checkIn);
    return ok("Manual entry recorded", { checkIn }, 201);
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
