import { z } from "zod";
import { validateCedula } from "./cedula";

export const tipoDocumentoSchema = z.enum(["cedula", "pasaporte"]);
export const sexoSchema = z.enum([
  "masculino",
  "femenino",
  "otro",
  "no_especificado",
]);

const numeroDocumentoSchema = z
  .string()
  .trim()
  .min(1, "Documento requerido")
  .max(32);

export const pacienteBaseSchema = z
  .object({
    tipoDocumento: tipoDocumentoSchema,
    numeroDocumento: numeroDocumentoSchema,
    nombres: z.string().trim().min(1, "Nombres requeridos").max(120),
    apellidos: z.string().trim().min(1, "Apellidos requeridos").max(120),
    fechaNacimiento: z.string().min(1, "Fecha de nacimiento requerida"),
    sexo: sexoSchema,
    direccion: z.string().trim().max(240).optional().or(z.literal("")),
    telefono: z.string().trim().max(40).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Email inválido")
      .optional()
      .or(z.literal("")),
    contactoEmergenciaNombre: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal("")),
    contactoEmergenciaTelefono: z
      .string()
      .trim()
      .max(40)
      .optional()
      .or(z.literal("")),
    numeroArchivo: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.tipoDocumento === "cedula") {
      const result = validateCedula(data.numeroDocumento);
      if (!result.ok) {
        ctx.addIssue({
          code: "custom",
          path: ["numeroDocumento"],
          message:
            result.reason === "formato"
              ? "La cédula debe tener 10 dígitos"
              : "Cédula inválida (dígito verificador)",
        });
      }
    } else if (!/^[A-Za-z0-9-]{5,32}$/.test(data.numeroDocumento)) {
      ctx.addIssue({
        code: "custom",
        path: ["numeroDocumento"],
        message: "Pasaporte: 5–32 caracteres alfanuméricos",
      });
    }

    const born = new Date(data.fechaNacimiento);
    if (Number.isNaN(born.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaNacimiento"],
        message: "Fecha inválida",
      });
    } else if (born > new Date()) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaNacimiento"],
        message: "La fecha no puede ser futura",
      });
    }
  });

export type PacienteInput = z.infer<typeof pacienteBaseSchema>;

export const pacienteCreateSchema = pacienteBaseSchema;
export const pacienteUpdateSchema = pacienteBaseSchema;

export const pacienteSearchSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
});
