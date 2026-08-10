import { z } from "zod";
import { db } from "@/lib/db";
import { logAudit } from "./auditAgent";

const RequirementSchema = z.object({
  externalId: z.string().min(1, "externalId es requerido"),
  type: z.enum(["RF", "RNF", "RN", "HU", "SUP"]),
  name: z.string().min(1, "name no puede estar vacío"),
  description: z.string().min(1, "description no puede estar vacía"),
  acceptanceCriteria: z.string().optional(),
  businessRule: z.string().optional(),
  priority: z.enum(["ALTA", "MEDIA", "BAJA"]).optional(),
  status: z.string().optional(),
  assumptions: z.string().optional(),
});

export async function ingestRequirements(projectId: string, userId: string, data: any[]) {
  const normalized = [];
  const errors = [];
  const seenIds = new Set();
  const seenNames = new Set();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const parsed = RequirementSchema.safeParse(item);
    
    if (!parsed.success) {
      errors.push(`Fila ${i + 1}: ${parsed.error.issues.map(e => e.message).join(", ")}`);
      continue;
    }

    const req = parsed.data;

    if (seenIds.has(req.externalId)) {
      errors.push(`Fila ${i + 1}: externalId duplicado (${req.externalId})`);
      continue;
    }
    if (seenNames.has(req.name)) {
      errors.push(`Fila ${i + 1}: name duplicado (${req.name})`);
      continue;
    }

    seenIds.add(req.externalId);
    seenNames.add(req.name);

    normalized.push({
      ...req,
      projectId,
      raw: JSON.stringify(item),
    });
  }

  if (normalized.length > 0) {
    await db.requirement.createMany({
      data: normalized,
    });
    
    await logAudit({
      projectId,
      userId,
      agent: "IngestAgent",
      action: "Carga de requisitos",
      details: `Cargados ${normalized.length} requisitos. Errores: ${errors.length}`,
    });
  }

  return {
    success: errors.length === 0,
    created: normalized.length,
    errors,
  };
}
