"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { appUrl, sendNotification } from "@/lib/notify";
import { sendManualReminder } from "@/lib/reminders";
import { isSlotFree } from "@/lib/slots";
import { fmtDateTime, isValidCpf, localToDate, onlyDigits, parseMoney } from "@/lib/format";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function resolveStart(form: FormData) {
  const iso = str(form, "start");
  if (iso) return new Date(iso);
  const d = str(form, "date");
  const t = str(form, "time");
  return d && t ? localToDate(d, t) : new Date(NaN);
}

export async function createAppointment(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("agenda", "create");
  const scope = ownProfessionalScope(user);
  const professionalId = scope ?? str(form, "professionalId");
  const pro = await prisma.professional.findUnique({ where: { id: professionalId } });
  if (!pro) return { error: "Escolha o profissional." };
  const start = resolveStart(form);
  if (Number.isNaN(start.getTime())) return { error: "Escolha a data e o horário." };
  const duration = Number(str(form, "duration")) || pro.durationMin;
  const end = new Date(start.getTime() + duration * 60_000);

  let patientId = str(form, "patientId");
  if (!patientId) {
    const name = str(form, "newName");
    const phone = onlyDigits(str(form, "newPhone"));
    const cpf = onlyDigits(str(form, "newCpf"));
    if (!name || phone.length < 10) return { error: "Selecione um paciente ou preencha nome e telefone do novo paciente." };
    if (cpf && !isValidCpf(cpf)) return { error: "CPF do novo paciente é inválido." };
    if (cpf && (await prisma.patient.findUnique({ where: { cpf } }))) return { error: "Já existe paciente com este CPF. Busque pelo nome ou CPF." };
    const p = await prisma.patient.create({ data: { name, phone, cpf: cpf || null, email: str(form, "newEmail") } });
    await audit(user, "CREATE", "Paciente", p.id, "Cadastro rápido pela agenda");
    patientId = p.id;
  }
  if (!form.get("force") && !(await isSlotFree(pro.id, start, end)))
    return { error: "Já existe consulta nesse horário para este profissional. Marque “Encaixe” para agendar mesmo assim." };

  const insuranceId = str(form, "insuranceId") || null;
  const appt = await prisma.appointment.create({
    data: {
      professionalId: pro.id,
      patientId,
      unitId: pro.unitId,
      start,
      end,
      type: str(form, "type") === "TELECONSULTA" ? "TELECONSULTA" : "PRESENCIAL",
      insuranceId,
      priceCents: form.get("price") ? parseMoney(form.get("price")) : insuranceId ? 0 : pro.priceCents,
      notes: str(form, "notes"),
      source: "INTERNO",
      status: form.get("confirmed") ? "CONFIRMADA" : "AGENDADA",
    },
    include: { patient: true },
  });
  await audit(user, "CREATE", "Consulta", appt.id, `${fmtDateTime(start)} com ${pro.name}`);
  if (form.get("notify")) {
    const body = `Olá, ${appt.patient.name.split(" ")[0]}! Sua consulta com ${pro.title} ${pro.name} está marcada para ${fmtDateTime(start)}. Para remarcar ou cancelar: ${appUrl(`/consulta/${appt.manageToken}`)}`;
    await sendNotification({ channel: "WHATSAPP", to: appt.patient.phone, body, related: appt.id });
    if (appt.patient.email) await sendNotification({ channel: "EMAIL", to: appt.patient.email, subject: "Consulta agendada", body, related: appt.id });
  }
  revalidatePath("/admin/agenda");
  redirect(`/admin/agenda?data=${str(form, "date") || ""}&ok=criada`);
}

async function loadEditable(id: string, action: "edit" | "delete" = "edit") {
  const user = await requireUser("agenda", action);
  const appt = await prisma.appointment.findUnique({ where: { id }, include: { patient: true, professional: true } });
  if (!appt) throw new Error("Consulta não encontrada");
  const scope = ownProfessionalScope(user);
  if (scope && appt.professionalId !== scope) redirect("/admin?negado=1");
  return { user, appt };
}

export async function setAppointmentStatus(id: string, status: string, form?: FormData) {
  const { user, appt } = await loadEditable(id, status === "CANCELADA" ? "delete" : "edit");
  if (!(status in APPOINTMENT_STATUS)) return;
  await prisma.appointment.update({
    where: { id },
    data: { status, ...(status === "CANCELADA" ? { cancelReason: String(form?.get("reason") ?? "") || "Cancelada pela clínica" } : {}) },
  });
  if (status === "CANCELADA") {
    await prisma.payment.updateMany({ where: { appointmentId: id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
    if (form?.get("notify"))
      await sendNotification({
        channel: "WHATSAPP",
        to: appt.patient.phone,
        body: `Olá, ${appt.patient.name.split(" ")[0]}. Sua consulta de ${fmtDateTime(appt.start)} com ${appt.professional.title} ${appt.professional.name} foi cancelada. Para remarcar, responda esta mensagem ou acesse nosso site.`,
        related: id,
      });
  }
  await audit(user, "UPDATE", "Consulta", id, `Status: ${appt.status} → ${status}`);
  revalidatePath(`/admin/agenda/${id}`);
  revalidatePath("/admin/agenda");
}

export async function updateAppointment(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { user, appt } = await loadEditable(id);
  const start = resolveStart(form);
  if (Number.isNaN(start.getTime())) return { error: "Informe data e horário." };
  const duration = Math.round((appt.end.getTime() - appt.start.getTime()) / 60_000);
  const end = new Date(start.getTime() + duration * 60_000);
  const moved = start.getTime() !== appt.start.getTime();
  if (moved && !form.get("force") && !(await isSlotFree(appt.professionalId, start, end, id)))
    return { error: "Horário ocupado. Marque “Encaixe” para salvar mesmo assim." };
  const insuranceId = str(form, "insuranceId") || null;
  await prisma.appointment.update({
    where: { id },
    data: {
      start,
      end,
      type: str(form, "type") === "TELECONSULTA" ? "TELECONSULTA" : "PRESENCIAL",
      insuranceId,
      priceCents: parseMoney(form.get("price")),
      notes: str(form, "notes"),
    },
  });
  await audit(user, "UPDATE", "Consulta", id, moved ? `Remarcada de ${fmtDateTime(appt.start)} para ${fmtDateTime(start)}` : "Dados alterados");
  if (moved && form.get("notify")) {
    const body = `Olá, ${appt.patient.name.split(" ")[0]}! Sua consulta com ${appt.professional.title} ${appt.professional.name} foi remarcada para ${fmtDateTime(start)}.`;
    await sendNotification({ channel: "WHATSAPP", to: appt.patient.phone, body, related: id });
  }
  revalidatePath(`/admin/agenda/${id}`);
  return { ok: true, message: moved ? `Remarcada para ${fmtDateTime(start)}.` : "Alterações salvas." };
}

export async function sendReminder(id: string) {
  const { user } = await loadEditable(id);
  await sendManualReminder(id);
  await audit(user, "NOTIFY", "Consulta", id, "Lembrete enviado");
  revalidatePath(`/admin/agenda/${id}`);
}

/** Médico abriu a sala da teleconsulta. */
export async function markDoctorJoined(id: string) {
  const { user, appt } = await loadEditable(id);
  if (!appt.doctorJoinedAt) await prisma.appointment.update({ where: { id }, data: { doctorJoinedAt: new Date() } });
  await audit(user, "VIEW", "Teleconsulta", id, "Entrou na sala de vídeo");
}
