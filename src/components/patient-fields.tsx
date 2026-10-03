import { Field } from "./ui";
import { MaskedInput } from "./client";
import { ymd } from "@/lib/format";

type P = { name: string; cpf: string | null; phone: string; email: string; birthDate: Date | null; sex: string; address: string; notes: string; lgpdConsentAt: Date | null };

export function PatientFields({ p }: { p?: P | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome completo" htmlFor="name" required className="sm:col-span-2">
        <input id="name" name="name" defaultValue={p?.name} required className="input" autoComplete="off" />
      </Field>
      <Field label="CPF" htmlFor="cpf">
        <MaskedInput mask="cpf" id="cpf" name="cpf" defaultValue={p?.cpf ?? ""} />
      </Field>
      <Field label="Data de nascimento" htmlFor="birthDate">
        <input id="birthDate" name="birthDate" type="date" defaultValue={p?.birthDate ? ymd(p.birthDate) : ""} className="input" />
      </Field>
      <Field label="Celular / WhatsApp" htmlFor="phone" required>
        <MaskedInput mask="phone" id="phone" name="phone" defaultValue={p?.phone ?? ""} required />
      </Field>
      <Field label="E-mail" htmlFor="email">
        <input id="email" name="email" type="email" defaultValue={p?.email} className="input" />
      </Field>
      <Field label="Sexo" htmlFor="sex">
        <select id="sex" name="sex" defaultValue={p?.sex ?? ""} className="input">
          <option value="">Não informado</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
          <option value="O">Outro</option>
        </select>
      </Field>
      <Field label="Endereço" htmlFor="address">
        <input id="address" name="address" defaultValue={p?.address} className="input" />
      </Field>
      <Field label="Observações administrativas" htmlFor="notes" className="sm:col-span-2" hint="Não registre dados clínicos aqui — use o prontuário.">
        <textarea id="notes" name="notes" defaultValue={p?.notes} rows={2} className="input" />
      </Field>
      <label className="flex items-start gap-3 text-[15px] sm:col-span-2">
        <input type="checkbox" name="lgpd" defaultChecked={!!p?.lgpdConsentAt} disabled={!!p?.lgpdConsentAt} className="mt-0.5 size-5 accent-[var(--brand)]" />
        <span>
          Paciente autorizou o tratamento de dados pessoais e de saúde (LGPD)
          {p?.lgpdConsentAt && <span className="block text-sm text-muted">Consentimento registrado em {p.lgpdConsentAt.toLocaleDateString("pt-BR")}</span>}
        </span>
      </label>
    </div>
  );
}
