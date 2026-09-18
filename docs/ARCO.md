# ARCO — Acceso / Rectificación / Cancelación / Oposición (Fase 6)

## Alcance

Flujo interno de **solicitudes** del titular (capturadas por el personal de la clínica):

| Tipo | Efecto |
|---|---|
| `exportacion` | Paquete JSON con datos clínicos del paciente (tenant). Descarga autenticada. |
| `eliminacion` | Anonimiza PII del paciente y **borra** datos clínicos asociados, si no hay retención vigente. |

Estados: `solicitada` → `aprobada_admin` → `ejecutada` | `rechazada`.

## Roles

| Capacidad | odontologo | auxiliar | admin |
|---|---|---|---|
| Solicitar | sí | sí | sí |
| Aprobar / rechazar / ejecutar | no | no | sí |

## Retención vs eliminación

**No se inventan plazos legales en código.**

- Si `pacientes.retencion_hasta` es **futura** → la ejecución de eliminación **falla** (retención vigente).
- Si es `null` o ya pasó → se puede ejecutar tras aprobación admin.
- `organization.retencion_historia_anios` sigue nullable hasta confirmación legal (ver `docs/CUMPLIMIENTO.md`).

## Purga y odontograma firmado

Los triggers de inmutabilidad del odontograma bloquean DELETE en visitas firmadas.  
Durante la ejecución ARCO el servidor hace `SET LOCAL app.arco_purge = 'true'` (solo en esa transacción `withTenant`) y el trigger permite el borrado.

## Fuera de alcance F6

- Portal del paciente (titular autoservicio).
- Plazos numéricos de retención inventados.
- Dexie / offline-first: ver [`docs/OFFLINE.md`](OFFLINE.md) (cola odontograma + `useOffline`).
- Rectificación masiva de campos clínicos vía este flujo (usar edición clínica normal).

## Artefactos

Export: `storage/arco/{clinicaId}/{solicitudId}.json` (+ hash en `solicitudes_arco`).
