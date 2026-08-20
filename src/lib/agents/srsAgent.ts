import { db } from "@/lib/db";
import { logAudit } from "./auditAgent";

export async function generateSRS(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: true,
      gaps: {
        where: { status: "RESOLVED" },
        include: { requirement: true }
      }
    }
  });

  if (!project) throw new Error("Proyecto no encontrado");

  const rf = project.requirements.filter(r => r.type === "RF" || r.type === "HU");
  const rnf = project.requirements.filter(r => r.type === "RNF");
  const rn = project.requirements.filter(r => r.type === "RN");
  const sup = project.requirements.filter(r => r.type === "SUP");

  const srsContent = `
# Software Requirements Specification (SRS)
## Proyecto: ${project.name}
**Cliente:** ${project.client || "N/A"}
**Fecha de generación:** ${new Date().toLocaleDateString()}

---

## 1. Resumen
Este documento describe los requisitos del sistema para el proyecto **${project.name}**.

## 2. Requisitos Funcionales
${rf.map(r => `- **[${r.externalId}] ${r.name}**: ${r.description}
  - *Criterios de aceptación:* ${r.acceptanceCriteria || "N/A"}`).join("\n")}

## 3. Requisitos No Funcionales
${rnf.map(r => `- **[${r.externalId}] ${r.name}**: ${r.description}`).join("\n")}

## 4. Reglas de Negocio
${rn.map(r => `- **[${r.externalId}] ${r.name}**: ${r.description}
  - *Regla:* ${r.businessRule || "N/A"}`).join("\n")}

## 5. Supuestos
${sup.map(r => `- **[${r.externalId}] ${r.name}**: ${r.description}
  - *Estado:* ${r.assumptions || "N/A"}`).join("\n")}

## 6. GAPs Resueltos (Trazabilidad)
${project.gaps.map(g => `- **${g.code}** (Req: ${g.requirement?.externalId || "N/A"}): ${g.description}
  - *Respuesta:* ${g.response}`).join("\n")}

> Ver también el artefacto **Matriz de Trazabilidad** asociado a este proyecto.
`;

  const artifact = await db.artifact.create({
    data: {
      projectId,
      type: "SRS",
      title: "Software Requirements Specification",
      content: srsContent.trim(),
      format: "markdown"
    }
  });

  await logAudit({
    projectId, userId, agent: "SRSAgent", action: "Generación SRS",
    details: `Generado artefacto SRS (${artifact.id})`
  });

  return artifact;
}

export async function generateTraceability(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: { orderBy: { externalId: "asc" } },
      gaps: { include: { requirement: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) throw new Error("Proyecto no encontrado");

  const clean = (text: string | null) =>
    (text || "-").replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();

  const rows: string[] = [];
  for (const req of project.requirements) {
    const reqGaps = project.gaps.filter(g => g.requirementId === req.id);
    if (reqGaps.length === 0) {
      rows.push(`| ${req.externalId} | ${clean(req.name)} | - | - | - | Sin GAPS |`);
      continue;
    }
    for (const g of reqGaps) {
      rows.push(
        `| ${req.externalId} | ${clean(req.name)} | ${g.code} (${g.severity}) | ${clean(g.question)} | ${clean(g.response || "Sin responder")} | ${g.status === "RESOLVED" ? "Resuelto" : "Abierto"} |`
      );
    }
  }

  const content = `# Matriz de Trazabilidad
## Proyecto: ${project.name}
**Fecha de generación:** ${new Date().toLocaleDateString()}

Trazabilidad entre requisitos, GAPS detectados por el Agente ACCR y sus respuestas.

| Requisito | Nombre | GAP | Pregunta | Respuesta | Estado |
|---|---|---|---|---|---|
${rows.join("\n")}
`.trim();

  const artifact = await db.artifact.create({
    data: {
      projectId,
      type: "TRACEABILITY",
      title: "Matriz de Trazabilidad",
      content,
      format: "markdown",
    },
  });

  await logAudit({
    projectId,
    userId,
    agent: "SRSAgent",
    action: "Generación Matriz de Trazabilidad",
    details: `Generado artefacto TRACEABILITY (${artifact.id}) con ${rows.length} filas.`,
  });

  return artifact;
}
