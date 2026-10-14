import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { fmtDate, formatCpf } from "@/lib/format";
import { PrintButton } from "@/components/client";

export const metadata = { title: "Receita" };

export default async function Receita({ params }: PageProps<"/admin/prontuario/[id]/receita">) {
  const { id } = await params;
  const user = await requireUser("prontuario");
  const clinic = await getClinic();
  const rec = await prisma.medicalRecord.findUnique({ where: { id }, include: { patient: true, professional: true, prescriptions: true } });
  if (!rec) notFound();
  const scope = ownProfessionalScope(user);
  if (scope && rec.professionalId !== scope) notFound();
  await audit(user, "PRINT", "Receita", id);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton label="Imprimir receita" />
      </div>
      <article className="card min-h-[800px] p-10 print:min-h-0 print:border-0 print:shadow-none">
        <header className="border-b border-line pb-4 text-center">
          <p className="text-lg font-semibold">
            {rec.professional.title} {rec.professional.name}
          </p>
          <p className="text-sm text-muted">
            CRM {rec.professional.crm}/{rec.professional.crmUf} · {clinic.name}
          </p>
          <p className="text-sm text-muted">
            {clinic.address} · {clinic.phone}
          </p>
        </header>
        <h1 className="mt-6 text-center text-xl font-semibold tracking-widest">RECEITUÁRIO</h1>
        <p className="mt-6">
          <span className="text-muted">Paciente:</span> <strong>{rec.patient.name}</strong>
          {rec.patient.cpf && <span className="text-muted"> · CPF {formatCpf(rec.patient.cpf)}</span>}
        </p>
        <ol className="mt-8 space-y-6">
          {rec.prescriptions.map((p, i) => (
            <li key={p.id}>
              <p className="font-semibold">
                {i + 1}. {p.medication}
              </p>
              {p.dosage && <p className="pl-5">{p.dosage}</p>}
              {p.instructions && <p className="pl-5 text-muted">{p.instructions}</p>}
            </li>
          ))}
        </ol>
        <footer className="mt-24 flex flex-col items-center">
          <div className="w-72 border-t border-foreground pt-2 text-center text-sm">
            {rec.professional.title} {rec.professional.name}
            <br />
            CRM {rec.professional.crm}/{rec.professional.crmUf}
          </div>
          <p className="mt-6 text-sm text-muted">{fmtDate(rec.createdAt)}</p>
          <p className="mt-4 text-xs text-muted">Assinatura digital ICP-Brasil disponível na fase 3.</p>
        </footer>
      </article>
    </div>
  );
}
