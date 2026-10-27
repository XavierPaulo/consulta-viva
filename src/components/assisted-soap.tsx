"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AudioLines, Mic, Sparkles, Square, Trash2 } from "lucide-react";
import { draftSoapFromTranscript, startTranscription } from "@/app/admin/(app)/agenda/[id]/sala/actions";
import type { SoapDraft, TranscriptLine } from "@/lib/transcription";
import { SoapFields } from "./soap-form";
import { Notice } from "./ui";

type Availability = "ready" | "no-consent" | "disabled";
type Item = { medication: string; dosage: string; instructions: string };
type Fields = { subjective: string; objective: string; assessment: string; plan: string; items: Item[] };

// conversa de exemplo do modo de demonstração (sem chave do Deepgram)
const DEMO: TranscriptLine[] = [
  { speaker: "Médico", text: "Boa tarde! Me conte o que está acontecendo." },
  { speaker: "Paciente", text: "Doutora, estou com dor de garganta e febre há três dias. Ontem a febre chegou a 38,5." },
  { speaker: "Médico", text: "Tem tosse, coriza ou dificuldade para engolir?" },
  { speaker: "Paciente", text: "Dói muito para engolir, mas não tenho tosse. Estou tomando dipirona quando a febre sobe." },
  { speaker: "Médico", text: "Tem alergia a algum medicamento?" },
  { speaker: "Paciente", text: "Não, nenhuma." },
  { speaker: "Médico", text: "Abra a boca perto da câmera, por favor. Observo as amígdalas aumentadas e com placas brancas." },
  { speaker: "Médico", text: "Parece um quadro de amigdalite bacteriana." },
  { speaker: "Médico", text: "Vou prescrever amoxicilina 500 mg, 1 comprimido de 8 em 8 horas, por 10 dias." },
  { speaker: "Médico", text: "Mantenha a dipirona se tiver febre, com hidratação e repouso. Procure o pronto-socorro se tiver falta de ar. Retorno em 7 dias se não melhorar." },
];

const merge = (mine: string, draft: string) => {
  const a = mine.trim();
  const b = draft.trim();
  if (!b || a.includes(b)) return a;
  return a ? `${a}\n\n${b}` : b;
};

/**
 * Prontuário da teleconsulta com transcrição ao vivo: o áudio do médico (microfone) e do paciente (som da aba da chamada)
 * vai direto do navegador para o Deepgram; o texto aparece aqui e vira rascunho de SOAP. O áudio não é gravado, e a
 * transcrição fica só neste navegador até o fim da sessão. Só entra no prontuário o que o médico salvar.
 */
export function AssistedSoap({ appointmentId, availability, demo, embed }: { appointmentId: string; availability: Availability; demo: boolean; embed: boolean }) {
  const storeKey = `cv-transcricao-${appointmentId}`;
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState<Partial<Record<TranscriptLine["speaker"], string>>>({});
  const [status, setStatus] = useState<"idle" | "starting" | "live">("idle");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [version, setVersion] = useState(0);
  const [drafting, startDraft] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storeKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a transcrição depois de recarregar a página
      if (saved) setLines(JSON.parse(saved));
    } catch {}
    return () => stopRef.current();
  }, [storeKey]);

  useEffect(() => {
    try {
      if (lines.length) sessionStorage.setItem(storeKey, JSON.stringify(lines));
      else sessionStorage.removeItem(storeKey);
    } catch {}
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim, storeKey]);

  const add = (speaker: TranscriptLine["speaker"], text: string) =>
    setLines((prev) => {
      const last = prev.at(-1);
      // mesma pessoa falando em sequência: junta na mesma fala
      if (last && last.speaker === speaker && last.text.length < 400) return [...prev.slice(0, -1), { speaker, text: `${last.text} ${text}` }];
      return [...prev, { speaker, text }];
    });

  async function start() {
    setError("");
    setNote("");
    setStatus("starting");
    const res = await startTranscription(appointmentId);
    if ("error" in res) {
      setError(res.error);
      setStatus("idle");
      return;
    }
    if (res.mode === "demo") {
      let i = 0;
      const t = setInterval(() => {
        const l = DEMO[i++];
        if (!l) return stop();
        add(l.speaker, l.text);
      }, 1800);
      stopRef.current = () => clearInterval(t);
      setStatus("live");
      return;
    }

    const cleanups: (() => void)[] = [];
    const connect = (stream: MediaStream, speaker: TranscriptLine["speaker"]) => {
      const ws = new WebSocket(res.url, ["bearer", res.token]);
      const audio = new MediaStream(stream.getAudioTracks());
      const rec = new MediaRecorder(audio, MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? { mimeType: "audio/webm;codecs=opus" } : undefined);
      let closing = false;
      ws.onopen = () => {
        rec.ondataavailable = (e) => e.data.size > 0 && ws.readyState === WebSocket.OPEN && ws.send(e.data);
        rec.start(250);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const text: string = msg?.channel?.alternatives?.[0]?.transcript ?? "";
        if (msg.type !== "Results") return;
        if (msg.is_final) {
          setInterim((p) => ({ ...p, [speaker]: "" }));
          if (text.trim()) add(speaker, text.trim());
        } else setInterim((p) => ({ ...p, [speaker]: text }));
      };
      ws.onclose = (e) => {
        if (closing) return;
        setError(e.code === 1008 || e.code === 4001 ? "O serviço de transcrição recusou a conexão. Confira a chave do Deepgram." : "A conexão da transcrição caiu. Clique em Transcrever para retomar.");
        stopRef.current();
      };
      cleanups.push(() => {
        closing = true;
        if (rec.state !== "inactive") rec.stop();
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
        setTimeout(() => ws.close(), 1500);
        stream.getTracks().forEach((t) => t.stop());
      });
    };

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      let tab: MediaStream | null = null;
      try {
        tab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, ...(embed ? { preferCurrentTab: true } : { selfBrowserSurface: "exclude" }) } as DisplayMediaStreamOptions);
        tab.getVideoTracks().forEach((t) => t.stop());
        if (!tab.getAudioTracks().length) {
          tab = null;
          setNote("A aba foi compartilhada sem o som. Para separar as falas, pare e compartilhe de novo marcando “Compartilhar áudio da guia”.");
        }
      } catch {
        setNote("Sem o som da chamada, transcrevo só pelo seu microfone. As falas aparecem como “Consulta”.");
      }
      connect(mic, tab ? "Médico" : "Consulta");
      if (tab) connect(tab, "Paciente");
      stopRef.current = () => {
        cleanups.splice(0).forEach((c) => c());
        setInterim({});
        setStatus("idle");
      };
      setStatus("live");
    } catch {
      setError("Não consegui acessar o microfone. Libere o microfone para este site no navegador e tente de novo.");
      cleanups.forEach((c) => c());
      setStatus("idle");
    }
  }

  function stop() {
    stopRef.current();
    stopRef.current = () => {};
    setStatus("idle");
  }

  function current(): Fields {
    const v = (id: string) => (box.current?.querySelector<HTMLTextAreaElement>(`#${id}`)?.value ?? "").trim();
    const all = (name: string) => [...(box.current?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? [])].map((i) => i.value);
    const meds = all("medication");
    const dos = all("dosage");
    const ins = all("instructions");
    return {
      subjective: v("subjective"),
      objective: v("objective"),
      assessment: v("assessment"),
      plan: v("plan"),
      items: meds.map((m, i) => ({ medication: m, dosage: dos[i] ?? "", instructions: ins[i] ?? "" })),
    };
  }

  function apply(d: SoapDraft) {
    const mine = current();
    const known = new Set(mine.items.map((i) => i.medication.trim().toLowerCase()));
    setFields({
      subjective: merge(mine.subjective, d.subjective),
      objective: merge(mine.objective, d.objective),
      assessment: merge(mine.assessment, d.assessment),
      plan: merge(mine.plan, d.plan),
      items: [...mine.items, ...d.prescriptions.filter((p) => p.medication.trim() && !known.has(p.medication.trim().toLowerCase()))],
    });
    setVersion((n) => n + 1);
  }

  function generate() {
    setError("");
    startDraft(async () => {
      const res = await draftSoapFromTranscript(appointmentId, lines);
      if ("error" in res) setError(res.error);
      else {
        apply(res.draft);
        setNote("Rascunho inserido nos campos abaixo, sem apagar o que você já tinha escrito. Revise e corrija antes de salvar.");
      }
    });
  }

  const live = status === "live";
  const pending = Object.entries(interim).filter(([, t]) => t);

  return (
    <div ref={box} className="space-y-5">
      {availability === "ready" ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4" aria-label="Transcrição da consulta">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <AudioLines className="size-5 text-violet-600" aria-hidden /> Transcrição da conversa
              {live && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-700" role="status">
                  <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden /> ao vivo
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {live ? (
                <button type="button" className="btn-secondary btn-sm" onClick={stop}>
                  <Square className="size-4" aria-hidden /> Parar
                </button>
              ) : (
                <button type="button" className="btn-secondary btn-sm" onClick={start} disabled={status === "starting"}>
                  <Mic className="size-4" aria-hidden /> {status === "starting" ? "Conectando…" : lines.length ? "Continuar transcrevendo" : "Transcrever consulta"}
                </button>
              )}
              {lines.length > 0 && !live && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setLines([])} aria-label="Apagar transcrição">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
          {status === "idle" && lines.length === 0 && (
            <p className="mt-2 text-sm text-muted">
              {embed
                ? "Ao começar, autorize o microfone e, na janela seguinte, escolha esta aba com o som ligado, para separar a sua fala da fala do paciente."
                : "Ao começar, autorize o microfone e, na janela seguinte, escolha a aba da chamada de vídeo marcando “Compartilhar áudio da guia”, para separar a sua fala da fala do paciente."}{" "}
              O áudio não é gravado.
              {demo && " Modo de demonstração: sem a chave do Deepgram, aparece uma conversa de exemplo."}
            </p>
          )}
          {(lines.length > 0 || pending.length > 0) && (
            <ol ref={list} className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 text-[15px]" aria-live="polite">
              {lines.map((l, i) => (
                <li key={i}>
                  <span className={`font-semibold ${l.speaker === "Paciente" ? "text-sky-700" : "text-violet-700"}`}>{l.speaker}:</span> {l.text}
                </li>
              ))}
              {pending.map(([s, t]) => (
                <li key={s} className="text-muted italic">
                  {s}: {t}…
                </li>
              ))}
            </ol>
          )}
          {lines.length >= 2 && (
            <button type="button" className="btn-primary btn-sm mt-3" onClick={generate} disabled={drafting}>
              <Sparkles className="size-4" aria-hidden /> {drafting ? "Gerando rascunho…" : "Gerar rascunho do SOAP"}
            </button>
          )}
        </section>
      ) : availability === "no-consent" ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-muted">Transcrição automática indisponível: o paciente não autorizou no termo da teleconsulta.</p>
      ) : null}
      {error && <Notice tone="error">{error}</Notice>}
      {note && !error && <Notice tone="info">{note}</Notice>}
      <SoapFields key={version} defaults={fields ?? undefined} />
    </div>
  );
}
