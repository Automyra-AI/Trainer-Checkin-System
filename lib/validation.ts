import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(2, "Client name is required").max(120)
});

export const checkInSchema = z.object({
  clientId: z.string().trim().min(4, "clientId is required").max(80)
});

export const clientMutationSchema = z.object({
  clientId: z.string().trim().min(4).max(80),
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["active", "disabled", "deleted"]).optional()
});

export const manualEntrySchema = z.object({
  clientId: z.string().trim().min(4).max(80),
  timestamp: z.string().datetime().optional()
});
