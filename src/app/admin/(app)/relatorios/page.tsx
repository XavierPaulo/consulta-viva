import { prisma } from "@/lib/db";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { APPOINTMENT_STATUS, PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { addDays, brl, localToDate, todayYmd } from "@/lib/format";
import { PrintButton } from "@/components/client";
import { PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Relatórios" };

function Bars({ title, rows, money }: { title: string; rows: { label: string; value: number; extra?: string }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Sem dados no período.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums text-muted">
                  {money ? brl(r.value) : r.value}
                  {r.extra && ` · ${r.extra}`}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Relatorios({ searchParams }: PageProps<"/admin/relatorios">) {
  const sp = await searchParams;
  const user = await requireUser("relatorios");
  const scope = ownProfessionalScope(user);
  const today = todayYmd();
  const from = typeof sp.de === "string" && sp.de ? sp.de : `${today.slice(0, 8)}01`;
  const to = typeof sp.ate === "string" && sp.ate ? sp.ate : addDays(today, 30);
  const range = { gte: localToDate(from), lt: localToDate(addDays(to, 1)) };

  const [appts, payments, newPatients] = await Promise.all([
    prisma.appointment.findMany({
      where: { start: range, ...(scope ? { professionalId: scope } : {}) },
      include: { professional: { include: { specialties: true } }, insurance: true },
    }),
    prisma.payment.findMany({
      where: { status: "PAGO", paidAt: range, ...(scope ? { appointment: { professionalId: scope } } : {}) },
      include: { appointment: { include: { professional: { include: { specialties: true } }, insurance: true } } },
    }),
    prisma.patient.count({ where: { createdAt: range } }),
  ]);
  const group = <T,>(list: T[], key: (x: T) => string, val: (x: T) => number = () => 1) => {
    const m = new Map<string, number>();
    for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + val(x));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const valid = appts.filter((a) => a.status !== "CANCELADA");
  const done = appts.filter((a) => a.status === "REALIZADA").length;
  const missed = appts.filter((a) => a.status === "FALTOU").length;
  const revenue = payments.reduce((s, p) => s + p.amountCents, 0);
  const showMoney = can(user, "financeiro");
  const online = valid.filter((a) => a.source === "ONLINE").length;

  return (
    <>
      <PageHeader title="Relatórios" description="Indicadores essenciais do período." actions={<PrintButton label="Imprimir" />} />
      <form className="card no-print mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="de">
            De
          </label>
          <input id="de" name="de" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">
            Até
          </label>
          <input id="ate" name="ate" type="date" defaultValue={to} className="input" />
        </div>
        <button className="btn-secondary">Atualizar</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Consultas (exceto canceladas)" value={valid.length} />
        <Stat label="Realizadas" value={done} />
        <Stat label="Taxa de faltas" value={`${done + missed ? Math.round((missed / (done + missed)) * 100) : 0}%`} hint={`${missed} faltas`} />
        <Stat label="Agendadas pelo site" value={`${valid.length ? Math.round((online / valid.length) * 100) : 0}%`} hint={`${online} online`} />
        {showMoney ? <Stat label="Receita recebida" value={brl(revenue)} hint={`Ticket médio ${brl(payments.length ? revenue / payments.length : 0)}`} /> : <Stat label="Pacientes novos" value={newPatients} />}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Bars title="Consultas por situação" rows={group(appts, (a) => APPOINTMENT_STATUS[a.status as keyof typeof APPOINTMENT_STATUS]?.label ?? a.status)} />
        {!scope && <Bars title="Consultas por médico" rows={group(valid, (a) => `${a.professional.title} ${a.professional.name}`)} />}
        <Bars title="Consultas por especialidade" rows={group(valid, (a) => a.professional.specialties[0]?.name ?? "—")} />
        <Bars title="Consultas por convênio" rows={group(valid, (a) => a.insurance?.name ?? "Particular")} />
        {showMoney && (
          <>
            <Bars title="Receita por forma de pagamento" money rows={group(payments, (p) => PAYMENT_ENTRY_METHODS[p.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? p.method, (p) => p.amountCents)} />
            {!scope && (
              <Bars
                title="Receita por médico"
                money
                rows={group(payments, (p) => (p.appointment ? `${p.appointment.professional.title} ${p.appointment.professional.name}` : "Sem consulta vinculada"), (p) => p.amountCents)}
              />
            )}
            <Bars title="Receita por especialidade" money rows={group(payments, (p) => p.appointment?.professional.specialties[0]?.name ?? "Outros", (p) => p.amountCents)} />
          </>
        )}
      </div>
    </>
  );
}
