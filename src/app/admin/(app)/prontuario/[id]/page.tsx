import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2, Lock, Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { now } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { SoapFields } from "@/components/soap-form";
import { Notice, PageHeader } from "@/components/ui";
import { updateRecord } from "../actions";
import { EDIT_WINDOW_HOURS } from "@/lib/constants";

export const metadata = { title: "Prontuário" };

export default async function RegistroPage({ params, searchParams }: PageProps<"/admin/prontuario/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser("prontuario");
  const rec = await prisma.medicalRecord.findUnique({ where: { id }, include: { patient: true, professional: true, prescriptions: true } });
  if (!rec) notFound();
  const scope = ownProfessionalScope(user);
  if (scope && rec.professionalId !== scope) notFound();
  await audit(user, "VIEW", "Prontuário", id, `Paciente ${rec.patient.name}`);
  const editable = can(user, "prontuario", "edit") && rec.createdById === user.id && now() - rec.createdAt.getTime() < EDIT_WINDOW_HOURS * 3600_000;
  const defaults = {
    subjective: rec.subjective,
    objective: rec.objective,
    assessment: rec.assessment,
    plan: rec.plan,
    items: rec.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage, instructions: p.instructions })),
  };
  return (
    <>
      <PageHeader
        back={{ href: `/admin/pacientes/${rec.patientId}`, label: rec.patient.name }}
        title="Evolução clínica"
        description={`${fmtDateTime(rec.createdAt)} · ${rec.professional.title} ${rec.professional.name} – CRM ${rec.professional.crm}/${rec.professional.crmUf}`}
        actions={
          <>
            {rec.prescriptions.length > 0 && (
              <Link href={`/admin/prontuario/${id}/receita`} className="btn-secondary">
                <Printer className="size-4" aria-hidden /> Imprimir receita
              </Link>
            )}
            {can(user, "prontuario", "create") && (
              <Link href={`/admin/prontuario/novo?paciente=${rec.patientId}`} className="btn-secondary">
                <FilePlus2 className="size-4" aria-hidden /> Nova evolução
              </Link>
            )}
          </>
        }
      />
      <div className="max-w-3xl space-y-4">
        {sp.ok && <Notice tone="success">Registro salvo no prontuário.</Notice>}
        {!editable && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="size-4" aria-hidden /> Registro bloqueado para edição (permitida só ao autor, até {EDIT_WINDOW_HOURS} h). Para complementar, adicione uma nova evolução.
          </p>
        )}
        {editable ? (
          <ActionForm action={updateRecord.bind(null, id)} className="card space-y-5 p-5 sm:p-6">
            <SoapFields defaults={defaults} />
            <SubmitButton>Salvar alterações</SubmitButton>
          </ActionForm>
        ) : (
          <div className="card p-5 sm:p-6">
            <SoapFields defaults={defaults} readOnly />
          </div>
        )}
      </div>
    </>
  );
}
