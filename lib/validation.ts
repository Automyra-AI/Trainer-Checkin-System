import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(2, "Client name is required").max(120),
  totalSessions: z.number().int().min(0).max(999).optional()
});

export const checkInSchema = z.object({
  clientId: z.string().trim().min(4, "clientId is required").max(80)
});

export const clientMutationSchema = z.object({
  clientId: z.string().trim().min(4).max(80),
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["active", "disabled", "deleted"]).optional(),
  totalSessions: z.number().int().min(0).max(999).optional(),
  remainingSessions: z.number().int().min(0).max(999).optional()
});

export const checkInTypeSchema = z.enum(["manual_session", "late_cancel", "no_show"]);
export const checkInDeleteTypeSchema = z.enum(["qr_checkin", "manual_session", "late_cancel", "no_show"]);

export const deleteCheckInSchema = z.object({
  clientId: z.string().trim().min(4).max(80),
  timestamp: z.string().datetime(),
  type: checkInDeleteTypeSchema,
  manualOverride: z.boolean()
});

export const manualEntrySchema = z.object({
  clientId: z.string().trim().min(4).max(80),
  timestamp: z.string().datetime().optional(),
  type: checkInTypeSchema.default("manual_session")
});
