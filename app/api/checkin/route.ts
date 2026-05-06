import { NextRequest } from "next/server";
import { appendCheckIn, getCheckIns, getClient } from "@/lib/google-sheets";
import { checkInSchema } from "@/lib/validation";
import { dateKey, nowIso } from "@/lib/date";
import { fail, ok, errorMessage } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const payload = checkInSchema.parse(await request.json());
    const client = await getClient(payload.clientId);

    if (!client || client.status === "deleted") return fail("Client not found", 404);
    if (client.status !== "active") return fail("Client is disabled", 403);

    const today = dateKey();
    const existingToday = (await getCheckIns()).find(
      (checkIn) => checkIn.clientId === client.clientId && checkIn.date === today && !checkIn.manualOverride
    );

    if (existingToday) {
      return ok("Already checked in today", { checkIn: existingToday, duplicate: true });
    }

    const checkIn = {
      clientId: client.clientId,
      name: client.name,
      timestamp: nowIso(),
      date: today,
      manualOverride: false
    };

    await appendCheckIn(checkIn);
    return ok("Check-in recorded", { checkIn, duplicate: false }, 201);
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
