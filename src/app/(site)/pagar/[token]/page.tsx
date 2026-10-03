import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { fakePixCode } from "@/lib/payments";
import { brl, fmtDateTime } from "@/lib/format";
import { PayForm } from "@/components/pay-form";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

export default async function PagarPage({ params }: PageProps<"/pagar/[token]">) {
  const { token } = await params;
  const clinic = await getClinic();
  const pay = await prisma.payment.findUnique({ where: { linkToken: token }, include: { patient: true, appointment: true } });
  if (!pay) notFound();
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="card p-6">
        <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
          <ShieldCheck className="size-4" aria-hidden /> Pagamento seguro · {clinic.name}
        </p>
        <h1 className="mt-2 text-xl font-semibold">{pay.description || "Pagamento"}</h1>
        <p className="text-muted">
          {pay.patient.name}
          {pay.appointment && ` · ${fmtDateTime(pay.appointment.start)}`}
        </p>
        <p className="mt-4 text-3xl font-semibold tabular-nums">{brl(pay.amountCents)}</p>
        <div className="mt-6">
          {pay.status === "PENDENTE" ? (
            <PayForm token={token} pixCode={fakePixCode(token, pay.amountCents)} amountLabel={brl(pay.amountCents)} amountCents={pay.amountCents} maxInstallments={clinic.maxInstallments} />
          ) : pay.status === "PAGO" ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
              <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
              <p className="text-lg font-semibold">Pagamento confirmado. Obrigado!</p>
              {pay.paidAt && <p className="text-sm text-muted">Pago em {fmtDateTime(pay.paidAt)}</p>}
            </div>
          ) : (
            <Notice tone="warning">Este link de pagamento foi cancelado. Fale com a recepção.</Notice>
          )}
        </div>
      </div>
    </div>
  );
}
