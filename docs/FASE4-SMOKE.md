# Fase 4 — Smoke dictado

1. Login odontólogo/auxiliar → paciente con **tratamiento_datos** + **grabacion_audio**.
2. Iniciar atención (visita borrador).
3. Ficha → **Dictado** (o botón Dictado en signos vitales).
4. Escribir o dictar: `Caries en 16 oclusal y 26 obturado`.
5. **Extraer propuestas** → revisar checkboxes → **Aplicar seleccionados**.
6. Abrir odontograma y verificar piezas 16/26.
7. Confirmar que piezas no mencionadas siguen sin marcarse como sanas.

Opcional STT cloud: `OPENAI_API_KEY` o `STT_API_KEY` en `.env`.

Fuentes/reglas: [`docs/DICTADO.md`](DICTADO.md).
