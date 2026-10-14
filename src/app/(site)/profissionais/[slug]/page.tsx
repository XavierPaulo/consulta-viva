import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Building2, GraduationCap, MapPin, Briefcase, Video } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic, sectionVisible } from "@/lib/clinic";
import { getAvailableSlots } from "@/lib/slots";
import { WEEKDAYS } from "@/lib/constants";
import { brl, fmtTime, todayYmd, ymd, fmtLongDate, parseJson } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui";
import { MessageForm } from "@/components/message-form";

export async function generateMetadata({ params }: PageProps<"/profissionais/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.professional.findUnique({ where: { slug }, include: { specialties: true } });
  return p ? { title: `${p.title} ${p.name} – ${p.specialties.map((s) => s.name).join(", ")}`, description: p.bio.slice(0, 155) } : {};
}

export default async function ProfessionalPage({ params, searchParams }: PageProps<"/profissionais/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const clinic = await getClinic();
  const p = await prisma.professional.findUnique({
    where: { slug },
    include: { specialties: true, insurances: { where: { active: true } }, unit: true, availability: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] } },
  });
  if (!p || !p.published) notFound();
  const fromDay = typeof sp.data === "string" && sp.data >= todayYmd() ? sp.data : todayYmd();
  const slots = await getAvailableSlots({ professionalIds: [p.id], fromDay, days: 14, minLeadHours: clinic.minBookingHours });
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const d = ymd(s.start);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(s);
  }
  const gallery = parseJson<string[]>(p.gallery, []);
  const weekly = Object.entries(
    p.availability.reduce<Record<number, string[]>>((acc, a) => {
      (acc[a.weekday] ??= []).push(`${a.startTime}–${a.endTime}`);
      return acc;
    }, {}),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/#profissionais" className="text-sm font-medium text-muted hover:text-foreground">
        ← Todos os profissionais
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex flex-col gap-5 sm:flex-row">
              <Avatar name={p.name} url={p.photoUrl} size={112} />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {p.title} {p.name}
                </h1>
                <p className="text-muted">
                  CRM {p.crm}/{p.crmUf}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.specialties.map((s) => (
                    <Badge key={s.id} tone="teal">
                      {s.name}
                    </Badge>
                  ))}
                  {p.inPerson && (
                    <Badge>
                      <Building2 className="size-3" aria-hidden /> Presencial
                    </Badge>
                  )}
                  {p.telemedicine && (
                    <Badge tone="violet">
                      <Video className="size-3" aria-hidden /> Teleconsulta
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-[15px]">{p.bio}</p>
              </div>
            </div>
            {gallery.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {gallery.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g} src={g} alt="" className="aspect-video rounded-xl object-cover" />
                ))}
              </div>
            )}
          </section>
          <section className="card grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <GraduationCap className="size-5 text-brand-700" aria-hidden /> Formação
              </h2>
              <p className="mt-2 whitespace-pre-line text-[15px] text-muted">{p.education || "—"}</p>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Briefcase className="size-5 text-brand-700" aria-hidden /> Experiência
              </h2>
              <p className="mt-2 whitespace-pre-line text-[15px] text-muted">{p.experience || "—"}</p>
            </div>
          </section>
          <section className="card grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <h2 className="font-semibold">Atendimento semanal</h2>
              <ul className="mt-2 space-y-1 text-[15px] text-muted">
                {weekly.map(([wd, ranges]) => (
                  <li key={wd}>
                    <span className="inline-block w-20 font-medium text-foreground">{WEEKDAYS[Number(wd)]}</span> {ranges.join(", ")}
                  </li>
                ))}
              </ul>
              {p.unit && (
                <p className="mt-3 flex gap-1.5 text-sm text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {p.unit.name} – {p.unit.address}
                </p>
              )}
            </div>
            <div>
              <h2 className="font-semibold">Valores e convênios</h2>
              <p className="mt-2 text-[15px]">
                Particular: <span className="font-semibold">{p.priceCents ? brl(p.priceCents) : "consulte"}</span>
              </p>
              {sectionVisible(clinic, "convenios", p.insurances.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.insurances.map((i) => (
                    <Badge key={i.id}>{i.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          </section>
          {sectionVisible(clinic, "mensagem") && (
            <section className="card p-6">
              <h2 className="mb-1 font-semibold">Enviar mensagem para {p.title} {p.name.split(" ")[0]}</h2>
              <p className="mb-4 text-sm text-muted">A resposta chega no seu WhatsApp ou e-mail.</p>
              <MessageForm professionals={[{ id: p.id, name: `${p.title} ${p.name}` }]} defaultProfessionalId={p.id} />
            </section>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-semibold">Agende direto</h2>
            <p className="text-sm text-muted">Próximos 14 dias</p>
            {byDay.size === 0 ? (
              <p className="mt-4 text-sm text-muted">Sem horários livres no período. Fale com a recepção.</p>
            ) : (
              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                {[...byDay.entries()].map(([d, list]) => (
                  <div key={d}>
                    <p className="mb-2 text-sm font-semibold">{fmtLongDate(list[0]!.start)}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {list.map((s) => (
                        <Link
                          key={s.start.toISOString()}
                          href={`/agendar/confirmar?p=${p.id}&s=${encodeURIComponent(s.start.toISOString())}`}
                          className="rounded-lg border border-brand-200 bg-brand-50 py-2 text-center text-sm font-semibold text-brand-800 tabular-nums hover:border-brand hover:bg-brand hover:text-white"
                        >
                          {fmtTime(s.start)}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
