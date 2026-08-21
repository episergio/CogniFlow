import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";
import { ensureDb } from "./dbBootstrap";

const COOKIE_NAME = "cogniflow_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 1 semana

function getSessionSecret(): string {
  // En producción debe definirse SESSION_SECRET en el entorno.
  return process.env.SESSION_SECRET || "cogniflow-dev-secret-not-for-production";
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function createToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function parseToken(token: string | undefined): string | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = Buffer.from(sign(userId));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;
  return userId;
}

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return parseToken(cookie?.value);
}

export async function getUser() {
  await ensureDb();
  const userId = await getSession();
  if (!userId) return null;
  try {
    return await db.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
