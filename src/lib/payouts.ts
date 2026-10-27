import { prisma } from "./db";
import { localToDate } from "./format";

/** "2026-10" → intervalo do mês no fuso de Brasília */
export function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: localToDate(`${period}-01`), to: localToDate(`${next}-01`) };
}

export function shiftMonth(period: string, delta: number) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Repasse do mês por profissional: soma o que foi efetivamente recebido (pagamentos PAGO no mês,
 * ligados a consultas do profissional), desconta as taxas e aplica o percentual de repasse.
 */
export async function computePayouts(period: string, professionalId?: string) {
  const { from, to } = monthRange(period);
  const [pros, payments, payouts] = await Promise.all([
    prisma.professional.findMany({ where: professionalId ? { id: professionalId } : {}, orderBy: { name: "asc" } }),
    prisma.payment.findMany({
      where: {
        status: "PAGO",
        paidAt: { gte: from, lt: to },
        appointment: professionalId ? { professionalId } : { isNot: null },
      },
      include: { patient: { select: { name: true } }, appointment: { select: { professionalId: true, start: true } } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.payout.findMany({ where: { period, ...(professionalId ? { professionalId } : {}) } }),
  ]);
  return pros
    .map((pro) => {
      const items = payments.filter((p) => p.appointment?.professionalId === pro.id);
      const gross = items.reduce((s, p) => s + p.amountCents, 0);
      const fees = items.reduce((s, p) => s + p.feeCents, 0);
      const net = gross - fees;
      return {
        pro,
        items,
        appointments: new Set(items.map((p) => p.appointmentId)).size,
        gross,
        fees,
        net,
        due: Math.round((net * pro.payoutPercent) / 100),
        payout: payouts.find((x) => x.professionalId === pro.id) ?? null,
      };
    })
    .filter((r) => r.items.length > 0 || r.payout);
}
