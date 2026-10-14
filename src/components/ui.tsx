import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  Baby,
  Bone,
  Brain,
  Eye,
  Flower2,
  HeartPulse,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { initials } from "@/lib/format";
import { SPECIALTY_TONE, TONE, type Tone } from "./tones";

const TONES: Record<string, string> = {
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  teal: "bg-brand-50 text-brand-800 ring-brand-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function Badge({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone] ?? TONES.gray}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-[13px] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const map = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-[15px] ${map[tone]}`}>
      {children}
    </div>
  );
}

export function IconChip({ icon: Icon, tone = "teal", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ring-1 ring-inset ${TONE[tone].chip} ${size === "sm" ? "size-8" : "size-10"}`}>
      <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <IconChip icon={icon} tone={tone} size="sm" />}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition hover:border-brand-200 hover:shadow-sm">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

const SPECIALTY_ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  heart: HeartPulse,
  sparkles: Sparkles,
  baby: Baby,
  flower: Flower2,
  bone: Bone,
  brain: Brain,
  activity: Activity,
  eye: Eye,
  smile: Smile,
};
export const SPECIALTY_ICON_KEYS = Object.keys(SPECIALTY_ICONS);

export function SpecialtyIcon({ name, className = "size-6" }: { name: string; className?: string }) {
  const Icon = SPECIALTY_ICONS[name] ?? Stethoscope;
  return <Icon className={className} aria-hidden />;
}

/** Ícone da especialidade dentro de um quadrado com a cor própria dela. */
export function SpecialtyChip({ name }: { name: string }) {
  return <IconChip icon={SPECIALTY_ICONS[name] ?? Stethoscope} tone={SPECIALTY_TONE[name] ?? "teal"} />;
}
