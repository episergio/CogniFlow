import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma/client";
import { db } from "./db";
import { logAudit } from "./agents/auditAgent";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DEMO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "priority" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Requirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "businessRule" TEXT,
    "priority" TEXT,
    "status" TEXT,
    "assumptions" TEXT,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Iteration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "gapCount" INTEGER NOT NULL DEFAULT 0,
    "criticalGapCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Iteration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Gap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "iterationId" TEXT,
    "requirementId" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gap_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "Iteration" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Gap_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'markdown',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "userId" TEXT,
    "agent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "MemoryInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemoryInsight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Iteration_projectId_number_key" ON "Iteration"("projectId", "number")`,
];

// IDs determinísticos para el usuario/proyecto demo: la sesión guarda el userId
// y con IDs fijos resuelve igual en BDs efímeras por instancia o en la BD
// remota compartida.
const DEMO_USER_ID = "user-demo";
const DEMO_PROJECT_ID = "project-demo-cogniflow";

async function seedDemoData() {
  const demoEmail = process.env.DEMO_EMAIL || "demo@cogniflow.app";
  const demoPassword = process.env.DEMO_PASSWORD || "Demo1234!";

  const existingUser = await db.user.findUnique({ where: { email: demoEmail } });
  const demoUser =
    existingUser ||
    (await db.user
      .create({
        data: {
          id: DEMO_USER_ID,
          email: demoEmail,
          passwordHash: await bcrypt.hash(demoPassword, 10),
          name: "Usuario Demo",
          role: "DEMO",
        },
      })
      // Race benigno: otra lambda fría puede sembrar el mismo usuario contra
      // la BD remota compartida; recuperar su fila en lugar de fallar.
      .catch(async (error) => {
        if (!isUniqueViolation(error)) throw error;
        return db.user.findUniqueOrThrow({ where: { email: demoEmail } });
      }));

  const existingProject = await db.project.findFirst({
    where: { name: "Proyecto Demo CogniFlow" },
  });

  if (!existingProject) {
    await db.project
      .create({
        data: {
          id: DEMO_PROJECT_ID,
          name: "Proyecto Demo CogniFlow",
          client: "Cliente Demo",
          priority: "ALTA",
          status: "DRAFT",
          ownerId: demoUser.id,
        requirements: {
          create: [
            {
              id: "req-demo-001",
              externalId: "REQ-001",
              type: "RF",
              name: "Alta de cliente",
              description: "El sistema debe permitir registrar un cliente.",
            },
            {
              id: "req-demo-002",
              externalId: "REQ-002",
              type: "RF",
              name: "Validación de CUIT",
              description:
                "El sistema debería validar el CUIT de manera apropiada y rápida.",
            },
            {
              id: "req-demo-003",
              externalId: "REQ-003",
              type: "RN",
              name: "CUIT inválido",
              description: "Validación de CUIT inválido.",
              businessRule:
                "Si el CUIT es inválido, el sistema debe mostrar error.",
            },
            {
              id: "req-demo-004",
              externalId: "REQ-004",
              type: "SUP",
              name: "Cliente entrega datos fiscales",
              description: "Se asume que el cliente entrega datos fiscales.",
              assumptions: "PENDIENTE",
            },
          ],
        },
        memoryInsights: {
          create: [
            {
              id: "insight-demo-001",
              type: "GAP_RESUELTO",
              content:
                "En reglas de negocio, conviene validar escenario positivo y negativo.",
              keywords: "rn, regla, negocio, negativo, error",
            },
          ],
        },
        },
      })
      .catch((error) => {
        // Race benigno contra la BD remota compartida: otra lambda ya sembró
        // el proyecto demo con el mismo id.
        if (!isUniqueViolation(error)) throw error;
      });
  }
}

let readyPromise: Promise<void> | null = null;

/**
 * Auto-provisionamiento idempotente de la base de datos.
 * Necesario en serverless (Vercel) donde el FS es efímero y no hay paso
 * de migraciones previo; en local es un no-op si ya corriste las migraciones.
 */
export function ensureDb(): Promise<void> {
  readyPromise ??= bootstrapDatabase();
  return readyPromise;
}

async function bootstrapDatabase() {
  try {
    for (const stmt of DDL) {
      await db.$executeRawUnsafe(stmt);
    }
    await seedDemoData();
  } catch (error) {
    // No bloquear el arranque: las queries posteriores mostrarán el error real.
    console.error("Error en bootstrap de base de datos:", error);
  }
}

export async function bootstrapAndAudit() {
  await ensureDb();
  await logAudit({
    agent: "Sistema",
    action: "Bootstrap de base de datos",
    details: "Esquema verificado y datos demo asegurados.",
  });
}
