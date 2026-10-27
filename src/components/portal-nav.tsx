"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { TONE, type Tone } from "./tones";

const ITEMS: { href: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { href: "/paciente", label: "Início", icon: Home, tone: "teal" },
  { href: "/paciente/consultas", label: "Consultas", icon: CalendarDays, tone: "sky" },
  { href: "/paciente/receitas", label: "Receitas", icon: FileText, tone: "rose" },
  { href: "/paciente/pagamentos", label: "Pagamentos", icon: Wallet, tone: "emerald" },
  { href: "/paciente/dados", label: "Meus dados", icon: UserRound, tone: "violet" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Área do paciente" className="no-print -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
      {ITEMS.map(({ href, label, icon: Icon, tone }) => {
        const active = href === "/paciente" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} data-active={active} className="chip shrink-0 gap-2 pl-1.5">
            <span className={`grid size-7 place-items-center rounded-lg ring-1 ring-inset ${active ? `${TONE[tone].solid} text-white ring-transparent` : TONE[tone].chip}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
