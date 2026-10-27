import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, MapPin, Video, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { getAvailableSlots } from "@/lib/slots";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES } from "@/lib/constants";
import { brl, fmtLongDate, fmtTime, todayYmd, ymd, fmtWeekdayShort } from "@/lib/format";
import { now } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui";
import { ManageAppointment } from "@/components/manage-appointment";
import { SubmitButton } from "@/components/client";
import { confirmByPatient } from "../../actions";

export const metadata: Metadata = { title: "Minha consulta", robots: { index: false } };

export default async function ConsultaPage({ params, searchParams }: PageProps<"/consulta/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const clinic = await getClinic();
  const appt = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { professional: { include: { specialties: true } }, unit: true, insurance: true, payments: true },
  });
  if (!appt) notFound();
  const status = APPOINTMENT_STATUS[appt.status as keyof typeof APPOINTMENT_STATUS];
  const isFuture = appt.start.getTime() > now();
  const canChange = isFuture && ["AGENDADA", "CONFIRMADA"].includes(appt.status) && appt.start.getTime() - now() >= clinic.cancelMinHours * 3600_000;
  const pendingLink = appt.payments.find((p) => p.status === "PENDENTE" && p.linkToken);
  const paid = appt.payments.some((p) => p.status === "PAGO");

  let days: { day: string; label: string; slots: { iso: string; time: string }[] }[] = [];
  if (canChange) {
    const slots = await getAvailableSlots({
      professionalIds: [appt.professionalId],
      fromDay: todayYmd(),
      days: 21,
      minLeadHours: clinic.minBookingHours,
      ignoreAppointmentId: appt.id,
    });
    const map = new Map<string, { iso: string; time: string }[]>();
    for (const s of slots) {
      const d = ymd(s.start);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push({ iso: s.start.toISOString(), time: fmtTime(s.start) });
    }
    days = [...map.entries()].map(([day, list]) => ({
      day,
      label: `${fmtWeekdayShort(list[0] ? new Date(list[0].iso) : new Date())} ${day.slice(8)}/${day.slice(5, 7)}`,
      slots: list,
    }));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {sp.novo && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" role="status">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" aria-hidden />
          <div>
            <p className="text-lg font-semibold">Consulta agendada!</p>
            <p className="text-[15px]">Enviamos a confirmação por e-mail e WhatsApp. Guarde este link para remarcar ou cancelar quando precisar.</p>
          </div>
        </div>
      )}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={appt.professional.name} url={appt.professional.photoUrl} size={56} />
            <div>
              <h1 className="text-xl font-semibold">
                {appt.professional.title} {appt.professional.name}
              </h1>
              <p className="text-muted">{appt.professional.specialties.map((s) => s.name).join(", ")}</p>
            </div>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <CalendarDays className="mt-0.5 size-5 text-brand-700" aria-hidden />
            <div>
              <dt className="text-sm text-muted">Quando</dt>
              <dd className="font-semibold">
                {fmtLongDate(appt.start)}, {fmtTime(appt.start)}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            {appt.type === "TELECONSULTA" ? <Video className="mt-0.5 size-5 text-brand-700" aria-hidden /> : <MapPin className="mt-0.5 size-5 text-brand-700" aria-hidden />}
            <div>
              <dt className="text-sm text-muted">{APPOINTMENT_TYPES[appt.type as keyof typeof APPOINTMENT_TYPES]}</dt>
              <dd className="font-semibold">
                {appt.type === "TELECONSULTA" ? (
                  <Link href={`/consulta/${token}/sala`} className="link">
                    Sala virtual (abre 30 min antes)
                  </Link>
                ) : appt.unit ? (
                  appt.unit.name
                ) : (
                  clinic.address
                )}
              </dd>
              {appt.type === "PRESENCIAL" && appt.unit && <dd className="text-sm text-muted">{appt.unit.address}</dd>}
            </div>
          </div>
          <div className="flex gap-3">
            <Wallet className="mt-0.5 size-5 text-brand-700" aria-hidden />
            <div>
              <dt className="text-sm text-muted">Valor</dt>
              <dd className="font-semibold">
                {appt.insurance ? `Convênio ${appt.insurance.name}` : brl(appt.priceCents)} {paid && <Badge tone="green">Pago</Badge>}
              </dd>
            </div>
          </div>
        </dl>
        {appt.status === "AGENDADA" && isFuture && (
          <form action={confirmByPatient.bind(null, token)} className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sky-50 p-4">
            <p className="text-[15px]">Vai comparecer? Confirme para a clínica se organizar.</p>
            <SubmitButton className="btn-primary btn-sm" pendingText="Confirmando…">
              Confirmar presença
            </SubmitButton>
          </form>
        )}
        {appt.status === "CONFIRMADA" && isFuture && <p className="mt-6 text-[15px] font-medium text-emerald-700">✓ Presença confirmada. Até lá!</p>}
        {pendingLink && appt.status !== "CANCELADA" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4">
            <p className="text-[15px]">Pagamento antecipado disponível: {brl(pendingLink.amountCents)}</p>
            <Link href={`/pagar/${pendingLink.linkToken}`} className="btn-primary btn-sm">
              Pagar agora
            </Link>
          </div>
        )}
      </div>

      {appt.status !== "CANCELADA" && isFuture && (
        <div className="mt-6">
          <ManageAppointment token={token} days={days} canChange={canChange} limitHours={clinic.cancelMinHours} />
        </div>
      )}
      {clinic.cancellationPolicy && <p className="mt-6 text-sm text-muted">{clinic.cancellationPolicy}</p>}
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/paciente" className="link">
          Ver todas as minhas consultas
        </Link>
        <Link href="/" className="link">
          Voltar ao site
        </Link>
      </p>
    </div>
  );
}
