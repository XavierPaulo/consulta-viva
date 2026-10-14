"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { sendNotification } from "@/lib/notify";
import type { ActionState } from "@/components/action-form";

export async function replyMessage(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("mensagens", "edit");
  const reply = String(form.get("reply") ?? "").trim();
  if (reply.length < 2) return { error: "Escreva a resposta." };
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return { error: "Mensagem não encontrada." };
  const clinic = await getClinic();
  const body = `Olá, ${msg.name.split(" ")[0]}! ${reply}\n\n— ${user.name}, ${clinic.name}`;
  if (msg.preferredChannel === "WHATSAPP" && msg.whatsapp) await sendNotification({ channel: "WHATSAPP", to: msg.whatsapp, body, related: id });
  else await sendNotification({ channel: "EMAIL", to: msg.email, subject: `Resposta – ${clinic.name}`, body, related: id });
  await prisma.message.update({ where: { id }, data: { reply, repliedAt: new Date(), repliedById: user.id, status: "RESPONDIDA" } });
  await audit(user, "UPDATE", "Mensagem", id, `Respondida por ${msg.preferredChannel}`);
  revalidatePath("/admin/mensagens");
  return { ok: true, message: `Resposta enviada por ${msg.preferredChannel === "WHATSAPP" ? "WhatsApp" : "e-mail"}.` };
}

export async function setMessageStatus(id: string, status: string) {
  const user = await requireUser("mensagens", "edit");
  await prisma.message.update({ where: { id }, data: { status } });
  await audit(user, "UPDATE", "Mensagem", id, `Status: ${status}`);
  revalidatePath("/admin/mensagens");
}
