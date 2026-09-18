# Fase 6 — Smoke ARCO + offline

## ARCO

1. Login **odontologo** → ficha paciente → **Derechos ARCO** → Solicitar exportación.
2. Logout → login **admin@demo.local** → nav **ARCO** → Aprobar → Ejecutar exportación → Descargar JSON.
3. (Opcional) Solicitar eliminación en un paciente de prueba **sin** `retencion_hasta` futura → admin aprueba → Ejecutar eliminación → ficha queda anonimizada (`ELIMINADO, ARCO`).
4. Con `retencion_hasta` futura: la ejecución de eliminación debe fallar / botón deshabilitado.
5. Auxiliar puede solicitar; no ve el menú ARCO admin.

## Offline (Dexie)

1. Abrir odontograma con visita borrador.
2. En DevTools → Network → Offline (o desactivar Wi‑Fi).
3. Aplicar un cambio de pieza/cara → debe verse en UI y mensaje de guardado local.
4. Volver online → banner **Sincronizar** (o auto-flush) → el cambio queda en servidor (recargar ficha).

Ver [`docs/ARCO.md`](ARCO.md), [`docs/OFFLINE.md`](OFFLINE.md) y [`docs/CUMPLIMIENTO.md`](CUMPLIMIENTO.md).
