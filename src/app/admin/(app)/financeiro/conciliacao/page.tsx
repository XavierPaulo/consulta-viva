import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinic } from "@/lib/clinic";
import { PAYMENT_ENTRY_METHODS } from "@/lib/constants";
import { brl, fmtDate, now } from "@/lib/format";
import { feeBpFor, matchScore } from "@/lib/statement";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { EmptyState, PageHeader, Stat } from "@/components/ui";
import { FinanceTabs } from "@/components/finance-tabs";
import { ignoreLine, importStatement, linkLine, reconcileWithoutStatement, runAutoMatch, unlink } from "./actions";

export const metadata = { title: "Conciliação" };

const method = (m: string) => PAYMENT_ENTRY_METHODS[m as keyof typeof PAYMENT_ENTRY_METHODS] ?? m;

export default async function Conciliacao() {
  const user = await requireUser("financeiro");
  if (user.role === "MEDICO") return <EmptyState title="Conciliação disponível para a administração da clínica" />;
  const editable = can(user, "financeiro", "edit");
  const clinic = await getClinic();
  const since = new Date(now() - 120 * 86400_000);
  const [pendingLines, openPayments, done, ignoredCount] = await Promise.all([
    prisma.statementLine.findMany({ where: { paymentId: null, ignored: false }, orderBy: { date: "desc" }, take: 100 }),
    prisma.payment.findMany({
      where: { status: "PAGO", reconciledAt: null, paidAt: { gte: since } },
      include: { patient: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { reconciledAt: { not: null } },
      include: { patient: { select: { name: true } }, statementLine: true },
      orderBy: { reconciledAt: "desc" },
      take: 30,
    }),
    prisma.statementLine.count({ where: { ignored: true } }),
  ]);
  const pays = openPayments.map((p) => ({ ...p, feeBp: feeBpFor(clinic, p.method) }));
  const suggestions = new Map(
    pendingLines.map((l) => [
      l.id,
      pays
        .map((p) => ({ p, score: matchScore(l, p) }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    ]),
  );

  return (
    <>
      <PageHeader title="Financeiro" description="Confira se cada pagamento registrado caiu de fato na conta da clínica." />
      <FinanceTabs active="conciliacao" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lançamentos a conferir" value={pendingLines.length} hint="do extrato, sem pagamento ligado" />
        <Stat label="Pagamentos sem extrato" value={openPayments.length} hint={brl(openPayments.reduce((s, p) => s + p.amountCents, 0))} />
        <Stat label="Conciliados (últimos)" value={done.length} hint={`Taxas: ${brl(done.reduce((s, p) => s + p.feeCents, 0))}`} />
        <Stat label="Ignorados" value={ignoredCount} hint="tarifas, transferências, saídas" />
      </div>

      {editable && (
        <section className="card mb-5 p-5">
          <h2 className="font-semibold">Importar extrato</h2>
          <p className="mb-4 text-sm text-muted">
            Baixe o extrato no internet banking ou no portal da maquininha (formato OFX ou CSV) e envie aqui. Lançamentos repetidos são ignorados.
          </p>
          <ActionForm action={importStatement} className="space-y-3" resetOnSuccess>
            <input type="file" name="file" accept=".ofx,.csv,.txt,text/csv" className="input py-2" aria-label="Arquivo do extrato" />
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted">Ou cole as linhas (data; descrição; valor)</summary>
              <textarea name="text" rows={4} className="input mt-2 font-mono text-sm" placeholder={"27/10/2026;PIX RECEBIDO MARIA;250,00\n28/10/2026;VENDA CREDITO;241,27"} />
            </details>
            <SubmitButton pendingText="Importando…">Importar e conciliar</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section className="mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Lançamentos do extrato a conferir</h2>
          {editable && pendingLines.length > 0 && (
            <ActionForm action={runAutoMatch} className="flex items-center gap-3">
              <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                Tentar conciliar de novo
              </SubmitButton>
            </ActionForm>
          )}
        </div>
        {pendingLines.length === 0 ? (
          <EmptyState title="Nada a conferir">Tudo o que foi importado já está ligado a um pagamento ou foi ignorado.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {pendingLines.map((l) => {
              const sug = suggestions.get(l.id) ?? [];
              return (
                <li key={l.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{l.description}</p>
                    <p className="text-sm text-muted">{fmtDate(l.date)}</p>
                  </div>
                  <p className="w-28 text-right font-semibold tabular-nums">{brl(l.amountCents)}</p>
                  {editable && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      {sug.length > 0 ? (
                        <form action={linkLine.bind(null, l.id)} className="flex flex-wrap items-center gap-2">
                          <select name="paymentId" className="input min-h-10 w-auto max-w-80 py-1.5 text-sm" aria-label="Pagamento correspondente" defaultValue={sug[0]!.p.id}>
                            {sug.map(({ p }) => (
                              <option key={p.id} value={p.id}>
                                {p.patient.name} · {brl(p.amountCents)} · {method(p.method)} · {p.paidAt ? fmtDate(p.paidAt) : ""}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn-primary btn-sm" pendingText="…">
                            Vincular
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="text-sm text-muted">Nenhum pagamento parecido</span>
                      )}
                      <form action={ignoreLine.bind(null, l.id)}>
                        <SubmitButton className="btn-ghost btn-sm" pendingText="…">
                          Ignorar
                        </SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-1 text-lg font-semibold">Pagamentos recebidos sem lançamento no extrato</h2>
        <p className="mb-3 text-sm text-muted">Pagos nos últimos 120 dias. Cartão de crédito pode levar até 30 dias para cair; dinheiro não passa pelo banco.</p>
        {openPayments.length === 0 ? (
          <EmptyState title="Todos os pagamentos estão conciliados" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Pago em</th>
                  <th>Paciente</th>
                  <th>Forma</th>
                  <th className="text-right">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paidAt ? fmtDate(p.paidAt) : "—"}</td>
                    <td>
                      <Link href={`/admin/financeiro/${p.id}`} className="hover:underline">
                        {p.patient.name}
                      </Link>
                    </td>
                    <td>{method(p.method)}</td>
                    <td className="text-right tabular-nums">{brl(p.amountCents)}</td>
                    <td className="text-right">
                      {editable && ["DINHEIRO", "CONVENIO"].includes(p.method) && (
                        <form action={reconcileWithoutStatement.bind(null, p.id)}>
                          <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                            Conferido no caixa
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Conciliados recentemente</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>No extrato</th>
                  <th className="text-right">Pago</th>
                  <th className="text-right">Caiu na conta</th>
                  <th className="text-right">Taxa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {done.map((p) => (
                  <tr key={p.id}>
                    <td>{p.patient.name}</td>
                    <td className="text-muted">{p.statementLine ? `${fmtDate(p.statementLine.date)} · ${p.statementLine.description}` : "Conferido no caixa"}</td>
                    <td className="text-right tabular-nums">{brl(p.amountCents)}</td>
                    <td className="text-right tabular-nums">{brl(p.statementLine?.amountCents ?? p.amountCents)}</td>
                    <td className="text-right tabular-nums text-muted">{p.feeCents ? brl(p.feeCents) : "—"}</td>
                    <td className="text-right">
                      {editable && (
                        <form action={unlink.bind(null, p.id)}>
                          <SubmitButton className="btn-ghost btn-sm" pendingText="…">
                            Desfazer
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
