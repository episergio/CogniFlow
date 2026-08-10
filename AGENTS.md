<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# CogniFlow - Reglas para el agente

## Objetivo del proyecto
CogniFlow es un MVP académico para demostrar análisis funcional asistido por IA.

El flujo principal es:
1. Usuario demo inicia sesión.
2. Crea un proyecto.
3. Carga requisitos.
4. Agente Ingesta valida requisitos.
5. Agente ACCR detecta GAPS.
6. Usuario responde GAPS.
7. Sistema reanaliza.
8. Cuando no hay GAPS críticos, genera artefactos simples.
9. Sistema guarda auditoría, iteraciones y memoria básica.

## Stack permitido
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite local
- Zod
- Mermaid
- React Markdown
- bcryptjs

## No implementar en esta etapa
No implementar:
- OCR
- PDF parsing complejo
- Word parsing complejo
- Jira
- Git integration
- bases legacy
- firma digital
- multi-tenant complejo
- vector database compleja
- fine-tuning
- notificaciones reales por email
- sistema de pagos

## Reglas de negocio críticas
1. El sistema no debe inventar requisitos.
2. Todo problema de calidad debe registrarse como GAP.
3. Los GAPS críticos bloquean la generación de artefactos.
4. Máximo 5 iteraciones.
5. Si se supera el máximo, el proyecto debe marcarse como ESCALATED.
6. Toda acción importante debe registrarse en auditoría.
7. La app debe funcionar sin OPENAI_API_KEY.
8. Si hay OPENAI_API_KEY, el uso de LLM debe ser opcional y con fallback.
9. Idioma de la interfaz: español.
10. Usar solo datos sintéticos.

## Agentes del MVP
Implementar módulos simples para:
- Agente Ingesta
- Agente ACCR
- Agente SRS
- Agente BPMN
- Agente de memoria
- Agente de auditoría

## Flujo de trabajo
Comandos:
- npm install
- npx prisma migrate dev
- npm run db:seed
- npm run dev
- npm run build

## Criterio de done
El MVP está listo si:
- El usuario demo puede loguearse.
- Puede crear un proyecto.
- Puede cargar requisitos demo.
- El sistema detecta GAPS.
- El usuario puede responder GAPS.
- El sistema puede reanalizar.
- Si no hay GAPS críticos, genera artefactos.
- La auditoría registra eventos.
- El build de producción compila sin errores.

## Prioridad
Prioridad absoluta:
1. Flujo funcional completo.
2. Build sin errores.
3. UI simple pero navegable.
4. Persistencia local.
5. Auditoría.
6. Estética avanzada.


<!-- END:nextjs-agent-rules -->
