import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { brl, fmtDate, now } from "@/lib/format";
import { EmptyState, IconChip } from "@/components/ui";
import { PortalApptCard, portalApptInclude } from "./appt-card";

export const metadata: Metadata = { title: "Área do paciente", robots: { index: false } };

export default async function PatientHome() {
  const patient = await requirePatient();
  const nowMs = now();
  // inclui a consulta em andamento (até 1 h depois do fim) para a teleconsulta continuar acessível
  const [upcoming, pendingPayments, lastRecipe] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: patient.id, status: { in: ["AGENDADA", "CONFIRMADA"] }, end: { gt: new Date(nowMs - 3600_000) } },
      orderBy: { start: "asc" },
      take: 3,
      include: portalApptInclude,
    }),
    prisma.payment.findMany({ where: { patientId: patient.id, status: "PENDENTE" }, orderBy: { createdAt: "desc" } }),
    prisma.medicalRecord.findFirst({
      where: { patientId: patient.id, prescriptions: { some: {} } },
      orderBy: { createdAt: "desc" },
      include: { professional: { select: { title: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Próximas consultas</h1>
          <Link href="/agendar" className="btn-secondary btn-sm">
            <CalendarPlus className="size-4" aria-hidden /> Agendar
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState title="Nenhuma consulta marcada" action={<Link href="/agendar" className="btn-primary">Agendar consulta</Link>}>
            Quando você agendar, ela aparece aqui.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <PortalApptCard key={a.id} a={a} nowMs={nowMs} />
            ))}
          </div>
        )}
      </section>

      {pendingPayments.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pagamentos em aberto</h2>
          <ul className="card divide-y divide-line">
            {pendingPayments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{p.description || "Consulta"}</p>
                  <p className="text-sm text-muted">{p.dueDate ? `Vence em ${fmtDate(p.dueDate)}` : `Desde ${fmtDate(p.createdAt)}`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{brl(p.amountCents)}</span>
                  {p.linkToken ? (
                    <Link href={`/pagar/${p.linkToken}`} className="btn-primary btn-sm">
                      Pagar
                    </Link>
                  ) : (
                    <span className="text-sm text-muted">Pagar na recepção</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lastRecipe && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Última receita</h2>
          <Link href={`/paciente/receitas/${lastRecipe.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-200">
            <IconChip icon={FileText} tone="rose" />
            <div>
              <p className="font-medium">
                {lastRecipe.professional.title} {lastRecipe.professional.name}
              </p>
              <p className="text-sm text-muted">{fmtDate(lastRecipe.createdAt)} · ver e imprimir</p>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
