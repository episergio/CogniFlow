import { db } from "@/lib/db";
import { logAudit } from "./auditAgent";
import { enrichGapQuestion, isLlmEnabled } from "./llmAgent";

const AMBIGUOUS_WORDS = [
  "apropiado", "apropiada", "rápido", "rápida", "eficiente",
  "correcto", "correcta", "normal", "adecuado", "adecuada",
  "debería", "posiblemente", "eventualmente", "sencillo", "fácil",
];

const MAX_ITERATIONS = Number(process.env.MAX_ITERATIONS || 5);

interface AccrRule {
  type: string;
  severity: string;
  description: (req: {
    description: string;
    acceptanceCriteria: string | null;
    businessRule: string | null;
    assumptions: string | null;
  }) => string;
  question: string;
  test: (req: {
    type: string;
    description: string;
    acceptanceCriteria: string | null;
    businessRule: string | null;
    assumptions: string | null;
  }) => boolean;
}

const RULES: AccrRule[] = [
  {
    type: "COMPLETITUD",
    severity: "CRITICAL",
    test: (req) =>
      (req.type === "RF" || req.type === "HU") &&
      (!req.acceptanceCriteria || req.acceptanceCriteria.trim() === ""),
    description: () => "Falta criterio de aceptación.",
    question: "¿Cuáles son los criterios de aceptación medibles para este requisito?",
  },
  {
    type: "REGLA_NEGOCIO",
    severity: "CRITICAL",
    test: (req) => req.type === "RN" && (!req.businessRule || req.businessRule.trim() === ""),
    description: () => "Regla de negocio sin lógica especificada.",
    question: "¿Cuál es la lógica o condición específica de esta regla de negocio?",
  },
  {
    type: "CLARIDAD",
    severity: "MEDIUM",
    test: (req) => !!req.description && req.description.length < 30,
    description: () => "Descripción demasiado corta.",
    question: "¿Podrías proporcionar más detalles en la descripción del requisito?",
  },
  {
    type: "AMBIGUEDAD",
    severity: "HIGH",
    test: (req) => {
      const lowerDesc = req.description?.toLowerCase() || "";
      return AMBIGUOUS_WORDS.some((w) => lowerDesc.includes(w));
    },
    description: (req) => {
      const lowerDesc = req.description?.toLowerCase() || "";
      const foundWords = AMBIGUOUS_WORDS.filter((w) => lowerDesc.includes(w));
      return `Se encontraron palabras ambiguas: ${foundWords.join(", ")}`;
    },
    question: "¿Podrías cuantificar o definir de forma exacta las palabras ambiguas mencionadas?",
  },
  {
    type: "REGLA_NEGOCIO",
    severity: "MEDIUM",
    test: (req) => {
      if (req.type !== "RN" || !req.businessRule) return false;
      const rule = req.businessRule.toLowerCase();
      return (
        !rule.includes("error") &&
        !rule.includes("inválido") &&
        !rule.includes("escenario negativo")
      );
    },
    description: () => "Regla de negocio sin escenario negativo aparente.",
    question: "¿Qué debería hacer el sistema si no se cumple la condición principal?",
  },
  {
    type: "SUPUESTO",
    severity: "HIGH",
    test: (req) => req.type === "SUP" && req.assumptions === "PENDIENTE",
    description: () => "Supuesto pendiente de validación.",
    question: "¿Se confirma este supuesto?",
  },
];

export async function runACCRAgent(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: true,
      iterations: true,
    },
  });

  if (!project) throw new Error("Proyecto no encontrado");

  // Verificar iteraciones (máximo configurable, default 5)
  if (project.iterations.length >= MAX_ITERATIONS) {
    await db.project.update({
      where: { id: projectId },
      data: { status: "ESCALATED" },
    });
    await logAudit({
      projectId,
      userId,
      agent: "ACCRAgent",
      action: "Límite de iteraciones",
      details: `Se alcanzó el límite máximo de iteraciones (${MAX_ITERATIONS}). Escalado a revisión humana.`,
    });
    return { success: false, escalated: true, error: `Máximo de ${MAX_ITERATIONS} iteraciones alcanzado. Escalado a humano.` };
  }

  // Crear iteración
  const iterationNumber = project.iterations.length + 1;
  const iteration = await db.iteration.create({
    data: {
      projectId,
      number: iterationNumber,
      status: "RUNNING",
    },
  });

  // Un mismo GAP por (requisito, tipo): si ya existe abierto o resuelto,
  // no se regenera. Esto garantiza que responder un GAP converge la iteración.
  const existingGaps = await db.gap.findMany({
    where: { projectId },
    select: { requirementId: true, type: true },
  });
  const handledKeys = new Set(
    existingGaps.map((g) => `${g.requirementId}|${g.type}`)
  );

  let gapCount = 0;
  let criticalGapCount = 0;

  for (const req of project.requirements) {
    for (const rule of RULES) {
      if (!rule.test(req)) continue;

      const key = `${req.id}|${rule.type}`;
      if (handledKeys.has(key)) continue;

      const baseQuestion = rule.question;
      const question = isLlmEnabled()
        ? await enrichGapQuestion(baseQuestion, req)
        : baseQuestion;

      await createGap({
        projectId,
        iterationId: iteration.id,
        requirementId: req.id,
        code: `GAP-IT${iterationNumber}-${String(gapCount + 1).padStart(2, "0")}`,
        type: rule.type,
        severity: rule.severity,
        description: rule.description(req),
        question,
      });

      handledKeys.add(key);
      gapCount++;
      if (rule.severity === "CRITICAL") criticalGapCount++;
    }
  }

  // Update iteration
  await db.iteration.update({
    where: { id: iteration.id },
    data: {
      status: gapCount > 0 ? "GAPS_FOUND" : "GAPS_RESOLVED",
      gapCount,
      criticalGapCount,
    },
  });

  // El estado considera TODOS los GAPS críticos abiertos del proyecto
  // (incluidos los de iteraciones previas), no solo los de esta corrida.
  const openCriticalGaps = await db.gap.count({
    where: { projectId, status: "OPEN", severity: "CRITICAL" },
  });

  await db.project.update({
    where: { id: projectId },
    data: {
      status: openCriticalGaps > 0 ? "GAPS_PENDING" : "READY_FOR_ARTIFACTS",
    },
  });

  await logAudit({
    projectId,
    userId,
    agent: "ACCRAgent",
    action: "Detección de GAPS",
    details: `Iteración ${iterationNumber} finalizada. ${gapCount} GAPs nuevos (${criticalGapCount} críticos). Críticos abiertos totales: ${openCriticalGaps}.`,
  });

  return {
    success: true,
    iteration: iterationNumber,
    gapCount,
    criticalGapCount,
    openCriticalGaps,
    readyForArtifacts: openCriticalGaps === 0,
  };
}

async function createGap(data: {
  projectId: string;
  iterationId: string;
  requirementId: string;
  code: string;
  type: string;
  severity: string;
  description: string;
  question: string;
}) {
  return db.gap.create({ data });
}
