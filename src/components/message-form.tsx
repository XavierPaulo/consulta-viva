"use client";

import { useActionState, useState } from "react";
import { sendMessage, type FormState } from "@/app/(site)/actions";
import { Field, Notice } from "./ui";
import { MaskedInput, SubmitButton } from "./client";

export function MessageForm({ professionals, defaultProfessionalId = "" }: { professionals: { id: string; name: string }[]; defaultProfessionalId?: string }) {
  const [state, action] = useActionState<FormState, FormData>(sendMessage, {});
  const [channel, setChannel] = useState("WHATSAPP");
  if (state.ok) return <Notice tone="success">{state.message}</Notice>;
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" htmlFor="m-name" required error={fe.name}>
          <input id="m-name" name="name" className="input" autoComplete="name" required aria-invalid={!!fe.name} />
        </Field>
        <Field label="Para quem é a mensagem?" htmlFor="m-pro">
          <select id="m-pro" name="professionalId" className="input" defaultValue={defaultProfessionalId}>
            <option value="">Equipe da clínica</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset>
        <legend className="label">Como prefere receber a resposta?</legend>
        <div className="flex gap-2">
          {[
            ["WHATSAPP", "WhatsApp"],
            ["EMAIL", "E-mail"],
          ].map(([v, l]) => (
            <label key={v} className="chip has-checked:border-brand has-checked:bg-brand has-checked:text-white">
              <input type="radio" name="channel" value={v} checked={channel === v} onChange={() => setChannel(v!)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp" htmlFor="m-wa" required={channel === "WHATSAPP"} error={fe.whatsapp}>
          <MaskedInput mask="phone" id="m-wa" name="whatsapp" aria-invalid={!!fe.whatsapp} />
        </Field>
        <Field label="E-mail" htmlFor="m-email" required={channel === "EMAIL"} error={fe.email}>
          <input id="m-email" name="email" type="email" className="input" autoComplete="email" aria-invalid={!!fe.email} />
        </Field>
      </div>
      <Field label="Mensagem" htmlFor="m-body" required error={fe.body} hint="Não envie informações sensíveis como resultados de exames por aqui.">
        <textarea id="m-body" name="body" className="input" rows={4} aria-invalid={!!fe.body} />
      </Field>
      <Field label="" error={fe.consent}>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consent" className="mt-0.5 size-5 accent-[var(--brand)]" />
          <span>
            Concordo que a clínica use estes dados para responder minha mensagem, conforme a{" "}
            <a href="/privacidade" className="link">
              Política de Privacidade
            </a>
            .
          </span>
        </label>
      </Field>
      <div>
        <SubmitButton pendingText="Enviando…">Enviar mensagem</SubmitButton>
      </div>
    </form>
  );
}
