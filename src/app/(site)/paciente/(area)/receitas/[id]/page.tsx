import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { requirePatient } from "@/lib/patient-auth";
import { getClinic } from "@/lib/clinic";
import { fmtDate, formatCpf } from "@/lib/format";
import { PrintButton } from "@/components/client";

export const metadata: Metadata = { title: "Receita", robots: { index: false } };

export default async function MyPrescription({ params }: PageProps<"/paciente/receitas/[id]">) {
  const { id } = await params;
  const patient = await requirePatient();
  const clinic = await getClinic();
  const rec = await prisma.medicalRecord.findUnique({ where: { id }, include: { professional: true, prescriptions: true } });
  // só o próprio paciente vê; o SOAP (anotações do médico) não é exibido aqui
  if (!rec || rec.patientId !== patient.id || rec.prescriptions.length === 0) notFound();
  await audit(null, "VIEW", "Receita", id, "Visualizada pelo paciente");
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href="/paciente/receitas" className="text-sm font-medium text-muted hover:text-foreground">
          ← Receitas
        </Link>
        <PrintButton label="Imprimir receita" />
      </div>
      <article className="card p-8 sm:p-10 print:border-0 print:shadow-none">
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
          <span className="text-muted">Paciente:</span> <strong>{patient.name}</strong>
          {patient.cpf && <span className="text-muted"> · CPF {formatCpf(patient.cpf)}</span>}
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
        <footer className="mt-20 flex flex-col items-center">
          <div className="w-72 border-t border-foreground pt-2 text-center text-sm">
            {rec.professional.title} {rec.professional.name}
            <br />
            CRM {rec.professional.crm}/{rec.professional.crmUf}
          </div>
          <p className="mt-6 text-sm text-muted">{fmtDate(rec.createdAt)}</p>
          <p className="no-print mt-4 text-center text-xs text-muted">Cópia para consulta. Para comprar medicamentos controlados, use a via assinada entregue pelo médico.</p>
        </footer>
      </article>
    </div>
  );
}
