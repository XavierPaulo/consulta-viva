import { prisma } from "./db";

/**
 * Envio de e-mail / SMS / WhatsApp.
 * No MVP o envio é simulado: tudo fica registrado na tabela Notification e aparece em Comunicação.
 * Para produção, implemente os provedores aqui (ex.: SMTP/Resend, Twilio, WhatsApp Business API).
 */
export async function sendNotification(input: {
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  to: string;
  subject?: string;
  body: string;
  related?: string;
}) {
  if (!input.to) return null;
  return prisma.notification.create({
    data: {
      channel: input.channel,
      to: input.to,
      subject: input.subject ?? "",
      body: input.body,
      related: input.related ?? "",
      status: "SIMULADO",
    },
  });
}
