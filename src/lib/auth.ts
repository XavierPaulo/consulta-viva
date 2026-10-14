import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { prisma } from "./db";
import { can, type Action, type Module } from "./permissions";

export const SESSION_COOKIE = "cv_session";
export const IDLE_MINUTES = 30; // sessão expira após 30 min sem uso
export const ABSOLUTE_HOURS = 10; // e no máximo 10 h após o login
export const MAX_ATTEMPTS = 5; // tentativas antes do bloqueio
export const LOCK_MINUTES = 15;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function clientInfo() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || h.get("x-real-ip") || "",
    userAgent: h.get("user-agent") ?? "",
  };
}

export async function createSession(userId: string) {
  const token = newToken();
  const { ip, userAgent } = await clientInfo();
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + ABSOLUTE_HOURS * 3600_000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ABSOLUTE_HOURS * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { professional: { select: { id: true, name: true } } } } },
  });
  if (!session) return null;
  const now = Date.now();
  const idle = now - session.lastSeenAt.getTime() > IDLE_MINUTES * 60_000;
  if (session.expiresAt.getTime() < now || idle || !session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // renova a janela de inatividade no máximo 1x por minuto
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...user } = session.user;
  return user;
});

/** Exige usuário logado e com permissão. Redireciona para o login ou para o painel. */
export async function requireUser(module?: Module, action: Action = "view") {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login?expirada=1");
  if (module && !can(user, module, action)) redirect("/admin?negado=1");
  return user;
}

export async function audit(
  user: { id: string; name: string } | null,
  action: string,
  entity: string,
  entityId = "",
  details = "",
) {
  const { ip } = await clientInfo();
  await prisma.auditLog.create({
    data: { userId: user?.id, userName: user?.name ?? "", action, entity, entityId, details, ip },
  });
}

/** Médicos enxergam e editam apenas a própria agenda/prontuários; demais perfis veem todos. */
export function ownProfessionalScope(user: { role: string; professionalId: string | null }) {
  return user.role === "MEDICO" && user.professionalId ? user.professionalId : undefined;
}
