"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { brl } from "@/lib/format";
import { computePayouts } from "@/lib/payouts";

export async function registerPayout(professionalId: string, period: string, form: FormData) {
  const user = await requireUser("financeiro", "edit");
  if (!/^\d{4}-\d{2}$/.test(period)) return;
  // recalcula no servidor: o valor nunca vem do navegador
  const [row] = await computePayouts(period, professionalId);
  if (!row || row.payout || row.due <= 0) return;
  await prisma.payout.create({
    data: { professionalId, period, grossCents: row.net, amountCents: row.due, notes: String(form.get("notes") ?? "").trim(), createdById: user.id },
  });
  await audit(user, "CREATE", "Repasse", professionalId, `${period}: ${brl(row.due)}`);
  revalidatePath("/admin/financeiro/repasse");
}

export async function undoPayout(id: string) {
  const user = await requireUser("financeiro", "delete");
  const p = await prisma.payout.delete({ where: { id } });
  await audit(user, "DELETE", "Repasse", p.professionalId, `${p.period}: ${brl(p.amountCents)} desfeito`);
  revalidatePath("/admin/financeiro/repasse");
}
