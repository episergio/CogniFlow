import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/agents/auditAgent";

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project || (project.ownerId && project.ownerId !== user.id)) {
    return new Response("Proyecto no encontrado", { status: 404 });
  }

  const logs = await db.auditLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  const header = "id;fecha;agente;accion;detalles;usuario";
  const rows = logs.map((log) =>
    [
      log.id,
      log.createdAt.toISOString(),
      log.agent,
      log.action,
      log.details,
      log.user?.email || log.userId || "",
    ]
      .map(escapeCsv)
      .join(";")
  );

  // BOM para que Excel respete UTF-8. Separador ";" para configuración regional es-AR.
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");

  await logAudit({
    projectId: id,
    userId: user.id,
    agent: "Sistema",
    action: "Export de auditoría",
    details: `Se exportaron ${logs.length} registros en CSV.`,
  });

  const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, "_");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${safeName}.csv"`,
    },
  });
}
