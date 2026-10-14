"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, CreditCard, QrCode } from "lucide-react";
import { payByLink, type FormState } from "@/app/(site)/actions";
import { Field, Notice } from "./ui";
import { CopyButton, SubmitButton } from "./client";

export function PayForm({ token, pixCode, amountLabel, maxInstallments, amountCents }: { token: string; pixCode: string; amountLabel: string; maxInstallments: number; amountCents: number }) {
  const [state, action] = useActionState<FormState, FormData>(payByLink.bind(null, token), {});
  const [method, setMethod] = useState<"PIX" | "CREDITO">("PIX");
  if (state.ok)
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="size-12 text-emerald-600" aria-hidden />
        <p className="text-lg font-semibold">{state.message}</p>
        <p className="text-muted">O recibo fica disponível na recepção e é enviado por e-mail.</p>
      </div>
    );
  return (
    <form action={action} className="space-y-5">
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist">
        {(
          [
            ["PIX", "PIX", QrCode],
            ["CREDITO", "Cartão de crédito", CreditCard],
          ] as const
        ).map(([v, l, Icon]) => (
          <button key={v} type="button" role="tab" aria-selected={method === v} onClick={() => setMethod(v)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg font-semibold ${method === v ? "bg-white shadow-sm" : "text-muted"}`}>
            <Icon className="size-4" aria-hidden /> {l}
          </button>
        ))}
      </div>
      {method === "PIX" ? (
        <div className="space-y-3">
          <div className="mx-auto grid size-44 place-items-center rounded-xl border-2 border-dashed border-line text-muted">
            <QrCode className="size-20" aria-hidden />
          </div>
          <p className="text-center text-sm text-muted">Abra o app do seu banco e use o código PIX copia e cola:</p>
          <div className="flex items-center gap-2">
            <input readOnly value={pixCode} className="input font-mono text-xs" aria-label="Código PIX" />
            <CopyButton text={pixCode} />
          </div>
          <SubmitButton pendingText="Verificando…" className="btn-primary w-full">
            Já paguei
          </SubmitButton>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número do cartão" htmlFor="card" required error={state.fieldErrors?.card} className="sm:col-span-2">
            <input id="card" name="card" inputMode="numeric" autoComplete="cc-number" className="input" placeholder="0000 0000 0000 0000" />
          </Field>
          <Field label="Validade" htmlFor="exp" required>
            <input id="exp" name="exp" autoComplete="cc-exp" className="input" placeholder="MM/AA" />
          </Field>
          <Field label="CVV" htmlFor="cvv" required>
            <input id="cvv" name="cvv" inputMode="numeric" autoComplete="cc-csc" className="input" placeholder="123" />
          </Field>
          <Field label="Parcelas" htmlFor="inst" className="sm:col-span-2">
            <select id="inst" name="installments" className="input">
              {Array.from({ length: Math.max(1, maxInstallments) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x de {(amountCents / n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sem juros
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton pendingText="Processando…" className="btn-primary sm:col-span-2">
            Pagar {amountLabel}
          </SubmitButton>
        </div>
      )}
      <p className="text-center text-xs text-muted">Ambiente de demonstração: nenhum valor é cobrado de verdade.</p>
    </form>
  );
}
