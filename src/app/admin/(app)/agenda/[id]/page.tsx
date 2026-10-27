import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, CheckCircle2, FileText, UserX, Video, Wallet, XCircle, ThumbsUp, Link2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { APPOINTMENT_TYPES } from "@/lib/constants";
import { brl, centsToInput, fmtDateTime, fmtLongDate, fmtTime, formatCpf, formatPhone, hm, ymd } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Field, PageHeader } from "@/components/ui";
import { ApptStatus, PayStatus } from "@/components/status";
import { sendReminder, setAppointmentStatus, updateAppointment } from "../actions";
import { createPaymentLink } from "../../financeiro/actions";

export const metadata = { title: "Consulta" };

export default async function ConsultaAdmin({ params }: PageProps<"/admin/agenda/[id]">) {
  const { id } = await params;
  const user = await requireUser("agenda");
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      professional: { include: { insurances: true } },
      insurance: true,
      unit: true,
      payments: { orderBy: { createdAt: "desc" } },
      records: { select: { id: true } },
    },
  });
  if (!appt) notFound();
  const scope = ownProfessionalScope(user);
  if (scope && appt.professionalId !== scope) notFound();
  await audit(user, "VIEW", "Consulta", id);

  const canEdit = can(user, "agenda", "edit");
  const canCancel = can(user, "agenda", "delete");
  const active = ["AGENDADA", "CONFIRMADA"].includes(appt.status);
  const canRecord = can(user, "prontuario", "create") && (!scope || scope === appt.professionalId);
  const notifs = await prisma.notification.findMany({ where: { related: id }, orderBy: { createdAt: "desc" }, take: 5 });

  return (
    <>
      <PageHeader
        back={{ href: `/admin/agenda?data=${ymd(appt.start)}`, label: "Agenda do dia" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {appt.patient.name} <ApptStatus status={appt.status} />
          </span>
        }
        description={
          <span>
            {fmtLongDate(appt.start)}, {fmtTime(appt.start)}–{fmtTime(appt.end)} · {appt.professional.title} {appt.professional.name}
          </span>
        }
        actions={
          <>
            {appt.type === "TELECONSULTA" && appt.status !== "CANCELADA" && (
              <Link href={`/admin/agenda/${appt.id}/sala`} className="btn-primary bg-violet-600 hover:bg-violet-700">
                <Video className="size-4" aria-hidden /> Sala de vídeo
              </Link>
            )}
            {canRecord && appt.status !== "CANCELADA" && (
              <Link href={appt.records[0] ? `/admin/prontuario/${appt.records[0].id}` : `/admin/prontuario/novo?consulta=${appt.id}`} className="btn-primary">
                <FileText className="size-4" aria-hidden /> {appt.records[0] ? "Ver prontuário" : "Iniciar atendimento"}
              </Link>
            )}
            {can(user, "pacientes") && (
              <Link href={`/admin/pacientes/${appt.patientId}`} className="btn-secondary">
                Ficha do paciente
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {canEdit && active && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Ações rápidas</h2>
              <div className="flex flex-wrap gap-2">
                {appt.status === "AGENDADA" && (
                  <form action={setAppointmentStatus.bind(null, id, "CONFIRMADA")}>
                    <SubmitButton className="btn-secondary" pendingText="…">
                      <ThumbsUp className="size-4" aria-hidden /> Confirmar presença
                    </SubmitButton>
                  </form>
                )}
                <form action={setAppointmentStatus.bind(null, id, "REALIZADA")}>
                  <SubmitButton className="btn-secondary" pendingText="…">
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> Marcar como realizada
                  </SubmitButton>
                </form>
                <form action={setAppointmentStatus.bind(null, id, "FALTOU")}>
                  <SubmitButton className="btn-secondary" pendingText="…" confirm="Registrar falta do paciente?">
                    <UserX className="size-4 text-amber-600" aria-hidden /> Faltou
                  </SubmitButton>
                </form>
                <form action={sendReminder.bind(null, id)}>
                  <SubmitButton className="btn-secondary" pendingText="Enviando…">
                    <Bell className="size-4" aria-hidden /> Enviar lembrete
                  </SubmitButton>
                </form>

              </div>
            </section>
          )}

          {canEdit && appt.status !== "CANCELADA" && (
            <section className="card p-5">
              <h2 className="mb-4 font-semibold">Dados da consulta</h2>
              <ActionForm action={updateAppointment.bind(null, id)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Data" htmlFor="date" required>
                    <input id="date" name="date" type="date" defaultValue={ymd(appt.start)} className="input" required />
                  </Field>
                  <Field label="Horário" htmlFor="time" required>
                    <input id="time" name="time" type="time" defaultValue={hm(appt.start)} className="input" required step={300} />
                  </Field>
                  <Field label="Tipo" htmlFor="type">
                    <select id="type" name="type" defaultValue={appt.type} className="input">
                      {Object.entries(APPOINTMENT_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Pagamento" htmlFor="insuranceId">
                    <select id="insuranceId" name="insuranceId" defaultValue={appt.insuranceId ?? ""} className="input">
                      <option value="">Particular</option>
                      {appt.professional.insurances.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor (R$)" htmlFor="price">
                    <input id="price" name="price" inputMode="decimal" defaultValue={centsToInput(appt.priceCents)} className="input" />
                  </Field>
                </div>
                <Field label="Observações internas" htmlFor="notes">
                  <textarea id="notes" name="notes" rows={2} defaultValue={appt.notes} className="input" />
                </Field>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--brand)]" /> Avisar paciente se remarcar
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="force" className="size-4 accent-[var(--brand)]" /> Encaixe (permitir sobreposição)
                  </label>
                </div>
                <SubmitButton>Salvar alterações</SubmitButton>
              </ActionForm>
            </section>
          )}

          {canCancel && active && (
            <details className="card p-5">
              <summary className="cursor-pointer font-semibold text-red-700">Cancelar consulta</summary>
              <form action={setAppointmentStatus.bind(null, id, "CANCELADA")} className="mt-4 space-y-3">
                <label htmlFor="reason" className="label">
                  Motivo
                </label>
                <input id="reason" name="reason" className="input" placeholder="Ex.: paciente pediu para cancelar" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notify" defaultChecked className="size-4 accent-[var(--brand)]" /> Avisar o paciente por WhatsApp
                </label>
                <SubmitButton className="btn-danger" pendingText="Cancelando…" confirm="Confirmar o cancelamento desta consulta?">
                  <XCircle className="size-4" aria-hidden /> Cancelar consulta
                </SubmitButton>
              </form>
            </details>
          )}
          {appt.status === "CANCELADA" && appt.cancelReason && <p className="text-muted">Motivo do cancelamento: {appt.cancelReason}</p>}
        </div>

        <aside className="space-y-5">
          <section className="card p-5 text-[15px]">
            <h2 className="mb-3 font-semibold">Paciente</h2>
            <p className="font-medium">{appt.patient.name}</p>
            {appt.patient.cpf && <p className="text-muted">CPF {formatCpf(appt.patient.cpf)}</p>}
            <p className="text-muted">{formatPhone(appt.patient.phone)}</p>
            {appt.patient.email && <p className="text-muted">{appt.patient.email}</p>}
            <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Tipo</dt>
                <dd>{APPOINTMENT_TYPES[appt.type as keyof typeof APPOINTMENT_TYPES]}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Local</dt>
                <dd>{appt.unit?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Origem</dt>
                <dd>{appt.source === "ONLINE" ? "Site (online)" : "Recepção"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Valor</dt>
                <dd className="font-semibold">{appt.insurance ? appt.insurance.name : brl(appt.priceCents)}</dd>
              </div>
            </dl>
          </section>

          {can(user, "financeiro") && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Pagamentos</h2>
              {appt.payments.length === 0 ? (
                <p className="text-sm text-muted">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {appt.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/admin/financeiro/${p.id}`} className="hover:underline">
                        {brl(p.amountCents)}
                      </Link>
                      <PayStatus status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
              {can(user, "financeiro", "create") && appt.status !== "CANCELADA" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/admin/financeiro/novo?consulta=${appt.id}`} className="btn-secondary btn-sm">
                    <Wallet className="size-4" aria-hidden /> Registrar
                  </Link>
                  {!appt.insurance && appt.priceCents > 0 && (
                    <form action={createPaymentLink.bind(null, appt.id)}>
                      <SubmitButton className="btn-secondary btn-sm" pendingText="Gerando…">
                        <Link2 className="size-4" aria-hidden /> Link de pagamento
                      </SubmitButton>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}

          {notifs.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Mensagens enviadas</h2>
              <ul className="space-y-2 text-sm">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <span className="font-medium">{n.channel === "WHATSAPP" ? "WhatsApp" : n.channel === "EMAIL" ? "E-mail" : "SMS"}</span>
                    <span className="text-muted"> · {fmtDateTime(n.createdAt)}</span>
                    <p className="line-clamp-2 text-muted">{n.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
