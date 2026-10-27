import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { PatientFields } from "@/components/patient-fields";
import { PageHeader } from "@/components/ui";
import { createPatient } from "../actions";

export const metadata = { title: "Novo paciente" };

export default async function NovoPaciente() {
  await requireUser("pacientes", "create");
  const insurances = await prisma.insurance.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Novo paciente" back={{ href: "/admin/pacientes", label: "Pacientes" }} />
      <ActionForm action={createPatient} className="card max-w-3xl space-y-5 p-5 sm:p-6">
        <PatientFields insurances={insurances} />
        <SubmitButton>Cadastrar paciente</SubmitButton>
      </ActionForm>
    </>
  );
}
