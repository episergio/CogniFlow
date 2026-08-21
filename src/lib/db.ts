import fs from "fs";
import path from "path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function resolveAdapter() {
  const url = process.env.DATABASE_URL || "";

  // BD remota (p. ej. Turso): DATABASE_URL="libsql://<db>-<org>.turso.io"
  if (url.startsWith("libsql:")) {
    return new PrismaLibSql({
      url,
      authToken: process.env.LIBSQL_AUTH_TOKEN,
    });
  }

  // SQLite local. En serverless (Vercel) el FS es efímero: usar /tmp.
  let filePath = url.replace("file:", "");
  if (!filePath) {
    filePath = process.env.VERCEL ? "/tmp/cogniflow.db" : "prisma/dev.db";
  }

  if (filePath !== ":memory:") {
    const dir = path.dirname(filePath);
    if (dir && dir !== "." && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return new PrismaBetterSqlite3({ url: filePath });
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient({ adapter: resolveAdapter() });

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
