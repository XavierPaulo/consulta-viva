"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { requestLoginCode, verifyLoginCode, type LoginState } from "@/app/(site)/paciente/actions";
import { MaskedInput, SubmitButton } from "./client";
import { Notice } from "./ui";

/** Entrada em dois passos: CPF → código de 6 dígitos. */
export function PatientLogin() {
  const [sent, request] = useActionState<LoginState, FormData>(requestLoginCode, { step: "cpf" });
  const [checked, verify] = useActionState<LoginState, FormData>(verifyLoginCode, {});
  // "Não recebi" volta ao CPF sem perder o estado; um novo envio gera outro objeto e reabre o passo do código
  const [dismissed, setDismissed] = useState<LoginState | null>(null);
  const onCodeStep = sent.step === "code" && sent !== dismissed;

  if (!onCodeStep) {
    return (
      <form action={request} className="space-y-5">
        {sent.error && <Notice tone="error">{sent.error}</Notice>}
        <div>
          <label htmlFor="cpf" className="label">
            CPF
          </label>
          <MaskedInput mask="cpf" id="cpf" name="cpf" inputMode="numeric" autoComplete="off" className="input text-lg" placeholder="000.000.000-00" required autoFocus defaultValue={sent.cpf} />
          <p className="mt-1 text-[13px] text-muted">Use o CPF informado no seu cadastro na clínica.</p>
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Enviando código…">
          Receber código de acesso
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={verify} className="space-y-5">
      <input type="hidden" name="cpf" value={sent.cpf} />
      <Notice tone="info">{sent.info}</Notice>
      {sent.demoCode && (
        <Notice tone="warning">
          Modo demonstração (mensagens simuladas): o código é <strong className="tabular-nums tracking-widest">{sent.demoCode}</strong>
        </Notice>
      )}
      {checked.error && <Notice tone="error">{checked.error}</Notice>}
      <div>
        <label htmlFor="code" className="label">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          className="input text-center text-2xl tracking-[0.5em] tabular-nums"
          placeholder="••••••"
          required
          autoFocus
        />
        <p className="mt-1 text-[13px] text-muted">O código vale por 10 minutos.</p>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Conferindo…">
        <KeyRound className="size-4" aria-hidden /> Entrar
      </SubmitButton>
      <button type="button" className="btn-ghost w-full" onClick={() => setDismissed(sent)}>
        Não recebi / usar outro CPF
      </button>
    </form>
  );
}
