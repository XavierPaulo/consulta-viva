import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";
import { getClinic } from "@/lib/clinic";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const clinic = await getClinic();
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-50 to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-brand text-white">
            <CalendarCheck className="size-5" />
          </span>
          {clinic.name}
        </Link>
        <div className="card p-6 shadow-lg">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 mb-5 text-sm text-muted">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
