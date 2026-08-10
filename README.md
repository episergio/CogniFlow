# CogniFlow MVP

CogniFlow es un sistema cognitivo MVP para análisis funcional. Permite ingestar requisitos, detectar GAPS de calidad, iterar con el usuario y generar artefactos documentales básicos (SRS, Diagramas de flujo).

## Funcionalidades
- **Autenticación Demo**: Sistema básico para demostración.
- **Ingesta de Requisitos**: Carga estructurada validada con esquemas.
- **Motor ACCR**: Detección de GAPs, ambigüedades e inconsistencias por reglas.
- **Generación de Artefactos**: Creación de Markdown y diagramas Mermaid automáticos si no hay GAPs críticos.
- **Auditoría y Memoria**: Logs de acciones e insights sencillos de iteraciones previas.

## Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma ORM + SQLite
- Zod, bcryptjs, React Markdown

## Cómo instalar y ejecutar

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   (La app funciona en modo básico sin OPENAI_API_KEY).

3. Inicializar Base de Datos (SQLite local):
   ```bash
   npx prisma migrate dev
   ```

4. Cargar datos de prueba (Usuario Demo y Proyectos previos):
   ```bash
   npm run db:seed
   ```

5. Ejecutar en desarrollo:
   ```bash
   npm run dev
   ```
   Abrir [http://localhost:3000](http://localhost:3000)

## Credenciales Demo
- **Email:** demo@cogniflow.app
- **Password:** Demo1234!

## Flujo de Demostración
1. Entrar a [http://localhost:3000](http://localhost:3000) e Iniciar Sesión.
2. Ir a "Nuevo Proyecto".
3. Dentro del proyecto, usar el botón "Cargar Requisitos Demo" para simular la ingesta de JSON.
4. Presionar "Ejecutar Análisis".
5. Revisar los GAPS en la sección correspondiente. Responderlos y volver a analizar si es necesario.
6. Cuando no queden GAPS críticos, hacer click en "Generar Artefactos".
7. Verificar los logs en "Auditoría" y los aprendizajes en "Memoria".

## Ciberseguridad (Riesgos Mínimos)
Para la presentación del MVP se consideran los siguientes controles:
- **Prompt Injection:** N/A (el sistema depende principalmente del motor de reglas en su configuración por defecto).
- **Exposición de API keys:** Las variables críticas se guardan en `.env` y el LLM opcional se ejecuta desde servidor.
- **Autenticación:** Las contraseñas están hasheadas en base de datos.
- **Cross-site Scripting:** React escapa el contenido por defecto, se tiene cuidado extra al renderizar Markdown.

## Licencia
Uso académico interno.
