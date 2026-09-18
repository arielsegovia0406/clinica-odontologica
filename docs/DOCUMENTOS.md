# Documentos clínicos — Fase 5

## Alcance

Generación **server-side** de un **resumen clínico tipo Formulario 033** (no facsímil oficial MSP).

Incluye:
- PDF con datos reales de la visita (paciente, clínica, motivo, signos, odontograma resumido, índices, consentimientos).
- Firma intercambiable vía `SignatureProvider` (MVP: `DrawnSignatureProvider`).
- Persistencia en `documentos_generados` (`ruta_storage`, `content_hash`).
- Al firmar: `visitas.estado = firmada` → odontograma queda inmutable (trigger F2).

## Fuera de alcance F5

- Facsímil pixel-perfect del 033 MSP.
- Certificado acreditado / firma electrónica con validez MSP (pendiente legal — ver CUMPLIMIENTO).
- Inventar códigos CIE-10 o dosis de fármacos.
- ARCO / portal titular autoservicio (Fase 6 cubre flujo interno de solicitudes).

## Almacenamiento

Archivos bajo `storage/documentos/{clinicaId}/{visitaId}/` (gitignored).  
Descarga solo con sesión + membresía activa + `withTenant` / auth de ruta.

## Firma

`tipo_firma` + `SignatureProvider`. Validez ante MSP: **no asumir** en código.
