import Link from "next/link";
import type { Metadata } from "next";
import { Building2, MapPin, Video } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { getAvailableSlots } from "@/lib/slots";
import { addDays, brl, fmtTime, normalize, todayYmd, ymd, localToDate, fmtWeekdayShort } from "@/lib/format";
import type { Shift } from "@/lib/constants";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { BookingFilters } from "@/components/booking-filters";

export const metadata: Metadata = { title: "Agendar consulta" };

const DAYS = 7;

export default async function AgendarPage({ searchParams }: PageProps<"/agendar">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const clinic = await getClinic();
  const today = todayYmd();
  const fromDay = get("data") && get("data") >= today ? get("data") : today;

  const [specialties, allPros, units, insurances] = await Promise.all([
    prisma.specialty.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.professional.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      include: { specialties: true, insurances: true, unit: true },
    }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.insurance.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const q = normalize(get("q"));
  const words = q.split(/\s+/).filter((w) => w.length > 1 && !["dr", "dra", "de", "da", "do", "com", "no", "na"].includes(w));
  const pros = allPros.filter((p) => {
    if (get("especialidade") && !p.specialties.some((s) => s.slug === get("especialidade"))) return false;
    if (get("medico") && p.slug !== get("medico")) return false;
    if (get("convenio") && get("convenio") !== "particular" && !p.insurances.some((i) => i.id === get("convenio"))) return false;
    if (get("tipo") === "TELECONSULTA" && !p.telemedicine) return false;
    if (get("tipo") === "PRESENCIAL" && !p.inPerson) return false;
    if (words.length) {
      const hay = normalize(`${p.name} ${p.specialties.map((s) => `${s.name} ${s.symptoms}`).join(" ")}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });

  const slots = await getAvailableSlots({
    professionalIds: pros.map((p) => p.id),
    fromDay,
    days: DAYS,
    unitId: get("unidade") || undefined,
    shift: (get("turno") || undefined) as Shift | undefined,
    minLeadHours: clinic.minBookingHours,
  });
  const days = Array.from({ length: DAYS }, (_, i) => addDays(fromDay, i));
  const prevDay = addDays(fromDay, -DAYS) < today ? today : addDays(fromDay, -DAYS);
  const navHref = (d: string) => {
    const n = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    n.set("data", d);
    return `/agendar?${n.toString()}`;
  };
  const extra = new URLSearchParams();
  if (get("tipo")) extra.set("tipo", get("tipo"));
  if (get("convenio")) extra.set("convenio", get("convenio"));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Agendar consulta</h1>
      <p className="mt-1 mb-6 text-muted">Horários atualizados em tempo real. Escolha um horário para continuar — leva menos de 2 minutos.</p>

      <BookingFilters
        minDate={today}
        specialties={specialties.map((s) => ({ value: s.slug, label: s.name }))}
        professionals={allPros.map((p) => ({ value: p.slug, label: `${p.title} ${p.name}` }))}
        units={units.map((u) => ({ value: u.id, label: u.name }))}
        insurances={insurances.map((i) => ({ value: i.id, label: i.name }))}
      />

      <div className="mt-6 mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {pros.length} {pros.length === 1 ? "profissional encontrado" : "profissionais encontrados"}
        </p>
        <div className="flex gap-2">
          {fromDay > today && (
            <Link href={navHref(prevDay)} className="btn-secondary btn-sm" scroll={false}>
              ← Semana anterior
            </Link>
          )}
          <Link href={navHref(addDays(fromDay, DAYS))} className="btn-secondary btn-sm" scroll={false}>
            Próxima semana →
          </Link>
        </div>
      </div>

      {pros.length === 0 ? (
        <EmptyState title="Nenhum profissional com esses filtros" action={<Link href="/agendar" className="btn-secondary">Limpar filtros</Link>}>
          Tente outra palavra, remova algum filtro ou fale com a recepção pelo WhatsApp {clinic.whatsapp}.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {pros.map((p) => {
            const mine = slots.filter((s) => s.professionalId === p.id);
            return (
              <li key={p.id} className="card overflow-hidden">
                <div className="grid lg:grid-cols-[300px_1fr]">
                  <div className="border-b border-line p-5 lg:border-r lg:border-b-0">
                    <div className="flex gap-3">
                      <Avatar name={p.name} url={p.photoUrl} size={56} />
                      <div className="min-w-0">
                        <h2 className="font-semibold">
                          <Link href={`/profissionais/${p.slug}`} className="hover:underline">
                            {p.title} {p.name}
                          </Link>
                        </h2>
                        <p className="text-sm text-muted">{p.specialties.map((s) => s.name).join(", ")}</p>
                        <p className="text-xs text-muted">
                          CRM {p.crm}/{p.crmUf}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.inPerson && (
                        <Badge tone="teal">
                          <Building2 className="size-3" aria-hidden /> Presencial
                        </Badge>
                      )}
                      {p.telemedicine && (
                        <Badge tone="violet">
                          <Video className="size-3" aria-hidden /> Teleconsulta
                        </Badge>
                      )}
                    </div>
                    {p.unit && (
                      <p className="mt-2 flex gap-1 text-sm text-muted">
                        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {p.unit.name}
                      </p>
                    )}
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">{p.priceCents ? brl(p.priceCents) : "Consulte"}</span>
                      <span className="text-muted"> particular · {p.durationMin} min</span>
                    </p>
                    {p.insurances.length > 0 && <p className="mt-1 text-xs text-muted">Convênios: {p.insurances.map((i) => i.name).join(", ")}</p>}
                  </div>
                  <div className="p-4 sm:p-5">
                    {mine.length === 0 ? (
                      <div className="flex h-full flex-col items-start justify-center gap-2 text-sm text-muted">
                        <p>Sem horários livres nesta semana com esses filtros.</p>
                        <Link href={navHref(addDays(fromDay, DAYS))} className="link" scroll={false}>
                          Ver próxima semana →
                        </Link>
                      </div>
                    ) : (
                      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
                        {days.map((d) => {
                          const daySlots = mine.filter((s) => ymd(s.start) === d);
                          const date = localToDate(d, "12:00");
                          return (
                            <div key={d} className="w-[72px] shrink-0 snap-start md:w-auto md:min-w-0">
                              <p className="mb-2 text-center text-xs leading-tight">
                                <span className="block font-semibold capitalize">{d === today ? "Hoje" : fmtWeekdayShort(date)}</span>
                                <span className="text-muted">{d.slice(8)}/{d.slice(5, 7)}</span>
                              </p>
                              <div className="flex flex-col gap-1.5">
                                {daySlots.slice(0, 6).map((s) => (
                                  <Link
                                    key={s.start.toISOString()}
                                    href={`/agendar/confirmar?p=${p.id}&s=${encodeURIComponent(s.start.toISOString())}&${extra.toString()}`}
                                    className="rounded-lg border border-brand-200 bg-brand-50 py-2 text-center text-sm font-semibold text-brand-800 tabular-nums transition hover:border-brand hover:bg-brand hover:text-white"
                                    aria-label={`Agendar com ${p.name} em ${d.split("-").reverse().join("/")} às ${fmtTime(s.start)}`}
                                  >
                                    {fmtTime(s.start)}
                                  </Link>
                                ))}
                                {daySlots.length > 6 && (
                                  <Link
                                    href={`/profissionais/${p.slug}?data=${d}`}
                                    className="rounded-lg py-1.5 text-center text-xs font-medium text-brand-700 hover:underline"
                                  >
                                    +{daySlots.length - 6} {daySlots.length - 6 === 1 ? "horário" : "horários"}
                                  </Link>
                                )}
                                {daySlots.length === 0 && <span className="py-2 text-center text-xs text-slate-400">—</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
