import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PAYMENT_ENTRY_METHODS, PAYMENT_STATUS } from "@/lib/constants";
import { addDays, brl, fmtDate, localToDate, todayYmd } from "@/lib/format";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { PayStatus } from "@/components/status";

export const metadata = { title: "Financeiro" };

export default async function Financeiro({ searchParams }: PageProps<"/admin/financeiro">) {
  const sp = await searchParams;
  const user = await requireUser("financeiro");
  const scope = ownProfessionalScope(user);
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const today = todayYmd();
  const from = get("de") || `${today.slice(0, 8)}01`;
  const to = get("ate") || today;
  const where = {
    createdAt: { gte: localToDate(from), lt: localToDate(addDays(to, 1)) },
    ...(get("status") ? { status: get("status") } : {}),
    ...(get("forma") ? { method: get("forma") } : {}),
    ...(scope ? { appointment: { professionalId: scope } } : {}),
  };
  const [list, paid, pending, refunded] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, include: { patient: true }, take: 200 }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { ...where, status: "PAGO" } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { ...where, status: "PENDENTE" } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { ...where, status: "ESTORNADO" } }),
  ]);
  const overdue = list.filter((p) => p.status === "PENDENTE" && p.dueDate && p.dueDate < new Date());

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Pagamentos registrados, links enviados e valores a receber."
        actions={
          can(user, "financeiro", "create") && (
            <Link href="/admin/financeiro/novo" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Registrar pagamento
            </Link>
          )
        }
      />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" action="/admin/financeiro">
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
        <div>
          <label className="label" htmlFor="status">
            Situação
          </label>
          <select id="status" name="status" defaultValue={get("status")} className="input">
            <option value="">Todas</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="forma">
            Forma
          </label>
          <select id="forma" name="forma" defaultValue={get("forma")} className="input">
            <option value="">Todas</option>
            {Object.entries(PAYMENT_ENTRY_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-secondary w-full">Filtrar</button>
        </div>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido" value={brl(paid._sum.amountCents)} />
        <Stat label="A receber" value={brl(pending._sum.amountCents)} />
        <Stat label="Em atraso" value={overdue.length} hint={brl(overdue.reduce((s, p) => s + p.amountCents, 0))} />
        <Stat label="Estornado" value={brl(refunded._sum.amountCents)} />
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nenhum pagamento no período">Ajuste os filtros ou registre um pagamento.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Descrição</th>
                <th>Forma</th>
                <th className="text-right">Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                  <td>
                    <Link href={`/admin/financeiro/${p.id}`} className="font-medium hover:underline">
                      {p.patient.name}
                    </Link>
                  </td>
                  <td className="max-w-64 truncate text-muted">{p.description || "—"}</td>
                  <td className="whitespace-nowrap">
                    {PAYMENT_ENTRY_METHODS[p.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? p.method}
                    {p.installments > 1 && ` (${p.installments}x)`}
                  </td>
                  <td className="text-right font-semibold tabular-nums">{brl(p.amountCents)}</td>
                  <td>
                    <PayStatus status={p.status} />
                    {p.status === "PENDENTE" && p.dueDate && p.dueDate < new Date() && <span className="ml-1 text-xs font-semibold text-red-700">atrasado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
