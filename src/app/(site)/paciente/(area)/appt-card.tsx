import Link from "next/link";
import { CalendarDays, MapPin, Video } from "lucide-react";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPES } from "@/lib/constants";
import { brl, fmtLongDate, fmtTime } from "@/lib/format";
import { roomState } from "@/lib/video";
import { Avatar, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { confirmByPatient } from "../../actions";

export type PortalAppt = {
  id: string;
  start: Date;
  end: Date;
  type: string;
  status: string;
  manageToken: string;
  priceCents: number;
  professional: { name: string; title: string; photoUrl: string; specialties: { name: string }[] };
  unit: { name: string; address: string } | null;
  insurance: { name: string } | null;
  payments: { status: string; linkToken: string | null; amountCents: number }[];
};

export function PortalApptCard({ a, nowMs }: { a: PortalAppt; nowMs: number }) {
  const status = APPOINTMENT_STATUS[a.status as keyof typeof APPOINTMENT_STATUS];
  const tele = a.type === "TELECONSULTA";
  const room = roomState(a, nowMs);
  const future = a.start.getTime() > nowMs;
  const pending = a.payments.find((p) => p.status === "PENDENTE" && p.linkToken);
  const canConfirm = a.status === "AGENDADA" && future && a.start.getTime() - nowMs < 3 * 86400_000;
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={a.professional.name} url={a.professional.photoUrl} size={48} />
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {a.professional.title} {a.professional.name}
            </p>
            <p className="truncate text-sm text-muted">{a.professional.specialties.map((s) => s.name).join(", ")}</p>
          </div>
        </div>
        <Badge tone={status?.tone}>{status?.label ?? a.status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-[15px] sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-sky-600" aria-hidden />
          {fmtLongDate(a.start)}, {fmtTime(a.start)}
        </p>
        <p className="flex items-center gap-2">
          {tele ? <Video className="size-4 shrink-0 text-violet-600" aria-hidden /> : <MapPin className="size-4 shrink-0 text-rose-600" aria-hidden />}
          {tele ? APPOINTMENT_TYPES.TELECONSULTA : (a.unit?.name ?? APPOINTMENT_TYPES.PRESENCIAL)}
          <span className="text-muted">· {a.insurance ? a.insurance.name : brl(a.priceCents)}</span>
        </p>
      </div>
      {(future || room === "aberta") && !["CANCELADA", "FALTOU"].includes(a.status) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tele && room === "aberta" && (
            <Link href={`/consulta/${a.manageToken}/sala`} className="btn-primary">
              <Video className="size-4" aria-hidden /> Entrar na sala
            </Link>
          )}
          {canConfirm && (
            <form action={confirmByPatient.bind(null, a.manageToken)}>
              <SubmitButton className="btn-primary" pendingText="Confirmando…">
                Confirmar presença
              </SubmitButton>
            </form>
          )}
          {pending && (
            <Link href={`/pagar/${pending.linkToken}`} className="btn-secondary">
              Pagar {brl(pending.amountCents)}
            </Link>
          )}
          {future && (
            <Link href={`/consulta/${a.manageToken}`} className="btn-secondary">
              Remarcar ou cancelar
            </Link>
          )}
        </div>
      )}
      {tele && room === "cedo" && future && (
        <p className="mt-3 text-sm text-muted">A sala de vídeo abre 30 minutos antes do horário. Você também recebe o link por mensagem.</p>
      )}
    </article>
  );
}

export const portalApptInclude = {
  professional: { select: { name: true, title: true, photoUrl: true, specialties: { select: { name: true } } } },
  unit: { select: { name: true, address: true } },
  insurance: { select: { name: true } },
  payments: { select: { status: true, linkToken: true, amountCents: true } },
} as const;
