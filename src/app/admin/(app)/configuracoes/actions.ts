"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { parseMoney, slugify } from "@/lib/format";
import { PAYMENT_METHODS, PUBLIC_SECTIONS } from "@/lib/constants";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function guard() {
  return requireUser("configuracoes", "edit");
}
function done(msg = "Configurações salvas.") {
  revalidatePath("/", "layout");
  return { ok: true, message: msg } satisfies ActionState;
}

export async function saveClinic(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const fields = ["name", "tagline", "about", "cnpj", "phone", "whatsapp", "email", "address", "logoUrl", "heroImageUrl", "openingHours", "instagram", "facebook", "linkedin", "youtube"] as const;
  const data = Object.fromEntries(fields.filter((f) => form.has(f)).map((f) => [f, str(form, f)]));
  if (form.has("name") && !data.name) return { error: "O nome da clínica é obrigatório." };
  const color = str(form, "primaryColor");
  await prisma.clinic.update({ where: { id: "clinic" }, data: { ...data, ...(color ? { primaryColor: color } : {}) } });
  await audit(user, "UPDATE", "Configurações", "clinica", Object.keys(data).join(", "));
  return done();
}

export async function savePublicPage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const hidden = PUBLIC_SECTIONS.filter((s) => !s.required && form.get(`hide_${s.key}`)).map((s) => s.key);
  const methods = Object.keys(PAYMENT_METHODS).filter((m) => form.get(`pm_${m}`));
  if (!methods.length) return { error: "Formas de pagamento é um campo obrigatório: marque ao menos uma." };
  await prisma.clinic.update({
    where: { id: "clinic" },
    data: { hiddenSections: JSON.stringify(hidden), paymentMethods: JSON.stringify(methods), maxInstallments: Math.max(1, Math.min(12, Number(str(form, "maxInstallments")) || 1)) },
  });
  await audit(user, "UPDATE", "Configurações", "pagina-publica", `Ocultas: ${hidden.join(", ") || "nenhuma"}`);
  return done("Página pública atualizada.");
}

export async function saveRules(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const n = (k: string, d: number) => Math.max(0, Number(str(form, k)) || d);
  await prisma.clinic.update({
    where: { id: "clinic" },
    data: {
      minBookingHours: n("minBookingHours", 2),
      cancelMinHours: n("cancelMinHours", 24),
      bookingWindowDays: n("bookingWindowDays", 60),
      cancellationPolicy: str(form, "cancellationPolicy"),
    },
  });
  await audit(user, "UPDATE", "Configurações", "regras");
  return done();
}

export async function saveLegal(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  if (!str(form, "privacyPolicy") || !str(form, "termsOfUse")) return { error: "Política de Privacidade e Termos de Uso são obrigatórios." };
  await prisma.clinic.update({ where: { id: "clinic" }, data: { privacyPolicy: str(form, "privacyPolicy"), termsOfUse: str(form, "termsOfUse") } });
  await audit(user, "UPDATE", "Configurações", "lgpd");
  return done();
}

// ---- cadastros auxiliares ----

export async function saveSpecialty(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const name = str(form, "name");
  if (!name) return { error: "Informe o nome." };
  const data = { name, slug: slugify(name), description: str(form, "description"), symptoms: str(form, "symptoms"), icon: str(form, "icon") || "stethoscope", active: !!form.get("active") };
  try {
    if (id) await prisma.specialty.update({ where: { id }, data });
    else await prisma.specialty.create({ data });
  } catch {
    return { error: "Já existe uma especialidade com esse nome." };
  }
  await audit(user, id ? "UPDATE" : "CREATE", "Especialidade", id ?? "", name);
  return done(id ? "Especialidade salva." : "Especialidade criada.");
}

export async function saveInsurance(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const name = str(form, "name");
  if (!name) return { error: "Informe o nome." };
  const data = { name, active: !!form.get("active"), priceCents: form.get("price") ? parseMoney(form.get("price")) : null };
  try {
    if (id) await prisma.insurance.update({ where: { id }, data });
    else await prisma.insurance.create({ data });
  } catch {
    return { error: "Já existe um convênio com esse nome." };
  }
  await audit(user, id ? "UPDATE" : "CREATE", "Convênio", id ?? "", name);
  return done(id ? "Convênio salvo." : "Convênio criado.");
}

export async function saveUnit(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const name = str(form, "name");
  if (!name) return { error: "Informe o nome." };
  const data = { name, address: str(form, "address"), active: !!form.get("active") };
  if (id) await prisma.unit.update({ where: { id }, data });
  else await prisma.unit.create({ data });
  await audit(user, id ? "UPDATE" : "CREATE", "Unidade", id ?? "", name);
  return done(id ? "Unidade salva." : "Unidade criada.");
}

export async function saveFaq(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const question = str(form, "question");
  const answer = str(form, "answer");
  if (!question || !answer) return { error: "Preencha pergunta e resposta." };
  const data = { question, answer, order: Number(str(form, "order")) || 0 };
  if (id) await prisma.faqItem.update({ where: { id }, data });
  else await prisma.faqItem.create({ data });
  await audit(user, id ? "UPDATE" : "CREATE", "FAQ", id ?? "", question);
  return done(id ? "Pergunta salva." : "Pergunta adicionada.");
}

export async function deleteFaq(id: string) {
  const user = await guard();
  await prisma.faqItem.delete({ where: { id } });
  await audit(user, "DELETE", "FAQ", id);
  revalidatePath("/", "layout");
}

export async function saveTestimonial(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await guard();
  const author = str(form, "author");
  const text = str(form, "text");
  if (!author || !text) return { error: "Preencha autor e depoimento." };
  const data = { author, text, rating: Math.min(5, Math.max(1, Number(str(form, "rating")) || 5)), authorized: !!form.get("authorized") };
  if (id) await prisma.testimonial.update({ where: { id }, data });
  else await prisma.testimonial.create({ data });
  await audit(user, id ? "UPDATE" : "CREATE", "Depoimento", id ?? "", `${author} (autorizado: ${data.authorized ? "sim" : "não"})`);
  return done(id ? "Depoimento salvo." : "Depoimento adicionado.");
}

export async function deleteTestimonial(id: string) {
  const user = await guard();
  await prisma.testimonial.delete({ where: { id } });
  await audit(user, "DELETE", "Depoimento", id);
  revalidatePath("/", "layout");
}
