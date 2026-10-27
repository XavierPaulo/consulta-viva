import type { Metadata } from "next";
import { Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { PRIVACY_REQUEST_KINDS } from "@/lib/constants";
import { fmtDate, formatCpf, formatPhone } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Badge, Field } from "@/components/ui";
import { createPrivacyRequest, updateMyData } from "../../actions";

export const metadata: Metadata = { title: "Meus dados", robots: { index: false } };

export default async function MyData() {
  const patient = await requirePatient();
  const requests = await prisma.patientRequest.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <h1 className="text-xl font-semibold">Meus dados</h1>
        <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Nome</dt>
            <dd className="font-medium">{patient.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">CPF</dt>
            <dd className="font-medium">{patient.cpf ? formatCpf(patient.cpf) : "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Nascimento</dt>
            <dd className="font-medium">{patient.birthDate ? fmtDate(patient.birthDate) : "—"}</dd>
          </div>
        </dl>
        <ActionForm action={updateMyData} className="mt-6 space-y-4 border-t border-line pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Celular (WhatsApp)" htmlFor="phone" required hint="É para cá que enviamos lembretes e códigos de acesso.">
              <input id="phone" name="phone" inputMode="tel" defaultValue={formatPhone(patient.phone)} className="input" required />
            </Field>
            <Field label="E-mail" htmlFor="email">
              <input id="email" name="email" type="email" defaultValue={patient.email} className="input" />
            </Field>
            <Field label="Endereço" htmlFor="address" className="sm:col-span-2">
              <input id="address" name="address" defaultValue={patient.address} className="input" />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" name="reminders" defaultChecked={!patient.remindersOptOut} className="size-5 accent-[var(--brand)]" />
            Quero receber lembretes das consultas por WhatsApp, SMS ou e-mail
          </label>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Privacidade (LGPD)</h2>
        <p className="mt-1 text-[15px] text-muted">
          Você pode baixar uma cópia de tudo o que a clínica guarda sobre você, inclusive o prontuário, ou fazer um pedido sobre seus dados.
        </p>
        <a href="/paciente/exportar" className="btn-secondary mt-4" download>
          <Download className="size-4" aria-hidden /> Baixar meus dados
        </a>
        <ActionForm action={createPrivacyRequest} className="mt-6 space-y-4 border-t border-line pt-6" resetOnSuccess>
          <Field label="Tipo de pedido" htmlFor="kind" required>
            <select id="kind" name="kind" className="input" required defaultValue="">
              <option value="" disabled>
                Escolha
              </option>
              {Object.entries(PRIVACY_REQUEST_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detalhes" htmlFor="details">
            <textarea id="details" name="details" rows={3} className="input" placeholder="Ex.: meu nome está escrito errado; o correto é…" />
          </Field>
          <SubmitButton className="btn-secondary">Enviar pedido</SubmitButton>
        </ActionForm>
        {requests.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-line pt-4 text-[15px]">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {fmtDate(r.createdAt)} · {PRIVACY_REQUEST_KINDS[r.kind as keyof typeof PRIVACY_REQUEST_KINDS] ?? r.kind}
                </span>
                <Badge tone={r.status === "CONCLUIDO" ? "green" : "amber"}>{r.status === "CONCLUIDO" ? "Concluído" : "Em análise"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
