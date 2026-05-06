import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { addClient, getClient } from "@/lib/google-sheets";
import { createClientSchema } from "@/lib/validation";
import { checkInUrl, qrPngDataUrl } from "@/lib/qr";
import { nowIso } from "@/lib/date";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = createClientSchema.parse(await request.json());
    let clientId = randomUUID().slice(0, 12);
    while (await getClient(clientId)) clientId = randomUUID().slice(0, 12);

    const qrUrl = checkInUrl(clientId);
    const client = {
      clientId,
      name: payload.name,
      qrUrl,
      status: "active" as const,
      createdAt: nowIso()
    };

    await addClient(client);
    const qrCode = await qrPngDataUrl(qrUrl);
    return ok("Client created", { client, qrCode }, 201);
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
