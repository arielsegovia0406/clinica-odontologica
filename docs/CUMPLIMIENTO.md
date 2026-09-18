# Cumplimiento — LOPDP / datos de salud (Ecuador)

Matriz viva: cada requisito del PRD §10 y su estado de implementación.
Actualizar esta tabla en cada fase.

| Requisito | Estado | Dónde |
|---|---|---|
| Consentimiento explícito datos personales | F1 UI + audit | `consentimientos.tipo = tratamiento_datos`; textos provisionales en `src/lib/consent/texts.ts`; UI ficha paciente |
| Consentimiento separado grabación de audio | F1 UI + F4 dictado | `grabacion_audio`; dictado en `/dictado` gated por consentimiento vigente |
| Audio efímero (retención off por defecto) | F0+F4 | `organization.retener_audio` default `false`; sesiones sin blob de audio |
| Cifrado en tránsito | Parcial F0 | TLS en staging/prod; dev local sin TLS |
| Cifrado en reposo | Infra | Volumen Docker / disco del host; en cloud: storage cifrado del proveedor |
| Control de acceso por rol (mínimo privilegio) | F1–F6 app-layer | `src/lib/clinical/permissions.ts`; auxiliar sin anamnesis; `arco_admin` solo admin |
| Auditoría inmutable | F0 + writes F1–F6 | `audit_log` en create/update clínico, firma 033 y solicitudes ARCO |
| Aislamiento multi-tenant (RLS) | F0 | `FORCE ROW LEVEL SECURITY` + `withTenant` + tests en `tests/isolation` |
| Exportación ARCO | F6 | `solicitudes_arco` + JSON en `storage/arco/`; UI ficha + `/arco` admin; `docs/ARCO.md` |
| Eliminación ARCO | F6 | Aprobación admin + bloqueo si `retencion_hasta` futura; anonimiza PII + purga clínica; `app.arco_purge` |
| Notificación de brecha (5 días) | Documentado | Este archivo, sección Procedimiento de brecha |
| `retencion_hasta` | Esquema F0 + gate F6 | `pacientes.retencion_hasta`; `organization.retencion_historia_anios` nullable |

## Textos de consentimiento (Fase 1)

Los textos en `src/lib/consent/texts.ts` son **provisionales** (versión + SHA-256).
**Pendiente revisión legal** antes de producción. No constituyen asesoría LOPDP.

## Validación de cédula (Fase 1)

`src/lib/validation/cedula.ts`: formato 10 dígitos + dígito verificador módulo 10 (persona natural).
**Pendiente:** confirmar con registro civil / abogado códigos de provincia especiales y personas jurídicas.

## Tensión: retención legal vs. derecho de eliminación (ARCO)

La historia clínica tiene **plazos legales de conservación** que pueden prevalecer sobre una solicitud de borrado del titular.

**En este código (Fase 6):**

- Modelamos `retencion_hasta` y dejamos `retencion_historia_anios` nullable hasta confirmación legal.
- El borrado **no** es automático: requiere solicitud en `solicitudes_arco`, **aprobación de administrador**, y queda rastro en `audit_log`.
- Si `retencion_hasta` es futura, la ejecución de eliminación **falla** (no se inventan años de retención en código).
- La regla concreta de plazos la confirmará un abogado. No inventar plazos numéricos.

## Procedimiento de notificación de brecha

Plazo legal de referencia: **5 días** (LOPDP Ecuador — verificar texto vigente al aplicar).

1. Contener el incidente (revocar sesiones, rotar secretos, aislar sistemas).
2. Documentar: qué datos, cuántos afectados, cuándo, vector probable.
3. Notificar a la autoridad competente y a titulares según obligación legal vigente.
4. Registrar acciones en `audit_log` y en un postmortem interno (carpeta `docs/incidentes/` cuando ocurra).
5. Revisar controles (RLS, accesos, retención de audio).

Contacto interno de seguridad: _por definir por la clínica operadora_.

## Firma electrónica del 033

Existe diferencia legal entre firma dibujada en pantalla y firma con certificado acreditado.
El modelo usa `tipo_firma` + `SignatureProvider` intercambiable.
**Validez ante el MSP: pendiente de confirmación legal — no asumir en código.**
