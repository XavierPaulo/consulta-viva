import Link from "next/link";
import { CalendarPlus, UserPlus, Wallet, Video } from "lucide-react";
import { prisma } from "@/lib/db";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { brl, fmtLongDate, fmtTime, localToDate, todayYmd, addDays, formatPhone } from "@/lib/format";
import { Avatar, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import { ApptStatus } from "@/components/status";

export const metadata = { title: "Painel" };

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const user = await requireUser("dashboard");
  const scope = ownProfessionalScope(user);
  const today = todayYmd();
  const dayStart = localToDate(today);
  const dayEnd = localToDate(addDays(today, 1));
  const monthStart = localToDate(`${today.slice(0, 8)}01`);
  const proWhere = scope ? { professionalId: scope } : {};

  const [todayAppts, toConfirm, paidMonth, pending, newMsgs, newPatients, monthDone, monthMissed] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...proWhere, start: { gte: dayStart, lt: dayEnd }, status: { not: "CANCELADA" } },
      orderBy: { start: "asc" },
      include: { patient: true, professional: true, insurance: true },
    }),
    prisma.appointment.count({ where: { ...proWhere, status: "AGENDADA", start: { gte: new Date(), lt: localToDate(addDays(today, 3)) } } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { status: "PAGO", paidAt: { gte: monthStart }, ...(scope ? { appointment: { professionalId: scope } } : {}) } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, _count: true, where: { status: "PENDENTE", ...(scope ? { appointment: { professionalId: scope } } : {}) } }),
    prisma.message.count({ where: { status: "NOVA", ...(scope ? { OR: [{ professionalId: scope }, { professionalId: null }] } : {}) } }),
    prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.appointment.count({ where: { ...proWhere, status: "REALIZADA", start: { gte: monthStart } } }),
    prisma.appointment.count({ where: { ...proWhere, status: "FALTOU", start: { gte: monthStart } } }),
  ]);
  const noShow = monthDone + monthMissed ? Math.round((monthMissed / (monthDone + monthMissed)) * 100) : 0;
  const first = user.name.replace(/^(Dra?\.)\s*/, "").split(" ")[0];
  const hour = Number(fmtTime(new Date()).slice(0, 2));
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      {sp.negado && (
        <div className="mb-4">
          <Notice tone="warning">Seu perfil não tem permissão para acessar aquela área. Fale com o administrador se precisar.</Notice>
        </div>
      )}
      <PageHeader
        title={`${greet}, ${first}!`}
        description={<span>{fmtLongDate(new Date())}</span>}
        actions={
          <>
            {can(user, "agenda", "create") && (
              <Link href="/admin/agenda/novo" className="btn-primary">
                <CalendarPlus className="size-4" aria-hidden /> Novo agendamento
              </Link>
            )}
            {can(user, "pacientes", "create") && (
              <Link href="/admin/pacientes/novo" className="btn-secondary">
                <UserPlus className="size-4" aria-hidden /> Novo paciente
              </Link>
            )}
            {can(user, "financeiro", "create") && (
              <Link href="/admin/financeiro/novo" className="btn-secondary">
                <Wallet className="size-4" aria-hidden /> Registrar pagamento
              </Link>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Consultas hoje" value={todayAppts.length} hint={`${todayAppts.filter((a) => a.status === "REALIZADA").length} realizadas`} href="/admin/agenda" />
        <Stat label="A confirmar (3 dias)" value={toConfirm} hint="Agendadas sem confirmação" href="/admin/agenda" />
        {can(user, "financeiro") && <Stat label="Recebido no mês" value={brl(paidMonth._sum.amountCents)} href="/admin/financeiro?status=PAGO" />}
        {can(user, "financeiro") && <Stat label="A receber" value={brl(pending._sum.amountCents)} hint={`${pending._count} pagamentos pendentes`} href="/admin/financeiro?status=PENDENTE" />}
        {can(user, "mensagens") && <Stat label="Mensagens novas" value={newMsgs} href="/admin/mensagens" />}
        <Stat label="Pacientes novos no mês" value={newPatients} href="/admin/pacientes" />
        <Stat label="Atendimentos no mês" value={monthDone} />
        <Stat label="Taxa de faltas no mês" value={`${noShow}%`} hint={`${monthMissed} faltas`} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Agenda de hoje</h2>
          <Link href="/admin/agenda" className="link text-sm">
            Abrir agenda completa →
          </Link>
        </div>
        {todayAppts.length === 0 ? (
          <EmptyState title="Nenhuma consulta para hoje">Aproveite para revisar pendências ou responder mensagens.</EmptyState>
        ) : (
          <ul className="card divide-y divide-line">
            {todayAppts.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/agenda/${a.id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-slate-50 sm:flex-nowrap">
                  <span className="w-14 text-lg font-semibold tabular-nums">{fmtTime(a.start)}</span>
                  <Avatar name={a.patient.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.patient.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {scope ? formatPhone(a.patient.phone) : `${a.professional.title} ${a.professional.name}`} · {a.insurance ? a.insurance.name : "Particular"}
                    </span>
                  </span>
                  {a.type === "TELECONSULTA" && (
                    <span className="inline-flex items-center gap-1 text-sm text-violet-700">
                      <Video className="size-4" aria-hidden /> Online
                    </span>
                  )}
                  <ApptStatus status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
