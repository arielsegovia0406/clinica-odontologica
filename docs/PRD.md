# PRD — Copiloto de Historia Clínica Odontológica

Especificación del producto. Las secciones 1–11 son requisitos; la 12 el plan por fases; la 13 reglas de trabajo del agente.

## Correcciones respecto al borrador inicial (vinculantes)

1. **El rol no vive en `usuarios`.** Un odontólogo puede trabajar en varias clínicas. Modelo: usuario global + `member(organizationId, userId, role, estado)`. El `clinica_id` de RLS se resuelve verificando membresía activa en servidor, nunca desde un claim del token como fuente de verdad.
2. **Firma:** proveedor intercambiable (`tipo_firma`: dibujada | electronica_simple | certificado_acreditado). Validez MSP del 033 electrónico pendiente de consulta legal.
3. **Retención vs ARCO:** documentar tensión en `docs/CUMPLIMIENTO.md`; campo `retencion_hasta`; borrado solo con aprobación admin + auditoría. Plazos legales confirmados con abogado antes de Fase 6.

## Stack (obligatorio)

Next.js App Router + TypeScript estricto · Tailwind + shadcn/ui · PostgreSQL · Drizzle · Zod · React Hook Form · Better Auth (sesiones DB) · STT/LLM tras interfaces · PDFs server-side · Dexie offline (F6) · Vitest + Playwright.

## Auth / multi-tenant (Fase 0)

- Better Auth ^1.7 + argon2id
- Docker Postgres 16: roles `migrator` / `app_user`, `FORCE ROW LEVEL SECURITY`
- `withTenant`: única vía clínica; `SET LOCAL` solo en transacción explícita
- Bloqueo por inactividad + PIN (no destruye borrador)

## Fases

0 Fundaciones → 1 Pacientes/anamnesis → 2 Odontograma → 3 Índices → 4 Dictado → 5 Documentos → 6 Endurecimiento

Ejecutar **una fase a la vez**; aprobación explícita entre fases.

## Fuera de alcance MVP

Agenda, facturación SRI, IA sobre radiografías, portal paciente, integraciones de terceros, app nativa.

## Principio de IA

La IA propone, el odontólogo dispone. Sin diagnósticos autónomos definitivos; sin dosis inventadas; sin rellenar piezas no mencionadas como “sanas”.

---

El detalle clínico del odontograma está en [`docs/ODONTOGRAMA.md`](ODONTOGRAMA.md); índices CPO-D / ceo-d / IHOS en [`docs/INDICES.md`](INDICES.md).
