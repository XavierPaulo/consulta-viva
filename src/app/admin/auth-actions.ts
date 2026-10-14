"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  audit,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  newToken,
  sha256,
  verifyPassword,
} from "@/lib/auth";
import { sendNotification } from "@/lib/notify";
import type { ActionState } from "@/components/action-form";

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const back = String(form.get("voltar") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = "E-mail ou senha incorretos.";
  if (!user || !user.active) {
    await audit(null, "LOGIN_FAIL", "Sessão", "", `E-mail: ${email}`);
    return { error: generic };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Acesso bloqueado por excesso de tentativas. Tente novamente em ${min} min ou recupere sua senha.` };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const attempts = user.failedAttempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await audit(user, lock ? "LOCKED" : "LOGIN_FAIL", "Sessão", user.id, `Tentativa ${attempts}`);
    if (lock) return { error: `Muitas tentativas. Por segurança, o acesso foi bloqueado por ${LOCK_MINUTES} minutos.` };
    const left = MAX_ATTEMPTS - attempts;
    return { error: `${generic} ${left <= 2 ? `Restam ${left} tentativa${left > 1 ? "s" : ""} antes do bloqueio.` : ""}` };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit(user, "LOGIN", "Sessão", user.id);
  redirect(back.startsWith("/admin") ? back : "/admin");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await audit(user, "LOGOUT", "Sessão", user.id);
  await destroySession();
  redirect("/admin/login?saiu=1");
}

export async function requestReset(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const msg = "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha em instantes.";
  if (!email) return { error: "Informe seu e-mail." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.active) {
    const token = newToken();
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
    await sendNotification({
      channel: "EMAIL",
      to: user.email,
      subject: "Redefinição de senha",
      body: `Olá, ${user.name}. Para criar uma nova senha acesse /admin/redefinir/${token} (válido por 1 hora).`,
      related: user.id,
    });
    await audit(user, "RESET_REQUEST", "Usuário", user.id);
  }
  return { ok: true, message: msg };
}

export async function resetPassword(token: string, _: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password))
    return { error: "A senha precisa ter pelo menos 8 caracteres, com letras e números." };
  if (password !== confirm) return { error: "As senhas não conferem." };
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { error: "Link inválido ou expirado. Peça um novo." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  await audit(reset.user, "RESET_PASSWORD", "Usuário", reset.userId);
  redirect("/admin/login?senha=1");
}
