"use server";

import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { roomState } from "@/lib/video";
import { DEEPGRAM_LISTEN_URL, deepgramToken, draftSoap, transcriptionProvider, type SoapDraft, type TranscriptLine } from "@/lib/transcription";

async function load(id: string) {
  const user = await requireUser("prontuario", "create");
  const appt = await prisma.appointment.findUnique({ where: { id }, include: { patient: true, professional: { include: { specialties: true } } } });
  const scope = ownProfessionalScope(user);
  if (!appt || appt.type !== "TELECONSULTA" || (scope && appt.professionalId !== scope)) throw new Error("Consulta não encontrada");
  return { user, appt };
}

export type TranscriptionStart = { mode: "deepgram"; token: string; url: string } | { mode: "demo" } | { error: string };

/** Libera a transcrição: confere a autorização do paciente e devolve um token temporário do Deepgram. */
export async function startTranscription(id: string): Promise<TranscriptionStart> {
  const { user, appt } = await load(id);
  const clinic = await getClinic();
  if (!clinic.transcriptionEnabled) return { error: "A transcrição está desligada nas Configurações › Telemedicina." };
  if (!appt.transcriptConsentAt) return { error: "O paciente não autorizou a transcrição desta consulta." };
  if (roomState(appt) !== "aberta") return { error: "A sala desta teleconsulta não está aberta." };
  await audit(user, "CREATE", "Transcrição", id, "Iniciou a transcrição da teleconsulta");
  if (transcriptionProvider() === "demo") return { mode: "demo" };
  try {
    return { mode: "deepgram", token: await deepgramToken(), url: DEEPGRAM_LISTEN_URL };
  } catch (e) {
    console.error("[transcrição]", e);
    return { error: "Não foi possível conectar ao serviço de transcrição. Confira a chave do Deepgram." };
  }
}

/** Organiza a transcrição em rascunho de SOAP. Nada é salvo aqui: o médico revisa e salva pelo formulário. */
export async function draftSoapFromTranscript(id: string, lines: TranscriptLine[]): Promise<{ draft: SoapDraft } | { error: string }> {
  const { user, appt } = await load(id);
  if (!appt.transcriptConsentAt) return { error: "O paciente não autorizou a transcrição desta consulta." };
  const clean = lines
    .filter((l) => ["Médico", "Paciente", "Consulta"].includes(l.speaker) && typeof l.text === "string" && l.text.trim())
    .map((l) => ({ speaker: l.speaker, text: l.text.trim().slice(0, 2000) }))
    .slice(-600);
  if (clean.length < 2) return { error: "Ainda há pouca conversa transcrita para montar o rascunho." };
  const age = appt.patient.birthDate ? `${Math.floor((appt.start.getTime() - appt.patient.birthDate.getTime()) / 31_557_600_000)} anos` : "";
  try {
    const draft = await draftSoap(clean, { specialty: appt.professional.specialties.map((s) => s.name).join(", "), patientAge: age });
    await audit(user, "CREATE", "Rascunho SOAP", id, `Rascunho gerado a partir de ${clean.length} falas`);
    return { draft };
  } catch (e) {
    console.error("[rascunho SOAP]", e);
    return { error: e instanceof Error && /^(A IA|O rascunho)/.test(e.message) ? e.message : "Não foi possível gerar o rascunho agora. Tente de novo ou escreva manualmente." };
  }
}
