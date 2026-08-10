import { db } from "@/lib/db";
import { logAudit } from "./auditAgent";

export async function generateBPMN(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { requirements: true }
  });

  if (!project) throw new Error("Proyecto no encontrado");

  // Flowchart simple de alto nivel simulando BPMN
  const bpmnContent = `
graph TD
  A((Inicio)) --> B[Carga de requisitos]
  B --> C{Agente Ingesta: Validación}
  C -- Válidos --> D[Agente ACCR: Detección de GAPS]
  C -- Inválidos --> B
  D --> E{¿Existen GAPS Críticos?}
  E -- Sí --> F[Usuario responde GAPS]
  F --> D
  E -- No --> G[Agente SRS & BPMN]
  G --> H((Fin))
`;

  const artifact = await db.artifact.create({
    data: {
      projectId,
      type: "BPMN",
      title: "Diagrama de Flujo (Mermaid)",
      content: bpmnContent.trim(),
      format: "mermaid"
    }
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED" }
  });

  await logAudit({
    projectId, userId, agent: "BPMNAgent", action: "Generación BPMN",
    details: `Generado artefacto BPMN (${artifact.id})`
  });

  return artifact;
}
