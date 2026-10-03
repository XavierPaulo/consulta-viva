import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { now } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { SoapFields } from "@/components/soap-form";
import { Field, PageHeader } from "@/components/ui";
import { saveRecord } from "../actions";

export const metadata = { title: "Atendimento" };

export default async function NovoRegistro({ searchParams }: PageProps<"/admin/prontuario/novo">) {
  const sp = await searchParams;
  const user = await requireUser("prontuario", "create");
  const appt = typeof sp.consulta === "string" ? await prisma.appointment.findUnique({ where: { id: sp.consulta } }) : null;
  const patientId = appt?.patientId ?? (typeof sp.paciente === "string" ? sp.paciente : "");
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { records: { orderBy: { createdAt: "desc" }, take: 5, include: { professional: true, prescriptions: true } } },
  });
  if (!patient) notFound();
  await audit(user, "VIEW", "Prontuário", patient.id, "Abertura de atendimento");
  const pros = user.professionalId ? [] : await prisma.professional.findMany({ orderBy: { name: "asc" } });
  const age = patient.birthDate ? Math.floor((now() - patient.birthDate.getTime()) / (365.25 * 86400_000)) : null;
  return (
    <>
      <PageHeader
        back={appt ? { href: `/admin/agenda/${appt.id}`, label: "Consulta" } : { href: `/admin/pacientes/${patient.id}`, label: "Paciente" }}
        title={`Atendimento – ${patient.name}`}
        description={[age !== null ? `${age} anos` : null, patient.sex === "F" ? "Feminino" : patient.sex === "M" ? "Masculino" : null, appt ? `Consulta de ${fmtDateTime(appt.start)}` : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <ActionForm action={saveRecord} className="card space-y-5 p-5 sm:p-6">
          <input type="hidden" name="patientId" value={patient.id} />
          {appt && <input type="hidden" name="appointmentId" value={appt.id} />}
          {!user.professionalId && (
            <Field label="Profissional responsável" htmlFor="professionalId" required>
              <select id="professionalId" name="professionalId" className="input" defaultValue={appt?.professionalId} required>
                <option value="">Selecione</option>
                {pros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <SoapFields />
          {appt && (
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="finish" defaultChecked className="size-5 accent-[var(--brand)]" /> Marcar consulta como realizada
            </label>
          )}
          <SubmitButton pendingText="Salvando registro…">Salvar no prontuário</SubmitButton>
        </ActionForm>
        <aside className="card h-fit p-5">
          <h2 className="font-semibold">Histórico recente</h2>
          {patient.records.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Primeiro atendimento registrado.</p>
          ) : (
            <ol className="mt-3 space-y-4">
              {patient.records.map((r) => (
                <li key={r.id} className="text-sm">
                  <Link href={`/admin/prontuario/${r.id}`} className="text-muted hover:underline" target="_blank">
                    {fmtDate(r.createdAt)} · {r.professional.name.split(" ")[0]}
                  </Link>
                  {r.assessment && <p className="font-medium">{r.assessment}</p>}
                  {r.plan && <p className="text-muted">{r.plan}</p>}
                  {r.prescriptions.map((x) => (
                    <p key={x.id} className="text-brand-700">
                      ℞ {x.medication} {x.dosage && `– ${x.dosage}`}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}
