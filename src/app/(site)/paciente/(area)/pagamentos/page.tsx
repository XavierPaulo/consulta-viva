import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { brl, fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { PayStatus } from "@/components/status";

export const metadata: Metadata = { title: "Meus pagamentos", robots: { index: false } };

export default async function MyPayments() {
  const patient = await requirePatient();
  // pagamentos de convênio são entre a clínica e a operadora; o paciente vê só os dele
  const list = await prisma.payment.findMany({ where: { patientId: patient.id, method: { not: "CONVENIO" } }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Pagamentos</h1>
      {list.length === 0 ? (
        <EmptyState title="Nenhum pagamento registrado" />
      ) : (
        <ul className="card divide-y divide-line">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{p.description || "Consulta"}</p>
                <p className="text-sm text-muted">
                  {fmtDate(p.paidAt ?? p.createdAt)}
                  {p.status === "PAGO" && ` · ${PAYMENT_ENTRY_METHODS[p.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? p.method}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{brl(p.amountCents)}</span>
                <PayStatus status={p.status} />
                {p.status === "PAGO" && (
                  <Link href={`/paciente/pagamentos/${p.id}`} className="btn-secondary btn-sm">
                    Recibo
                  </Link>
                )}
                {p.status === "PENDENTE" && p.linkToken && (
                  <Link href={`/pagar/${p.linkToken}`} className="btn-primary btn-sm">
                    Pagar
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
