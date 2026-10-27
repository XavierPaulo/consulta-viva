import { LogOut } from "lucide-react";
import { requirePatient } from "@/lib/patient-auth";
import { PortalNav } from "@/components/portal-nav";
import { logoutPatient } from "../actions";

export default async function PatientAreaLayout({ children }: { children: React.ReactNode }) {
  const patient = await requirePatient();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="no-print mb-5 flex items-center justify-between gap-3">
        <p className="text-[15px] text-muted">
          Olá, <strong className="text-foreground">{patient.name.split(" ")[0]}</strong>
        </p>
        <form action={logoutPatient}>
          <button className="btn-ghost btn-sm">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </form>
      </div>
      <PortalNav />
      {children}
    </div>
  );
}
