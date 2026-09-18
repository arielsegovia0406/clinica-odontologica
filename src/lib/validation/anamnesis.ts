import { z } from "zod";

export const anamnesisCreateSchema = z.object({
  pacienteId: z.string().min(1),
  antecedentesPersonales: z.string().trim().max(4000).optional().or(z.literal("")),
  antecedentesFamiliares: z.string().trim().max(4000).optional().or(z.literal("")),
  alergias: z.string().trim().max(4000).optional().or(z.literal("")),
  medicacionActual: z.string().trim().max(4000).optional().or(z.literal("")),
  embarazoLactancia: z.string().trim().max(4000).optional().or(z.literal("")),
  habitos: z.string().trim().max(4000).optional().or(z.literal("")),
});

export type AnamnesisCreateInput = z.infer<typeof anamnesisCreateSchema>;
