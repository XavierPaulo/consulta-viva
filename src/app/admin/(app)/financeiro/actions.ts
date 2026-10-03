"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { getGateway } from "@/lib/payments";
import { sendNotification } from "@/lib/notify";
import { brl, localToDate, parseMoney } from "@/lib/format";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("financeiro", "create");
  const patientId = str(form, "patientId");
  const amountCents = parseMoney(form.get("amount"));
  const method = str(form, "method");
  if (!patientId) return { error: "Selecione o paciente." };
  if (amountCents <= 0) return { error: "Informe um valor maior que zero." };
  if (!(method in PAYMENT_ENTRY_METHODS)) return { error: "Escolha a forma de pagamento." };
  const paidNow = str(form, "status") === "PAGO";
  const appointmentId = str(form, "appointmentId") || null;

  if (method === "LINK") {
    const clinic = await getClinic();
    const link = await getGateway().createPaymentLink({ amountCents, description: str(form, "description"), maxInstallments: clinic.maxInstallments });
    const pay = await prisma.payment.create({
      data: {
        patientId,
        appointmentId,
        amountCents,
        method,
        description: str(form, "description"),
        linkToken: link.token,
        gateway: getGateway().name,
        gatewayRef: link.reference,
        createdById: user.id,
        dueDate: str(form, "dueDate") ? localToDate(str(form, "dueDate"), "23:59") : null,
      },
      include: { patient: true },
    });
    await audit(user, "CREATE", "Pagamento", pay.id, `Link de pagamento ${brl(amountCents)}`);
    if (form.get("notify"))
      await sendNotification({ channel: "WHATSAPP", to: pay.patient.phone, body: `Olá, ${pay.patient.name.split(" ")[0]}! Segue o link para pagamento de ${brl(amountCents)}: ${link.url}`, related: pay.id });
    redirect(`/admin/financeiro/${pay.id}?ok=link`);
  }

  const pay = await prisma.payment.create({
    data: {
      patientId,
      appointmentId,
      amountCents,
      method,
      installments: Math.max(1, Number(str(form, "installments")) || 1),
      description: str(form, "description"),
      status: paidNow ? "PAGO" : "PENDENTE",
      paidAt: paidNow ? new Date() : null,
      dueDate: str(form, "dueDate") ? localToDate(str(form, "dueDate"), "23:59") : null,
      createdById: user.id,
    },
  });
  await audit(user, "CREATE", "Pagamento", pay.id, `${brl(amountCents)} via ${method}`);
  redirect(`/admin/financeiro/${pay.id}?ok=1`);
}

/** Gera link de pagamento para uma consulta (botão na tela da consulta). */
export async function createPaymentLink(appointmentId: string) {
  const user = await requireUser("financeiro", "create");
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { professional: true, patient: true } });
  if (!appt) return;
  const clinic = await getClinic();
  const link = await getGateway().createPaymentLink({ amountCents: appt.priceCents, description: "Consulta", maxInstallments: clinic.maxInstallments });
  const pay = await prisma.payment.create({
    data: {
      patientId: appt.patientId,
      appointmentId,
      amountCents: appt.priceCents,
      method: "LINK",
      description: `Consulta – ${appt.professional.title} ${appt.professional.name}`,
      linkToken: link.token,
      gateway: getGateway().name,
      gatewayRef: link.reference,
      createdById: user.id,
      dueDate: appt.start,
    },
  });
  await sendNotification({
    channel: "WHATSAPP",
    to: appt.patient.phone,
    body: `Olá, ${appt.patient.name.split(" ")[0]}! Segue o link para pagamento da sua consulta (${brl(appt.priceCents)}): ${link.url}`,
    related: pay.id,
  });
  await audit(user, "CREATE", "Pagamento", pay.id, "Link de pagamento gerado e enviado");
  redirect(`/admin/financeiro/${pay.id}?ok=link`);
}

export async function markPaid(id: string, form: FormData) {
  const user = await requireUser("financeiro", "edit");
  const method = String(form.get("method") ?? "");
  await prisma.payment.update({
    where: { id },
    data: { status: "PAGO", paidAt: new Date(), ...(method in PAYMENT_ENTRY_METHODS ? { method } : {}) },
  });
  await audit(user, "UPDATE", "Pagamento", id, "Baixa manual (pago)");
  revalidatePath(`/admin/financeiro/${id}`);
}

export async function refundPayment(id: string, form: FormData) {
  const user = await requireUser("financeiro", "edit");
  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay || pay.status !== "PAGO") return;
  if (pay.gatewayRef) await getGateway().refund(pay.gatewayRef);
  await prisma.payment.update({ where: { id }, data: { status: "ESTORNADO" } });
  await audit(user, "UPDATE", "Pagamento", id, `Estorno: ${String(form.get("reason") ?? "")}`);
  revalidatePath(`/admin/financeiro/${id}`);
}

export async function cancelPayment(id: string) {
  const user = await requireUser("financeiro", "edit");
  await prisma.payment.updateMany({ where: { id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
  await audit(user, "UPDATE", "Pagamento", id, "Cobrança cancelada");
  revalidatePath(`/admin/financeiro/${id}`);
}
