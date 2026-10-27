"use client";

import { useActionState } from "react";
import { acceptTeleConsent, type FormState } from "@/app/(site)/actions";
import { SubmitButton } from "./client";
import { Notice } from "./ui";

export function TeleConsent({ token, text, transcription }: { token: string; text: string; transcription: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(acceptTeleConsent.bind(null, token), {});
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-semibold">Termo de consentimento da teleconsulta</h2>
      <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed">{text}</div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" required />
        Li e concordo com o termo de teleconsulta.
      </label>
      {transcription && (
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" name="transcript" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
          <span>
            Autorizo a transcrição automática da conversa (opcional)
            <span className="block text-sm text-muted">
              O texto ajuda o médico a escrever o seu prontuário durante a consulta. O áudio não é gravado, e só entra no prontuário o que o médico revisar.
            </span>
          </span>
        </label>
      )}
      <SubmitButton pendingText="Registrando…">Concordo e quero continuar</SubmitButton>
    </form>
  );
}
