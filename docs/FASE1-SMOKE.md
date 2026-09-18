# Fase 1 — Smoke manual (criterio de aceptación)

Usuarios seed: password `Demo1234!`, PIN `1234`.
Clínica Norte id: `org_clinica_norte`.

## Flujo odontólogo

1. Login `odontologo@demo.local` → seleccionar Clínica Norte.
2. Ir a **Pacientes** → **Nuevo paciente**.
3. Crear con cédula válida (p. ej. `1713175071` u otra con checksum OK), nombres, apellidos, fecha, sexo.
4. En la ficha, registrar consentimiento **tratamiento de datos** (checkbox + método).
5. Registrar consentimiento **grabación de audio** por separado.
6. Verificar que el botón **Dictado** queda habilitado solo tras audio; sin audio permanece deshabilitado.
7. Guardar anamnesis (v1); editar y guardar de nuevo → aparece **v2** en historial (no overwrite).
8. **Iniciar atención** (crea visita `borrador` si no existe) y guardar signos vitales.
9. Confirmar en UI: demografía, consentimientos con versión/timestamp/método, historial anamnesis.

## Flujo auxiliar (mínimo privilegio)

1. Logout / login `auxiliar@demo.local` → Clínica Norte.
2. Abrir el mismo paciente.
3. Verificar: listado/ficha demográfica OK; consentimientos y signos vitales disponibles.
4. Sección anamnesis: solo indicador hay/no hay versiones — **sin campos clínicos ni historial**.
5. Intentar no debe existir formulario de anamnesis; si se fuerza la action, responde Forbidden.

## Multi-tenant

- Con `multi@demo.local` en Clínica Sur no debe verse el paciente de Norte (RLS + `withTenant`).

## Tests automatizados

```bash
npm test
```

Incluye `tests/unit/fase1-clinical-rules.test.ts` (versionado, permisos auxiliar, consentimientos, cédula).
