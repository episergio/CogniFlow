"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { logAudit } from "@/lib/agents/auditAgent";
import { ingestRequirements } from "@/lib/agents/ingestAgent";
import { runACCRAgent } from "@/lib/agents/accrAgent";
import { generateSRS } from "@/lib/agents/srsAgent";
import { generateBPMN } from "@/lib/agents/bpmnAgent";
import { saveInsight } from "@/lib/agents/memoryAgent";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  client: z.string().optional(),
  priority: z.string().optional(),
});

export async function createProjectAction(prevState: any, formData: FormData) {
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

export async function analyzeProjectAction(projectId: string) {
  try {
    const user = await getUser();
    if (!user) return { error: "No autorizado" };

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

    const gap = await db.gap.update({
      where: { id: gapId },
      data: {
        response,
        status: "RESOLVED",
        respondedAt: new Date(),
      }
    });

    // Guardar insight en memoria (MVP básico: si es de regla de negocio u otro)
    if (gap.type === "REGLA_NEGOCIO") {
      await saveInsight(projectId, "GAP_RESUELTO", `Se resolvió un GAP de regla de negocio: ${gap.description}. Respuesta: ${response}`, "rn, regla, negocio, escenario");
    }

    await logAudit({
      projectId, userId: user.id, agent: "Usuario", action: "Respuesta a GAP",
      details: `GAP ${gap.code} respondido.`
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

    await generateSRS(projectId, user.id);
    await generateBPMN(projectId, user.id);

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Error interno del servidor", success: false };
  }
}
