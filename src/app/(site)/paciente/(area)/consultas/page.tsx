import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePatient } from "@/lib/patient-auth";
import { now } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { PortalApptCard, portalApptInclude } from "../appt-card";

export const metadata: Metadata = { title: "Minhas consultas", robots: { index: false } };

export default async function MyAppointments() {
  const patient = await requirePatient();
  const nowMs = now();
  const all = await prisma.appointment.findMany({ where: { patientId: patient.id }, orderBy: { start: "desc" }, include: portalApptInclude, take: 100 });
  const cutoff = nowMs - 3600_000;
  const next = all.filter((a) => a.end.getTime() > cutoff && ["AGENDADA", "CONFIRMADA"].includes(a.status)).reverse();
  const past = all.filter((a) => !next.includes(a));
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">Próximas</h1>
        {next.length === 0 ? (
          <EmptyState title="Nenhuma consulta marcada" action={<Link href="/agendar" className="btn-primary">Agendar consulta</Link>} />
        ) : (
          <div className="space-y-3">
            {next.map((a) => (
              <PortalApptCard key={a.id} a={a} nowMs={nowMs} />
            ))}
          </div>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
          <div className="space-y-3">
            {past.map((a) => (
              <PortalApptCard key={a.id} a={a} nowMs={nowMs} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
