import Link from "next/link";
import { ArrowLeftRight, HandCoins, Landmark, Receipt, type LucideIcon } from "lucide-react";
import { TONE, type Tone } from "./tones";

const TABS: { key: string; href: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { key: "pagamentos", href: "/admin/financeiro", label: "Pagamentos", icon: Receipt, tone: "emerald" },
  { key: "repasse", href: "/admin/financeiro/repasse", label: "Repasse", icon: HandCoins, tone: "violet" },
  { key: "conciliacao", href: "/admin/financeiro/conciliacao", label: "Conciliação", icon: ArrowLeftRight, tone: "sky" },
  { key: "convenios", href: "/admin/financeiro/convenios", label: "Convênios (TISS)", icon: Landmark, tone: "amber" },
];

/** Abas do Financeiro; cada uma com a sua cor, como no menu. */
export function FinanceTabs({ active, hide = [] }: { active: string; hide?: string[] }) {
  return (
    <nav aria-label="Seções do financeiro" className="no-print -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.filter((t) => !hide.includes(t.key)).map(({ key, href, label, icon: Icon, tone }) => {
        const on = key === active;
        return (
          <Link key={key} href={href} aria-current={on ? "page" : undefined} data-active={on} className="chip shrink-0 gap-2 pl-1.5">
            <span className={`grid size-7 place-items-center rounded-lg ring-1 ring-inset ${on ? `${TONE[tone].solid} text-white ring-transparent` : TONE[tone].chip}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
