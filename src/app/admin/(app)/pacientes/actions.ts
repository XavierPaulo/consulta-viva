"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { isValidCpf, onlyDigits } from "@/lib/format";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function readPatient(form: FormData) {
  const birth = str(form, "birthDate");
  return {
    name: str(form, "name"),
    cpf: onlyDigits(str(form, "cpf")) || null,
    phone: onlyDigits(str(form, "phone")),
    email: str(form, "email").toLowerCase(),
    birthDate: birth ? new Date(`${birth}T12:00:00-03:00`) : null,
    sex: str(form, "sex"),
    address: str(form, "address"),
    notes: str(form, "notes"),
    insuranceId: str(form, "insuranceId") || null,
    insuranceCard: str(form, "insuranceCard").replace(/\s/g, ""),
  };
}

function validate(d: ReturnType<typeof readPatient>) {
  const fe: Record<string, string> = {};
  if (d.name.length < 3) fe.name = "Informe o nome completo.";
  if (d.phone.length < 10) fe.phone = "Informe o telefone com DDD.";
  if (d.cpf && !isValidCpf(d.cpf)) fe.cpf = "CPF inválido.";
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) fe.email = "E-mail inválido.";
  return fe;
}

export async function createPatient(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("pacientes", "create");
  const data = readPatient(form);
  const fe = validate(data);
  if (Object.keys(fe).length) return { error: "Confira os campos:", fieldErrors: fe };
  if (data.cpf && (await prisma.patient.findUnique({ where: { cpf: data.cpf } }))) return { error: "Já existe um paciente com este CPF." };
  const p = await prisma.patient.create({ data: { ...data, lgpdConsentAt: form.get("lgpd") ? new Date() : null } });
  await audit(user, "CREATE", "Paciente", p.id);
  redirect(`/admin/pacientes/${p.id}?ok=1`);
}

export async function updatePatient(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("pacientes", "edit");
  const data = readPatient(form);
  const fe = validate(data);
  if (Object.keys(fe).length) return { error: "Confira os campos:", fieldErrors: fe };
  if (data.cpf) {
    const other = await prisma.patient.findUnique({ where: { cpf: data.cpf } });
    if (other && other.id !== id) return { error: "Este CPF pertence a outro paciente." };
  }
  const before = await prisma.patient.findUnique({ where: { id } });
  await prisma.patient.update({
    where: { id },
    data: { ...data, ...(form.get("lgpd") && !before?.lgpdConsentAt ? { lgpdConsentAt: new Date() } : {}) },
  });
  const changed = before ? Object.keys(data).filter((k) => String(before[k as keyof typeof before] ?? "") !== String(data[k as keyof typeof data] ?? "")) : [];
  await audit(user, "UPDATE", "Paciente", id, changed.length ? `Campos: ${changed.join(", ")}` : "");
  revalidatePath(`/admin/pacientes/${id}`);
  return { ok: true, message: "Cadastro atualizado." };
}

export async function resolvePrivacyRequest(id: string) {
  const user = await requireUser("pacientes", "edit");
  const r = await prisma.patientRequest.update({ where: { id }, data: { status: "CONCLUIDO", resolvedAt: new Date() } });
  await audit(user, "UPDATE", "Pedido LGPD", r.patientId, `${r.kind} atendido`);
  revalidatePath(`/admin/pacientes/${r.patientId}`);
}
