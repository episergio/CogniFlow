import { db } from "@/lib/db";

export async function logAudit(data: {
  projectId?: string;
  userId?: string;
  agent: string;
  action: string;
  details?: string;
}) {
  try {
    return await db.auditLog.create({
      data: {
        projectId: data.projectId,
        userId: data.userId,
        agent: data.agent,
        action: data.action,
        details: data.details,
      },
    });
  } catch (error) {
    console.error("Error al registrar auditoría:", error);
    // No bloqueamos el flujo principal por error de auditoría
  }
}
