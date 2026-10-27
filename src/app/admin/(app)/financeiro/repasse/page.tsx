import Link from "next/link";
import { ChevronLeft, ChevronRight, HandCoins } from "lucide-react";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { brl, fmtDate, todayYmd } from "@/lib/format";
import { computePayouts, monthRange, shiftMonth } from "@/lib/payouts";
import { SubmitButton, PrintButton } from "@/components/client";
import { Badge, EmptyState, PageHeader, Stat } from "@/components/ui";
import { FinanceTabs } from "@/components/finance-tabs";
import { registerPayout, undoPayout } from "./actions";

export const metadata = { title: "Repasse" };

export default async function Repasse({ searchParams }: PageProps<"/admin/financeiro/repasse">) {
  const sp = await searchParams;
  const user = await requireUser("financeiro");
  const scope = ownProfessionalScope(user);
  const current = todayYmd().slice(0, 7);
  const period = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;
  const rows = await computePayouts(period, scope);
  const label = monthRange(period).from.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const canPay = can(user, "financeiro", "edit") && !scope;
  const total = rows.reduce((s, r) => s + r.due, 0);
  const paid = rows.reduce((s, r) => s + (r.payout?.amountCents ?? 0), 0);

  return (
    <>
      <PageHeader title="Financeiro" description="Quanto cabe a cada profissional pelo que a clínica recebeu no mês." actions={<PrintButton label="Imprimir" />} />
      <FinanceTabs active="repasse" hide={scope ? ["conciliacao", "convenios"] : []} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`?mes=${shiftMonth(period, -1)}`} className="btn-secondary btn-sm" aria-label="Mês anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <p className="min-w-40 text-center text-lg font-semibold first-letter:uppercase">{label}</p>
        <Link href={`?mes=${shiftMonth(period, 1)}`} className="btn-secondary btn-sm" aria-label="Próximo mês">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        {period !== current && (
          <Link href="?" className="btn-ghost btn-sm">
            Mês atual
          </Link>
        )}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido (líquido)" value={brl(rows.reduce((s, r) => s + r.net, 0))} hint={`Taxas: ${brl(rows.reduce((s, r) => s + r.fees, 0))}`} />
        <Stat label={scope ? "Seu repasse" : "Repasse total"} value={brl(total)} icon={HandCoins} tone="violet" />
        <Stat label="Já repassado" value={brl(paid)} />
        <Stat label="A repassar" value={brl(rows.filter((r) => !r.payout).reduce((s, r) => s + r.due, 0))} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum recebimento neste mês">O repasse considera pagamentos confirmados e ligados a uma consulta.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.pro.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {r.pro.title} {r.pro.name}
                  </p>
                  <p className="text-sm text-muted">
                    {r.appointments} consulta{r.appointments === 1 ? "" : "s"} · bruto {brl(r.gross)} · taxas {brl(r.fees)} · líquido {brl(r.net)} · {r.pro.payoutPercent}%
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xl font-semibold tabular-nums">{brl(r.payout?.amountCents ?? r.due)}</span>
                  {r.payout ? (
                    <>
                      <Badge tone="green">Repassado em {fmtDate(r.payout.paidAt)}</Badge>
                      {canPay && can(user, "financeiro", "delete") && (
                        <form action={undoPayout.bind(null, r.payout.id)} className="no-print">
                          <SubmitButton className="btn-ghost btn-sm" pendingText="…" confirm="Desfazer o registro deste repasse?">
                            Desfazer
                          </SubmitButton>
                        </form>
                      )}
                    </>
                  ) : canPay && r.due > 0 ? (
                    <form action={registerPayout.bind(null, r.pro.id, period)} className="no-print">
                      <SubmitButton className="btn-primary btn-sm" pendingText="Registrando…" confirm={`Registrar o repasse de ${brl(r.due)} para ${r.pro.name}?`}>
                        Registrar repasse
                      </SubmitButton>
                    </form>
                  ) : (
                    <Badge tone="amber">A repassar</Badge>
                  )}
                </div>
              </div>
              {r.payout && r.payout.amountCents !== r.due && (
                <p className="px-5 pb-3 text-sm text-amber-800">
                  Entraram novos recebimentos depois do registro: o valor atualizado seria {brl(r.due)}. Desfaça e registre de novo se for repassar a diferença agora.
                </p>
              )}
              <details className="border-t border-line px-5 py-3">
                <summary className="cursor-pointer text-sm font-medium text-muted">Ver recebimentos ({r.items.length})</summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Recebido em</th>
                        <th>Paciente</th>
                        <th>Forma</th>
                        <th className="text-right">Valor</th>
                        <th className="text-right">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((p) => (
                        <tr key={p.id}>
                          <td>{p.paidAt ? fmtDate(p.paidAt) : "—"}</td>
                          <td>
                            {can(user, "financeiro") && !scope ? (
                              <Link href={`/admin/financeiro/${p.id}`} className="hover:underline">
                                {p.patient.name}
                              </Link>
                            ) : (
                              p.patient.name
                            )}
                          </td>
                          <td>{PAYMENT_ENTRY_METHODS[p.method as keyof typeof PAYMENT_ENTRY_METHODS] ?? p.method}</td>
                          <td className="text-right tabular-nums">{brl(p.amountCents)}</td>
                          <td className="text-right tabular-nums text-muted">{p.feeCents ? brl(p.feeCents) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
