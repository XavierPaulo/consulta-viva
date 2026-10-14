import { prisma } from "@/lib/db";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { todayYmd, ymd } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { PatientPicker, SlotPicker } from "@/components/admin-pickers";
import { SubmitButton } from "@/components/client";
import { PageHeader } from "@/components/ui";
import { createAppointment } from "../actions";

export const metadata = { title: "Novo agendamento" };

export default async function NovoAgendamento({ searchParams }: PageProps<"/admin/agenda/novo">) {
  const sp = await searchParams;
  const user = await requireUser("agenda", "create");
  const scope = ownProfessionalScope(user);
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const pros = await prisma.professional.findMany({
    where: scope ? { id: scope } : {},
    orderBy: { name: "asc" },
    include: { insurances: { where: { active: true } } },
  });
  const patient = get("paciente") ? await prisma.patient.findUnique({ where: { id: get("paciente") }, select: { id: true, name: true, cpf: true, phone: true } }) : null;
  const s = get("s") ? new Date(get("s")) : null;
  return (
    <>
      <PageHeader title="Novo agendamento" back={{ href: "/admin/agenda", label: "Agenda" }} />
      <ActionForm action={createAppointment} className="max-w-3xl space-y-5">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Paciente</h2>
          <PatientPicker initial={patient} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Quando e com quem</h2>
          <SlotPicker
            professionals={pros.map((p) => ({
              id: p.id,
              name: `${p.title} ${p.name}`,
              durationMin: p.durationMin,
              priceCents: p.priceCents,
              telemedicine: p.telemedicine,
              inPerson: p.inPerson,
              insurances: p.insurances.map((i) => ({ id: i.id, name: i.name })),
            }))}
            defaultProfessionalId={get("p") || scope}
            defaultDate={s && !Number.isNaN(s.getTime()) ? ymd(s) : get("data") || todayYmd()}
            defaultStart={s?.toISOString()}
            lockedProfessional={!!scope}
          />
        </section>
        <section className="card space-y-4 p-5">
          <div>
            <label htmlFor="notes" className="label">
              Observações internas
            </label>
            <textarea id="notes" name="notes" rows={2} className="input" placeholder="Ex.: primeira consulta, trazer exames" />
          </div>
          <div className="flex flex-col gap-2 text-[15px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirmed" className="size-5 accent-[var(--brand)]" /> Já confirmada com o paciente
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notify" defaultChecked className="size-5 accent-[var(--brand)]" /> Enviar confirmação por WhatsApp e e-mail
            </label>
          </div>
        </section>
        <div className="flex gap-2">
          <SubmitButton pendingText="Agendando…">Agendar</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
