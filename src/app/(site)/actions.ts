"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { sendNotification } from "@/lib/notify";
import { isSlotFree } from "@/lib/slots";
import { brl, fmtDateTime, isValidCpf, onlyDigits } from "@/lib/format";
import { APPOINTMENT_TYPES } from "@/lib/constants";
import { getGateway } from "@/lib/payments";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function sendMessage(_: FormState, form: FormData): Promise<FormState> {
  const name = str(form, "name");
  const email = str(form, "email");
  const whatsapp = onlyDigits(str(form, "whatsapp"));
  const body = str(form, "body");
  const preferredChannel = str(form, "channel") === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Informe seu nome.";
  if (body.length < 5) fieldErrors.body = "Escreva sua mensagem.";
  if (preferredChannel === "EMAIL" && !/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = "Informe um e-mail válido para receber a resposta.";
  if (preferredChannel === "WHATSAPP" && whatsapp.length < 10) fieldErrors.whatsapp = "Informe um WhatsApp com DDD para receber a resposta.";
  if (!form.get("consent")) fieldErrors.consent = "É preciso concordar para enviarmos a resposta.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Confira os campos destacados." };
  const professionalId = str(form, "professionalId") || null;
  await prisma.message.create({ data: { name, email, whatsapp, body, preferredChannel, professionalId } });
  return { ok: true, message: "Mensagem enviada! A resposta chegará no canal que você escolheu." };
}

/** Agendamento online feito pelo paciente. */
export async function bookAppointment(_: FormState, form: FormData): Promise<FormState> {
  const clinic = await getClinic();
  const professionalId = str(form, "professionalId");
  const startIso = str(form, "start");
  const mode = str(form, "mode"); // novo | existente
  const type = str(form, "type") === "TELECONSULTA" ? "TELECONSULTA" : "PRESENCIAL";
  const insuranceId = str(form, "insuranceId") || null;
  const fieldErrors: Record<string, string> = {};

  const pro = await prisma.professional.findUnique({ where: { id: professionalId }, include: { insurances: true } });
  const start = new Date(startIso);
  if (!pro || Number.isNaN(start.getTime())) return { error: "Escolha um horário para continuar." };
  if (type === "TELECONSULTA" && !pro.telemedicine) return { error: "Este profissional não atende por teleconsulta." };
  if (type === "PRESENCIAL" && !pro.inPerson) return { error: "Este profissional atende somente por teleconsulta." };
  if (insuranceId && !pro.insurances.some((i) => i.id === insuranceId)) return { error: "Convênio não aceito por este profissional." };
  if (start.getTime() < Date.now() + clinic.minBookingHours * 3600_000)
    return { error: `Agendamentos online precisam de pelo menos ${clinic.minBookingHours} h de antecedência.` };
  if (!form.get("lgpd")) fieldErrors.lgpd = "É preciso autorizar o uso dos dados de saúde para agendar.";

  const cpf = onlyDigits(str(form, "cpf"));
  const phone = onlyDigits(str(form, "phone"));
  let patientId: string | null = null;

  if (mode === "existente") {
    if (!isValidCpf(cpf)) fieldErrors.cpf = "CPF inválido.";
    if (phone.length < 10) fieldErrors.phone = "Informe o telefone com DDD.";
    if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Confira os campos destacados." };
    const found = await prisma.patient.findFirst({ where: { cpf } });
    // confirma identidade comparando o telefone cadastrado (sem revelar dados)
    if (!found || onlyDigits(found.phone).slice(-8) !== phone.slice(-8))
      return { fieldErrors: { cpf: "Não encontramos cadastro com este CPF e telefone. Confira ou use “Primeira vez”." } };
    patientId = found.id;
  } else {
    const name = str(form, "name");
    const email = str(form, "email");
    const birth = str(form, "birthDate");
    if (name.split(/\s+/).length < 2) fieldErrors.name = "Informe nome e sobrenome.";
    if (!isValidCpf(cpf)) fieldErrors.cpf = "CPF inválido.";
    if (phone.length < 10) fieldErrors.phone = "Informe o celular com DDD.";
    if (!/^\S+@\S+\.\S+$/.test(email)) fieldErrors.email = "Informe um e-mail válido.";
    if (!birth) fieldErrors.birthDate = "Informe a data de nascimento.";
    if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Confira os campos destacados." };
    const existing = await prisma.patient.findFirst({ where: { cpf } });
    if (existing) {
      // CPF já cadastrado: só aproveitamos o cadastro se o telefone bater
      if (onlyDigits(existing.phone).slice(-8) !== phone.slice(-8))
        return { fieldErrors: { cpf: "Este CPF já tem cadastro. Use “Já sou paciente” ou fale com a recepção." } };
      patientId = existing.id;
    } else {
      const p = await prisma.patient.create({
        data: { name, cpf, phone, email, birthDate: new Date(`${birth}T12:00:00-03:00`), lgpdConsentAt: new Date() },
      });
      patientId = p.id;
    }
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Confira os campos destacados." };

  const end = new Date(start.getTime() + pro.durationMin * 60_000);
  if (!(await isSlotFree(pro.id, start, end)))
    return { error: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor." };

  const appt = await prisma.appointment.create({
    data: {
      professionalId: pro.id,
      patientId: patientId!,
      unitId: pro.unitId,
      start,
      end,
      type,
      insuranceId,
      priceCents: insuranceId ? 0 : pro.priceCents,
      source: "ONLINE",
    },
    include: { patient: true, unit: true },
  });
  await prisma.patient.update({ where: { id: patientId! }, data: { lgpdConsentAt: new Date() } });

  // Pagamento antecipado (opcional): gera link quando o paciente escolhe pagar agora
  let payUrl = "";
  if (!insuranceId && pro.priceCents > 0 && form.get("payNow")) {
    const link = await getGateway().createPaymentLink({ amountCents: pro.priceCents, description: "Consulta", maxInstallments: clinic.maxInstallments });
    await prisma.payment.create({
      data: {
        patientId: patientId!,
        appointmentId: appt.id,
        amountCents: pro.priceCents,
        method: "LINK",
        description: `Consulta – ${pro.title} ${pro.name}`,
        linkToken: link.token,
        gateway: getGateway().name,
        gatewayRef: link.reference,
        dueDate: start,
      },
    });
    payUrl = link.url;
  }

  const when = fmtDateTime(start);
  const text = `Olá, ${appt.patient.name.split(" ")[0]}! Sua consulta com ${pro.title} ${pro.name} está agendada para ${when} (${APPOINTMENT_TYPES[type]}${
    type === "PRESENCIAL" && appt.unit ? ` – ${appt.unit.name}, ${appt.unit.address}` : ""
  }). Valor: ${insuranceId ? "convênio" : brl(pro.priceCents)}. Para cancelar ou remarcar: /consulta/${appt.manageToken}`;
  await sendNotification({ channel: "EMAIL", to: appt.patient.email, subject: "Consulta agendada", body: text, related: appt.id });
  await sendNotification({ channel: "WHATSAPP", to: appt.patient.phone, body: text, related: appt.id });

  revalidatePath("/agendar");
  redirect(`/consulta/${appt.manageToken}?novo=1${payUrl ? `&pagar=${encodeURIComponent(payUrl)}` : ""}`);
}

export async function cancelByPatient(token: string, _: FormState, form: FormData): Promise<FormState> {
  const clinic = await getClinic();
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token }, include: { patient: true, professional: true } });
  if (!appt || appt.status === "CANCELADA") return { error: "Consulta não encontrada ou já cancelada." };
  if (appt.start.getTime() - Date.now() < clinic.cancelMinHours * 3600_000)
    return { error: `Cancelamento online só até ${clinic.cancelMinHours} h antes. Fale com a recepção, por favor.` };
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "CANCELADA", cancelReason: str(form, "reason") || "Cancelado pelo paciente (online)" },
  });
  await prisma.payment.updateMany({ where: { appointmentId: appt.id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
  await sendNotification({
    channel: "EMAIL",
    to: appt.patient.email,
    subject: "Consulta cancelada",
    body: `Sua consulta de ${fmtDateTime(appt.start)} com ${appt.professional.title} ${appt.professional.name} foi cancelada.`,
    related: appt.id,
  });
  revalidatePath(`/consulta/${token}`);
  return { ok: true, message: "Consulta cancelada." };
}

export async function rescheduleByPatient(token: string, _: FormState, form: FormData): Promise<FormState> {
  const clinic = await getClinic();
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token }, include: { patient: true, professional: true } });
  if (!appt || appt.status === "CANCELADA") return { error: "Consulta não encontrada ou cancelada." };
  if (appt.start.getTime() - Date.now() < clinic.cancelMinHours * 3600_000)
    return { error: `Remarcação online só até ${clinic.cancelMinHours} h antes. Fale com a recepção, por favor.` };
  const start = new Date(str(form, "start"));
  if (Number.isNaN(start.getTime())) return { error: "Escolha o novo horário." };
  if (start.getTime() < Date.now() + clinic.minBookingHours * 3600_000) return { error: "Horário muito próximo. Escolha outro." };
  const end = new Date(start.getTime() + appt.professional.durationMin * 60_000);
  if (!(await isSlotFree(appt.professionalId, start, end, appt.id))) return { error: "Esse horário acabou de ser ocupado. Escolha outro." };
  await prisma.appointment.update({ where: { id: appt.id }, data: { start, end, status: "AGENDADA" } });
  const body = `Sua consulta com ${appt.professional.title} ${appt.professional.name} foi remarcada para ${fmtDateTime(start)}.`;
  await sendNotification({ channel: "EMAIL", to: appt.patient.email, subject: "Consulta remarcada", body, related: appt.id });
  await sendNotification({ channel: "WHATSAPP", to: appt.patient.phone, body, related: appt.id });
  revalidatePath(`/consulta/${token}`);
  return { ok: true, message: `Pronto! Nova data: ${fmtDateTime(start)}.` };
}

/** Pagamento pelo link (gateway simulado). */
export async function payByLink(token: string, _: FormState, form: FormData): Promise<FormState> {
  const pay = await prisma.payment.findUnique({ where: { linkToken: token } });
  if (!pay || pay.status !== "PENDENTE") return { error: "Este link não está mais disponível." };
  const method = str(form, "method") === "CREDITO" ? "CREDITO" : "PIX";
  const installments = method === "CREDITO" ? Math.max(1, Math.min(12, Number(str(form, "installments")) || 1)) : 1;
  if (method === "CREDITO" && onlyDigits(str(form, "card")).length < 13) return { fieldErrors: { card: "Número do cartão inválido." } };
  await prisma.payment.update({
    where: { id: pay.id },
    data: { status: "PAGO", paidAt: new Date(), method, installments },
  });
  revalidatePath(`/pagar/${token}`);
  return { ok: true, message: "Pagamento confirmado. Obrigado!" };
}
