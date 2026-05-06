import { NextRequest } from "next/server";
import { getClient } from "@/lib/google-sheets";
import { qrPngDataUrl } from "@/lib/qr";
import { checkInSchema } from "@/lib/validation";
import { fail, ok, errorMessage } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return fail("Unauthorized", 401);

  try {
    const payload = checkInSchema.parse(await request.json());
    const client = await getClient(payload.clientId);
    if (!client || client.status === "deleted") return fail("Client not found", 404);
    const qrCode = await qrPngDataUrl(client.qrUrl);
    return ok("QR generated", { qrCode, qrUrl: client.qrUrl });
  } catch (error) {
    return fail(errorMessage(error), 400);
  }
}
