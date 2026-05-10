import type { CheckInType, Client } from "./types";

const SESSION_DEBIT_TYPES = new Set<CheckInType>(["qr_checkin", "manual_session", "late_cancel"]);

export function consumesSession(type: CheckInType) {
  return SESSION_DEBIT_TYPES.has(type);
}

export function nextRemainingSessions(client: Client, type: CheckInType) {
  if (!consumesSession(type)) return client.remainingSessions;
  return Math.max(client.remainingSessions - 1, 0);
}
