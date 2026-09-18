# Copiloto de Historia Clínica Odontológica

Aplicación web para **clínicas odontológicas en Ecuador**: captura la atención en el sillón (dictado por voz, odontograma FDI, índices CPO/ceo/IHOS) y genera un **resumen clínico tipo Formulario 033**, con multi-clínica, roles y cumplimiento LOPDP (consentimientos, auditoría, ARCO).

> La IA **propone**; el odontólogo **dispone**. No inventa diagnósticos definitivos, dosis ni piezas “sanas” no mencionadas.

## ¿Para qué sirve?

| Necesidad | Qué hace el sistema |
|---|---|
| Historia en el sillón | Pacientes, consentimientos, anamnesis versionada, signos vitales |
| Odontograma | Rejilla FDI, caras, tramos/prótesis, capa fantasma de visita previa, undo |
| Índices | CPO-D, ceo-d, IHOS (Greene & Vermillion) desde el odontograma |
| **Asistente de voz / dictado** | Micrófono o texto → extracción clínica → revisión → aplica solo lo aceptado al odontograma |
| Documentos | PDF resumen tipo 033 + firma dibujada (stub intercambiable) |
| Cumplimiento | Consentimientos, audit log, exportación/eliminación ARCO (admin), retención |
| Offline | Cola Dexie si cae la red al editar odontograma |

### Asistente de voz (dictado clínico)

1. Requiere consentimiento vigente de **grabación de audio**.
2. El profesional dicta por **micrófono del navegador** (Web Speech) o pega texto.
3. El servidor extrae hallazgos (por defecto **reglas en español**; opcionalmente Whisper/OpenAI si hay API key).
4. La UI muestra propuestas: **aceptar / corregir / rechazar**.
5. Solo lo aceptado se escribe en el odontograma (vía `withTenant` + auditoría).
6. El audio **no se retiene** por defecto.

Detalle: [`docs/DICTADO.md`](docs/DICTADO.md).

## Stack

Next.js (App Router) · TypeScript · Tailwind · PostgreSQL · Drizzle · Better Auth · Zod · React Hook Form · PDFKit · Dexie · Vitest / Playwright

## Requisitos

- Node.js **20+**
- npm
- **Docker Desktop** (Postgres 16) — recomendado — o Postgres 16 local

## Arranque local (desarrollo)

### Opción A — Docker (preferida)

```bash
cp .env.example .env
npm install
npm run db:up
node scripts/wait-for-pg.mjs
npm run db:push
npm run db:seed
npm run dev
```

Abre http://localhost:3000/login

**Tablet / otro PC en la misma Wi‑Fi:** el servidor escucha en `0.0.0.0`. Usa la IP de este equipo:

`http://192.168.x.x:3000/login`

Si el login falla por host, en `.env`:

`AUTH_ALLOWED_HOSTS=192.168.x.x:3000`

### Opción B — Postgres local (sin Docker)

```bash
cp .env.example .env
# Windows (PowerShell), con superusuario local:
$env:POSTGRES_SUPERUSER_URL="postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/postgres"
node scripts/bootstrap-db.mjs
npm run db:push
npm run db:seed
npm run dev
```

### Usuarios demo

Password: `Demo1234!` · PIN de desbloqueo: `1234`

| Email | Rol | Clínicas |
|---|---|---|
| odontologo@demo.local | odontologo | Norte |
| auxiliar@demo.local | auxiliar | Norte |
| admin@demo.local | admin | Norte |
| multi@demo.local | odontologo | Norte y Sur |

### Dictado con IA opcional

Sin claves API funciona el extractor **rule-based** + voz/texto del navegador.

Para Whisper / LLM (opcional), en `.env`:

```env
OPENAI_API_KEY=sk-...
# o STT_API_KEY=...
# STT_MODEL=whisper-1
```

## Cómo desplegarlo

### 1. Variables de entorno (producción)

Copia `.env.example` y define al menos:

| Variable | Uso |
|---|---|
| `BETTER_AUTH_SECRET` | Secreto ≥ 32 caracteres |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | URL pública HTTPS (p. ej. `https://tu-dominio.com`) |
| `AUTH_ALLOWED_HOSTS` | Hosts extra si hace falta |
| `DATABASE_URL` | Postgres **migrator** (migraciones / seed) |
| `DATABASE_APP_URL` | Postgres **app_user** (runtime; no dueño de tablas) |
| `OPENAI_API_KEY` | Opcional — STT/LLM para dictado |

**Nunca** subas `.env` al repositorio (ya está en `.gitignore`).

### 2. Base de datos

1. Provisiona PostgreSQL 16.
2. Crea roles equivalentes a `docker/postgres/init/01-roles.sql` (`migrator`, `app_user`).
3. En el servidor de build/deploy:

```bash
npm ci
npm run db:push    # esquema + RLS
npm run db:seed    # solo entornos demo; en prod crea usuarios reales
npm run build
npm run start      # escucha 0.0.0.0:3000
```

### 3. Opciones de hosting

| Escenario | Enfoque típico |
|---|---|
| Clínica en LAN | PC/servidor local + `npm run start` + IP `192.168.x.x` (sin IP pública) |
| Internet | VPS (Docker Compose app + Postgres) o PaaS con Postgres gestionado + volumen para `storage/` |
| HTTPS | Obligatorio en prod (reverse proxy Nginx/Caddy o TLS del PaaS) |

Almacenamiento de PDFs/ARCO: carpeta `storage/` (gitignored). En cloud, monta un volumen persistente o object storage adaptando `src/lib/documents/storage.ts` / `src/lib/arco/storage.ts`.

### 4. Checklist post-despliegue

- [ ] Login con usuario real (no solo demo)
- [ ] Consentimientos de datos y audio
- [ ] Dictado → revisión → odontograma
- [ ] Firmar visita → descargar PDF 033
- [ ] Admin: solicitud ARCO exportación
- [ ] Firewall: solo puertos necesarios (443); Postgres no expuesto a Internet

## Scripts útiles

| Script | Qué hace |
|---|---|
| `npm run dev` | Desarrollo en `0.0.0.0:3000` |
| `npm run build` / `start` | Producción |
| `db:up` / `db:down` | Postgres Docker |
| `db:push` | Esquema Drizzle + RLS |
| `db:seed` | Datos demo |
| `db:reset` | Volumen limpio + push + seed |
| `test` | Vitest |
| `test:e2e` | Playwright smoke login |

## Arquitectura (resumen)

- **Better Auth** sesiones en DB + organizaciones (clínicas).
- Rol en **membresía** (`member`), no en `user`.
- Acceso clínico solo vía **`withTenant`** + **RLS** (`FORCE ROW LEVEL SECURITY`).
- Password / PIN: **argon2id**.
- Bloqueo por inactividad (PIN); no destruye el borrador.
- STT / LLM / firma: interfaces en `src/lib/ai` y `src/lib/signatures`.

## Documentación

| Doc | Tema |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Producto y fases |
| [`docs/ODONTOGRAMA.md`](docs/ODONTOGRAMA.md) | Odontograma FDI |
| [`docs/INDICES.md`](docs/INDICES.md) | CPO / ceo / IHOS |
| [`docs/DICTADO.md`](docs/DICTADO.md) | Asistente de voz |
| [`docs/DOCUMENTOS.md`](docs/DOCUMENTOS.md) | PDF 033 |
| [`docs/ARCO.md`](docs/ARCO.md) | Derechos ARCO |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Dexie offline |
| [`docs/CUMPLIMIENTO.md`](docs/CUMPLIMIENTO.md) | LOPDP / salud |
| `docs/FASE1-SMOKE.md` … `FASE6-SMOKE.md` | Pruebas manuales |

## Licencia / aviso

Textos de consentimiento y validez de firma electrónica ante el MSP son **provisionales** — requieren revisión legal antes de producción. Ver [`docs/CUMPLIMIENTO.md`](docs/CUMPLIMIENTO.md).
