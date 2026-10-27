import { prisma } from "./db";
import { onlyDigits } from "./format";

/**
 * Envio de e-mail / SMS / WhatsApp.
 * Cada canal usa um provedor real quando as variáveis de ambiente dele existem; sem elas, o envio é
 * simulado (fica só registrado na tabela Notification). Tudo o que sai fica registrado, com status.
 *
 * WhatsApp: API oficial do WhatsApp Business (Meta Cloud API)
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_TEMPLATE (opcional): nome de um modelo aprovado com um parâmetro {{1}} no corpo.
 *   A Meta só aceita texto livre dentro de 24 h após a última mensagem do paciente; fora disso, use modelo.
 * SMS: Twilio — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
 * E-mail: Resend — RESEND_API_KEY, EMAIL_FROM
 */
export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

type SendResult = { provider: string; status: "ENVIADO" | "FALHOU" | "SIMULADO"; error?: string };

const env = (k: string) => process.env[k]?.trim() || "";

/** Telefone no formato internacional, só dígitos (55 + DDD + número). */
export function e164(phone: string) {
  const d = onlyDigits(phone);
  if (!d) return "";
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export function providerFor(channel: Channel) {
  if (channel === "WHATSAPP") return env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") ? "whatsapp-cloud" : null;
  if (channel === "SMS") return env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM") ? "twilio" : null;
  return env("RESEND_API_KEY") && env("EMAIL_FROM") ? "resend" : null;
}

/** true quando nenhum canal tem provedor real (modo demonstração). */
export function allSimulated() {
  return !providerFor("WHATSAPP") && !providerFor("SMS") && !providerFor("EMAIL");
}

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function deliver(channel: Channel, to: string, subject: string, body: string): Promise<SendResult> {
  const provider = providerFor(channel);
  if (!provider) return { provider: "simulado", status: "SIMULADO" };
  try {
    if (provider === "whatsapp-cloud") {
      const template = env("WHATSAPP_TEMPLATE");
      // Parâmetros de modelo não aceitam quebras de linha nem muitos espaços seguidos
      const param = body.replace(/\s*\n\s*/g, " · ").replace(/ {4,}/g, " ");
      await post(`https://graph.facebook.com/v21.0/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          template
            ? {
                messaging_product: "whatsapp",
                to: e164(to),
                type: "template",
                template: {
                  name: template,
                  language: { code: env("WHATSAPP_TEMPLATE_LANG") || "pt_BR" },
                  components: [{ type: "body", parameters: [{ type: "text", text: param }] }],
                },
              }
            : { messaging_product: "whatsapp", to: e164(to), type: "text", text: { body, preview_url: true } },
        ),
      });
    } else if (provider === "twilio") {
      const sid = env("TWILIO_ACCOUNT_SID");
      await post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: `+${e164(to)}`, From: env("TWILIO_FROM"), Body: body }),
      });
    } else {
      await post("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject: subject || "Mensagem da clínica", text: body }),
      });
    }
    return { provider, status: "ENVIADO" };
  } catch (e) {
    return { provider, status: "FALHOU", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendNotification(input: { channel: Channel; to: string; subject?: string; body: string; related?: string }) {
  if (!input.to) return null;
  const result = await deliver(input.channel, input.to, input.subject ?? "", input.body);
  return prisma.notification.create({
    data: {
      channel: input.channel,
      to: input.to,
      subject: input.subject ?? "",
      body: input.body,
      related: input.related ?? "",
      status: result.status,
      provider: result.provider,
      error: result.error ?? "",
    },
  });
}

/** Endereço público do sistema, para links enviados por mensagem. */
export function appUrl(path: string) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
