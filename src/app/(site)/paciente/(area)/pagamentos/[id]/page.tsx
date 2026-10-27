import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { getClinic } from "@/lib/clinic";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { brl, fmtDate, formatCpf } from "@/lib/format";
import { PrintButton } from "@/components/client";

export const metadata: Metadata = { title: "Recibo", robots: { index: false } };

export default async function MyReceipt({ params }: PageProps<"/paciente/pagamentos/[id]">) {
  const { id } = await params;
  const patient = await requirePatient();
  const clinic = await getClinic();
  const pay = await prisma.payment.findUnique({ where: { id }, include: { appointment: { include: { professional: true } } } });
  if (!pay || pay.patientId !== patient.id || pay.status !== "PAGO") notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href="/paciente/pagamentos" className="text-sm font-medium text-muted hover:text-foreground">
          ← Pagamentos
        </Link>
        <PrintButton label="Imprimir recibo" />
      </div>
      <article className="card p-8 print:border-0 print:shadow-none">
        <header className="border-b border-line pb-4">
          <p className="text-lg font-semibold">{clinic.name}</p>
          <p className="text-sm text-muted">
            {clinic.cnpj && `CNPJ ${clinic.cnpj} · `}
            {clinic.address}
          </p>
        </header>
        <h1 className="mt-6 text-center text-2xl font-semibold tracking-wide">RECIBO</h1>
        <p className="mt-1 text-center text-sm text-muted">Nº {pay.id.slice(-8).toUpperCase()}</p>
        <p className="mt-8 text-[16px] leading-relaxed">
          Recebemos de <strong>{patient.name}</strong>
          {patient.cpf && <>, CPF {formatCpf(patient.cpf)}</>}, a importância de <strong>{brl(pay.amountCents)}</strong>, referente a {pay.description || "serviços médicos"}, paga via{" "}
          {PAYMENT_ENTRY_METHODS[pay.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? pay.method}
          {pay.installments > 1 && ` em ${pay.installments} parcelas`}.
        </p>
        {pay.appointment && (
          <p className="mt-4 text-[15px]">
            Profissional: {pay.appointment.professional.title} {pay.appointment.professional.name} – CRM {pay.appointment.professional.crm}/{pay.appointment.professional.crmUf}
          </p>
        )}
        <p className="mt-10">{fmtDate(pay.paidAt ?? pay.createdAt)}</p>
        <div className="mt-16 w-64 border-t border-foreground pt-2 text-sm">{clinic.name}</div>
      </article>
    </div>
  );
}
