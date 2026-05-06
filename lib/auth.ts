import { NextRequest } from "next/server";

export function isAdminRequest(request: NextRequest) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return true;

  const headerToken = request.headers.get("x-admin-token");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return headerToken === token || bearer === token;
}
