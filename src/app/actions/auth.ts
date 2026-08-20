"use server";

import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export type LoginState = { error?: string; success?: boolean };

export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    const data = Object.fromEntries(formData.entries());
    const result = loginSchema.safeParse(data);

    if (!result.success) {
      return { error: result.error.issues[0].message };
    }

    const { email, password } = result.data;
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return { error: "Credenciales inválidas" };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return { error: "Credenciales inválidas" };
    }

    await setSession(user.id);
    
    // Auditoría
    await db.auditLog.create({
      data: {
        agent: "Sistema",
        action: "Login",
        details: "Usuario inició sesión",
        userId: user.id
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Error de servidor" };
  }
}

export async function logoutAction() {
  const { logout } = await import("@/lib/auth");
  await logout();
}
