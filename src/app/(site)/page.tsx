import Link from "next/link";
import { Clock, CreditCard, MapPin, Search, ShieldCheck, Star, Video, Building2, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic, sectionVisible } from "@/lib/clinic";
import { PAYMENT_METHODS } from "@/lib/constants";
import { brl } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui";
import { SpecialtyGrid } from "@/components/specialty-grid";
import { MessageForm } from "@/components/message-form";

export default async function Home() {
  const clinic = await getClinic();
  const [specialties, professionals, insurances, testimonials, faq, units] = await Promise.all([
    prisma.specialty.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { professionals: { where: { published: true }, select: { telemedicine: true } } },
    }),
    prisma.professional.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      include: { specialties: true, unit: true },
    }),
    prisma.insurance.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.testimonial.findMany({ where: { authorized: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.faqItem.findMany({ orderBy: { order: "asc" } }),
    prisma.unit.findMany({ where: { active: true } }),
  ]);

  const show = {
    convenios: sectionVisible(clinic, "convenios", insurances.length > 0),
    depoimentos: sectionVisible(clinic, "depoimentos", testimonials.length > 0),
    faq: sectionVisible(clinic, "faq", faq.length > 0),
    mensagem: sectionVisible(clinic, "mensagem"),
  };

  return (
    <>
      {/* Identidade visual */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-100">
              <ShieldCheck className="size-4" aria-hidden /> Agendamento online seguro
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground md:text-5xl">{clinic.tagline || clinic.name}</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">{clinic.about}</p>
            <form action="/agendar" className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-line sm:flex-row" role="search">
              <label htmlFor="hero-q" className="sr-only">
                Buscar por especialidade, médico ou sintoma
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden />
                <input id="hero-q" name="q" placeholder="Especialidade, médico ou sintoma" className="h-12 w-full rounded-xl pr-3 pl-11 text-base outline-none focus:bg-brand-50/50" />
              </div>
              <button className="btn-primary h-12 px-6">Buscar horários</button>
            </form>
            <p className="mt-3 text-sm text-muted">Ex.: “dor nas costas”, “cardiologia”, “Dra. Ana”.</p>
          </div>
          <div className="hidden md:block" aria-hidden>
            <div className="card relative space-y-3 p-5 shadow-xl">
              <p className="text-sm font-semibold text-muted">Próximos horários livres</p>
              {professionals.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <Avatar name={p.name} url={p.photoUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {p.title} {p.name}
                    </p>
                    <p className="text-xs text-muted">{p.specialties.map((s) => s.name).join(", ")}</p>
                  </div>
                  <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-800">Agendar</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section id="especialidades" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Especialidades</h2>
        <p className="mt-1 mb-6 text-muted">Escolha uma especialidade para ver os horários disponíveis.</p>
        <SpecialtyGrid
          items={specialties.filter((s) => s.professionals.length > 0).map((s) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            description: s.description,
            symptoms: s.symptoms,
            icon: s.icon,
            doctors: s.professionals.length,
            tele: s.professionals.some((p) => p.telemedicine),
          }))}
        />
      </section>

      {/* Profissionais */}
      <section id="profissionais" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Nossos profissionais</h2>
        <p className="mt-1 mb-6 text-muted">Conheça a formação e a experiência de quem vai cuidar de você.</p>
        <ul className="grid gap-4 md:grid-cols-2">
          {professionals.map((p) => (
            <li key={p.id} className="card flex flex-col gap-4 p-5 sm:flex-row">
              <Avatar name={p.name} url={p.photoUrl} size={80} />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">
                  {p.title} {p.name}
                </h3>
                <p className="text-sm text-muted">
                  CRM {p.crm}/{p.crmUf} · {p.specialties.map((s) => s.name).join(", ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
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
                  {p.unit && (
                    <Badge>
                      <MapPin className="size-3" aria-hidden /> {p.unit.name}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{p.bio}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={`/agendar?medico=${p.slug}`} className="btn-primary btn-sm">
                    Ver horários
                  </Link>
                  <Link href={`/profissionais/${p.slug}`} className="btn-secondary btn-sm">
                    Perfil completo
                  </Link>
                  {p.priceCents > 0 && <span className="ml-auto text-sm text-muted">Particular {brl(p.priceCents)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Atendimento: pagamento, horários e convênios */}
      <section id="atendimento" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Atendimento</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Clock className="size-5 text-sky-600" aria-hidden /> Horário de funcionamento
            </h3>
            <p className="mt-2 whitespace-pre-line text-muted">{clinic.openingHours || "Consulte a agenda online."}</p>
            {units.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {units.map((u) => (
                  <li key={u.id} className="flex gap-1.5">
                    <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">{u.name}</span> – {u.address}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/agendar" className="btn-ghost btn-sm mt-3 -ml-3">
              <CalendarClock className="size-4 text-sky-600" aria-hidden /> Ver agenda disponível
            </Link>
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <CreditCard className="size-5 text-emerald-600" aria-hidden /> Formas de pagamento
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {clinic.paymentMethodList.map((m) => (
                <li key={m}>
                  <Badge tone="teal">
                    {m === "PARCELAMENTO" && clinic.maxInstallments > 1 ? `Parcelamento em até ${clinic.maxInstallments}x` : PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS] ?? m}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          {show.convenios && (
            <div className="card p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-5 text-violet-600" aria-hidden /> Convênios aceitos
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {insurances.map((i) => (
                  <li key={i.id}>
                    <Badge>{i.name}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">Cada profissional informa no perfil os convênios que atende.</p>
            </div>
          )}
        </div>
      </section>

      {show.depoimentos && (
        <section className="mx-auto max-w-6xl px-4 pt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">O que dizem nossos pacientes</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.id} className="card p-5">
                <div className="flex gap-0.5 text-amber-500" aria-label={`${t.rating} de 5 estrelas`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`size-4 ${i < t.rating ? "fill-current" : "opacity-30"}`} aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-3 text-[15px]">“{t.text}”</blockquote>
                <p className="mt-3 text-sm font-medium text-muted">— {t.author}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {show.faq && (
        <section className="mx-auto max-w-3xl px-4 pt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="space-y-2">
            {faq.map((f) => (
              <details key={f.id} className="card group p-0">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-medium">
                  {f.question}
                  <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {show.mensagem && (
        <section id="contato" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Fale com a gente</h2>
          <p className="mt-1 mb-6 text-muted">Sua mensagem vai direto para a caixa de entrada do médico ou da equipe. Respondemos por WhatsApp ou e-mail.</p>
          <div className="card p-5 sm:p-6">
            <MessageForm professionals={professionals.map((p) => ({ id: p.id, name: `${p.title} ${p.name}` }))} />
          </div>
        </section>
      )}
    </>
  );
}
