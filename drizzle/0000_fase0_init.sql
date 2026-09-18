CREATE TYPE "public"."cara_dental" AS ENUM('vestibular', 'lingual', 'palatino', 'mesial', 'distal', 'oclusal', 'incisal');--> statement-breakpoint
CREATE TYPE "public"."certeza_diagnostico" AS ENUM('presuntivo', 'definitivo');--> statement-breakpoint
CREATE TYPE "public"."estado_cara" AS ENUM('caries', 'obturado', 'sellante_necesario', 'sellante_realizado');--> statement-breakpoint
CREATE TYPE "public"."estado_membresia" AS ENUM('activa', 'suspendida', 'revocada');--> statement-breakpoint
CREATE TYPE "public"."estado_pieza" AS ENUM('sano', 'extraccion_indicada', 'perdida_caries', 'perdida_otra_causa', 'ausente', 'endodoncia_indicada', 'endodoncia_realizada', 'corona_indicada', 'corona_realizada');--> statement-breakpoint
CREATE TYPE "public"."estado_plan_item" AS ENUM('propuesto', 'aceptado', 'ejecutado');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud_arco" AS ENUM('solicitada', 'aprobada_admin', 'rechazada', 'ejecutada');--> statement-breakpoint
CREATE TYPE "public"."estado_visita" AS ENUM('borrador', 'firmada');--> statement-breakpoint
CREATE TYPE "public"."grado_movilidad" AS ENUM('1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."grado_recesion" AS ENUM('1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."maloclusion_angle" AS ENUM('sin_hallazgo', 'clase_i', 'clase_ii', 'clase_iii');--> statement-breakpoint
CREATE TYPE "public"."metodo_consentimiento" AS ENUM('firma_pantalla', 'checkbox_explicito', 'papel_digitalizado');--> statement-breakpoint
CREATE TYPE "public"."rol_membresia" AS ENUM('odontologo', 'auxiliar', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severidad_hallazgo" AS ENUM('sin_hallazgo', 'leve', 'moderada', 'severa');--> statement-breakpoint
CREATE TYPE "public"."sexo" AS ENUM('masculino', 'femenino', 'otro', 'no_especificado');--> statement-breakpoint
CREATE TYPE "public"."tipo_consentimiento" AS ENUM('tratamiento_datos', 'grabacion_audio');--> statement-breakpoint
CREATE TYPE "public"."tipo_denticion" AS ENUM('permanente', 'temporal', 'mixta');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento_generado" AS ENUM('form_033', 'consentimiento', 'receta', 'indicaciones_postop', 'plan_presupuesto', 'interconsulta');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento_id" AS ENUM('cedula', 'pasaporte');--> statement-breakpoint
CREATE TYPE "public"."tipo_firma" AS ENUM('dibujada', 'electronica_simple', 'certificado_acreditado');--> statement-breakpoint
CREATE TYPE "public"."tipo_protesis" AS ENUM('fija', 'removible', 'total');--> statement-breakpoint
CREATE TYPE "public"."tipo_solicitud_arco" AS ENUM('exportacion', 'eliminacion');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anamnesis" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"version" integer NOT NULL,
	"antecedentes_personales" text,
	"antecedentes_familiares" text,
	"alergias" text,
	"medicacion_actual" text,
	"embarazo_lactancia" text,
	"habitos" text,
	"registrado_por" text,
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text,
	"actor_user_id" text,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"valor_anterior" jsonb,
	"valor_nuevo" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consentimientos" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"tipo" "tipo_consentimiento" NOT NULL,
	"version_texto" text NOT NULL,
	"texto_hash" text NOT NULL,
	"aceptado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"metodo" "metodo_consentimiento" NOT NULL,
	"capturado_por" text,
	"ip" text,
	"revocado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diagnosticos" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"descripcion" text NOT NULL,
	"cie10" text,
	"certeza" "certeza_diagnostico" DEFAULT 'presuntivo' NOT NULL,
	"sugerido_por_ia" boolean DEFAULT false NOT NULL,
	"confirmado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_generados" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"tipo" "tipo_documento_generado" NOT NULL,
	"ruta_storage" text NOT NULL,
	"content_hash" text NOT NULL,
	"generado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"generado_por" text
);
--> statement-breakpoint
CREATE TABLE "indicadores_salud_bucal" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"piezas_examinadas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enfermedad_periodontal" "severidad_hallazgo" DEFAULT 'sin_hallazgo' NOT NULL,
	"maloclusion" "maloclusion_angle" DEFAULT 'sin_hallazgo' NOT NULL,
	"fluorosis" "severidad_hallazgo" DEFAULT 'sin_hallazgo' NOT NULL,
	CONSTRAINT "indicadores_salud_bucal_visita_id_unique" UNIQUE("visita_id")
);
--> statement-breakpoint
CREATE TABLE "indices" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"c" integer DEFAULT 0 NOT NULL,
	"p" integer DEFAULT 0 NOT NULL,
	"o" integer DEFAULT 0 NOT NULL,
	"cpo_d" integer DEFAULT 0 NOT NULL,
	"c_temporal" integer DEFAULT 0 NOT NULL,
	"e_temporal" integer DEFAULT 0 NOT NULL,
	"o_temporal" integer DEFAULT 0 NOT NULL,
	"ceo_d" integer DEFAULT 0 NOT NULL,
	"ihos_placa" numeric(4, 2),
	"ihos_calculo" numeric(4, 2),
	"ihos_gingivitis" numeric(4, 2),
	"sobrescrito_manual" boolean DEFAULT false NOT NULL,
	"sobrescrito_por" text,
	"sobrescrito_en" timestamp with time zone,
	"motivo_sobrescritura" text,
	CONSTRAINT "indices_visita_id_unique" UNIQUE("visita_id")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estado" "estado_membresia" DEFAULT 'activa' NOT NULL,
	"registro_profesional_clinica" text,
	"firma_tipo" "tipo_firma" DEFAULT 'dibujada',
	"firma_referencia_certificado" text,
	"firma_imagen_path" text
);
--> statement-breakpoint
CREATE TABLE "odontograma_caras" (
	"id" text PRIMARY KEY NOT NULL,
	"diente_id" text NOT NULL,
	"clinica_id" text NOT NULL,
	"cara" "cara_dental" NOT NULL,
	"estado" "estado_cara" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontograma_dientes" (
	"id" text PRIMARY KEY NOT NULL,
	"odontograma_id" text NOT NULL,
	"clinica_id" text NOT NULL,
	"pieza_fdi" smallint NOT NULL,
	"estado_pieza" "estado_pieza",
	"endodoncia_indicada" boolean DEFAULT false NOT NULL,
	"endodoncia_realizada" boolean DEFAULT false NOT NULL,
	"corona_indicada" boolean DEFAULT false NOT NULL,
	"corona_realizada" boolean DEFAULT false NOT NULL,
	"movilidad" "grado_movilidad",
	"recesion" "grado_recesion",
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "odontograma_protesis" (
	"id" text PRIMARY KEY NOT NULL,
	"odontograma_id" text NOT NULL,
	"clinica_id" text NOT NULL,
	"tipo" "tipo_protesis" NOT NULL,
	"pieza_desde" smallint NOT NULL,
	"pieza_hasta" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontogramas" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"denticion" "tipo_denticion" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"inmutable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "odontogramas_visita_id_unique" UNIQUE("visita_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"metadata" text,
	"razon_social" text,
	"ruc" text,
	"codigo_establecimiento" text,
	"direccion" text,
	"telefono" text,
	"canton" text,
	"provincia" text,
	"retener_audio" boolean DEFAULT false NOT NULL,
	"inactividad_minutos" integer DEFAULT 5 NOT NULL,
	"retencion_historia_anios" integer,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"tipo_documento" "tipo_documento_id" NOT NULL,
	"numero_documento" text NOT NULL,
	"nombres" text NOT NULL,
	"apellidos" text NOT NULL,
	"fecha_nacimiento" timestamp with time zone NOT NULL,
	"sexo" "sexo" NOT NULL,
	"direccion" text,
	"telefono" text,
	"email" text,
	"contacto_emergencia_nombre" text,
	"contacto_emergencia_telefono" text,
	"numero_archivo" text,
	"retencion_hasta" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"procedimiento" text NOT NULL,
	"pieza_fdi" smallint,
	"superficie" text,
	"costo" numeric(12, 2),
	"estado" "estado_plan_item" DEFAULT 'propuesto' NOT NULL,
	"sesion" integer
);
--> statement-breakpoint
CREATE TABLE "plan_tratamiento" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas_prescripcion" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"nombre" text NOT NULL,
	"farmaco" text NOT NULL,
	"dosis" text,
	"via" text,
	"frecuencia" text,
	"duracion" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescripciones" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"plantilla_id" text,
	"farmaco" text NOT NULL,
	"dosis" text,
	"via" text,
	"frecuencia" text,
	"duracion" text
);
--> statement-breakpoint
CREATE TABLE "sesiones_dictado" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"transcripcion" text,
	"prompt" text,
	"respuesta_raw" text,
	"modelo_stt" text,
	"modelo_llm" text,
	"latencia_ms" integer,
	"campos_aceptados_corregidos" jsonb,
	"audio_retenido" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "solicitudes_arco" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"tipo" "tipo_solicitud_arco" NOT NULL,
	"estado" "estado_solicitud_arco" DEFAULT 'solicitada' NOT NULL,
	"solicitado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"aprobado_por" text,
	"ejecutado_en" timestamp with time zone,
	"nota" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visita_adendas" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"visita_id" text NOT NULL,
	"motivo" text NOT NULL,
	"contenido" text NOT NULL,
	"autor_membresia_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" text PRIMARY KEY NOT NULL,
	"clinica_id" text NOT NULL,
	"paciente_id" text NOT NULL,
	"profesional_membresia_id" text NOT NULL,
	"motivo_consulta" text,
	"enfermedad_actual" text,
	"signos_vitales" jsonb,
	"estado" "estado_visita" DEFAULT 'borrador' NOT NULL,
	"denticion_forzada" "tipo_denticion",
	"firmada_en" timestamp with time zone,
	"firma_tipo" "tipo_firma",
	"firma_referencia" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_registrado_por_user_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_capturado_por_user_id_fk" FOREIGN KEY ("capturado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosticos" ADD CONSTRAINT "diagnosticos_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_generados" ADD CONSTRAINT "documentos_generados_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_generados" ADD CONSTRAINT "documentos_generados_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_generados" ADD CONSTRAINT "documentos_generados_generado_por_user_id_fk" FOREIGN KEY ("generado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicadores_salud_bucal" ADD CONSTRAINT "indicadores_salud_bucal_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicadores_salud_bucal" ADD CONSTRAINT "indicadores_salud_bucal_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_sobrescrito_por_user_id_fk" FOREIGN KEY ("sobrescrito_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_caras" ADD CONSTRAINT "odontograma_caras_diente_id_odontograma_dientes_id_fk" FOREIGN KEY ("diente_id") REFERENCES "public"."odontograma_dientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_caras" ADD CONSTRAINT "odontograma_caras_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_dientes" ADD CONSTRAINT "odontograma_dientes_odontograma_id_odontogramas_id_fk" FOREIGN KEY ("odontograma_id") REFERENCES "public"."odontogramas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_dientes" ADD CONSTRAINT "odontograma_dientes_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_protesis" ADD CONSTRAINT "odontograma_protesis_odontograma_id_odontogramas_id_fk" FOREIGN KEY ("odontograma_id") REFERENCES "public"."odontogramas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma_protesis" ADD CONSTRAINT "odontograma_protesis_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_plan_tratamiento_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_tratamiento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tratamiento" ADD CONSTRAINT "plan_tratamiento_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tratamiento" ADD CONSTRAINT "plan_tratamiento_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas_prescripcion" ADD CONSTRAINT "plantillas_prescripcion_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescripciones" ADD CONSTRAINT "prescripciones_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescripciones" ADD CONSTRAINT "prescripciones_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescripciones" ADD CONSTRAINT "prescripciones_plantilla_id_plantillas_prescripcion_id_fk" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plantillas_prescripcion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_dictado" ADD CONSTRAINT "sesiones_dictado_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones_dictado" ADD CONSTRAINT "sesiones_dictado_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_arco" ADD CONSTRAINT "solicitudes_arco_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_arco" ADD CONSTRAINT "solicitudes_arco_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_arco" ADD CONSTRAINT "solicitudes_arco_aprobado_por_user_id_fk" FOREIGN KEY ("aprobado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_adendas" ADD CONSTRAINT "visita_adendas_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_adendas" ADD CONSTRAINT "visita_adendas_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visita_adendas" ADD CONSTRAINT "visita_adendas_autor_membresia_id_member_id_fk" FOREIGN KEY ("autor_membresia_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_clinica_id_organization_id_fk" FOREIGN KEY ("clinica_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_profesional_membresia_id_member_id_fk" FOREIGN KEY ("profesional_membresia_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anamnesis_version_uidx" ON "anamnesis" USING btree ("paciente_id","version");--> statement-breakpoint
CREATE INDEX "audit_log_clinica_idx" ON "audit_log" USING btree ("clinica_id","created_at");--> statement-breakpoint
CREATE INDEX "consentimientos_paciente_idx" ON "consentimientos" USING btree ("paciente_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uidx" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "odontograma_cara_uidx" ON "odontograma_caras" USING btree ("diente_id","cara");--> statement-breakpoint
CREATE UNIQUE INDEX "odontograma_pieza_uidx" ON "odontograma_dientes" USING btree ("odontograma_id","pieza_fdi");--> statement-breakpoint
CREATE UNIQUE INDEX "pacientes_doc_uidx" ON "pacientes" USING btree ("clinica_id","tipo_documento","numero_documento");--> statement-breakpoint
CREATE INDEX "pacientes_clinica_idx" ON "pacientes" USING btree ("clinica_id");--> statement-breakpoint
CREATE INDEX "visitas_paciente_idx" ON "visitas" USING btree ("paciente_id");