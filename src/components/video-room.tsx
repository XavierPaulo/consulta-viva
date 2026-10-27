"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, Mic, Video, VideoOff } from "lucide-react";
import { Notice } from "./ui";

type Check = "idle" | "testing" | "ok" | "error";

/** Teste de câmera e microfone antes de entrar, para o paciente não descobrir o problema no meio da consulta. */
export function DeviceCheck() {
  const [state, setState] = useState<Check>("idle");
  const [level, setLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    setState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const loop = () => {
        analyser.getByteFrequencyData(data);
        setLevel(Math.min(100, (data.reduce((s, v) => s + v, 0) / data.length) * 1.6));
        raf = requestAnimationFrame(loop);
      };
      loop();
      stopRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setState("ok");
    } catch {
      setState("error");
    }
  }

  function stop() {
    stopRef.current();
    stopRef.current = () => {};
    setState("idle");
  }

  return (
    <div className="rounded-2xl border border-line bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">Teste de câmera e microfone</p>
        {state === "ok" ? (
          <button type="button" className="btn-secondary btn-sm" onClick={stop}>
            <VideoOff className="size-4" aria-hidden /> Parar teste
          </button>
        ) : (
          <button type="button" className="btn-secondary btn-sm" onClick={start} disabled={state === "testing"}>
            <Camera className="size-4" aria-hidden /> {state === "testing" ? "Aguardando permissão…" : "Testar agora"}
          </button>
        )}
      </div>
      {state === "error" && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          Não conseguimos acessar a câmera ou o microfone. Clique no cadeado ao lado do endereço do site, permita câmera e microfone e tente de novo.
        </p>
      )}
      <div className={state === "ok" ? "mt-3 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-center" : "hidden"}>
        <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-slate-900 object-cover" />
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Mic className="size-4" aria-hidden /> Fale algo: a barra deve se mexer.
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${level}%` }} />
          </div>
          <p className="mt-2 text-sm font-medium text-emerald-700">Tudo certo com a câmera e o microfone.</p>
        </div>
      </div>
    </div>
  );
}

export function VideoRoom({
  url,
  embed,
  onJoin,
  deviceCheck = true,
  joinLabel = "Entrar na consulta",
}: {
  url: string;
  embed: boolean;
  onJoin: () => Promise<void>;
  deviceCheck?: boolean;
  joinLabel?: string;
}) {
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    // abre a aba antes do await para o navegador não bloquear como pop-up
    const tab = embed ? null : window.open(url, "_blank");
    try {
      await onJoin();
    } finally {
      setBusy(false);
      setJoined(true);
    }
    if (!embed && !tab) window.location.href = url;
  }

  if (joined && embed) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-slate-900">
        <iframe
          src={url}
          title="Sala da teleconsulta"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          className="h-[70dvh] min-h-[420px] w-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deviceCheck && !joined && <DeviceCheck />}
      {joined ? (
        <Notice tone="success">
          A chamada abriu em outra aba. Se ela não apareceu,{" "}
          <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">
            clique aqui para abrir
          </a>
          .
        </Notice>
      ) : (
        <button type="button" className="btn-primary w-full text-[17px] sm:w-auto" onClick={join} disabled={busy}>
          <Video className="size-5" aria-hidden /> {busy ? "Abrindo…" : joinLabel}
          {!embed && <ExternalLink className="size-4 opacity-80" aria-hidden />}
        </button>
      )}
    </div>
  );
}

/** Mostra ao médico se o paciente já entrou na sala (consulta a cada 10 s). */
export function PatientPresence({ appointmentId, initial }: { appointmentId: string; initial: { joinedAt: string | null; consent: boolean } }) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (state.joinedAt) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/admin/api/sala/${appointmentId}`, { cache: "no-store" });
        if (res.ok) setState(await res.json());
      } catch {}
    }, 10_000);
    return () => clearInterval(t);
  }, [appointmentId, state.joinedAt]);
  if (state.joinedAt)
    return (
      <p className="flex items-center gap-2 text-[15px] font-medium text-emerald-700" role="status">
        <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" aria-hidden /> Paciente entrou na sala às{" "}
        {new Date(state.joinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
      </p>
    );
  return (
    <p className="flex items-center gap-2 text-[15px] text-muted" role="status">
      <span className="size-2.5 rounded-full bg-slate-300" aria-hidden /> Aguardando o paciente{state.consent ? " (termo de teleconsulta já aceito)" : ""}
    </p>
  );
}
