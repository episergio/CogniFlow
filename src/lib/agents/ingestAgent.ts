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

export async function ingestRequirements(projectId: string, userId: string, data: unknown[]) {
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

  let created = 0;

  if (normalized.length > 0) {
    // Duplicados contra requisitos ya persistidos en el proyecto.
    const [dbIds, dbNames] = await Promise.all([
      db.requirement.findMany({
        where: { projectId, externalId: { in: normalized.map(r => r.externalId) } },
        select: { externalId: true },
      }),
      db.requirement.findMany({
        where: { projectId, name: { in: normalized.map(r => r.name) } },
        select: { name: true },
      }),
    ]);
    const dbIdSet = new Set(dbIds.map(r => r.externalId));
    const dbNameSet = new Set(dbNames.map(r => r.name));

    const toCreate = [];
    for (const req of normalized) {
      if (dbIdSet.has(req.externalId)) {
        errors.push(`externalId ya existe en el proyecto (${req.externalId})`);
        continue;
      }
      if (dbNameSet.has(req.name)) {
        errors.push(`name ya existe en el proyecto (${req.name})`);
        continue;
      }
      toCreate.push(req);
    }

    if (toCreate.length > 0) {
      await db.requirement.createMany({ data: toCreate });
      created = toCreate.length;

      await logAudit({
        projectId,
        userId,
        agent: "IngestAgent",
        action: "Carga de requisitos",
        details: `Cargados ${created} requisitos. Errores: ${errors.length}`,
      });
    }
  }

  return {
    success: errors.length === 0,
    created,
    errors,
  };
}
