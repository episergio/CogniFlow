import fs from "fs";
import os from "os";
import path from "path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function firstWritableDir(candidates: string[]): string | null {
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Directorio inexistente o de solo lectura: probar el siguiente.
    }
  }
  return null;
}

function isServerless(): boolean {
  return Boolean(
    process.env.LAMBDA_TASK_ROOT ||
      process.env.NOW_REGION ||
      (process.env.AWS_REGION &&
        String(process.env.AWS_EXECUTION_ENV || "").startsWith("AWS_Lambda"))
  );
}

function resolveAdapter() {
  // Indirección para evitar reemplazo estático del literal durante el bundling.
  const env = process.env;
  const url = env["DATABASE" + "_URL"] || "";

  // BD remota (p. ej. Turso): DATABASE_URL="libsql://<db>-<org>.turso.io"
  if (url.startsWith("libsql:")) {
    console.log("[cogniflow] DB: libsql remota");
    return new PrismaLibSql({
      url,
      authToken: process.env.LIBSQL_AUTH_TOKEN,
    });
  }

  let filePath = url.startsWith("file:") ? url.slice("file:".length) : "";

  // En serverless una ruta relativa cae en un FS de solo lectura
  // (SQLITE_CANTOPEN): redirigir siempre al directorio temporal escribible.
  if (!filePath || (isServerless() && !path.isAbsolute(filePath))) {
    const tmpDir = firstWritableDir(["/tmp", os.tmpdir()]);
    filePath = tmpDir ? path.join(tmpDir, "cogniflow.db") : filePath || "dev.db";
  } else {
    const ensured = firstWritableDir([path.dirname(filePath)]);
    filePath = ensured ? path.join(ensured, path.basename(filePath)) : filePath;
  }

  console.log(
    `[cogniflow] DB: sqlite en ${filePath} (DATABASE_URL=${
      url ? `"${url.slice(0, 16)}..."` : "<no definida>"
    })`
  );
  return new PrismaBetterSqlite3({ url: filePath });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db =
  globalThis.prisma || new PrismaClient({ adapter: resolveAdapter() });

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
