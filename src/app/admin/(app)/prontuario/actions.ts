"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
import { EDIT_WINDOW_HOURS } from "@/lib/constants";

function readItems(form: FormData) {
  const meds = form.getAll("medication").map(String);
  const dos = form.getAll("dosage").map(String);
  const ins = form.getAll("instructions").map(String);
  return meds
    .map((m, i) => ({ medication: m.trim(), dosage: (dos[i] ?? "").trim(), instructions: (ins[i] ?? "").trim() }))
    .filter((x) => x.medication);
}

export async function saveRecord(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("prontuario", "create");
  const patientId = str(form, "patientId");
  const appointmentId = str(form, "appointmentId") || null;
  const professionalId = user.professionalId ?? str(form, "professionalId");
  if (!patientId) return { error: "Paciente não informado." };
  if (!professionalId) return { error: "Selecione o profissional responsável pelo registro." };
  const data = {
    subjective: str(form, "subjective"),
    objective: str(form, "objective"),
    assessment: str(form, "assessment"),
    plan: str(form, "plan"),
  };
  if (!Object.values(data).some(Boolean)) return { error: "Preencha ao menos um campo do SOAP." };
  const rec = await prisma.medicalRecord.create({
    data: { ...data, patientId, professionalId, appointmentId, createdById: user.id, prescriptions: { create: readItems(form) } },
  });
  if (appointmentId && form.get("finish")) await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "REALIZADA" } });
  await audit(user, "CREATE", "Prontuário", rec.id, `Paciente ${patientId}`);
  // na sala da teleconsulta, volta para a sala (a chamada continua aberta)
  const returnTo = str(form, "returnTo");
  if (returnTo.startsWith("/admin/agenda/")) redirect(`${returnTo}?registro=${rec.id}`);
  redirect(`/admin/prontuario/${rec.id}?ok=1`);
}

export async function updateRecord(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("prontuario", "edit");
  const rec = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!rec) return { error: "Registro não encontrado." };
  if (rec.createdById !== user.id) return { error: "Somente quem criou o registro pode editá-lo." };
  if (Date.now() - rec.createdAt.getTime() > EDIT_WINDOW_HOURS * 3600_000)
    return { error: `Registros só podem ser editados até ${EDIT_WINDOW_HOURS} h após a criação. Adicione uma nova evolução.` };
  await prisma.$transaction([
    prisma.medicalRecord.update({
      where: { id },
      data: { subjective: str(form, "subjective"), objective: str(form, "objective"), assessment: str(form, "assessment"), plan: str(form, "plan") },
    }),
    prisma.prescriptionItem.deleteMany({ where: { recordId: id } }),
    prisma.prescriptionItem.createMany({ data: readItems(form).map((x) => ({ ...x, recordId: id })) }),
  ]);
  await audit(user, "UPDATE", "Prontuário", id, "Evolução editada");
  revalidatePath(`/admin/prontuario/${id}`);
  return { ok: true, message: "Registro atualizado." };
}
