import { z } from "zod";

const optionalNumber = (min: number, max: number) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? n : val;
  }, z.number().min(min).max(max).optional());

export const signosVitalesSchema = z.object({
  presionArterial: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v == null ? undefined : v)),
  frecuenciaCardiaca: optionalNumber(20, 250),
  frecuenciaRespiratoria: optionalNumber(5, 80),
  temperatura: optionalNumber(30, 45),
  saturacionO2: optionalNumber(50, 100),
});

export type SignosVitalesInput = z.infer<typeof signosVitalesSchema>;

export const visitaSignosSchema = z.object({
  pacienteId: z.string().min(1),
  signosVitales: signosVitalesSchema,
});
