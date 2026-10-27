import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Transcrição da teleconsulta e rascunho do SOAP.
 * - Áudio → texto: Deepgram (streaming ao vivo, nova-3, pt-BR). O navegador do médico conecta direto no Deepgram com
 *   um token temporário (30 s, só para abrir a conexão) emitido aqui; a chave da clínica nunca vai para o navegador.
 *   O áudio não passa nem fica guardado no ConsultaViva.
 * - Texto → SOAP: Claude, com saída estruturada. O médico revisa tudo antes de salvar.
 * Sem DEEPGRAM_API_KEY / ANTHROPIC_API_KEY, os dois funcionam em modo de demonstração.
 */

export const DEEPGRAM_LISTEN_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&smart_format=true&punctuate=true&interim_results=true&endpointing=300";

export function transcriptionProvider(): "deepgram" | "demo" {
  return process.env.DEEPGRAM_API_KEY ? "deepgram" : "demo";
}

export function soapDraftProvider(): "claude" | "demo" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "demo";
}

/** Token temporário do Deepgram (JWT) para o navegador abrir a conexão de streaming. */
export async function deepgramToken() {
  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 60 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export type TranscriptLine = { speaker: "Médico" | "Paciente" | "Consulta"; text: string };

const SoapDraft = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  prescriptions: z.array(z.object({ medication: z.string(), dosage: z.string(), instructions: z.string() })),
});
export type SoapDraft = z.infer<typeof SoapDraft>;

const SYSTEM = `Você ajuda médicos brasileiros a redigir o prontuário de uma teleconsulta a partir da transcrição automática da conversa.
Escreva em português do Brasil, em linguagem clínica concisa, no formato SOAP:
- subjective: queixa principal, história da doença atual, antecedentes e medicações em uso, como relatados pelo paciente.
- objective: apenas o que foi observado ou medido e dito na conversa (sinais vitais informados, achados à câmera, resultados de exames citados). Em teleconsulta o exame físico é limitado; não invente achados. Se nada foi dito, deixe vazio.
- assessment: hipóteses diagnósticas que o médico mencionou ou que decorrem diretamente do que ele disse. Não acrescente diagnósticos que o médico não considerou.
- plan: conduta, exames solicitados, orientações, sinais de alarme e retorno, como combinados na conversa.
- prescriptions: só medicamentos que o médico prescreveu explicitamente, com concentração e posologia quando ditas. Não sugira medicamentos.
A transcrição pode ter erros de reconhecimento de fala; corrija termos médicos evidentes, mas não preencha lacunas com suposições.
Use apenas informações presentes na transcrição. Campo sem informação fica como string vazia.`;

/** Gera o rascunho do SOAP a partir das falas transcritas. */
export async function draftSoap(lines: TranscriptLine[], context: { specialty: string; patientAge: string }): Promise<SoapDraft> {
  if (soapDraftProvider() === "demo") return demoDraft(lines);
  const client = new Anthropic();
  const transcript = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SoapDraft) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Especialidade: ${context.specialty || "não informada"}. Paciente: ${context.patientAge || "idade não informada"}.\n\n<transcricao>\n${transcript}\n</transcricao>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("A IA não conseguiu gerar o rascunho para esta conversa. Escreva o prontuário manualmente.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new Error("O rascunho veio incompleto. Tente de novo.");
  return response.parsed_output;
}

/** Modo de demonstração: organiza as falas por palavras-chave, sem IA. */
function demoDraft(lines: TranscriptLine[]): SoapDraft {
  const by = (s: TranscriptLine["speaker"]) => lines.filter((l) => l.speaker === s).map((l) => l.text);
  // falas seguidas da mesma pessoa chegam juntas; separa em frases para classificar cada uma
  const doctor = by("Médico").flatMap((t) => t.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/));
  const pick = (texts: string[], re: RegExp) => texts.filter((t) => re.test(t)).join(" ");
  const rx = doctor.filter((t) => /\b(prescrev|vou passar)/i.test(t));
  return {
    subjective: [...by("Paciente"), ...by("Consulta")].join(" "),
    objective: pick(doctor, /\b(press[aã]o|temperatura|satura|frequ[eê]ncia|vejo|observo)/i),
    assessment: pick(doctor, /\b(parece|provavelmente|hip[oó]tese|suspeita|quadro de|diagn[oó]stico)/i),
    plan: pick(doctor, /\b(retorno|solicit|orient|repouso|hidrata|procure)/i),
    prescriptions: rx.map((t) => ({
      medication: t.match(/([A-Za-zÀ-ú]+ \d+(?:,\d+)?\s?(?:mg|g|ml))/i)?.[1] ?? "",
      dosage: t.match(/(\d+ (?:comprimido|c[aá]psula|gota)s?[^,.]*)/i)?.[1] ?? "",
      instructions: t.match(/(por \d+ dias[^.]*)/i)?.[1] ?? "",
    })).filter((p) => p.medication),
  };
}
