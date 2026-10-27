import Link from "next/link";
import { Download, Send } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinic } from "@/lib/clinic";
import { TISS_STATUS } from "@/lib/constants";
import { brl, fmtDate } from "@/lib/format";
import { guideProblems, tissProblems } from "@/lib/tiss";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Badge, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { FinanceTabs } from "@/components/finance-tabs";
import { cancelBatch, generateBatch, markBatchSent, registerBatchPayment } from "./actions";

export const metadata = { title: "Convênios (TISS)" };

export default async function Convenios({ searchParams }: PageProps<"/admin/financeiro/convenios">) {
  const sp = await searchParams;
  const q = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const user = await requireUser("financeiro");
  if (user.role === "MEDICO") return <EmptyState title="Faturamento de convênios disponível para a administração da clínica" />;
  const canCreate = can(user, "financeiro", "create");
  const canEdit = can(user, "financeiro", "edit");
  const clinic = await getClinic();
  const [pending, batches] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: "REALIZADA", insuranceId: { not: null }, tissBatchId: null },
      include: { patient: true, professional: true, insurance: true },
      orderBy: { start: "asc" },
    }),
    prisma.tissBatch.findMany({ include: { insurance: true, _count: { select: { appointments: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const groups = [...new Map(pending.map((a) => [a.insuranceId!, a.insurance!])).values()].map((ins) => ({
    ins,
    items: pending.filter((a) => a.insuranceId === ins.id),
    head: tissProblems({ ansCode: ins.ansCode, providerCode: ins.providerCode, cnes: clinic.cnes }),
  }));
  const open = batches.filter((b) => ["GERADO", "ENVIADO"].includes(b.status));
  const glosas = batches.reduce((s, b) => s + (b.glosaCents ?? 0), 0);

  return (
    <>
      <PageHeader title="Financeiro" description="Gere os lotes de guias de consulta (Padrão TISS) e acompanhe o que cada operadora pagou." />
      <FinanceTabs active="convenios" />
      {q("gerado") && (
        <div className="mb-5">
          <Notice tone="success">
            Lote {q("gerado")} ({q("operadora")}) gerado com {q("guias")} guia(s). Baixe o XML abaixo e envie pelo portal da operadora.
          </Notice>
        </div>
      )}
      {q("pago") && (
        <div className="mb-5">
          <Notice tone={q("glosa") ? "warning" : "success"}>
            Pagamento do lote {q("pago")} ({q("operadora")}) registrado
            {q("glosa") ? ` com glosa de ${brl(Number(q("glosa")))}. Se discordar, entre com recurso de glosa no portal da operadora.` : "."}
          </Notice>
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Consultas a faturar" value={pending.length} />
        <Stat label="Em lotes aguardando pagamento" value={brl(open.reduce((s, b) => s + b.totalCents, 0))} hint={`${open.length} lote(s)`} />
        <Stat label="Recebido de convênios" value={brl(batches.reduce((s, b) => s + (b.receivedCents ?? 0), 0))} />
        <Stat label="Glosas" value={brl(glosas)} />
      </div>

      <section className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Consultas realizadas a faturar</h2>
        {groups.length === 0 && <EmptyState title="Nada a faturar">Consultas por convênio aparecem aqui depois de marcadas como realizadas.</EmptyState>}
        {groups.map(({ ins, items, head }) => {
          const value = (a: (typeof items)[number]) => ins.priceCents ?? a.priceCents;
          return (
            <div key={ins.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{ins.name}</h3>
                <span className="text-sm text-muted">TISS {ins.tissVersion}</span>
              </div>
              {head.length > 0 && (
                <div className="mb-3">
                  <Notice tone="warning">
                    Para gerar o lote, falta preencher: {head.join("; ")}.{" "}
                    {can(user, "configuracoes", "edit") && (
                      <Link href="/admin/configuracoes?aba=convenios" className="font-semibold underline">
                        Abrir configurações
                      </Link>
                    )}
                  </Notice>
                </div>
              )}
              <ActionForm action={generateBatch.bind(null, ins.id)} className="space-y-3">
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {items.map((a) => {
                    const problems = guideProblems({ cardNumber: a.patient.insuranceCard, professional: a.professional });
                    if (value(a) <= 0) problems.push("valor da consulta no convênio");
                    return (
                      <li key={a.id}>
                        <label className="flex flex-wrap items-center gap-3 p-3 has-checked:bg-brand-50/50">
                          <input type="checkbox" name="ids" value={a.id} defaultChecked={problems.length === 0} disabled={problems.length > 0} className="size-5 accent-[var(--brand)]" />
                          <span className="min-w-48 flex-1">
                            <span className="font-medium">{a.patient.name}</span>
                            <span className="block text-sm text-muted">
                              {fmtDate(a.start)} · {a.professional.name} · carteirinha {a.patient.insuranceCard || "—"}
                            </span>
                          </span>
                          {problems.length > 0 ? (
                            <Link href={`/admin/pacientes/${a.patientId}`} className="text-sm font-medium text-amber-800 underline">
                              Falta: {problems.join(", ")}
                            </Link>
                          ) : (
                            <span className="font-semibold tabular-nums">{brl(value(a))}</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {canCreate && head.length === 0 && <SubmitButton pendingText="Gerando lote…">Gerar lote de guias</SubmitButton>}
              </ActionForm>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Lotes</h2>
        {batches.length === 0 ? (
          <EmptyState title="Nenhum lote gerado ainda" />
        ) : (
          <ul className="space-y-3">
            {batches.map((b) => {
              const st = TISS_STATUS[b.status as keyof typeof TISS_STATUS];
              return (
                <li key={b.id} className="card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {b.insurance.name} · lote {b.number}
                      </p>
                      <p className="text-sm text-muted">
                        Gerado em {fmtDate(b.createdAt)} · {b._count.appointments} guia(s) · {brl(b.totalCents)}
                        {b.sentAt && ` · enviado em ${fmtDate(b.sentAt)}`}
                        {b.receivedCents != null && ` · recebido ${brl(b.receivedCents)}`}
                        {!!b.glosaCents && ` · glosa ${brl(b.glosaCents)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={st?.tone}>{st?.label ?? b.status}</Badge>
                      {b.status !== "CANCELADO" && (
                        <a href={`/admin/api/tiss/${b.id}`} className="btn-secondary btn-sm" download>
                          <Download className="size-4" aria-hidden /> XML
                        </a>
                      )}
                      {canEdit && b.status === "GERADO" && (
                        <form action={markBatchSent.bind(null, b.id)}>
                          <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                            <Send className="size-4" aria-hidden /> Marcar como enviado
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                  {canEdit && ["GERADO", "ENVIADO"].includes(b.status) && (
                    <details className="mt-3 border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm font-medium">Registrar pagamento da operadora</summary>
                      <ActionForm action={registerBatchPayment.bind(null, b.id)} className="mt-3 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="label" htmlFor={`rec-${b.id}`}>
                            Valor pago (R$)
                          </label>
                          <input id={`rec-${b.id}`} name="received" inputMode="decimal" className="input w-40" placeholder={brl(b.totalCents).replace("R$", "").trim()} required />
                        </div>
                        <div className="min-w-56 flex-1">
                          <label className="label" htmlFor={`not-${b.id}`}>
                            Observação (motivo da glosa, protocolo…)
                          </label>
                          <input id={`not-${b.id}`} name="notes" className="input" />
                        </div>
                        <SubmitButton pendingText="Registrando…">Registrar</SubmitButton>
                      </ActionForm>
                      {can(user, "financeiro", "delete") && (
                        <form action={cancelBatch.bind(null, b.id)} className="mt-3">
                          <SubmitButton className="btn-ghost btn-sm text-red-700" pendingText="…" confirm="Cancelar este lote? As consultas voltam para a lista a faturar.">
                            Cancelar lote (operadora recusou / gerado errado)
                          </SubmitButton>
                        </form>
                      )}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
