import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { fmtDate } from "@/lib/format";
import { EmptyState, IconChip } from "@/components/ui";

export const metadata: Metadata = { title: "Minhas receitas", robots: { index: false } };

export default async function MyPrescriptions() {
  const patient = await requirePatient();
  const records = await prisma.medicalRecord.findMany({
    where: { patientId: patient.id, prescriptions: { some: {} } },
    orderBy: { createdAt: "desc" },
    include: { professional: { select: { title: true, name: true } }, prescriptions: { select: { id: true, medication: true } } },
  });
  return (
    <div>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Receitas</h1>
      {records.length === 0 ? (
        <EmptyState title="Nenhuma receita ainda">As receitas emitidas nas suas consultas aparecem aqui para ver e imprimir.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id}>
              <Link href={`/paciente/receitas/${r.id}`} className="card flex items-start gap-4 p-4 transition hover:border-brand-200">
                <IconChip icon={FileText} tone="rose" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {fmtDate(r.createdAt)} · {r.professional.title} {r.professional.name}
                  </p>
                  <p className="truncate text-sm text-muted">{r.prescriptions.map((p) => p.medication).join(" · ")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
