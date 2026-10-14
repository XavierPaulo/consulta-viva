import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { centsToInput, fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { PatientPicker } from "@/components/admin-pickers";
import { SubmitButton } from "@/components/client";
import { Field, PageHeader } from "@/components/ui";
import { createPayment } from "../actions";

export const metadata = { title: "Registrar pagamento" };

export default async function NovoPagamento({ searchParams }: PageProps<"/admin/financeiro/novo">) {
  const sp = await searchParams;
  await requireUser("financeiro", "create");
  const clinic = await getClinic();
  const appt =
    typeof sp.consulta === "string"
      ? await prisma.appointment.findUnique({ where: { id: sp.consulta }, include: { patient: true, professional: true, insurance: true } })
      : null;
  const patient =
    appt?.patient ?? (typeof sp.paciente === "string" ? await prisma.patient.findUnique({ where: { id: sp.paciente } }) : null);
  return (
    <>
      <PageHeader title="Registrar pagamento" back={{ href: "/admin/financeiro", label: "Financeiro" }} />
      <ActionForm action={createPayment} className="card max-w-2xl space-y-5 p-5 sm:p-6">
        {appt && <input type="hidden" name="appointmentId" value={appt.id} />}
        <Field label="Paciente" required>
          <PatientPicker initial={patient ? { id: patient.id, name: patient.name, cpf: patient.cpf, phone: patient.phone } : null} />
        </Field>
        <Field label="Descrição" htmlFor="description">
          <input
            id="description"
            name="description"
            className="input"
            defaultValue={appt ? `Consulta – ${appt.professional.title} ${appt.professional.name} (${fmtDateTime(appt.start)})` : ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Valor (R$)" htmlFor="amount" required>
            <input id="amount" name="amount" inputMode="decimal" required className="input" defaultValue={appt ? centsToInput(appt.priceCents || appt.insurance?.priceCents) : ""} placeholder="0,00" />
          </Field>
          <Field label="Forma" htmlFor="method" required>
            <select id="method" name="method" className="input" defaultValue={appt?.insurance ? "CONVENIO" : "PIX"}>
              {Object.entries(PAYMENT_ENTRY_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parcelas" htmlFor="installments">
            <select id="installments" name="installments" className="input">
              {Array.from({ length: Math.max(1, clinic.maxInstallments) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Situação" htmlFor="status">
            <select id="status" name="status" className="input" defaultValue="PAGO">
              <option value="PAGO">Já recebido</option>
              <option value="PENDENTE">A receber</option>
            </select>
          </Field>
          <Field label="Vencimento" htmlFor="dueDate" hint="Para valores a receber ou links.">
            <input id="dueDate" name="dueDate" type="date" className="input" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" name="notify" defaultChecked className="size-5 accent-[var(--brand)]" /> Se for link de pagamento, enviar por WhatsApp
        </label>
        <SubmitButton>Registrar</SubmitButton>
      </ActionForm>
    </>
  );
}
