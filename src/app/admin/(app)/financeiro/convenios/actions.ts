"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { brl, parseMoney } from "@/lib/format";
import { buildTissBatchXml, tissProblems } from "@/lib/tiss";
import type { ActionState } from "@/components/action-form";

const PATH = "/admin/financeiro/convenios";

export async function generateBatch(insuranceId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("financeiro", "create");
  const ids = form.getAll("ids").map(String);
  if (!ids.length) return { error: "Marque ao menos uma consulta para incluir no lote." };
  const [clinic, ins] = await Promise.all([getClinic(), prisma.insurance.findUnique({ where: { id: insuranceId } })]);
  if (!ins) return { error: "Convênio não encontrado." };
  const head = tissProblems({ ansCode: ins.ansCode, providerCode: ins.providerCode, cnes: clinic.cnes });
  if (head.length) return { error: `Falta preencher: ${head.join("; ")}.` };
  const appts = await prisma.appointment.findMany({
    where: { id: { in: ids }, insuranceId, status: "REALIZADA", tissBatchId: null },
    include: { patient: true, professional: true },
    orderBy: { start: "asc" },
  });
  if (appts.length !== ids.length) return { error: "Algumas consultas mudaram ou já entraram em outro lote. Atualize a página." };
  const value = (a: (typeof appts)[number]) => ins.priceCents ?? a.priceCents;
  for (const a of appts) {
    const p = tissProblems({ ansCode: ins.ansCode, providerCode: ins.providerCode, cnes: clinic.cnes }, { cardNumber: a.patient.insuranceCard, professional: a.professional });
    if (p.length) return { error: `${a.patient.name}: falta ${p.join(", ")}.` };
    if (value(a) <= 0) return { error: `Defina o valor da consulta para ${ins.name} em Configurações › Convênios (Valor tabela).` };
  }

  const last = await prisma.tissBatch.findFirst({ where: { insuranceId }, orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;
  const sequence = (await prisma.tissBatch.count()) + 1;
  // primeira consulta com o profissional → tipoConsulta 1 (primeira); senão, 2 (seguimento)
  const firsts = await Promise.all(
    appts.map(async (a) => !(await prisma.appointment.findFirst({ where: { patientId: a.patientId, professionalId: a.professionalId, status: "REALIZADA", start: { lt: a.start } } }))),
  );
  const guides = appts.map((a, i) => ({
    guideNumber: a.tissGuide || `${String(number).padStart(4, "0")}${String(i + 1).padStart(3, "0")}`,
    operatorGuide: a.authCode || undefined,
    cardNumber: a.patient.insuranceCard,
    date: a.start,
    firstVisit: firsts[i]!,
    valueCents: value(a),
    professional: a.professional,
    tussCode: ins.tussCode,
    tableCode: ins.tableCode,
    notes: a.type === "TELECONSULTA" ? "Teleconsulta" : undefined,
  }));
  const createdAt = new Date();
  const { xml } = buildTissBatchXml({
    batchNumber: number,
    sequence,
    createdAt,
    version: ins.tissVersion,
    ansCode: ins.ansCode,
    providerCode: ins.providerCode,
    cnes: clinic.cnes,
    guides,
  });
  const total = guides.reduce((s, g) => s + g.valueCents, 0);
  await prisma.$transaction(async (tx) => {
    const batch = await tx.tissBatch.create({ data: { number, insuranceId, totalCents: total, xml, createdById: user.id, createdAt } });
    for (const [i, a] of appts.entries()) {
      await tx.appointment.update({ where: { id: a.id }, data: { tissBatchId: batch.id, tissGuide: guides[i]!.guideNumber } });
    }
  });
  await audit(user, "CREATE", "Lote TISS", insuranceId, `${ins.name} lote ${number}: ${appts.length} guias, ${brl(total)}`);
  // a lista de consultas some depois de faturada; a confirmação aparece no topo da página
  redirect(`${PATH}?gerado=${number}&operadora=${encodeURIComponent(ins.name)}&guias=${appts.length}`);
}

export async function markBatchSent(id: string) {
  const user = await requireUser("financeiro", "edit");
  await prisma.tissBatch.update({ where: { id, status: "GERADO" }, data: { status: "ENVIADO", sentAt: new Date() } });
  await audit(user, "UPDATE", "Lote TISS", id, "Enviado à operadora");
  revalidatePath(PATH);
}

export async function cancelBatch(id: string) {
  const user = await requireUser("financeiro", "delete");
  const batch = await prisma.tissBatch.findUnique({ where: { id } });
  if (!batch || !["GERADO", "ENVIADO"].includes(batch.status)) return;
  await prisma.$transaction([
    prisma.appointment.updateMany({ where: { tissBatchId: id }, data: { tissBatchId: null } }),
    // o lote fica registrado como cancelado para o número não ser reaproveitado
    prisma.tissBatch.update({ where: { id }, data: { status: "CANCELADO" } }),
  ]);
  await audit(user, "DELETE", "Lote TISS", id, `Lote ${batch.number} cancelado`);
  revalidatePath(PATH);
}

/**
 * Retorno da operadora: valor pago no lote. A diferença é glosa. O valor recebido é distribuído entre as consultas
 * do lote (proporcional ao valor de cada guia) como pagamentos "Convênio", que entram no repasse e na conciliação.
 */
export async function registerBatchPayment(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("financeiro", "edit");
  const batch = await prisma.tissBatch.findUnique({ where: { id }, include: { insurance: true, appointments: { orderBy: { start: "asc" } } } });
  if (!batch || !["GERADO", "ENVIADO"].includes(batch.status)) return { error: "Este lote já teve o pagamento registrado." };
  const received = parseMoney(form.get("received"));
  if (received <= 0) return { error: "Informe o valor pago pela operadora." };
  if (received > batch.totalCents) return { error: `O valor pago não pode passar do total do lote (${brl(batch.totalCents)}).` };
  const glosa = batch.totalCents - received;
  const paidAt = new Date();
  const per = (a: (typeof batch.appointments)[number]) => batch.insurance.priceCents ?? a.priceCents;
  let left = received;
  const rows = batch.appointments.map((a, i) => {
    const share = i === batch.appointments.length - 1 ? left : Math.round((received * per(a)) / batch.totalCents);
    left -= share;
    return {
      patientId: a.patientId,
      appointmentId: a.id,
      description: `${batch.insurance.name} – lote ${batch.number}, guia ${a.tissGuide}`,
      amountCents: share,
      method: "CONVENIO",
      status: "PAGO",
      paidAt,
      gateway: "tiss",
      gatewayRef: `lote-${batch.number}`,
      createdById: user.id,
    };
  });
  await prisma.$transaction([
    prisma.payment.createMany({ data: rows.filter((r) => r.amountCents > 0) }),
    prisma.tissBatch.update({
      where: { id },
      data: { status: glosa > 0 ? "GLOSADO" : "PAGO", receivedCents: received, glosaCents: glosa, paidAt, notes: String(form.get("notes") ?? "").trim() },
    }),
  ]);
  await audit(user, "UPDATE", "Lote TISS", id, `Recebido ${brl(received)}${glosa ? `, glosa ${brl(glosa)}` : ""}`);
  redirect(`${PATH}?pago=${batch.number}&operadora=${encodeURIComponent(batch.insurance.name)}${glosa ? `&glosa=${glosa}` : ""}`);
}
