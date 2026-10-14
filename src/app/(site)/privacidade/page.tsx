import type { Metadata } from "next";
import { getClinic } from "@/lib/clinic";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default async function Page() {
  const clinic = await getClinic();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-muted">Lei Geral de Proteção de Dados – Lei 13.709/2018</p>
      <div className="mt-6 space-y-4 whitespace-pre-line text-[16px] leading-relaxed">{clinic.privacyPolicy || "Política em elaboração."}</div>
      {clinic.email && (
        <p className="mt-8 rounded-xl bg-brand-50 p-4">
          Para exercer seus direitos (acesso, correção, portabilidade ou exclusão), escreva para <a className="link" href={`mailto:${clinic.email}`}>{clinic.email}</a>.
        </p>
      )}
    </article>
  );
}
