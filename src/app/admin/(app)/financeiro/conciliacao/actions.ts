"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { feeBpFor, matchScore, parseStatement } from "@/lib/statement";
import type { ActionState } from "@/components/action-form";

const PATH = "/admin/financeiro/conciliacao";


/** Vincula automaticamente as linhas que têm um único pagamento claramente correspondente. */
async function autoMatch() {
  const lines = await prisma.statementLine.findMany({ where: { paymentId: null, ignored: false, amountCents: { gt: 0 } } });
  if (!lines.length) return 0;
  const payments = await prisma.payment.findMany({
    where: { status: "PAGO", reconciledAt: null, paidAt: { gte: new Date(Date.now() - 120 * 86400_000) } },
  });
  const clinic = await getClinic();
  const pays = payments.map((p) => ({ ...p, feeBp: feeBpFor(clinic, p.method) }));
  const used = new Set<string>();
  let matched = 0;
  for (const line of lines.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const candidates = pays
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: matchScore(line, p) }))
      .filter((c) => c.score >= 75)
      .sort((a, b) => b.score - a.score);
    // só vincula sozinho quando não há empate (dois pagamentos iguais no mesmo dia ficam para a pessoa decidir)
    if (candidates.length === 1 || (candidates.length > 1 && candidates[0]!.score - candidates[1]!.score >= 5)) {
      const { p } = candidates[0]!;
      used.add(p.id);
      await link(line.id, p.id, line.amountCents, p.amountCents);
      matched++;
    }
  }
  return matched;
}

async function link(lineId: string, paymentId: string, lineCents: number, paymentCents: number) {
  await prisma.$transaction([
    prisma.statementLine.update({ where: { id: lineId }, data: { paymentId } }),
    prisma.payment.update({ where: { id: paymentId }, data: { reconciledAt: new Date(), feeCents: Math.max(0, paymentCents - lineCents) } }),
  ]);
}

export async function importStatement(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("financeiro", "edit");
  const file = form.get("file");
  let text = String(form.get("text") ?? "");
  let name = "colado";
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { error: "Arquivo muito grande (máximo 2 MB)." };
    const buf = Buffer.from(await file.arrayBuffer());
    // bancos brasileiros costumam exportar em ISO-8859-1; se não for UTF-8 válido, lê como latin1
    const utf8 = buf.toString("utf8");
    text = utf8.includes("�") ? buf.toString("latin1") : utf8;
    name = file.name;
  }
  if (!text.trim()) return { error: "Escolha o arquivo do extrato (CSV ou OFX) ou cole as linhas." };
  const lines = parseStatement(text);
  if (!lines.length) return { error: "Não reconhecemos lançamentos nesse arquivo. Ele precisa ter data, descrição e valor em cada linha." };
  const batch = `${new Date().toISOString().slice(0, 16)} ${name}`;
  let created = 0;
  for (const l of lines) {
    try {
      // lançamentos negativos (tarifas, saídas) entram já como ignorados
      await prisma.statementLine.create({ data: { ...l, batch, ignored: l.amountCents <= 0 } });
      created++;
    } catch {
      // linha repetida (mesma data, valor e descrição) de um extrato já importado
    }
  }
  const matched = await autoMatch();
  await audit(user, "CREATE", "Extrato", "", `${name}: ${created} lançamentos, ${matched} conciliados automaticamente`);
  revalidatePath(PATH);
  const dup = lines.length - created;
  return {
    ok: true,
    message: `${created} lançamento(s) importado(s)${dup ? ` (${dup} já existiam)` : ""}. ${matched} conciliado(s) automaticamente.`,
  };
}

export async function linkLine(lineId: string, form: FormData) {
  const user = await requireUser("financeiro", "edit");
  const paymentId = String(form.get("paymentId") ?? "");
  const [line, pay] = await Promise.all([prisma.statementLine.findUnique({ where: { id: lineId } }), prisma.payment.findUnique({ where: { id: paymentId } })]);
  if (!line || !pay || line.paymentId || pay.reconciledAt || pay.status !== "PAGO") return;
  await link(line.id, pay.id, line.amountCents, pay.amountCents);
  await audit(user, "UPDATE", "Conciliação", pay.id, `Vinculado ao extrato de ${line.date.toISOString().slice(0, 10)}`);
  revalidatePath(PATH);
}

export async function ignoreLine(lineId: string) {
  const user = await requireUser("financeiro", "edit");
  await prisma.statementLine.update({ where: { id: lineId }, data: { ignored: true } });
  await audit(user, "UPDATE", "Conciliação", lineId, "Lançamento ignorado");
  revalidatePath(PATH);
}

/** Recebimentos que não passam pelo banco (dinheiro): confere no caixa e marca como conciliado. */
export async function reconcileWithoutStatement(paymentId: string) {
  const user = await requireUser("financeiro", "edit");
  await prisma.payment.update({ where: { id: paymentId }, data: { reconciledAt: new Date() } });
  await audit(user, "UPDATE", "Conciliação", paymentId, "Conciliado sem extrato (caixa)");
  revalidatePath(PATH);
}

export async function unlink(paymentId: string) {
  const user = await requireUser("financeiro", "edit");
  await prisma.$transaction([
    prisma.statementLine.updateMany({ where: { paymentId }, data: { paymentId: null } }),
    prisma.payment.update({ where: { id: paymentId }, data: { reconciledAt: null, feeCents: 0 } }),
  ]);
  await audit(user, "UPDATE", "Conciliação", paymentId, "Conciliação desfeita");
  revalidatePath(PATH);
}

export async function runAutoMatch(): Promise<ActionState> {
  await requireUser("financeiro", "edit");
  const n = await autoMatch();
  revalidatePath(PATH);
  return { ok: true, message: n ? `${n} lançamento(s) conciliado(s).` : "Nenhuma correspondência segura encontrada." };
}
