import { db } from "@/lib/db";
import { logAudit } from "./auditAgent";

const AMBIGUOUS_WORDS = [
  "apropiado", "rápido", "eficiente", "correcto", 
  "normal", "adecuado", "debería", "posiblemente", "eventualmente"
];

export async function runACCRAgent(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: true,
      iterations: true,
      gaps: {
        where: { status: "OPEN" }
      }
    }
  });

  if (!project) throw new Error("Proyecto no encontrado");

  // Verificar iteraciones (máximo 5)
  if (project.iterations.length >= 5) {
    await db.project.update({
      where: { id: projectId },
      data: { status: "ESCALATED" }
    });
    await logAudit({
      projectId, userId, agent: "ACCRAgent", action: "Límite de iteraciones",
      details: "Se alcanzó el límite máximo de iteraciones (5)."
    });
    return { success: false, escalated: true, error: "Máximo de 5 iteraciones alcanzado." };
  }

  // Crear iteración
  const iterationNumber = project.iterations.length + 1;
  const iteration = await db.iteration.create({
    data: {
      projectId,
      number: iterationNumber,
      status: "RUNNING"
    }
  });

  let gapCount = 0;
  let criticalGapCount = 0;

  for (const req of project.requirements) {
    // 1. Falta acceptanceCriteria
    if ((req.type === "RF" || req.type === "HU") && (!req.acceptanceCriteria || req.acceptanceCriteria.trim() === "")) {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "COMPLETITUD", "CRITICAL", 
        "Falta criterio de aceptación.",
        "¿Cuáles son los criterios de aceptación medibles para este requisito?");
      gapCount++; criticalGapCount++;
    }

    // 2. Falta businessRule cuando type es RN
    if (req.type === "RN" && (!req.businessRule || req.businessRule.trim() === "")) {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "REGLA_NEGOCIO", "CRITICAL",
        "Regla de negocio sin lógica especificada.",
        "¿Cuál es la lógica o condición específica de esta regla de negocio?");
      gapCount++; criticalGapCount++;
    }

    // 3. Descripción menor a 30 caracteres
    if (req.description && req.description.length < 30) {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "COMPLETITUD", "MEDIUM",
        "Descripción demasiado corta.",
        "¿Podrías proporcionar más detalles en la descripción del requisito?");
      gapCount++;
    }

    // 4. Palabras ambiguas
    const lowerDesc = req.description?.toLowerCase() || "";
    const foundWords = AMBIGUOUS_WORDS.filter(w => lowerDesc.includes(w));
    if (foundWords.length > 0) {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "AMBIGUEDAD", "HIGH",
        `Se encontraron palabras ambiguas: ${foundWords.join(", ")}`,
        "¿Podrías cuantificar o definir de forma exacta las palabras ambiguas mencionadas?");
      gapCount++;
    }

    // 5. Regla de negocio sin escenario negativo (heuristic basic)
    if (req.type === "RN" && req.businessRule && !req.businessRule.toLowerCase().includes("error") && !req.businessRule.toLowerCase().includes("inválido")) {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "REGLA_NEGOCIO", "MEDIUM",
        "Regla de negocio sin escenario negativo aparente.",
        "¿Qué debería hacer el sistema si no se cumple la condición principal?");
      gapCount++;
    }

    // 6. Supuesto con estado PENDIENTE
    if (req.type === "SUP" && req.assumptions === "PENDIENTE") {
      await createGap(projectId, iteration.id, req.id, gapCount + 1, "SUPUESTO", "HIGH",
        "Supuesto pendiente de validación.",
        "¿Se confirma este supuesto?");
      gapCount++;
    }
  }

  // Update iteration
  await db.iteration.update({
    where: { id: iteration.id },
    data: {
      status: gapCount > 0 ? "GAPS_FOUND" : "GAPS_RESOLVED",
      gapCount,
      criticalGapCount
    }
  });

  // Update project status
  await db.project.update({
    where: { id: projectId },
    data: {
      status: gapCount > 0 ? "GAPS_PENDING" : "READY_FOR_ARTIFACTS"
    }
  });

  await logAudit({
    projectId, userId, agent: "ACCRAgent", action: "Detección de GAPS",
    details: `Iteración ${iterationNumber} finalizada. ${gapCount} GAPs encontrados (${criticalGapCount} críticos).`
  });

  return {
    success: true,
    iteration: iterationNumber,
    gapCount,
    criticalGapCount
  };
}

async function createGap(projectId: string, iterationId: string, requirementId: string, index: number, type: string, severity: string, description: string, question: string) {
  const code = `GAP-${Math.random().toString(36).substr(2, 5).toUpperCase()}-${index}`;
  return await db.gap.create({
    data: {
      projectId,
      iterationId,
      requirementId,
      code,
      type,
      severity,
      description,
      question
    }
  });
}
