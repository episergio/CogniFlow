"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { logAudit } from "@/lib/agents/auditAgent";
import { ingestRequirements } from "@/lib/agents/ingestAgent";
import { runACCRAgent } from "@/lib/agents/accrAgent";
import { generateSRS, generateTraceability } from "@/lib/agents/srsAgent";
import { generateBPMN } from "@/lib/agents/bpmnAgent";
import { saveInsight } from "@/lib/agents/memoryAgent";
import { applyGapResponse, countOpenCriticalGaps, GAP_KEYWORDS } from "@/lib/gapResolution";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  client: z.string().optional(),
  priority: z.string().optional(),
});

async function getOwnedProject(projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (project.ownerId && project.ownerId !== userId) return null;
  return project;
}

export type CreateProjectState = { error?: string; success?: boolean; projectId?: string };

export async function createProjectAction(
  prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const data = Object.fromEntries(formData.entries());
    const parsed = createProjectSchema.safeParse(data);

    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((e) => e.message).join(", "),
        success: false,
      };
    }

    const project = await db.project.create({
      data: {
        ...parsed.data,
        ownerId: user.id,
      },
    });

    await logAudit({
      projectId: project.id,
      userId: user.id,
      agent: "Sistema",
      action: "Creación de proyecto",
      details: `Proyecto ${project.name} creado.`,
    });

    revalidatePath("/dashboard");
    return { success: true, projectId: project.id };
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor" };
  }
}

export async function loadDemoRequirementsAction(projectId: string) {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const project = await getOwnedProject(projectId, user.id);
    if (!project) return { error: "Proyecto no encontrado", success: false };

    const demoReqs = [
      { externalId: "REQ-001", type: "RF", name: "Alta de cliente", description: "El sistema debe permitir registrar un cliente." },
      { externalId: "REQ-002", type: "RF", name: "Validación de CUIT", description: "El sistema debería validar el CUIT de manera apropiada y rápida." },
      { externalId: "REQ-003", type: "RN", name: "CUIT inválido", description: "Validación de CUIT inválido.", businessRule: "Si el CUIT es inválido, el sistema debe mostrar error." },
      { externalId: "REQ-004", type: "SUP", name: "Cliente entrega datos fiscales", description: "Se asume que el cliente entrega datos fiscales.", assumptions: "PENDIENTE" },
    ];

    const result = await ingestRequirements(projectId, user.id, demoReqs);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor", success: false };
  }
}

export type LoadRequirementsState = {
  error?: string;
  success?: boolean;
  created?: number;
  errors?: string[];
};

export async function loadRequirementsFromJsonAction(
  prevState: LoadRequirementsState,
  formData: FormData
): Promise<LoadRequirementsState> {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const projectId = String(formData.get("projectId") || "");
    const raw = String(formData.get("requirements") || "");

    const project = await getOwnedProject(projectId, user.id);
    if (!project) return { error: "Proyecto no encontrado" };

    const maxSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 1);
    if (raw.length > maxSizeMb * 1024 * 1024) {
      return { error: `El contenido excede el límite de ${maxSizeMb}MB`, success: false };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { error: "JSON inválido: revisá la sintaxis del array de requisitos.", success: false };
    }

    const items = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
    if (items.length === 0) {
      return { error: "El array de requisitos está vacío.", success: false };
    }

    const result = await ingestRequirements(projectId, user.id, items);
    revalidatePath(`/projects/${projectId}`);
    return {
      success: result.success,
      created: result.created,
      errors: result.errors,
    };
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor", success: false };
  }
}

export async function analyzeProjectAction(projectId: string) {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const project = await getOwnedProject(projectId, user.id);
    if (!project) return { error: "Proyecto no encontrado", success: false };

    const result = await runACCRAgent(projectId, user.id);
    revalidatePath(`/projects/${projectId}`);
    return result;
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor", success: false };
  }
}

export async function answerGapAction(gapId: string, response: string, projectId: string) {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const project = await getOwnedProject(projectId, user.id);
    if (!project) return { error: "Proyecto no encontrado", success: false };

    const trimmed = response?.trim();
    if (!trimmed) return { error: "La respuesta no puede estar vacía", success: false };

    const gap = await db.gap.findUnique({ where: { id: gapId } });
    if (!gap || gap.projectId !== projectId) {
      return { error: "GAP no encontrado", success: false };
    }
    if (gap.status !== "OPEN") {
      return { error: "El GAP ya fue respondido", success: false };
    }

    // Aplica la respuesta al requisito para que la próxima iteración converja.
    await applyGapResponse(gap, trimmed);

    // Memoria básica: guarda insight con palabras clave según tipo de GAP.
    const keywords = GAP_KEYWORDS[gap.type] || "gap, resuelto";
    await saveInsight(
      projectId,
      "GAP_RESUELTO",
      `GAP ${gap.code} (${gap.type}) resuelto. Pregunta: ${gap.question} Respuesta: ${trimmed}`,
      keywords
    );

    await logAudit({
      projectId,
      userId: user.id,
      agent: "Usuario",
      action: "Respuesta a GAP",
      details: `GAP ${gap.code} respondido y aplicado al requisito.`,
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor" };
  }
}

export async function generateArtifactsAction(projectId: string) {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

    const project = await getOwnedProject(projectId, user.id);
    if (!project) return { error: "Proyecto no encontrado", success: false };

    // Regla dura en servidor: los GAPS críticos abiertos bloquean la generación.
    const openCritical = await countOpenCriticalGaps(projectId);
    if (openCritical > 0) {
      await logAudit({
        projectId,
        userId: user.id,
        agent: "Sistema",
        action: "Generación bloqueada",
        details: `Intento de generación con ${openCritical} GAPS críticos abiertos.`,
      });
      revalidatePath(`/projects/${projectId}`);
      return {
        error: `Bloqueado: existen ${openCritical} GAPS críticos sin resolver. Respondelos y reanalizá antes de generar artefactos.`,
        success: false,
      };
    }

    await generateSRS(projectId, user.id);
    await generateTraceability(projectId, user.id);
    await generateBPMN(projectId, user.id);

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor", success: false };
  }
}
