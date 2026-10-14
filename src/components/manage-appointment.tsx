"use client";

import { useActionState, useState } from "react";
import { cancelByPatient, rescheduleByPatient, type FormState } from "@/app/(site)/actions";
import { Notice } from "./ui";
import { SubmitButton } from "./client";

type Day = { day: string; label: string; slots: { iso: string; time: string }[] };

export function ManageAppointment({ token, days, canChange, limitHours }: { token: string; days: Day[]; canChange: boolean; limitHours: number }) {
  const [cState, cancel] = useActionState<FormState, FormData>(cancelByPatient.bind(null, token), {});
  const [rState, reschedule] = useActionState<FormState, FormData>(rescheduleByPatient.bind(null, token), {});
  const [open, setOpen] = useState<"" | "cancel" | "reschedule">("");
  const [day, setDay] = useState(days[0]?.day ?? "");

  if (cState.ok) return <Notice tone="success">{cState.message} Se quiser, você pode agendar um novo horário quando preferir.</Notice>;
  if (rState.ok) return <Notice tone="success">{rState.message} Enviamos a nova confirmação por e-mail e WhatsApp.</Notice>;
  if (!canChange)
    return (
      <Notice tone="info">
        Alterações online podem ser feitas até {limitHours} h antes da consulta. Para mudanças agora, fale com a recepção.
      </Notice>
    );

  const current = days.find((d) => d.day === day);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={open === "reschedule" ? "btn-primary" : "btn-secondary"} onClick={() => setOpen(open === "reschedule" ? "" : "reschedule")} aria-expanded={open === "reschedule"}>
          Remarcar
        </button>
        <button type="button" className="btn-danger" onClick={() => setOpen(open === "cancel" ? "" : "cancel")} aria-expanded={open === "cancel"}>
          Cancelar consulta
        </button>
      </div>

      {open === "reschedule" && (
        <form action={reschedule} className="card space-y-4 p-5">
          {rState.error && <Notice tone="error">{rState.error}</Notice>}
          <p className="font-semibold">Escolha o novo horário</p>
          {days.length === 0 ? (
            <p className="text-muted">Sem horários livres nas próximas semanas. Fale com a recepção.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Dias">
                {days.map((d) => (
                  <button key={d.day} type="button" role="tab" aria-selected={day === d.day} data-active={day === d.day} className="chip shrink-0 capitalize" onClick={() => setDay(d.day)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <fieldset className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <legend className="sr-only">Horários</legend>
                {current?.slots.map((s) => (
                  <label key={s.iso} className="cursor-pointer rounded-lg border border-brand-200 bg-brand-50 py-2 text-center text-sm font-semibold text-brand-800 has-checked:border-brand has-checked:bg-brand has-checked:text-white">
                    <input type="radio" name="start" value={s.iso} className="sr-only" required />
                    {s.time}
                  </label>
                ))}
              </fieldset>
              <SubmitButton pendingText="Remarcando…">Confirmar novo horário</SubmitButton>
            </>
          )}
        </form>
      )}

      {open === "cancel" && (
        <form action={cancel} className="card space-y-4 p-5">
          {cState.error && <Notice tone="error">{cState.error}</Notice>}
          <label htmlFor="reason" className="label">
            Quer contar o motivo? (opcional)
          </label>
          <textarea id="reason" name="reason" className="input" rows={2} />
          <SubmitButton className="btn-danger" pendingText="Cancelando…" confirm="Tem certeza que deseja cancelar esta consulta?">
            Confirmar cancelamento
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
