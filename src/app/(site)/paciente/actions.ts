"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, sha256 } from "@/lib/auth";
import { allSimulated, sendNotification } from "@/lib/notify";
import { isValidCpf, onlyDigits } from "@/lib/format";
import { getClinic } from "@/lib/clinic";
import { PRIVACY_REQUEST_KINDS } from "@/lib/constants";
import {
  CODE_MAX_ATTEMPTS,
  CODE_MINUTES,
  CODES_PER_WINDOW,
  createPatientSession,
  destroyPatientSession,
  newLoginCode,
  requirePatient,
} from "@/lib/patient-auth";

export type LoginState = { step?: "cpf" | "code"; cpf?: string; error?: string; info?: string; demoCode?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const codeHash = (patientId: string, code: string) => sha256(`${patientId}:${code}`);

const GENERIC = "Se houver cadastro com este CPF, enviamos um código de 6 dígitos para o WhatsApp e o e-mail cadastrados.";

export async function requestLoginCode(_: LoginState, form: FormData): Promise<LoginState> {
  const cpf = onlyDigits(str(form, "cpf"));
  if (!isValidCpf(cpf)) return { step: "cpf", error: "CPF inválido. Confira os números." };
  const patient = await prisma.patient.findFirst({ where: { cpf } });
  // Resposta igual com ou sem cadastro: ninguém descobre quem é paciente da clínica pelo CPF.
  if (!patient) return { step: "code", cpf, info: GENERIC };
  const recent = await prisma.patientLoginCode.count({ where: { patientId: patient.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
  // Limite de envios: segue com a mesma resposta (o último código enviado continua valendo)
  if (recent >= CODES_PER_WINDOW) return { step: "code", cpf, info: `${GENERIC} Se pediu vários, use o último que chegou.` };

  const code = newLoginCode();
  await prisma.patientLoginCode.create({
    data: { patientId: patient.id, codeHash: codeHash(patient.id, code), channel: "WHATSAPP", expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) },
  });
  const clinic = await getClinic();
  const body = `${code} é o seu código de acesso à Área do paciente da ${clinic.name}. Ele vale por ${CODE_MINUTES} minutos. Não compartilhe com ninguém.`;
  await sendNotification({ channel: "WHATSAPP", to: patient.phone, body, related: `login:${patient.id}` });
  if (patient.email) await sendNotification({ channel: "EMAIL", to: patient.email, subject: "Seu código de acesso", body, related: `login:${patient.id}` });

  return {
    step: "code",
    cpf,
    info: GENERIC,
    // Em demonstração (sem provedor de mensagens e fora de produção) o código aparece na tela.
    demoCode: allSimulated() && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function verifyLoginCode(_: LoginState, form: FormData): Promise<LoginState> {
  const cpf = onlyDigits(str(form, "cpf"));
  const code = onlyDigits(str(form, "code"));
  const back: LoginState = { step: "code", cpf };
  if (code.length !== 6) return { ...back, error: "Digite os 6 números do código." };
  const patient = await prisma.patient.findFirst({ where: { cpf } });
  const pending = patient
    ? await prisma.patientLoginCode.findFirst({
        where: { patientId: patient.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!patient || !pending) return { ...back, error: "Código inválido ou expirado. Peça um novo código." };
  if (pending.attempts >= CODE_MAX_ATTEMPTS) return { ...back, error: "Muitas tentativas. Peça um novo código." };
  if (pending.codeHash !== codeHash(patient.id, code)) {
    await prisma.patientLoginCode.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    const left = CODE_MAX_ATTEMPTS - pending.attempts - 1;
    return { ...back, error: left > 0 ? `Código incorreto. Você ainda tem ${left} tentativa${left > 1 ? "s" : ""}.` : "Muitas tentativas. Peça um novo código." };
  }
  await prisma.patientLoginCode.update({ where: { id: pending.id }, data: { usedAt: new Date() } });
  await createPatientSession(patient.id);
  await audit(null, "LOGIN", "Área do paciente", patient.id, "Acesso do paciente");
  redirect("/paciente");
}

export async function logoutPatient() {
  await destroyPatientSession();
  redirect("/paciente/entrar?saiu=1");
}

export type PortalState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

export async function updateMyData(_: PortalState, form: FormData): Promise<PortalState> {
  const patient = await requirePatient();
  const phone = onlyDigits(str(form, "phone"));
  const email = str(form, "email");
  const fieldErrors: Record<string, string> = {};
  if (phone.length < 10) fieldErrors.phone = "Informe o celular com DDD.";
  if (email && !/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = "E-mail inválido.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Confira os campos destacados." };
  await prisma.patient.update({
    where: { id: patient.id },
    data: { phone, email, address: str(form, "address"), remindersOptOut: !form.get("reminders") },
  });
  await audit(null, "UPDATE", "Paciente", patient.id, "Dados atualizados pelo próprio paciente (Área do paciente)");
  revalidatePath("/paciente", "layout");
  return { ok: true, message: "Dados atualizados." };
}


export async function createPrivacyRequest(_: PortalState, form: FormData): Promise<PortalState> {
  const patient = await requirePatient();
  const kind = str(form, "kind");
  if (!(kind in PRIVACY_REQUEST_KINDS)) return { error: "Escolha o tipo de pedido." };
  const details = str(form, "details");
  if (kind !== "REVOGACAO" && details.length < 5) return { fieldErrors: { details: "Conte o que você precisa." }, error: "Descreva o pedido." };
  await prisma.patientRequest.create({ data: { patientId: patient.id, kind, details } });
  await audit(null, "CREATE", "Pedido LGPD", patient.id, kind);
  revalidatePath("/paciente/dados");
  return {
    ok: true,
    message: "Pedido registrado. A clínica responde em até 15 dias, como prevê a LGPD. Prontuários médicos precisam ser guardados por 20 anos (Lei 13.787/2018), então alguns dados não podem ser apagados.",
  };
}
