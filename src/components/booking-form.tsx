"use client";

import { useActionState, useState } from "react";
import { Building2, CalendarDays, Clock, MapPin, Video, Wallet } from "lucide-react";
import { bookAppointment, type FormState } from "@/app/(site)/actions";
import { Field, Notice } from "./ui";
import { MaskedInput, SubmitButton } from "./client";

type Props = {
  professional: { id: string; name: string; specialties: string; priceCents: number; inPerson: boolean; telemedicine: boolean; durationMin: number };
  start: string;
  dateLabel: string;
  timeLabel: string;
  unit: { name: string; address: string } | null;
  insurances: { id: string; name: string }[];
  defaultType?: string;
  defaultInsurance?: string;
  cancellationPolicy: string;
  allowPrepay: boolean;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BookingForm(props: Props) {
  const { professional: p } = props;
  const [state, action] = useActionState<FormState, FormData>(bookAppointment, {});
  const [mode, setMode] = useState<"novo" | "existente">("novo");
  const [type, setType] = useState(
    props.defaultType === "TELECONSULTA" && p.telemedicine ? "TELECONSULTA" : p.inPerson ? "PRESENCIAL" : "TELECONSULTA",
  );
  const [insuranceId, setInsuranceId] = useState(props.insurances.some((i) => i.id === props.defaultInsurance) ? props.defaultInsurance! : "");
  const fe = state.fieldErrors ?? {};
  const insuranceName = props.insurances.find((i) => i.id === insuranceId)?.name;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_360px]" noValidate>
      <input type="hidden" name="professionalId" value={p.id} />
      <input type="hidden" name="start" value={props.start} />
      <input type="hidden" name="mode" value={mode} />

      <div className="space-y-6">
        {state.error && <Notice tone="error">{state.error}</Notice>}

        <section className="card p-5 sm:p-6" aria-labelledby="sec-id">
          <h2 id="sec-id" className="text-lg font-semibold">
            1. Quem vai ser atendido?
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Tipo de paciente">
            {(
              [
                ["novo", "Primeira vez aqui"],
                ["existente", "Já sou paciente"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={mode === v}
                onClick={() => setMode(v)}
                className={`min-h-11 rounded-lg text-[15px] font-semibold transition ${mode === v ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {mode === "novo" ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo" htmlFor="b-name" required error={fe.name} className="sm:col-span-2">
                <input id="b-name" name="name" className="input" autoComplete="name" aria-invalid={!!fe.name} />
              </Field>
              <Field label="CPF" htmlFor="b-cpf" required error={fe.cpf}>
                <MaskedInput mask="cpf" id="b-cpf" name="cpf" aria-invalid={!!fe.cpf} />
              </Field>
              <Field label="Data de nascimento" htmlFor="b-birth" required error={fe.birthDate}>
                <input id="b-birth" name="birthDate" type="date" className="input" autoComplete="bday" aria-invalid={!!fe.birthDate} />
              </Field>
              <Field label="Celular (WhatsApp)" htmlFor="b-phone" required error={fe.phone}>
                <MaskedInput mask="phone" id="b-phone" name="phone" aria-invalid={!!fe.phone} />
              </Field>
              <Field label="E-mail" htmlFor="b-email" required error={fe.email}>
                <input id="b-email" name="email" type="email" className="input" autoComplete="email" aria-invalid={!!fe.email} />
              </Field>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="CPF" htmlFor="b-cpf2" required error={fe.cpf}>
                <MaskedInput mask="cpf" id="b-cpf2" name="cpf" aria-invalid={!!fe.cpf} />
              </Field>
              <Field label="Telefone cadastrado" htmlFor="b-phone2" required error={fe.phone} hint="Usamos para confirmar que é você.">
                <MaskedInput mask="phone" id="b-phone2" name="phone" aria-invalid={!!fe.phone} />
              </Field>
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="sec-type">
          <h2 id="sec-type" className="text-lg font-semibold">
            2. Como prefere ser atendido?
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {p.inPerson && (
              <label className="card flex cursor-pointer items-start gap-3 p-4 has-checked:border-brand has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-100">
                <input type="radio" name="type" value="PRESENCIAL" checked={type === "PRESENCIAL"} onChange={() => setType("PRESENCIAL")} className="mt-1 size-4 accent-[var(--brand)]" />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Building2 className="size-4" aria-hidden /> Presencial
                  </span>
                  <span className="text-sm text-muted">{props.unit ? props.unit.name : "Na clínica"}</span>
                </span>
              </label>
            )}
            {p.telemedicine && (
              <label className="card flex cursor-pointer items-start gap-3 p-4 has-checked:border-brand has-checked:bg-brand-50 has-checked:ring-2 has-checked:ring-brand-100">
                <input type="radio" name="type" value="TELECONSULTA" checked={type === "TELECONSULTA"} onChange={() => setType("TELECONSULTA")} className="mt-1 size-4 accent-[var(--brand)]" />
                <span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Video className="size-4" aria-hidden /> Teleconsulta
                  </span>
                  <span className="text-sm text-muted">Por vídeo, pelo celular ou computador</span>
                </span>
              </label>
            )}
          </div>
          <Field label="Pagamento" htmlFor="b-ins" className="mt-4">
            <select id="b-ins" name="insuranceId" className="input" value={insuranceId} onChange={(e) => setInsuranceId(e.target.value)}>
              <option value="">Particular – {brl(p.priceCents)}</option>
              {props.insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  Convênio {i.name}
                </option>
              ))}
            </select>
          </Field>
          {!insuranceId && props.allowPrepay && p.priceCents > 0 && (
            <label className="mt-4 flex items-start gap-3 text-[15px]">
              <input type="checkbox" name="payNow" className="mt-0.5 size-5 accent-[var(--brand)]" />
              <span>
                Quero pagar agora (PIX ou cartão)
                <span className="block text-sm text-muted">Opcional. Você também pode pagar no dia da consulta.</span>
              </span>
            </label>
          )}
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="sec-lgpd">
          <h2 id="sec-lgpd" className="text-lg font-semibold">
            3. Consentimento
          </h2>
          <label className="mt-3 flex items-start gap-3 text-[15px]">
            <input type="checkbox" name="lgpd" className="mt-0.5 size-5 accent-[var(--brand)]" aria-invalid={!!fe.lgpd} />
            <span>
              Autorizo a clínica a tratar meus dados pessoais e de saúde para agendamento e atendimento, conforme a{" "}
              <a href="/privacidade" target="_blank" className="link">
                Política de Privacidade
              </a>{" "}
              e a LGPD (Lei 13.709/2018).
              <span className="text-red-600" aria-hidden>
                {" "}
                *
              </span>
            </span>
          </label>
          {fe.lgpd && (
            <p className="mt-1 text-[13px] font-medium text-red-700" role="alert">
              {fe.lgpd}
            </p>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <h2 className="font-semibold">Resumo</h2>
          <dl className="mt-3 space-y-3 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Profissional</dt>
              <dd className="font-semibold">{p.name}</dd>
              <dd className="text-sm text-muted">{p.specialties}</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-brand-700" aria-hidden />
              <dd>{props.dateLabel}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-brand-700" aria-hidden />
              <dd>
                {props.timeLabel} · {p.durationMin} min
              </dd>
            </div>
            <div className="flex items-start gap-2">
              {type === "TELECONSULTA" ? <Video className="mt-0.5 size-4 text-brand-700" aria-hidden /> : <MapPin className="mt-0.5 size-4 text-brand-700" aria-hidden />}
              <dd>{type === "TELECONSULTA" ? "Teleconsulta (link enviado antes do horário)" : props.unit ? `${props.unit.name} – ${props.unit.address}` : "Presencial"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-brand-700" aria-hidden />
              <dd className="font-semibold">{insuranceName ? `Convênio ${insuranceName}` : brl(p.priceCents)}</dd>
            </div>
          </dl>
          {props.cancellationPolicy && (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-muted">
              <span className="font-semibold text-foreground">Cancelamento: </span>
              {props.cancellationPolicy}
            </p>
          )}
          <SubmitButton className="btn-primary mt-4 w-full" pendingText="Confirmando…">
            Confirmar agendamento
          </SubmitButton>
          <p className="mt-2 text-center text-xs text-muted">Você recebe a confirmação por e-mail e WhatsApp.</p>
        </div>
      </aside>
    </form>
  );
}
