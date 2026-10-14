import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { brl, fmtDate, fmtDateTime } from "@/lib/format";
import { CopyButton, SubmitButton } from "@/components/client";
import { Notice, PageHeader } from "@/components/ui";
import { PayStatus } from "@/components/status";
import { cancelPayment, markPaid, refundPayment } from "../actions";

export const metadata = { title: "Pagamento" };

export default async function PagamentoPage({ params, searchParams }: PageProps<"/admin/financeiro/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser("financeiro");
  const pay = await prisma.payment.findUnique({ where: { id }, include: { patient: true, appointment: { include: { professional: true } } } });
  if (!pay) notFound();
  await audit(user, "VIEW", "Pagamento", id);
  const canEdit = can(user, "financeiro", "edit");
  const link = pay.linkToken ? `/pagar/${pay.linkToken}` : "";
  return (
    <>
      <PageHeader
        back={{ href: "/admin/financeiro", label: "Financeiro" }}
        title={
          <span className="flex items-center gap-3">
            {brl(pay.amountCents)} <PayStatus status={pay.status} />
          </span>
        }
        description={pay.description}
        actions={
          pay.status === "PAGO" && (
            <Link href={`/admin/financeiro/${id}/recibo`} className="btn-secondary">
              <Printer className="size-4" aria-hidden /> Emitir recibo
            </Link>
          )
        }
      />
      <div className="max-w-2xl space-y-5">
        {sp.ok === "link" && <Notice tone="success">Link de pagamento gerado e enviado ao paciente.</Notice>}
        {sp.ok === "1" && <Notice tone="success">Pagamento registrado.</Notice>}
        <section className="card p-5">
          <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Paciente</dt>
              <dd className="font-medium">
                <Link className="hover:underline" href={`/admin/pacientes/${pay.patientId}`}>
                  {pay.patient.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Forma</dt>
              <dd>
                {PAYMENT_ENTRY_METHODS[pay.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? pay.method}
                {pay.installments > 1 && ` em ${pay.installments}x`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Criado em</dt>
              <dd>{fmtDateTime(pay.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{pay.paidAt ? "Pago em" : "Vencimento"}</dt>
              <dd>{pay.paidAt ? fmtDateTime(pay.paidAt) : pay.dueDate ? fmtDate(pay.dueDate) : "—"}</dd>
            </div>
            {pay.appointment && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Consulta</dt>
                <dd>
                  <Link className="link" href={`/admin/agenda/${pay.appointment.id}`}>
                    {fmtDateTime(pay.appointment.start)} – {pay.appointment.professional.title} {pay.appointment.professional.name}
                  </Link>
                </dd>
              </div>
            )}
            {pay.gatewayRef && (
              <div>
                <dt className="text-sm text-muted">Referência ({pay.gateway})</dt>
                <dd className="font-mono text-sm">{pay.gatewayRef}</dd>
              </div>
            )}
          </dl>
        </section>
        {link && pay.status === "PENDENTE" && (
          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-semibold">Link de pagamento</p>
              <p className="font-mono text-sm text-muted">{link}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={link} label="Copiar link" />
              <Link href={link} target="_blank" className="btn-secondary btn-sm">
                Abrir
              </Link>
            </div>
          </section>
        )}
        {canEdit && pay.status === "PENDENTE" && (
          <section className="card flex flex-wrap items-end gap-3 p-5">
            <form action={markPaid.bind(null, id)} className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="method" className="label">
                  Recebido via
                </label>
                <select id="method" name="method" defaultValue={pay.method === "LINK" ? "PIX" : pay.method} className="input">
                  {Object.entries(PAYMENT_ENTRY_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton pendingText="…">Dar baixa (pago)</SubmitButton>
            </form>
            <form action={cancelPayment.bind(null, id)}>
              <SubmitButton className="btn-danger" pendingText="…" confirm="Cancelar esta cobrança?">
                Cancelar cobrança
              </SubmitButton>
            </form>
          </section>
        )}
        {canEdit && pay.status === "PAGO" && (
          <details className="card p-5">
            <summary className="cursor-pointer font-semibold text-red-700">Estornar pagamento</summary>
            <form action={refundPayment.bind(null, id)} className="mt-3 space-y-3">
              <label htmlFor="reason" className="label">
                Motivo do estorno
              </label>
              <input id="reason" name="reason" className="input" required />
              <SubmitButton className="btn-danger" pendingText="Estornando…" confirm="Confirmar estorno? Esta ação fica registrada na auditoria.">
                Estornar
              </SubmitButton>
            </form>
          </details>
        )}
      </div>
    </>
  );
}
