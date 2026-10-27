import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck, FileText, Video, Wallet } from "lucide-react";
import { getCurrentPatient } from "@/lib/patient-auth";
import { PatientLogin } from "@/components/patient-login";
import { IconChip, Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Área do paciente", robots: { index: false } };

export default async function Entrar({ searchParams }: PageProps<"/paciente/entrar">) {
  if (await getCurrentPatient()) redirect("/paciente");
  const sp = await searchParams;
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Área do paciente</h1>
        <p className="mt-2 text-[17px] text-muted">Tudo sobre as suas consultas em um só lugar, sem senha para decorar.</p>
        <ul className="mt-8 space-y-4 text-[15px]">
          <li className="flex items-center gap-3">
            <IconChip icon={CalendarCheck} tone="sky" /> Ver, remarcar e cancelar consultas
          </li>
          <li className="flex items-center gap-3">
            <IconChip icon={Video} tone="violet" /> Entrar na teleconsulta
          </li>
          <li className="flex items-center gap-3">
            <IconChip icon={FileText} tone="rose" /> Baixar receitas
          </li>
          <li className="flex items-center gap-3">
            <IconChip icon={Wallet} tone="emerald" /> Pagar e emitir recibos
          </li>
        </ul>
      </div>
      <div className="card h-fit p-6 sm:p-8">
        {sp.expirada && (
          <div className="mb-5">
            <Notice tone="warning">Sua sessão terminou por segurança. Entre de novo.</Notice>
          </div>
        )}
        {sp.saiu && (
          <div className="mb-5">
            <Notice tone="success">Você saiu da Área do paciente.</Notice>
          </div>
        )}
        <PatientLogin />
      </div>
    </div>
  );
}
