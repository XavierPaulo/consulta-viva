import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Video, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAvailableSlots } from "@/lib/slots";
import { addDays, fmtLongDate, fmtTime, localToDate, todayYmd } from "@/lib/format";
import { Notice, PageHeader } from "@/components/ui";
import { ApptStatus } from "@/components/status";

export const metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/admin/agenda">) {
  const sp = await searchParams;
  const user = await requireUser("agenda");
  const scope = ownProfessionalScope(user);
  const today = todayYmd();
  const day = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : today;
  const proFilter = scope ?? (typeof sp.p === "string" ? sp.p : "");

  const allPros = await prisma.professional.findMany({ orderBy: { name: "asc" }, where: scope ? { id: scope } : {} });
  const pros = proFilter ? allPros.filter((p) => p.id === proFilter) : allPros;
  const [appts, free] = await Promise.all([
    prisma.appointment.findMany({
      where: { professionalId: { in: pros.map((p) => p.id) }, start: { gte: localToDate(day), lt: localToDate(addDays(day, 1)) } },
      orderBy: { start: "asc" },
      include: { patient: true, insurance: true },
    }),
    getAvailableSlots({ professionalIds: pros.map((p) => p.id), fromDay: day, days: 1 }),
  ]);
  const canCreate = can(user, "agenda", "create");
  const href = (patch: Record<string, string>) => {
    const n = new URLSearchParams({ data: day, ...(proFilter && !scope ? { p: proFilter } : {}), ...patch });
    return `/admin/agenda?${n.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description={<span>{fmtLongDate(localToDate(day, "12:00"))}</span>}
        actions={
          canCreate && (
            <Link href={`/admin/agenda/novo?data=${day}`} className="btn-primary">
              <CalendarPlus className="size-4" aria-hidden /> Novo agendamento
            </Link>
          )
        }
      />
      {sp.ok && (
        <div className="mb-4">
          <Notice tone="success">Agendamento criado.</Notice>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={href({ data: addDays(day, -1) })} className="btn-secondary btn-sm" aria-label="Dia anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={href({ data: today })} className="btn-secondary btn-sm" aria-current={day === today ? "date" : undefined}>
            Hoje
          </Link>
          <Link href={href({ data: addDays(day, 1) })} className="btn-secondary btn-sm" aria-label="Próximo dia">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/admin/agenda">
          <label htmlFor="ag-data" className="sr-only">
            Data
          </label>
          <input id="ag-data" type="date" name="data" defaultValue={day} className="input min-h-9 w-auto py-1.5 text-sm" />
          {!scope && (
            <>
              <label htmlFor="ag-p" className="sr-only">
                Profissional
              </label>
              <select id="ag-p" name="p" defaultValue={proFilter} className="input min-h-9 w-auto py-1.5 text-sm">
                <option value="">Todos os profissionais</option>
                {allPros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="btn-secondary btn-sm">Ver</button>
        </form>
      </div>

      <div className={`grid gap-4 ${pros.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
        {pros.map((p) => {
          const items = [
            ...appts.filter((a) => a.professionalId === p.id).map((a) => ({ kind: "appt" as const, t: a.start.getTime(), a })),
            ...free.filter((s) => s.professionalId === p.id && s.start.getTime() > Date.now()).map((s) => ({ kind: "free" as const, t: s.start.getTime(), s })),
          ].sort((x, y) => x.t - y.t);
          return (
            <section key={p.id} className="card overflow-hidden" aria-labelledby={`pro-${p.id}`}>
              <h2 id={`pro-${p.id}`} className="border-b border-line bg-slate-50/60 px-4 py-3 font-semibold">
                {p.title} {p.name}
                <span className="ml-2 text-sm font-normal text-muted">{appts.filter((a) => a.professionalId === p.id && a.status !== "CANCELADA").length} consultas</span>
              </h2>
              {items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">Sem atendimento neste dia.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((it) =>
                    it.kind === "appt" ? (
                      <li key={it.a.id} className={it.a.status === "CANCELADA" ? "opacity-55" : ""}>
                        <Link href={`/admin/agenda/${it.a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                          <span className="w-12 font-semibold tabular-nums">{fmtTime(it.a.start)}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-medium ${it.a.status === "CANCELADA" ? "line-through" : ""}`}>{it.a.patient.name}</span>
                            <span className="flex items-center gap-1 text-xs text-muted">
                              {it.a.type === "TELECONSULTA" && <Video className="size-3 text-violet-600" aria-label="Teleconsulta" />}
                              {it.a.insurance ? it.a.insurance.name : "Particular"}
                            </span>
                          </span>
                          <ApptStatus status={it.a.status} />
                        </Link>
                      </li>
                    ) : (
                      <li key={it.s.start.toISOString()}>
                        {canCreate ? (
                          <Link
                            href={`/admin/agenda/novo?p=${p.id}&data=${day}&s=${encodeURIComponent(it.s.start.toISOString())}`}
                            className="group flex items-center gap-3 px-4 py-2 text-sm text-muted hover:bg-brand-50 hover:text-brand-800"
                          >
                            <span className="w-12 tabular-nums">{fmtTime(it.s.start)}</span>
                            <span className="flex-1">Livre</span>
                            <Plus className="size-4 opacity-0 group-hover:opacity-100" aria-hidden />
                            <span className="sr-only">Agendar neste horário</span>
                          </Link>
                        ) : (
                          <span className="flex items-center gap-3 px-4 py-2 text-sm text-muted">
                            <span className="w-12 tabular-nums">{fmtTime(it.s.start)}</span> Livre
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
