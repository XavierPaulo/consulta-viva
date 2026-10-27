import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { prisma } from "./db";
import { newToken, sha256 } from "./auth";

/**
 * Acesso do paciente à Área do paciente: CPF + código de 6 dígitos enviado ao WhatsApp e ao e-mail cadastrados.
 * Sem senha para lembrar. Sessão própria (cookie cv_paciente), separada da equipe.
 */
export const PATIENT_COOKIE = "cv_paciente";
export const PATIENT_IDLE_MINUTES = 30;
export const PATIENT_ABSOLUTE_HOURS = 8;
export const CODE_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODES_PER_WINDOW = 3; // no máximo 3 códigos a cada 15 min por paciente

export const newLoginCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function createPatientSession(patientId: string) {
  const token = newToken();
  await prisma.patientSession.create({
    data: { tokenHash: sha256(token), patientId, expiresAt: new Date(Date.now() + PATIENT_ABSOLUTE_HOURS * 3600_000) },
  });
  (await cookies()).set(PATIENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PATIENT_ABSOLUTE_HOURS * 3600,
  });
}

export async function destroyPatientSession() {
  const jar = await cookies();
  const token = jar.get(PATIENT_COOKIE)?.value;
  if (token) await prisma.patientSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(PATIENT_COOKIE);
}

export const getCurrentPatient = cache(async () => {
  const token = (await cookies()).get(PATIENT_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.patientSession.findUnique({ where: { tokenHash: sha256(token) }, include: { patient: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > PATIENT_IDLE_MINUTES * 60_000) {
    await prisma.patientSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.patientSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session.patient;
});

export async function requirePatient() {
  const patient = await getCurrentPatient();
  if (!patient) redirect("/paciente/entrar?expirada=1");
  return patient;
}
