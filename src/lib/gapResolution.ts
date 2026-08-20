import { db } from "@/lib/db";

export const GAP_KEYWORDS: Record<string, string> = {
  COMPLETITUD: "criterios, aceptacion, completitud",
  CLARIDAD: "descripcion, detalle, claridad",
  AMBIGUEDAD: "ambiguedad, definicion, cuantificacion",
  REGLA_NEGOCIO: "rn, regla, negocio, escenario",
  SUPUESTO: "supuesto, validacion",
};

function sanitizeForMarkdown(text: string): string {
  return text.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
}

export async function countOpenCriticalGaps(projectId: string): Promise<number> {
  return db.gap.count({
    where: { projectId, status: "OPEN", severity: "CRITICAL" },
  });
}

/**
 * Aplica la respuesta del usuario al GAP y la persiste en el requisito
 * correspondiente para que la próxima iteración del ACCR converja.
 * No inventa información: usa únicamente el texto respondido por el usuario.
 */
export async function applyGapResponse(
  gap: { id: string; requirementId: string | null; type: string },
  response: string
) {
  const trimmed = response.trim();

  const updatedGap = await db.gap.update({
    where: { id: gap.id },
    data: {
      response: trimmed,
      status: "RESOLVED",
      respondedAt: new Date(),
    },
  });

  if (!gap.requirementId) return updatedGap;

  const requirement = await db.requirement.findUnique({
    where: { id: gap.requirementId },
  });
  if (!requirement) return updatedGap;

  switch (gap.type) {
    case "COMPLETITUD": {
      if (!requirement.acceptanceCriteria?.trim()) {
        await db.requirement.update({
          where: { id: requirement.id },
          data: { acceptanceCriteria: trimmed },
        });
      }
      break;
    }
    case "REGLA_NEGOCIO": {
      const base = requirement.businessRule?.trim() || "";
      const next = base ? `${base} | Escenario negativo: ${trimmed}` : trimmed;
      await db.requirement.update({
        where: { id: requirement.id },
        data: { businessRule: next },
      });
      break;
    }
    case "CLARIDAD":
    case "AMBIGUEDAD": {
      await db.requirement.update({
        where: { id: requirement.id },
        data: {
          description: `${requirement.description} [Aclaración: ${sanitizeForMarkdown(trimmed)}]`,
        },
      });
      break;
    }
    case "SUPUESTO": {
      await db.requirement.update({
        where: { id: requirement.id },
        data: { assumptions: trimmed },
      });
      break;
    }
  }

  return updatedGap;
}
