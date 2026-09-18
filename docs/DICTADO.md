# Dictado clínico — Fase 4

## Principio (PRD)

**La IA propone, el odontólogo dispone.**  
Sin diagnósticos autónomos definitivos; sin dosis; **sin** marcar piezas no mencionadas como sanas.

## Consentimiento

- Requiere `grabacion_audio` vigente (`canEnableDictado`).
- Audio **efímero** por defecto (`organization.retener_audio` / `sesiones_dictado.audio_retenido` = false).
- Textos de consentimiento: provisionales en `src/lib/consent/texts.ts` (revisión legal pendiente).

## Arquitectura

```
Micrófono / texto → TranscriptionProvider (opcional)
                 → ClinicalExtractor (reglas o LLM)
                 → Zod ClinicalExtraction
                 → UI de revisión (aceptar / corregir / rechazar)
                 → solo hallazgos aceptados → Transition → odontograma (withTenant)
                 → sesiones_dictado + audit_log
```

Interfaces en `src/lib/ai/*`. La UI **nunca** llama SDKs de STT/LLM.

## Proveedores

| Modo | Cuándo |
|---|---|
| `rule-based` extractor | Por defecto (sin API). Parsea frases clínicas explícitas en español. |
| `openai` STT/LLM | Si `OPENAI_API_KEY` (u `LLM_API_KEY` / `STT_API_KEY`) está definida. |
| Texto / Web Speech | El profesional puede dictar en el navegador o pegar texto; el servidor extrae. |

## Mapper hallazgos → odontograma

`src/lib/clinical/dictado-mapper.ts`:

- Cara + estado de cara → `set_cara`
- Estado de pieza → `set_estado_pieza`
- Comando `borrar_pieza` → `clear_pieza`
- Estado desconocido → rechazado (no se aplica)
- Piezas no mencionadas → **intocadas**

## Persistencia

Tabla `sesiones_dictado`: transcripción, prompt, respuesta cruda, modelos, latencia, `campos_aceptados_corregidos`, `audio_retenido=false`.
