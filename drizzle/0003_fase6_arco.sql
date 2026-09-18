-- Fase 6: ARCO export artifact columns
ALTER TABLE "solicitudes_arco" ADD COLUMN IF NOT EXISTS "resultado_ruta" text;
ALTER TABLE "solicitudes_arco" ADD COLUMN IF NOT EXISTS "resultado_hash" text;
