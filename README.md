# CogniFlow MVP

CogniFlow es un sistema cognitivo MVP para análisis funcional. Permite ingestar requisitos, detectar GAPS de calidad con un motor de reglas (Agente ACCR), iterar con el usuario hasta resolverlos y generar artefactos documentales (SRS, Matriz de Trazabilidad y Diagrama Mermaid).

## Funcionalidades

- **Autenticación demo**: login con contraseña hasheada (bcryptjs) y cookie de sesión firmada (HMAC-SHA256).
- **Creación de proyectos** con dashboard de estado.
- **Ingesta de requisitos**: carga demo o carga propia pegando JSON, validada con esquemas Zod (Agente Ingesta).
- **Detección de GAPS** (Agente ACCR, motor de reglas): completitud, claridad, ambigüedad, reglas de negocio y supuestos, con severidad CRITICAL / HIGH / MEDIUM.
- **Ciclo de refinamiento**: responder GAPS actualiza los requisitos; cada re-análisis es una nueva iteración (máximo 5, luego escala a revisión humana).
- **Bloqueo duro de artefactos**: mientras existan GAPS críticos abiertos, la generación está bloqueada en servidor (no solo en la UI).
- **Generación de artefactos** cuando no hay GAPS críticos: SRS en Markdown, Matriz de Trazabilidad y Diagrama de flujo Mermaid renderizado en el navegador.
- **Memoria básica**: insights por proyecto que se sugieren según el contexto.
- **Auditoría**: registro de todas las acciones con exportación a CSV.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Prisma ORM 7 + SQLite (driver adapter `better-sqlite3`)
- Zod, bcryptjs, React Markdown, Mermaid.js

## Cómo instalar y ejecutar

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Configurar variables de entorno: copiar `.env.example` a `.env`:

   ```bash
   cp .env.example .env
   ```

   La app funciona en modo motor de reglas sin `OPENAI_API_KEY`. Si definís `AI_PROVIDER="openai"` con una key válida, el LLM solo refina la redacción de las preguntas de los GAPS (opcional, con fallback automático a reglas ante cualquier error).

3. Inicializar la base de datos (SQLite local):

   ```bash
   npx prisma migrate dev
   ```

4. Cargar datos de prueba (usuario demo y proyecto previo):

   ```bash
   npm run db:seed
   ```

5. Ejecutar en desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000)

## Credenciales demo

- **Email:** `demo@cogniflow.app`
- **Password:** `Demo1234!`

## Flujo de demostración

1. Iniciar sesión con el usuario demo.
2. Crear un proyecto nuevo (o usar "Proyecto Demo CogniFlow" del seed).
3. Cargar requisitos: botón "Cargar Requisitos Demo" o pegando tu propio JSON en el formulario de carga.
4. Presionar "Ejecutar Análisis": el Agente ACCR detecta GAPS y crea la iteración 1.
5. Responder cada GAP: la respuesta se aplica al requisito correspondiente (criterio de aceptación, regla de negocio, descripción o supuesto).
6. Volver a ejecutar el análisis: la nueva iteración encuentra menos GAPS hasta llegar a cero críticos.
7. Sin GAPS críticos abiertos, aparece "Generar Artefactos": genera SRS, Matriz de Trazabilidad y Diagrama Mermaid (renderizado inline).
8. Revisar insights de memoria, logs de auditoría y exportarlos en CSV.

> Los datos demo incluyen requisitos deliberadamente imperfectos para mostrar el ciclo completo de detección → respuesta → convergencia.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite local |
| `AI_PROVIDER` | `rules` | `rules` (motor de reglas) u `openai` (LLM opcional) |
| `OPENAI_API_KEY` | vacía | Solo si `AI_PROVIDER=openai`; el sistema funciona sin ella |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo usado por el LLM opcional |
| `SESSION_SECRET` | vacía | Clave HMAC de las cookies de sesión. **Definila en producción** |
| `MAX_ITERATIONS` | `5` | Iteraciones máximas antes de escalar a humano |
| `MAX_FILE_SIZE_MB` | `1` | Tamaño máximo del JSON de requisitos |

## Seguridad

- Contraseñas hasheadas con bcryptjs (salt 10).
- Cookie de sesión `httpOnly`, `sameSite=lax`, `secure` en producción y **firmada con HMAC-SHA256** (`SESSION_SECRET`): no puede falsificarse un userId.
- Rutas protegidas por proxy (Next.js 16) y verificación de sesión + ownership en cada Server Action y route handler.
- El diagrama Mermaid se renderiza con `securityLevel: "strict"`.
- Sin secretos en el repositorio: `.env*` y `*.db` están gitignoreados.

## Deploy público

CogniFlow soporta dos modos de base de datos según el valor de `DATABASE_URL`:

- **SQLite local** (`file:./dev.db`, default): pensado para desarrollo y demo en máquina. En serverless el FS es efímero; la app auto-crea esquema + usuario demo en `/tmp` al primer request (modo best-effort: los datos viven por instancia de lambda y se reinician en cold starts). Sirve como demo rápida sin configurar nada más.
- **libSQL/Turso remota** (`DATABASE_URL="libsql://..."` + `LIBSQL_AUTH_TOKEN`): persistencia real, recomendada para demo pública estable. Creá una base gratis en [turso.tech](https://turso.tech), apuntá `DATABASE_URL` a `libsql://...` y definí `LIBSQL_AUTH_TOKEN`. El esquema se auto-provisiona idempotentemente al primer arranque (también podés correr `npx prisma migrate deploy`).

Pasos sugeridos para Vercel:

1. Subí el repo a GitHub e importalo en Vercel.
2. Definí las variables de entorno: `SESSION_SECRET` (obligatoria), `DATABASE_URL` + `LIBSQL_AUTH_TOKEN` si usás Turso, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GITHUB_URL`.
3. Verificá `npm run build` en verde antes de publicar.

## Licencia

Uso académico interno.
