import Link from "next/link";
import { CalendarCheck, Globe, Phone, Mail, MessageCircle } from "lucide-react";
import { getClinic, sectionVisible } from "@/lib/clinic";
import { CookieBanner } from "@/components/client";
import { onlyDigits } from "@/lib/format";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const clinic = await getClinic();
  const socials = [
    { href: clinic.instagram, label: "Instagram"},
    { href: clinic.facebook, label: "Facebook"},
    { href: clinic.linkedin, label: "LinkedIn"},
    { href: clinic.youtube, label: "YouTube"},
  ].filter((s) => s.href);
  const showContact = sectionVisible(clinic, "contato", !!(clinic.phone || clinic.whatsapp || clinic.email));
  const showSocial = sectionVisible(clinic, "redes", socials.length > 0);
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-brand text-white">
                <CalendarCheck className="size-5" />
              </span>
            )}
            <span className="truncate text-[17px]">{clinic.name}</span>
          </Link>
          <nav aria-label="Principal" className="hidden items-center gap-1 text-[15px] md:flex">
            <Link href="/#especialidades" className="rounded-lg px-3 py-2 text-muted hover:bg-slate-50 hover:text-foreground">
              Especialidades
            </Link>
            <Link href="/#profissionais" className="rounded-lg px-3 py-2 text-muted hover:bg-slate-50 hover:text-foreground">
              Profissionais
            </Link>
            <Link href="/#atendimento" className="rounded-lg px-3 py-2 text-muted hover:bg-slate-50 hover:text-foreground">
              Atendimento
            </Link>
            {showContact && (
              <Link href="/#contato" className="rounded-lg px-3 py-2 text-muted hover:bg-slate-50 hover:text-foreground">
                Contato
              </Link>
            )}
          </nav>
          <Link href="/agendar" className="btn-primary shrink-0">
            Agendar<span className="hidden sm:inline"> consulta</span>
          </Link>
        </div>
      </header>
      <main id="conteudo" className="flex-1 pb-20">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-[15px] sm:grid-cols-3">
          <div>
            <p className="font-semibold">{clinic.name}</p>
            {clinic.address && <p className="mt-1 text-muted">{clinic.address}</p>}
            {clinic.cnpj && <p className="mt-1 text-sm text-muted">CNPJ {clinic.cnpj}</p>}
          </div>
          {showContact && (
            <div className="space-y-1.5">
              <p className="font-semibold">Contato</p>
              {clinic.phone && (
                <a href={`tel:+55${onlyDigits(clinic.phone)}`} className="flex items-center gap-2 text-muted hover:text-foreground">
                  <Phone className="size-4" aria-hidden /> {clinic.phone}
                </a>
              )}
              {clinic.whatsapp && (
                <a href={`https://wa.me/55${onlyDigits(clinic.whatsapp)}`} className="flex items-center gap-2 text-muted hover:text-foreground">
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp {clinic.whatsapp}
                </a>
              )}
              {clinic.email && (
                <a href={`mailto:${clinic.email}`} className="flex items-center gap-2 text-muted hover:text-foreground">
                  <Mail className="size-4" aria-hidden /> {clinic.email}
                </a>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <p className="font-semibold">Transparência</p>
            <Link href="/privacidade" className="block text-muted hover:text-foreground">
              Política de Privacidade (LGPD)
            </Link>
            <Link href="/termos" className="block text-muted hover:text-foreground">
              Termos de Uso
            </Link>
            <Link href="/admin" className="block text-muted hover:text-foreground">
              Acesso da equipe
            </Link>
            {showSocial && (
              <div className="flex flex-wrap gap-2 pt-2">
                {socials.map(({ href, label }) => (
                  <a key={label} href={href} className="chip min-h-9 px-3" target="_blank" rel="noreferrer">
                    <Globe className="size-4" aria-hidden /> {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>
      <CookieBanner />
    </>
  );
}
