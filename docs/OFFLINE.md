# Offline / Dexie — Fase 6 (endurecimiento)

## Alcance

Cola local en **IndexedDB (Dexie)** para no perder ediciones del odontograma si cae la red en el sillón.

| Pieza | Rol |
|---|---|
| `dexie` | Persistencia local (`mutations`, `drafts`) |
| `next.config` `experimental.useOffline` | Detección + reintento de navegación/Server Actions |
| Banner | Muestra “Sin conexión” y pendientes; botón **Sincronizar** |

## Flujo

1. El odontólogo aplica un cambio en el odontograma.
2. Si el Server Action falla por red (o `navigator.onLine === false`), se aplica el cambio **en UI** y se encola en Dexie.
3. Al recuperar red, el banner o el botón flush ejecuta la cola FIFO vía las mismas actions `withTenant`.

## Límites

- Solo `odontograma_transition` en esta entrega (no dictado/firma/ARCO offline).
- La verdad clínica sigue en Postgres; Dexie es cola de salida, no réplica completa.
- Conflictos (visita firmada mientras estaba offline) marcan la mutación como `failed` con el error del servidor.

## Archivos

- `src/lib/offline/*`
- `src/components/offline/offline-banner.tsx`
