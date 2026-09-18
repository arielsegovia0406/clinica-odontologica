# Índices epidemiológicos — fuente de verdad (Fase 3)

Cálculos implementados en `src/lib/clinical/indices.ts`. No inventar fórmulas.

## Fuentes (fiables)

| Índice | Referencia |
|---|---|
| **CPO-D / DMFT** | Klein H, Palmer CE (índice de caries permanente). Uso epidemiológico OMS (*Oral Health Surveys*). En literatura ecuatoriana: C=cariados, P=perdidos por caries, O=obturados; CPO-D = C+P+O a nivel individual. |
| **ceo-d** | Variante para dentición temporal: c=cariados, e=extracción indicada (o perdidos por caries), o=obturados. **No** contabilizar ausencias por exfoliación natural como “e”. |
| **IHOS (OHI-S)** | Greene JG, Vermillion JR. *The Simplified Oral Hygiene Index*. J Am Dent Assoc. 1964;68:7–13. DI-S + CI-S sobre 6 superficies índice. |
| **Contexto Ecuador** | Formulario MSP 033 (Historia Clínica Única de Odontología) y estudios locales que aplican CPO-D / ceo-d / IHOS. El detalle de casillas del 033 se alinea en Fase 5 (PDF). |

Pendiente de confirmación clínica local (no bloquea F3): si el establecimiento excluye terceros molares del CPO-D (práctica epidemiológica frecuente = 28 dientes). **Por defecto en código: se incluyen terceros molares si están registrados en el odontograma** (FDI 18,28,38,48); la constante `CPO_EXCLUIR_TERCEROS` permite cambiarlo.

## Mapeo desde odontograma (pieza FDI)

Un diente aporta **como máximo una** categoría (prioridad: P/e > C/c > O/o).

### Permanente → C, P, O

| Hallazgo en odontograma | Cuenta como |
|---|---|
| `estado_pieza = perdida_caries` | **P** |
| `estado_pieza = ausente` o `perdida_otra_causa` | *excluido* (no es P por caries) |
| Cara `caries`, o `extraccion_indicada`, o `endodoncia_indicada` | **C** |
| Cara `obturado`, o `corona_realizada`, o `endodoncia_realizada` | **O** (si no ya C/P) |
| Solo `sellante_*` / `sano` / sin fila | *no aporta* |

### Temporal → c, e, o

| Hallazgo | Cuenta como |
|---|---|
| `perdida_caries` o `extraccion_indicada` | **e** |
| Cara `caries` | **c** |
| Cara `obturado` / `corona_realizada` / `endodoncia_realizada` | **o** |
| `ausente` sin `perdida_caries` | *excluido* (posible exfoliación) |

## IHOS (Greene & Vermillion)

Seis dientes índice (FDI) y cara examinada:

| Pieza | Cara |
|---|---|
| 16 | vestibular |
| 11 | vestibular |
| 26 | vestibular |
| 36 | lingual |
| 31 | vestibular |
| 46 | lingual |

Si falta la pieza índice, se usa la **sustituta** del mismo sextante (convención clínica habitual documentada en la UI): p. ej. 17 por 16, 21 por 11, etc.

Puntajes por superficie:

- **Placa / detritos (0–3)** y **cálculo (0–3)** según Greene & Vermillion.
- **Gingivitis (0–1)** según casilla del esquema MSP (sí/no), no forma parte del OHI-S clásico; se promedia aparte como `ihos_gingivitis`.

Fórmulas:

- `ihos_placa` = Σ placa / n superficies registradas  
- `ihos_calculo` = Σ cálculo / n  
- `ihos_gingivitis` = Σ gingivitis / n  
- OHI-S de referencia = placa + cálculo (informativo en UI)

## Reglas de producto

1. Índices se calculan desde el odontograma **actual** de la visita borrador (y filas IHOS), nunca inventando piezas sanas.
2. El profesional puede **sobrescribir** totales (`sobrescrito_manual`) con motivo obligatorio.
3. Recalcular desde odontograma limpia el flag de sobrescritura.
4. Auxiliar / odontólogo / admin pueden editar (misma matriz que odontograma), vía `withTenant`.
