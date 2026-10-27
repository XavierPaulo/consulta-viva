import { prisma } from "./db";
import { getClinic } from "./clinic";
import { appUrl, sendNotification, type Channel } from "./notify";
import { fmtLongDate, fmtTime, parseJson } from "./format";
import { APPOINTMENT_TYPES } from "./constants";

export const DEFAULT_REMINDER_TEMPLATE =
  "Olá, {paciente}! Lembrete da sua consulta com {profissional}: {quando} ({tipo}). {local}Para confirmar, remarcar ou cancelar: {link}";

export const REMINDER_VARS = ["{paciente}", "{profissional}", "{quando}", "{tipo}", "{local}", "{link}", "{clinica}"];

type ApptForMessage = {
  start: Date;
  type: string;
  manageToken: string;
  patient: { name: string };
  professional: { title: string; name: string };
  unit: { name: string; address: string } | null;
};

/** Monta o texto do lembrete a partir do modelo configurado. */
export function reminderText(template: string, clinicName: string, a: ApptForMessage) {
  const tele = a.type === "TELECONSULTA";
  const local = tele
    ? `Na hora, entre pela sala virtual: ${appUrl(`/consulta/${a.manageToken}/sala`)} . `
    : a.unit
      ? `Local: ${a.unit.name}, ${a.unit.address}. `
      : "";
  const values: Record<string, string> = {
    "{paciente}": a.patient.name.split(" ")[0]!,
    "{profissional}": `${a.professional.title} ${a.professional.name}`,
    "{quando}": `${fmtLongDate(a.start)}, às ${fmtTime(a.start)}`,
    "{tipo}": APPOINTMENT_TYPES[a.type as keyof typeof APPOINTMENT_TYPES] ?? a.type,
    "{local}": local,
    "{link}": appUrl(`/consulta/${a.manageToken}`),
    "{clinica}": clinicName,
  };
  return (template || DEFAULT_REMINDER_TEMPLATE).replace(/\{[a-z]+\}/g, (m) => values[m] ?? m).replace(/\s{2,}/g, " ").trim();
}

const include = { patient: true, professional: true, unit: true } as const;

async function sendFor(channels: Channel[], template: string, clinicName: string, a: ApptForMessage & { id: string; patient: { name: string; phone: string; email: string } }) {
  const body = reminderText(template, clinicName, a);
  let sent = 0;
  for (const channel of channels) {
    const to = channel === "EMAIL" ? a.patient.email : a.patient.phone;
    if (!to) continue;
    await sendNotification({ channel, to, subject: `Lembrete: consulta em ${fmtLongDate(a.start)}`, body, related: a.id });
    sent++;
  }
  return sent;
}

/**
 * Envia os lembretes automáticos que estiverem na hora: 24 h antes (pede confirmação) e 2 h antes.
 * É idempotente: cada consulta recebe cada lembrete uma única vez (reminder24hAt / reminder2hAt).
 * Roda sozinho a cada 5 min (src/instrumentation.ts) e também pode ser chamado por um cron externo
 * em /api/cron/lembretes.
 */
export async function runReminders(at = new Date()) {
  const clinic = await getClinic();
  if (!clinic.remindersEnabled) return { sent24: 0, sent2: 0, skipped: "desativado" };
  const channels = parseJson<Channel[]>(clinic.reminderChannels, []).filter((c) => ["WHATSAPP", "SMS", "EMAIL"].includes(c));
  if (!channels.length) return { sent24: 0, sent2: 0, skipped: "sem canais" };
  const t = at.getTime();
  const H = 3600_000;
  const base = { status: { in: ["AGENDADA", "CONFIRMADA"] }, patient: { remindersOptOut: false } };
  let sent24 = 0;
  let sent2 = 0;

  if (clinic.reminder24h) {
    // janela de 24 h até 3 h antes; ignora quem agendou há menos de 1 h (acabou de receber a confirmação)
    const due = await prisma.appointment.findMany({
      where: { ...base, reminder24hAt: null, start: { gt: new Date(t + 3 * H), lte: new Date(t + 24 * H) }, createdAt: { lte: new Date(t - H) } },
      include,
      take: 200,
    });
    for (const a of due) {
      // marca antes de enviar: se dois processos rodarem juntos, só um envia
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminder24hAt: null }, data: { reminder24hAt: at } });
      if (claimed.count) sent24 += (await sendFor(channels, clinic.reminderTemplate, clinic.name, a)) ? 1 : 0;
    }
  }
  if (clinic.reminder2h) {
    const due = await prisma.appointment.findMany({
      where: { ...base, reminder2hAt: null, start: { gt: new Date(t), lte: new Date(t + 2 * H) }, createdAt: { lte: new Date(t - 30 * 60_000) } },
      include,
      take: 200,
    });
    for (const a of due) {
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminder2hAt: null }, data: { reminder2hAt: at } });
      if (claimed.count) sent2 += (await sendFor(channels, clinic.reminderTemplate, clinic.name, a)) ? 1 : 0;
    }
  }
  return { sent24, sent2 };
}

/** Lembrete manual (botão na consulta): usa o mesmo modelo e os mesmos canais. */
export async function sendManualReminder(appointmentId: string) {
  const clinic = await getClinic();
  const a = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include });
  const channels = parseJson<Channel[]>(clinic.reminderChannels, ["WHATSAPP", "EMAIL"]);
  return sendFor(channels.length ? channels : ["WHATSAPP"], clinic.reminderTemplate, clinic.name, a);
}
