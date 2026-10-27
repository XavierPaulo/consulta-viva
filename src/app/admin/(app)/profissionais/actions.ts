"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { parseMoney, slugify } from "@/lib/format";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function saveProfessional(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("profissionais", id ? "edit" : "create");
  const name = str(form, "name");
  const crm = str(form, "crm");
  const fe: Record<string, string> = {};
  if (name.length < 3) fe.name = "Informe o nome.";
  if (!crm) fe.crm = "Informe o CRM.";
  if (!str(form, "education")) fe.education = "Formação é obrigatória na página pública.";
  if (!str(form, "experience")) fe.experience = "Experiência é obrigatória na página pública.";
  const specialties = form.getAll("specialties").map(String);
  if (!specialties.length) fe.specialties = "Selecione ao menos uma especialidade.";
  const inPerson = !!form.get("inPerson");
  const telemedicine = !!form.get("telemedicine");
  if (!inPerson && !telemedicine) fe.type = "Marque presencial e/ou teleconsulta.";

  const wd = form.getAll("av_weekday").map(Number);
  const st = form.getAll("av_start").map(String);
  const en = form.getAll("av_end").map(String);
  const un = form.getAll("av_unit").map(String);
  const availability = wd
    .map((w, i) => ({ weekday: w, startTime: st[i]!, endTime: en[i]!, unitId: un[i] || null }))
    .filter((a) => a.startTime && a.endTime);
  if (availability.some((a) => a.startTime >= a.endTime)) fe.availability = "Em cada faixa de horário, o início precisa ser antes do fim.";
  if (Object.keys(fe).length) return { error: "Confira os campos:", fieldErrors: fe };

  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const other = await prisma.professional.findUnique({ where: { slug } });
    if (!other || other.id === id) break;
    slug = `${base}-${i}`;
  }
  const data = {
    name,
    slug,
    title: str(form, "title") || "Dr(a).",
    crm,
    crmUf: str(form, "crmUf").toUpperCase() || "SP",
    photoUrl: str(form, "photoUrl"),
    gallery: JSON.stringify(str(form, "gallery").split(/\s+/).filter((u) => /^https?:\/\//.test(u))),
    bio: str(form, "bio"),
    education: str(form, "education"),
    experience: str(form, "experience"),
    priceCents: parseMoney(form.get("price")),
    durationMin: Math.max(10, Number(str(form, "durationMin")) || 30),
    payoutPercent: Math.max(0, Math.min(100, Number(str(form, "payoutPercent") || 70))),
    cbo: str(form, "cbo").replace(/\D/g, "") || "225125",
    inPerson,
    telemedicine,
    published: !!form.get("published"),
    unitId: str(form, "unitId") || null,
  };
  const ins = form.getAll("insurances").map(String);
  let pid = id;
  if (id) {
    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { professionalId: id } }),
      prisma.professional.update({
        where: { id },
        data: {
          ...data,
          specialties: { set: specialties.map((s) => ({ id: s })) },
          insurances: { set: ins.map((s) => ({ id: s })) },
          availability: { create: availability },
        },
      }),
    ]);
    await audit(user, "UPDATE", "Profissional", id, name);
  } else {
    const p = await prisma.professional.create({
      data: { ...data, specialties: { connect: specialties.map((s) => ({ id: s })) }, insurances: { connect: ins.map((s) => ({ id: s })) }, availability: { create: availability } },
    });
    pid = p.id;
    await audit(user, "CREATE", "Profissional", p.id, name);
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/profissionais/${pid}?ok=1`);
  return { ok: true, message: "Profissional salvo. A página pública já foi atualizada." };
}
