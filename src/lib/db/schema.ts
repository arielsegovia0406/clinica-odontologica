import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Enums ---

export const rolMembresiaEnum = pgEnum("rol_membresia", [
  "odontologo",
  "auxiliar",
  "admin",
]);

export const estadoMembresiaEnum = pgEnum("estado_membresia", [
  "activa",
  "suspendida",
  "revocada",
]);

export const tipoDocumentoIdEnum = pgEnum("tipo_documento_id", [
  "cedula",
  "pasaporte",
]);

export const sexoEnum = pgEnum("sexo", [
  "masculino",
  "femenino",
  "otro",
  "no_especificado",
]);

export const tipoConsentimientoEnum = pgEnum("tipo_consentimiento", [
  "tratamiento_datos",
  "grabacion_audio",
]);

export const metodoConsentimientoEnum = pgEnum("metodo_consentimiento", [
  "firma_pantalla",
  "checkbox_explicito",
  "papel_digitalizado",
]);

export const estadoVisitaEnum = pgEnum("estado_visita", ["borrador", "firmada"]);

export const tipoDenticionEnum = pgEnum("tipo_denticion", [
  "permanente",
  "temporal",
  "mixta",
]);

export const caraDentalEnum = pgEnum("cara_dental", [
  "vestibular",
  "lingual",
  "palatino",
  "mesial",
  "distal",
  "oclusal",
  "incisal",
]);

export const estadoCaraEnum = pgEnum("estado_cara", [
  "caries",
  "obturado",
  "sellante_necesario",
  "sellante_realizado",
]);

export const estadoPiezaEnum = pgEnum("estado_pieza", [
  "sano",
  "extraccion_indicada",
  "perdida_caries",
  "perdida_otra_causa",
  "ausente",
  "endodoncia_indicada",
  "endodoncia_realizada",
  "corona_indicada",
  "corona_realizada",
]);

export const tipoProtesisEnum = pgEnum("tipo_protesis", [
  "fija",
  "removible",
  "total",
]);

export const gradoMovilidadEnum = pgEnum("grado_movilidad", ["1", "2", "3"]);
export const gradoRecesionEnum = pgEnum("grado_recesion", ["1", "2", "3"]);

export const certezaDiagnosticoEnum = pgEnum("certeza_diagnostico", [
  "presuntivo",
  "definitivo",
]);

export const estadoPlanItemEnum = pgEnum("estado_plan_item", [
  "propuesto",
  "aceptado",
  "ejecutado",
]);

export const severidadHallazgoEnum = pgEnum("severidad_hallazgo", [
  "sin_hallazgo",
  "leve",
  "moderada",
  "severa",
]);

export const maloclusionAngleEnum = pgEnum("maloclusion_angle", [
  "sin_hallazgo",
  "clase_i",
  "clase_ii",
  "clase_iii",
]);

export const tipoDocumentoGeneradoEnum = pgEnum("tipo_documento_generado", [
  "form_033",
  "consentimiento",
  "receta",
  "indicaciones_postop",
  "plan_presupuesto",
  "interconsulta",
]);

/** MSP validity of drawn vs accredited e-signature is TBD — keep provider-agnostic. */
export const tipoFirmaEnum = pgEnum("tipo_firma", [
  "dibujada",
  "electronica_simple",
  "certificado_acreditado",
]);

export const estadoSolicitudArcoEnum = pgEnum("estado_solicitud_arco", [
  "solicitada",
  "aprobada_admin",
  "rechazada",
  "ejecutada",
]);

export const tipoSolicitudArcoEnum = pgEnum("tipo_solicitud_arco", [
  "exportacion",
  "eliminacion",
]);

// --- Better Auth core (text ids) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** argon2id hash for inactivity unlock; null until the user sets a PIN */
  pinHash: text("pin_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** UI hint only — never trust for RLS authorization */
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tenant = clínica. Extra columns feed Formulario 033 headers. */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  metadata: text("metadata"),
  razonSocial: text("razon_social"),
  ruc: text("ruc"),
  codigoEstablecimiento: text("codigo_establecimiento"),
  direccion: text("direccion"),
  telefono: text("telefono"),
  canton: text("canton"),
  provincia: text("provincia"),
  retenerAudio: boolean("retener_audio").notNull().default(false),
  inactividadMinutos: integer("inactividad_minutos").notNull().default(5),
  /** Legal retention years TBD with counsel — nullable until confirmed */
  retencionHistoriaAnios: integer("retencion_historia_anios"),
});

/** Membership = role per clínica (not on user). */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    estado: estadoMembresiaEnum("estado").notNull().default("activa"),
    registroProfesionalClinica: text("registro_profesional_clinica"),
    firmaTipo: tipoFirmaEnum("firma_tipo").default("dibujada"),
    firmaReferenciaCertificado: text("firma_referencia_certificado"),
    firmaImagenPath: text("firma_imagen_path"),
  },
  (t) => [
    uniqueIndex("member_org_user_uidx").on(t.organizationId, t.userId),
    index("member_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Clinical domain (all tenant-scoped via clinica_id) ---

export const pacientes = pgTable(
  "pacientes",
  {
    id: text("id").primaryKey(),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    tipoDocumento: tipoDocumentoIdEnum("tipo_documento").notNull(),
    numeroDocumento: text("numero_documento").notNull(),
    nombres: text("nombres").notNull(),
    apellidos: text("apellidos").notNull(),
    fechaNacimiento: timestamp("fecha_nacimiento", { withTimezone: true }).notNull(),
    sexo: sexoEnum("sexo").notNull(),
    direccion: text("direccion"),
    telefono: text("telefono"),
    email: text("email"),
    contactoEmergenciaNombre: text("contacto_emergencia_nombre"),
    contactoEmergenciaTelefono: text("contacto_emergencia_telefono"),
    numeroArchivo: text("numero_archivo"),
    /** Legal hold end; deletion blocked while in the future (rule confirmed in F6) */
    retencionHasta: timestamp("retencion_hasta", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id),
  },
  (t) => [
    uniqueIndex("pacientes_doc_uidx").on(
      t.clinicaId,
      t.tipoDocumento,
      t.numeroDocumento,
    ),
    index("pacientes_clinica_idx").on(t.clinicaId),
  ],
);

export const consentimientos = pgTable(
  "consentimientos",
  {
    id: text("id").primaryKey(),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    pacienteId: text("paciente_id")
      .notNull()
      .references(() => pacientes.id),
    tipo: tipoConsentimientoEnum("tipo").notNull(),
    versionTexto: text("version_texto").notNull(),
    textoHash: text("texto_hash").notNull(),
    aceptadoEn: timestamp("aceptado_en", { withTimezone: true }).notNull().defaultNow(),
    metodo: metodoConsentimientoEnum("metodo").notNull(),
    capturadoPor: text("capturado_por").references(() => user.id),
    ip: text("ip"),
    revocadoEn: timestamp("revocado_en", { withTimezone: true }),
  },
  (t) => [index("consentimientos_paciente_idx").on(t.pacienteId, t.tipo)],
);

export const anamnesis = pgTable(
  "anamnesis",
  {
    id: text("id").primaryKey(),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    pacienteId: text("paciente_id")
      .notNull()
      .references(() => pacientes.id),
    version: integer("version").notNull(),
    antecedentesPersonales: text("antecedentes_personales"),
    antecedentesFamiliares: text("antecedentes_familiares"),
    alergias: text("alergias"),
    medicacionActual: text("medicacion_actual"),
    embarazoLactancia: text("embarazo_lactancia"),
    habitos: text("habitos"),
    registradoPor: text("registrado_por").references(() => user.id),
    registradoEn: timestamp("registrado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("anamnesis_version_uidx").on(t.pacienteId, t.version),
  ],
);

export const visitas = pgTable(
  "visitas",
  {
    id: text("id").primaryKey(),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    pacienteId: text("paciente_id")
      .notNull()
      .references(() => pacientes.id),
    profesionalMembresiaId: text("profesional_membresia_id")
      .notNull()
      .references(() => member.id),
    motivoConsulta: text("motivo_consulta"),
    enfermedadActual: text("enfermedad_actual"),
    signosVitales: jsonb("signos_vitales").$type<{
      presionArterial?: string;
      frecuenciaCardiaca?: number;
      frecuenciaRespiratoria?: number;
      temperatura?: number;
      saturacionO2?: number;
    }>(),
    estado: estadoVisitaEnum("estado").notNull().default("borrador"),
    denticionForzada: tipoDenticionEnum("denticion_forzada"),
    firmadaEn: timestamp("firmada_en", { withTimezone: true }),
    firmaTipo: tipoFirmaEnum("firma_tipo"),
    firmaReferencia: text("firma_referencia"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visitas_paciente_idx").on(t.pacienteId)],
);

export const visitaAdendas = pgTable("visita_adendas", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  motivo: text("motivo").notNull(),
  contenido: text("contenido").notNull(),
  autorMembresiaId: text("autor_membresia_id")
    .notNull()
    .references(() => member.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const odontogramas = pgTable("odontogramas", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id)
    .unique(),
  denticion: tipoDenticionEnum("denticion").notNull(),
  /** Who typed/transcribed findings (often auxiliar). */
  capturadoPor: text("capturado_por").references(() => user.id),
  /** Membership of the clinically responsible dentist (future signer). */
  responsableId: text("responsable_id").references(() => member.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  inmutable: boolean("inmutable").notNull().default(false),
});

export const odontogramaDientes = pgTable(
  "odontograma_dientes",
  {
    id: text("id").primaryKey(),
    odontogramaId: text("odontograma_id")
      .notNull()
      .references(() => odontogramas.id, { onDelete: "cascade" }),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    piezaFdi: smallint("pieza_fdi").notNull(),
    /** Whole-tooth states; face-level pathology lives in odontograma_caras */
    estadoPieza: estadoPiezaEnum("estado_pieza"),
    endodonciaIndicada: boolean("endodoncia_indicada").notNull().default(false),
    endodonciaRealizada: boolean("endodoncia_realizada").notNull().default(false),
    coronaIndicada: boolean("corona_indicada").notNull().default(false),
    coronaRealizada: boolean("corona_realizada").notNull().default(false),
    movilidad: gradoMovilidadEnum("movilidad"),
    recesion: gradoRecesionEnum("recesion"),
    notas: text("notas"),
  },
  (t) => [
    uniqueIndex("odontograma_pieza_uidx").on(t.odontogramaId, t.piezaFdi),
  ],
);

export const odontogramaCaras = pgTable(
  "odontograma_caras",
  {
    id: text("id").primaryKey(),
    dienteId: text("diente_id")
      .notNull()
      .references(() => odontogramaDientes.id, { onDelete: "cascade" }),
    clinicaId: text("clinica_id")
      .notNull()
      .references(() => organization.id),
    cara: caraDentalEnum("cara").notNull(),
    estado: estadoCaraEnum("estado").notNull(),
  },
  (t) => [uniqueIndex("odontograma_cara_uidx").on(t.dienteId, t.cara)],
);

export const odontogramaProtesis = pgTable("odontograma_protesis", {
  id: text("id").primaryKey(),
  odontogramaId: text("odontograma_id")
    .notNull()
    .references(() => odontogramas.id, { onDelete: "cascade" }),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  tipo: tipoProtesisEnum("tipo").notNull(),
  /** Ordered contiguous FDI span (source of truth for tramos). */
  piezasOrdenadas: jsonb("piezas_ordenadas").$type<number[]>().notNull().default([]),
  piezaDesde: smallint("pieza_desde").notNull(),
  piezaHasta: smallint("pieza_hasta").notNull(),
  estado: text("estado"),
});

export const indicadoresSaludBucal = pgTable("indicadores_salud_bucal", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id)
    .unique(),
  piezasExaminadas: jsonb("piezas_examinadas")
    .$type<
      Array<{
        principal: number;
        usada: number;
        placa: 0 | 1 | 2 | 3;
        calculo: 0 | 1 | 2 | 3;
        gingivitis: 0 | 1;
      }>
    >()
    .notNull()
    .default([]),
  enfermedadPeriodontal: severidadHallazgoEnum("enfermedad_periodontal")
    .notNull()
    .default("sin_hallazgo"),
  maloclusion: maloclusionAngleEnum("maloclusion")
    .notNull()
    .default("sin_hallazgo"),
  fluorosis: severidadHallazgoEnum("fluorosis")
    .notNull()
    .default("sin_hallazgo"),
});

export const indices = pgTable("indices", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id)
    .unique(),
  c: integer("c").notNull().default(0),
  p: integer("p").notNull().default(0),
  o: integer("o").notNull().default(0),
  cpoD: integer("cpo_d").notNull().default(0),
  cTemporal: integer("c_temporal").notNull().default(0),
  eTemporal: integer("e_temporal").notNull().default(0),
  oTemporal: integer("o_temporal").notNull().default(0),
  ceoD: integer("ceo_d").notNull().default(0),
  ihosPlaca: numeric("ihos_placa", { precision: 4, scale: 2 }),
  ihosCalculo: numeric("ihos_calculo", { precision: 4, scale: 2 }),
  ihosGingivitis: numeric("ihos_gingivitis", { precision: 4, scale: 2 }),
  sobrescritoManual: boolean("sobrescrito_manual").notNull().default(false),
  sobrescritoPor: text("sobrescrito_por").references(() => user.id),
  sobrescritoEn: timestamp("sobrescrito_en", { withTimezone: true }),
  motivoSobrescritura: text("motivo_sobrescritura"),
});

export const diagnosticos = pgTable("diagnosticos", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  descripcion: text("descripcion").notNull(),
  /** Empty catalog in F0 — never invent CIE-10 codes */
  cie10: text("cie10"),
  certeza: certezaDiagnosticoEnum("certeza").notNull().default("presuntivo"),
  sugeridoPorIa: boolean("sugerido_por_ia").notNull().default(false),
  confirmado: boolean("confirmado").notNull().default(false),
});

export const planTratamiento = pgTable("plan_tratamiento", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const planItems = pgTable("plan_items", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  planId: text("plan_id")
    .notNull()
    .references(() => planTratamiento.id, { onDelete: "cascade" }),
  procedimiento: text("procedimiento").notNull(),
  piezaFdi: smallint("pieza_fdi"),
  superficie: text("superficie"),
  costo: numeric("costo", { precision: 12, scale: 2 }),
  estado: estadoPlanItemEnum("estado").notNull().default("propuesto"),
  sesion: integer("sesion"),
});

export const plantillasPrescripcion = pgTable("plantillas_prescripcion", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  nombre: text("nombre").notNull(),
  farmaco: text("farmaco").notNull(),
  dosis: text("dosis"),
  via: text("via"),
  frecuencia: text("frecuencia"),
  duracion: text("duracion"),
  activo: boolean("activo").notNull().default(true),
});

export const prescripciones = pgTable("prescripciones", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  plantillaId: text("plantilla_id").references(() => plantillasPrescripcion.id),
  farmaco: text("farmaco").notNull(),
  dosis: text("dosis"),
  via: text("via"),
  frecuencia: text("frecuencia"),
  duracion: text("duracion"),
});

export const documentosGenerados = pgTable("documentos_generados", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  tipo: tipoDocumentoGeneradoEnum("tipo").notNull(),
  rutaStorage: text("ruta_storage").notNull(),
  contentHash: text("content_hash").notNull(),
  generadoEn: timestamp("generado_en", { withTimezone: true }).notNull().defaultNow(),
  generadoPor: text("generado_por").references(() => user.id),
});

export const sesionesDictado = pgTable("sesiones_dictado", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  visitaId: text("visita_id")
    .notNull()
    .references(() => visitas.id),
  transcripcion: text("transcripcion"),
  prompt: text("prompt"),
  respuestaRaw: text("respuesta_raw"),
  modeloStt: text("modelo_stt"),
  modeloLlm: text("modelo_llm"),
  latenciaMs: integer("latencia_ms"),
  camposAceptadosCorregidos: jsonb("campos_aceptados_corregidos"),
  audioRetenido: boolean("audio_retenido").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only: app_user gets INSERT+SELECT only; trigger blocks UPDATE/DELETE. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    clinicaId: text("clinica_id").references(() => organization.id),
    actorUserId: text("actor_user_id").references(() => user.id),
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id"),
    valorAnterior: jsonb("valor_anterior"),
    valorNuevo: jsonb("valor_nuevo"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_clinica_idx").on(t.clinicaId, t.createdAt)],
);

export const solicitudesArco = pgTable("solicitudes_arco", {
  id: text("id").primaryKey(),
  clinicaId: text("clinica_id")
    .notNull()
    .references(() => organization.id),
  pacienteId: text("paciente_id")
    .notNull()
    .references(() => pacientes.id),
  tipo: tipoSolicitudArcoEnum("tipo").notNull(),
  estado: estadoSolicitudArcoEnum("estado").notNull().default("solicitada"),
  solicitadoEn: timestamp("solicitado_en", { withTimezone: true }).notNull().defaultNow(),
  aprobadoPor: text("aprobado_por").references(() => user.id),
  ejecutadoEn: timestamp("ejecutado_en", { withTimezone: true }),
  nota: text("nota"),
  /** Relative path under storage/arco for export packages (Fase 6). */
  resultadoRuta: text("resultado_ruta"),
  resultadoHash: text("resultado_hash"),
});

// Relations (optional helpers for queries)
export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  pacientes: many(pacientes),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  members: many(member),
  sessions: many(session),
}));
