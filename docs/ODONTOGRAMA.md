# Odontograma — fuente de verdad clínica (Fase 2+)

El PRD remite a este documento para reglas del odontograma. No inventar estados fuera de aquí.

## 1. Modelo

- Un **odontograma** por `visita` (`visita_id` único).
- Campos de trazabilidad (F2 esquema; UI diferenciada en F4+):
  - `capturado_por` — quien digitó/transcribió (p. ej. auxiliar).
  - `responsable_id` — membresía del profesional responsable clínico (firma futura).
- Pieza (`odontograma_dientes`) vs cara (`odontograma_caras`) vs **tramo/prótesis** (entidad aparte, no bandera por diente).
- Visita nueva: odontograma **vacío**. La visita anterior se muestra como **capa fantasma** de solo lectura; promover pieza = copiar ese diente al registro actual con un toque. No copiar en silencio (equivale a registrar “sano” sin examen).

## 2. Dentición y FDI

| Dentición | Piezas FDI válidas |
|---|---|
| permanente | 11–18, 21–28, 31–38, 41–48 |
| temporal | 51–55, 61–65, 71–75, 81–85 |
| mixta | unión de permanente + temporal |

**Automática por edad** (heurística de producto, override manual siempre permitido):

| Edad (años cumplidos) | Dentición sugerida |
|---|---|
| &lt; 6 | temporal |
| 6–12 inclusive | mixta |
| &gt; 12 | permanente |

Override: `visitas.denticion_forzada` y/o `odontogramas.denticion`.

## 3. Estados por cara

Valores: `caries` | `obturado` | `sellante_necesario` | `sellante_realizado`.

Caras: `vestibular` | `lingual` | `palatino` | `mesial` | `distal` | `oclusal` | `incisal`.

## 4. Estados por pieza

Valores de `estado_pieza`: `sano` | `extraccion_indicada` | `perdida_caries` | `perdida_otra_causa` | `ausente` | `endodoncia_indicada` | `endodoncia_realizada` | `corona_indicada` | `corona_realizada`.

Flags booleanos `endodoncia_*` / `corona_*` en la fila del diente **deben coincidir** con el `estado_pieza` correspondiente (fuente de verdad = `estado_pieza`; los flags se sincronizan al persistir).

**Ausencia de fila = no examinado.** `sano` solo si el profesional lo registra explícitamente.

## 5. Movilidad y recesión

Escala configurable en `src/lib/clinical/odontograma-config.ts` (hoy 1–3, candidato formulario MSP 2008).  
**Pendiente legal/clínico:** confirmar si rige 2008 (1–3) o revisión 2021 (1–4). Cambiar la escala = editar la constante + migración de enum PG si hace falta el valor `4`.

## 6. Reglas de validación (§6)

Aplicadas en `src/lib/clinical/odontograma.ts` (puro) y revalidadas en servidor antes de persistir.

1. **FDI ∈ dentición activa.** Rechazar pieza fuera del conjunto de la dentición del odontograma.
2. **No examinado ≠ sano.** No crear filas “sano” por defecto al abrir visita.
3. **Pieza ausente / pérdida / extracción indicada:** no admite caras clínicas; al pasar a estos estados se eliminan caras existentes de esa pieza.
4. **Cara única por (diente, cara).** Upsert; un solo estado de cara a la vez.
5. **Arcada y cara:**
   - Superior (FDI 1x, 2x, 5x, 6x): `palatino` permitido; `lingual` no.
   - Inferior (FDI 3x, 4x, 7x, 8x): `lingual` permitido; `palatino` no.
6. **Oclusal vs incisal:**
   - Incisivos y caninos (permanente `*1,*2,*3`; temporal `*1,*2,*3`): `incisal` sí, `oclusal` no.
   - Premolares/molares (resto): `oclusal` sí, `incisal` no.
7. **Sellantes** solo en caras oclusales de piezas posteriores (premolar/molar).
8. **Movilidad / recesión** solo en piezas presentes (no ausente/pérdida). Grado ∈ escala configurada.
9. **Inmutabilidad:** si `odontogramas.inmutable = true` **o** `visitas.estado = 'firmada'`, toda mutación de odontograma/dientes/caras/tramos es **rechazada en base de datos** (trigger). Las adendas post-firma usan `visita_adendas` (UI en fase posterior).
10. **Promoción desde fantasma:** copia exactamente el estado de la pieza (y caras) de la instantánea previa; no inventa piezas no presentes en la referencia.
11. **Deshacer:** cada mutación de UI es una transición reversible; “deshacer a un toque” revierte la última transición aplicada en la sesión de edición (pila LIFO en cliente, revalidada al servidor).
12. **Autorización (dos capas):** membresía activa con rol `odontologo` | `auxiliar` | `admin` en servidor **y** política RLS / WITH CHECK en Postgres. `admin` puede editar por membresía, pero la responsabilidad clínica futura se registra en `responsable_id` (membresía odontólogo).

## 7. Tramos / prótesis

Entidad aparte (`odontograma_tramos` / extensión de prótesis): `tipo` (`fija` | `removible` | `total`), `piezas_ordenadas[]` contiguas en el mismo arco, estado del tramo.  
No modelar como atributo de una sola pieza. Se implementa **después** de pieza+cara estables.

## 8. Principio de IA (PRD §8, vinculante en F4)

La IA propone; el odontólogo dispone. **Prohibido** rellenar piezas no mencionadas como sanas — mismo anti-patrón que la copia silenciosa entre visitas.
