"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  agenda: CalendarDays,
  pacientes: Users,
  prontuario: FileText,
  profissionais: Stethoscope,
  financeiro: Wallet,
  mensagens: MessageSquare,
  relatorios: BarChart3,
  configuracoes: Settings,
  usuarios: ShieldCheck,
  auditoria: ClipboardList,
};

import { MODULE_TONE, TONE } from "./tones";

export type NavItem = { href: string; label: string; icon: string; badge?: number };

function Items({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const Icon = ICONS[it.icon] ?? LayoutDashboard;
        const tone = TONE[MODULE_TONE[it.icon] ?? "teal"];
        const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] font-medium transition ${
                active ? "bg-slate-100 text-foreground" : "text-muted hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${active ? `${tone.solid} text-white ring-transparent` : tone.chip}`}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">{it.badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Menu da área interna" className="px-3">
      <Items items={items} />
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost btn-sm lg:hidden" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-3 shadow-xl">
            <div className="mb-3 flex justify-end">
              <button type="button" className="btn-ghost btn-sm" aria-label="Fechar menu" onClick={() => setOpen(false)}>
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <Items items={items} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/** Encerra a sessão no navegador após o período de inatividade (o servidor também expira). */
export function IdleWatcher({ minutes }: { minutes: number }) {
  const router = useRouter();
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const bump = () => (last.current = Date.now());
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - last.current > minutes * 60_000) router.replace("/admin/login?expirada=1");
    }, 30_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [minutes, router]);
  return null;
}
