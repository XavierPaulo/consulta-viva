import { randomBytes } from "node:crypto";
import { prisma } from "./db";

/**
 * Teleconsulta por vídeo com Jitsi Meet (código aberto, criptografado, sem instalar nada).
 * Cada consulta tem uma sala com nome aleatório e impossível de adivinhar.
 * Servidor padrão: meet.jit.si (gratuito; o médico entra com uma conta Google/GitHub para abrir a sala).
 * Para abrir o vídeo dentro do sistema, sem limite de tempo, configure um Jitsi próprio ou o JaaS (8x8)
 * e marque "abrir dentro do sistema" nas Configurações.
 */
export const ROOM_OPENS_MIN_BEFORE = 30;
export const ROOM_CLOSES_MIN_AFTER = 60;

export const DEFAULT_TELE_CONSENT =
  "Declaro que fui informado(a) de que a teleconsulta é um atendimento médico a distância, feito por vídeo, nos termos da Resolução CFM nº 2.314/2022. " +
  "Entendo que o médico pode indicar consulta presencial se julgar necessário, que a chamada não é gravada e que os dados do atendimento ficam registrados no meu prontuário, com sigilo. " +
  "Estou em um local reservado e concordo em realizar a consulta desta forma.";

export function roomWindow(a: { start: Date; end: Date }) {
  return {
    opensAt: new Date(a.start.getTime() - ROOM_OPENS_MIN_BEFORE * 60_000),
    closesAt: new Date(a.end.getTime() + ROOM_CLOSES_MIN_AFTER * 60_000),
  };
}

export function roomState(a: { start: Date; end: Date; status: string; type: string }, at = Date.now()) {
  if (a.type !== "TELECONSULTA") return "nao-tele" as const;
  if (["CANCELADA", "FALTOU"].includes(a.status)) return "encerrada" as const;
  const { opensAt, closesAt } = roomWindow(a);
  if (at < opensAt.getTime()) return "cedo" as const;
  if (at > closesAt.getTime()) return "encerrada" as const;
  return "aberta" as const;
}

export async function ensureRoom(appointmentId: string) {
  const a = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: { videoRoom: true } });
  if (a.videoRoom) return a.videoRoom;
  const room = `ConsultaViva-${randomBytes(15).toString("base64url").replace(/[-_]/g, "x")}`;
  // updateMany com filtro evita sobrescrever se médico e paciente entrarem ao mesmo tempo
  await prisma.appointment.updateMany({ where: { id: appointmentId, videoRoom: null }, data: { videoRoom: room } });
  return (await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, select: { videoRoom: true } })).videoRoom!;
}

export function roomUrl(baseUrl: string, room: string, displayName: string) {
  const base = (baseUrl || "https://meet.jit.si").replace(/\/$/, "");
  const cfg = [
    `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`,
    "config.prejoinConfig.enabled=false",
    "config.disableDeepLinking=true",
    "config.defaultLanguage=%22ptBR%22",
  ].join("&");
  return `${base}/${room}#${cfg}`;
}
