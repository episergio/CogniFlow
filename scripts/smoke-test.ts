/* Smoke test del flujo MVP contra una DB temporal.
 * Uso: DATABASE_URL=file:<abs-path> npx tsx scripts/smoke-test.ts
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { ensureDb } from "../src/lib/dbBootstrap";
import { ingestRequirements } from "../src/lib/agents/ingestAgent";
import { runACCRAgent } from "../src/lib/agents/accrAgent";
import { generateSRS, generateTraceability } from "../src/lib/agents/srsAgent";
import { generateBPMN } from "../src/lib/agents/bpmnAgent";
import {
  applyGapResponse,
  countOpenCriticalGaps,
} from "../src/lib/gapResolution";

const DEMO_REQS = [
  { externalId: "REQ-001", type: "RF", name: "Alta de cliente", description: "El sistema debe permitir registrar un cliente." },
  { externalId: "REQ-002", type: "RF", name: "ValidaciÃ³n de CUIT", description: "El sistema deberÃ­a validar el CUIT de manera apropiada y rÃ¡pida." },
  { externalId: "REQ-003", type: "RN", name: "CUIT invÃ¡lido", description: "ValidaciÃ³n de CUIT invÃ¡lido.", businessRule: "Si el CUIT es invÃ¡lido, el sistema debe mostrar error." },
  { externalId: "REQ-004", type: "SUP", name: "Cliente entrega datos fiscales", description: "Se asume que el cliente entrega datos fiscales.", assumptions: "PENDIENTE" },
];

type AccrResult = {
  success: boolean;
  escalated?: boolean;
  error?: string;
  iteration?: number;
  gapCount?: number;
  criticalGapCount?: number;
  openCriticalGaps?: number;
  readyForArtifacts?: boolean;
};

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} - ${name}${extra ? ` (${extra})` : ""}`);
  if (!cond) failures++;
}

async function main() {
  await ensureDb();

  // ---------- Escenario 1: flujo feliz converge ----------
  const email = `smoke-${Date.now()}@cogniflow.test`;
  const user = await db.user.create({
    data: { email, passwordHash: await bcrypt.hash("smoke", 4), name: "Smoke" },
  });
  const project = await db.project.create({
    data: { name: "Smoke Test Flujo Feliz", ownerId: user.id },
  });

  const ingest = await ingestRequirements(project.id, user.id, DEMO_REQS);
  check("Ingesta crea 4 requisitos vÃ¡lidos", ingest.created === 4 && ingest.success);

  const bad = await ingestRequirements(project.id, user.id, [
    { externalId: "", type: "XX", name: "", description: "" },
  ]);
  check("Ingesta rechaza filas invÃ¡lidas", !bad.success && bad.created === 0);

  const dup = await ingestRequirements(project.id, user.id, [DEMO_REQS[0]]);
  check("Ingesta rechaza externalId duplicado", !dup.success && dup.created === 0);

  const it1 = await runACCRAgent(project.id, user.id)
  check(
    "IteraciÃ³n 1 detecta GAPS con crÃ­ticos",
    it1.success && it1.gapCount > 0 && it1.criticalGapCount > 0,
    `${it1.gapCount} gaps / ${it1.criticalGapCount} crÃ­ticos`
  );
  check(
    "Proyecto queda GAPS_PENDING tras iteraciÃ³n 1",
    (await db.project.findUnique({ where: { id: project.id } }))?.status === "GAPS_PENDING"
  );
  check(
    "Guard detecta GAPS crÃ­ticos abiertos",
    (await countOpenCriticalGaps(project.id)) > 0
  );

  // Responder todos los GAPS abiertos y reanalizar hasta converger
  let iterationsUsed = 1;
  let ready = false;
  for (let i = 0; i < 5; i++) {
    const open = await db.gap.findMany({
      where: { projectId: project.id, status: "OPEN" },
    });
    for (const gap of open) {
      await applyGapResponse(gap, `Respuesta de prueba para ${gap.code}`);
    }
    if (open.length > 0) {
      await db.memoryInsight.create({
        data: { projectId: project.id, type: "GAP_RESUELTO", content: `insight ${open[0].code}`, keywords: "test" },
      });
    }
    const res = await runACCRAgent(project.id, user.id)
    if (!res.success) break;
    iterationsUsed = res.iteration;
    if (res.readyForArtifacts) {
      ready = true;
      break;
    }
  }
  check(`Flujo converge en â‰¤5 iteraciones`, ready && iterationsUsed <= 5, `iteraciones: ${iterationsUsed}`);
  check(
    "Sin GAPS crÃ­ticos abiertos tras converger",
    (await countOpenCriticalGaps(project.id)) === 0
  );

  const req1 = await db.requirement.findFirst({
    where: { projectId: project.id, externalId: "REQ-001" },
  });
  check(
    "Respuesta aplicada al requisito (acceptanceCriteria)",
    !!req1?.acceptanceCriteria && req1.acceptanceCriteria.includes("Respuesta de prueba")
  );
  const req4 = await db.requirement.findFirst({
    where: { projectId: project.id, externalId: "REQ-004" },
  });
  check(
    "Supuesto confirmado con respuesta (no PENDIENTE)",
    !!req4?.assumptions && req4.assumptions !== "PENDIENTE"
  );

  await generateSRS(project.id, user.id);
  await generateTraceability(project.id, user.id);
  await generateBPMN(project.id, user.id);

  const artifacts = await db.artifact.findMany({ where: { projectId: project.id } });
  const types = artifacts.map((a) => a.type).sort();
  check(
    "Se generan SRS + TRACEABILITY + BPMN",
    JSON.stringify(types) === JSON.stringify(["BPMN", "SRS", "TRACEABILITY"]),
    types.join(",")
  );
  const trace = artifacts.find((a) => a.type === "TRACEABILITY");
  check(
    "Matriz de trazabilidad contiene filas por requisito",
    !!trace && trace.content.includes("REQ-001") && trace.content.includes("Resuelto")
  );
  check(
    "Proyecto COMPLETED tras generar artefactos",
    (await db.project.findUnique({ where: { id: project.id } }))?.status === "COMPLETED"
  );
  const auditCount = await db.auditLog.count({ where: { projectId: project.id } });
  check("AuditorÃ­a registrÃ³ eventos del flujo", auditCount >= 5, `${auditCount} logs`);

  // ---------- Escenario 2: escalado a humano ----------
  const project2 = await db.project.create({
    data: { name: "Smoke Test Escalado", ownerId: user.id },
  });
  await ingestRequirements(project2.id, user.id, DEMO_REQS);
  let escalatedResult: AccrResult | null = null;
  for (let i = 0; i < 6; i++) {
    escalatedResult = await runACCRAgent(project2.id, user.id)
  }
  check(
    "Tras mÃ¡x. iteraciones escala a humano",
    escalatedResult?.escalated === true &&
      (await db.project.findUnique({ where: { id: project2.id } }))?.status === "ESCALATED"
  );

  // ---------- Limpieza ----------
  await db.project.deleteMany({ where: { ownerId: user.id } });
  await db.user.delete({ where: { id: user.id } });

  console.log(failures === 0 ? "\nSMOKE TEST OK" : `\nSMOKE TEST CON ${failures} FALLOS`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
