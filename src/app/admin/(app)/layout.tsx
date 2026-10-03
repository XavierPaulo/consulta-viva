import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, ExternalLink, LogOut } from "lucide-react";
import { requireUser, IDLE_MINUTES } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { can, MODULES, type Module } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";
import { IdleWatcher, MobileNav, SideNav, type NavItem } from "@/components/admin-nav";
import { Avatar } from "@/components/ui";
import { logout } from "../auth-actions";

export const metadata: Metadata = { title: { default: "Área interna", template: "%s · Área interna" }, robots: { index: false } };

const NAV: { module: Module; href: string }[] = [
  { module: "dashboard", href: "/admin" },
  { module: "agenda", href: "/admin/agenda" },
  { module: "pacientes", href: "/admin/pacientes" },
  { module: "financeiro", href: "/admin/financeiro" },
  { module: "mensagens", href: "/admin/mensagens" },
  { module: "profissionais", href: "/admin/profissionais" },
  { module: "relatorios", href: "/admin/relatorios" },
  { module: "configuracoes", href: "/admin/configuracoes" },
  { module: "usuarios", href: "/admin/usuarios" },
  { module: "auditoria", href: "/admin/auditoria" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  const clinic = await getClinic();
  const unread = can(user, "mensagens")
    ? await prisma.message.count({ where: { status: "NOVA", ...(user.role === "MEDICO" && user.professionalId ? { OR: [{ professionalId: user.professionalId }, { professionalId: null }] } : {}) } })
    : 0;
  const items: NavItem[] = NAV.filter((n) => can(user, n.module)).map((n) => ({
    href: n.href,
    label: MODULES[n.module],
    icon: n.module,
    badge: n.module === "mensagens" ? unread : undefined,
  }));

  return (
    <div className="min-h-dvh flex-1 lg:grid lg:grid-cols-[256px_1fr]">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <IdleWatcher minutes={IDLE_MINUTES} />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white lg:flex">
        <Link href="/admin" className="flex h-16 items-center gap-2.5 px-5 font-semibold">
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <CalendarCheck className="size-5" />
          </span>
          <span className="truncate">{clinic.name}</span>
        </Link>
        <div className="flex-1 overflow-y-auto py-2">
          <SideNav items={items} />
        </div>
        <div className="border-t border-line p-3">
          <Link href="/" target="_blank" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-slate-50 hover:text-foreground">
            <ExternalLink className="size-4" aria-hidden /> Ver site público
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
          <MobileNav items={items} />
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size={36} />
            <div className="hidden text-sm leading-tight sm:block">
              <p className="font-semibold">{user.name}</p>
              <p className="text-muted">{ROLES[user.role as keyof typeof ROLES]}</p>
            </div>
            <form action={logout}>
              <button className="btn-ghost btn-sm" aria-label="Sair">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
