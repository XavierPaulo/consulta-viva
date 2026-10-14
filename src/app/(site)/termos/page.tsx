import type { Metadata } from "next";
import { getClinic } from "@/lib/clinic";

export const metadata: Metadata = { title: "Termos de Uso" };

export default async function Page() {
  const clinic = await getClinic();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Termos de Uso</h1>
      <div className="mt-6 space-y-4 whitespace-pre-line text-[16px] leading-relaxed">{clinic.termsOfUse || "Termos em elaboração."}</div>
      {clinic.cancellationPolicy && (
        <>
          <h2 className="mt-8 text-xl font-semibold">Política de cancelamento</h2>
          <p className="mt-2 whitespace-pre-line">{clinic.cancellationPolicy}</p>
        </>
      )}
    </article>
  );
}
