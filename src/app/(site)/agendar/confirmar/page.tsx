import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { isSlotFree } from "@/lib/slots";
import { fmtLongDate, fmtTime } from "@/lib/format";
import { now } from "@/lib/format";
import { BookingForm } from "@/components/booking-form";
import { Avatar, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Confirmar agendamento" };

export default async function ConfirmarPage({ searchParams }: PageProps<"/agendar/confirmar">) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const clinic = await getClinic();
  const pro = await prisma.professional.findUnique({
    where: { id: get("p") },
    include: { specialties: true, insurances: { where: { active: true } }, unit: true },
  });
  const start = new Date(get("s"));
  if (!pro || Number.isNaN(start.getTime())) notFound();
  const end = new Date(start.getTime() + pro.durationMin * 60_000);
  const free = start.getTime() > now() + clinic.minBookingHours * 3600_000 && (await isSlotFree(pro.id, start, end));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/agendar?medico=${pro.slug}`} className="text-sm font-medium text-muted hover:text-foreground">
        ← Escolher outro horário
      </Link>
      <div className="mt-3 mb-6 flex items-center gap-3">
        <Avatar name={pro.name} url={pro.photoUrl} size={48} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Confirmar agendamento</h1>
          <p className="text-muted">
            {pro.title} {pro.name} · <span>{fmtLongDate(start)}</span> às {fmtTime(start)}
          </p>
        </div>
      </div>
      {!free ? (
        <EmptyState title="Este horário não está mais disponível" action={<Link href={`/agendar?medico=${pro.slug}`} className="btn-primary">Ver outros horários</Link>}>
          Alguém pode ter reservado agora há pouco. Escolha outro horário, por favor.
        </EmptyState>
      ) : (
        <BookingForm
          professional={{
            id: pro.id,
            name: `${pro.title} ${pro.name}`,
            specialties: pro.specialties.map((s) => s.name).join(", "),
            priceCents: pro.priceCents,
            inPerson: pro.inPerson,
            telemedicine: pro.telemedicine,
            durationMin: pro.durationMin,
          }}
          start={start.toISOString()}
          dateLabel={fmtLongDate(start)}
          timeLabel={fmtTime(start)}
          unit={pro.unit ? { name: pro.unit.name, address: pro.unit.address } : null}
          insurances={pro.insurances.map((i) => ({ id: i.id, name: i.name }))}
          defaultType={get("tipo")}
          defaultInsurance={get("convenio")}
          cancellationPolicy={clinic.cancellationPolicy}
          allowPrepay={clinic.paymentMethodList.some((m) => ["PIX", "CREDITO"].includes(m))}
        />
      )}
    </div>
  );
}
