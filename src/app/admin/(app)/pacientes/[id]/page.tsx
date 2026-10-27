import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Download, FilePlus2, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { brl, fmtDate, fmtDateTime, formatCpf, formatPhone } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { PatientFields } from "@/components/patient-fields";
import { Avatar, Notice, PageHeader } from "@/components/ui";
import { ApptStatus, PayStatus } from "@/components/status";
import { resolvePrivacyRequest, updatePatient } from "../actions";
import { PRIVACY_REQUEST_KINDS } from "@/lib/constants";

export const metadata = { title: "Paciente" };

function age(b: Date | null) {
  if (!b) return null;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (365.25 * 86400_000));
}

export default async function PacientePage({ params, searchParams }: PageProps<"/admin/pacientes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser("pacientes");
  const insurances = await prisma.insurance.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const scope = ownProfessionalScope(user);
  const p = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: { orderBy: { start: "desc" }, include: { professional: true }, take: 30 },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
      requests: { where: { status: "ABERTO" }, orderBy: { createdAt: "asc" } },
      records: {
        orderBy: { createdAt: "desc" },
        include: { professional: true, prescriptions: true },
        ...(scope ? { where: { professionalId: scope } } : {}),
      },
    },
  });
  if (!p) notFound();
  await audit(user, "VIEW", "Paciente", id);
  const canRecords = can(user, "prontuario");
  if (canRecords && p.records.length) await audit(user, "VIEW", "Prontuário", id, `${p.records.length} registros listados`);
  const years = age(p.birthDate);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pacientes", label: "Pacientes" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={p.name} size={44} /> {p.name}
          </span>
        }
        description={[years !== null ? `${years} anos` : null, formatCpf(p.cpf) || null, formatPhone(p.phone)].filter(Boolean).join(" · ")}
        actions={
          <>
            {can(user, "agenda", "create") && (
              <Link href={`/admin/agenda/novo?paciente=${p.id}`} className="btn-primary">
                <CalendarPlus className="size-4" aria-hidden /> Agendar
              </Link>
            )}
            {can(user, "prontuario", "create") && (
              <Link href={`/admin/prontuario/novo?paciente=${p.id}`} className="btn-secondary">
                <FilePlus2 className="size-4" aria-hidden /> Nova evolução
              </Link>
            )}
            {can(user, "financeiro", "create") && (
              <Link href={`/admin/financeiro/novo?paciente=${p.id}`} className="btn-secondary">
                <Wallet className="size-4" aria-hidden /> Cobrar
              </Link>
            )}
          </>
        }
      />
      {sp.ok && (
        <div className="mb-4">
          <Notice tone="success">Paciente cadastrado.</Notice>
        </div>
      )}
      {!p.lgpdConsentAt && (
        <div className="mb-4">
          <Notice tone="warning">Consentimento LGPD para dados de saúde ainda não registrado. Colete antes do atendimento.</Notice>
        </div>
      )}

      {p.requests.length > 0 && (
        <section className="card mb-5 border-amber-200 p-5">
          <h2 className="font-semibold">Pedidos do paciente sobre os dados (LGPD)</h2>
          <p className="text-sm text-muted">Feitos pela Área do paciente. Prazo legal de resposta: 15 dias.</p>
          <ul className="mt-3 space-y-3">
            {p.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-amber-50 p-3">
                <div className="text-[15px]">
                  <p className="font-medium">
                    {PRIVACY_REQUEST_KINDS[r.kind as keyof typeof PRIVACY_REQUEST_KINDS] ?? r.kind} <span className="text-sm font-normal text-muted">· {fmtDate(r.createdAt)}</span>
                  </p>
                  {r.details && <p className="text-muted">{r.details}</p>}
                </div>
                {can(user, "pacientes", "edit") && (
                  <form action={resolvePrivacyRequest.bind(null, r.id)}>
                    <SubmitButton className="btn-secondary btn-sm" pendingText="…">
                      Marcar como atendido
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          {canRecords && (
            <section className="card p-5">
              <h2 className="mb-4 text-lg font-semibold">Prontuário</h2>
              {p.records.length === 0 ? (
                <p className="text-muted">Nenhuma evolução registrada{scope ? " por você" : ""}.</p>
              ) : (
                <ol className="relative space-y-5 border-l-2 border-brand-100 pl-5">
                  {p.records.map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white bg-brand" aria-hidden />
                      <Link href={`/admin/prontuario/${r.id}`} className="block rounded-xl p-3 -m-3 hover:bg-slate-50">
                        <p className="text-sm text-muted">
                          {fmtDateTime(r.createdAt)} · {r.professional.title} {r.professional.name}
                        </p>
                        <p className="mt-1 font-medium">{r.assessment || r.subjective.slice(0, 120) || "Evolução"}</p>
                        {r.plan && <p className="mt-0.5 line-clamp-2 text-sm text-muted">Plano: {r.plan}</p>}
                        {r.prescriptions.length > 0 && <p className="mt-1 text-sm text-brand-700">{r.prescriptions.length} item(ns) prescrito(s)</p>}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Consultas</h2>
            {p.appointments.length === 0 ? (
              <p className="text-muted">Nenhuma consulta.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.appointments.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/agenda/${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                      <span className="w-36 text-sm tabular-nums">{fmtDateTime(a.start)}</span>
                      <span className="flex-1 truncate text-sm text-muted">
                        {a.professional.title} {a.professional.name}
                      </span>
                      <ApptStatus status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {can(user, "financeiro") && (
            <section className="card p-5">
              <h2 className="mb-3 text-lg font-semibold">Pagamentos</h2>
              {p.payments.length === 0 ? (
                <p className="text-muted">Nenhum pagamento.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.payments.map((pay) => (
                    <li key={pay.id}>
                      <Link href={`/admin/financeiro/${pay.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                        <span className="w-24 text-sm">{fmtDate(pay.paidAt ?? pay.createdAt)}</span>
                        <span className="flex-1 truncate text-sm text-muted">{pay.description}</span>
                        <span className="font-semibold tabular-nums">{brl(pay.amountCents)}</span>
                        <PayStatus status={pay.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 text-lg font-semibold">Cadastro</h2>
            {can(user, "pacientes", "edit") ? (
              <ActionForm action={updatePatient.bind(null, p.id)} className="space-y-4">
                <PatientFields p={p} insurances={insurances} />
                <SubmitButton>Salvar</SubmitButton>
              </ActionForm>
            ) : (
              <dl className="space-y-2 text-[15px]">
                <div>
                  <dt className="text-sm text-muted">E-mail</dt>
                  <dd>{p.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Nascimento</dt>
                  <dd>{p.birthDate ? fmtDate(p.birthDate) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Endereço</dt>
                  <dd>{p.address || "—"}</dd>
                </div>
              </dl>
            )}
          </section>
          {can(user, "pacientes", "edit") && (
            <section className="card p-5">
              <h2 className="font-semibold">Direitos do titular (LGPD)</h2>
              <p className="mt-1 text-sm text-muted">Exporte os dados do paciente para atender pedidos de acesso ou portabilidade. O prontuário é mantido por no mínimo 20 anos (CFM).</p>
              <a href={`/admin/api/pacientes/${p.id}/exportar`} className="btn-secondary btn-sm mt-3">
                <Download className="size-4" aria-hidden /> Exportar dados (JSON)
              </a>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
