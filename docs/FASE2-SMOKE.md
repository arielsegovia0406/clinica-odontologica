# Fase 2 — Smoke odontograma

1. Reinicia DB si hace falta: `npm run db:push` (añade `capturado_por`, `responsable_id`, tramos, triggers).
2. Login odontólogo → paciente con consentimiento de datos → **Odontograma**.
3. Ver rejilla vacía (no examinado ≠ sano) y dentición sugerida por edad (override manual).
4. Marcar cara/pieza; **Deshacer** revierte el último cambio.
5. Si hay visita previa con odontograma: capa fantasma abajo → seleccionar pieza → **Promover**.
6. Añadir tramo `14 15 16` tipo fija; quitar.
7. Login auxiliar: puede editar odontograma; sigue sin ver anamnesis completa.
8. (Opcional SQL) `UPDATE visitas SET estado='firmada' WHERE id=...` → mutaciones odontograma deben fallar con `odontograma_locked`.

Reglas: [`docs/ODONTOGRAMA.md`](ODONTOGRAMA.md).
