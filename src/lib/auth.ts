import { cookies } from "next/headers";
import { db } from "./db";

export async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set("cogniflow_session", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("cogniflow_session");
  if (!session?.value) return null;
  return session.value;
}

export async function getUser() {
  const userId = await getSession();
  if (!userId) return null;
  try {
    return await db.user.findUnique({ where: { id: userId } });
  } catch (error) {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("cogniflow_session");
}
