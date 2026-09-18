-- Fase 2: trazabilidad odontograma + tramos + inmutabilidad DB + write gate por rol

ALTER TABLE "odontogramas"
  ADD COLUMN IF NOT EXISTS "capturado_por" text
    REFERENCES "user"("id");
--> statement-breakpoint
ALTER TABLE "odontogramas"
  ADD COLUMN IF NOT EXISTS "responsable_id" text
    REFERENCES "member"("id");
--> statement-breakpoint
ALTER TABLE "odontograma_protesis"
  ADD COLUMN IF NOT EXISTS "piezas_ordenadas" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "odontograma_protesis"
  ADD COLUMN IF NOT EXISTS "estado" text;
