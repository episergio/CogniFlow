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

function resolveAdapter() {
  const url = process.env.DATABASE_URL || "";

  // BD remota (p. ej. Turso): DATABASE_URL="libsql://<db>-<org>.turso.io"
  if (url.startsWith("libsql:")) {
    console.log("[cogniflow] DB: libsql remota");
    return new PrismaLibSql({
      url,
      authToken: process.env.LIBSQL_AUTH_TOKEN,
    });
  }

  let filePath = url.startsWith("file:") ? url.slice("file:".length) : "";

  if (!filePath) {
    // Sin DATABASE_URL: usar el primer directorio escribible disponible.
    // En serverless (Vercel) el único escribible suele ser /tmp.
    const tmpDir = firstWritableDir(["/tmp", os.tmpdir()]);
    filePath = tmpDir ? path.join(tmpDir, "cogniflow.db") : "dev.db";
  } else {
    const ensured = firstWritableDir([path.dirname(filePath)]);
    filePath = ensured ? path.join(ensured, path.basename(filePath)) : filePath;
  }

  console.log(`[cogniflow] DB: sqlite en ${filePath}`);
  return new PrismaBetterSqlite3({ url: filePath });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient({ adapter: resolveAdapter() });

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
