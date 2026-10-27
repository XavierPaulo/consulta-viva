import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getClinic } from "@/lib/clinic";
import { fmtDate, fmtLongDate, fmtTime, now } from "@/lib/format";
import { ensureRoom, roomState, roomUrl, roomWindow } from "@/lib/video";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { SoapFields } from "@/components/soap-form";
import { Notice, PageHeader } from "@/components/ui";
import { PatientPresence, VideoRoom } from "@/components/video-room";
import { markDoctorJoined } from "../../actions";
import { saveRecord } from "../../../prontuario/actions";

export const metadata = { title: "Sala da teleconsulta" };

export default async function DoctorRoom({ params, searchParams }: PageProps<"/admin/agenda/[id]/sala">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser("agenda");
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: { include: { records: { orderBy: { createdAt: "desc" }, take: 3, include: { prescriptions: true, professional: { select: { name: true } } } } } },
      professional: true,
      records: { select: { id: true } },
    },
  });
  if (!appt || appt.type !== "TELECONSULTA") notFound();
  const scope = ownProfessionalScope(user);
  if (scope && appt.professionalId !== scope) notFound();
  const clinic = await getClinic();
  const state = roomState(appt, now());
  const room = state === "aberta" ? await ensureRoom(appt.id) : null;
  const canRecord = can(user, "prontuario", "create") && (!scope || scope === appt.professionalId);
  const savedId = typeof sp.registro === "string" ? sp.registro : appt.records[0]?.id;
  await audit(user, "VIEW", "Teleconsulta", id);

  return (
    <>
      <PageHeader
        back={{ href: `/admin/agenda/${id}`, label: "Consulta" }}
        title={`Teleconsulta – ${appt.patient.name}`}
        description={`${fmtLongDate(appt.start)}, ${fmtTime(appt.start)}–${fmtTime(appt.end)} · ${appt.professional.title} ${appt.professional.name}`}
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="card h-fit space-y-4 p-5">
          {state === "cedo" && <Notice tone="info">A sala abre às {fmtTime(roomWindow(appt).opensAt)} (30 min antes do horário).</Notice>}
          {state === "encerrada" && <Notice tone="info">Esta teleconsulta foi encerrada ou cancelada.</Notice>}
          {room && (
            <>
              <PatientPresence appointmentId={id} initial={{ joinedAt: appt.patientJoinedAt?.toISOString() ?? null, consent: !!appt.teleConsentAt }} />
              {!appt.teleConsentAt && (
                <Notice tone="warning">O paciente ainda não aceitou o termo de teleconsulta. Ele aceita ao abrir o link da sala.</Notice>
              )}
              <VideoRoom
                url={roomUrl(clinic.videoBaseUrl, room, `${appt.professional.title} ${appt.professional.name}`)}
                embed={clinic.videoEmbed}
                onJoin={markDoctorJoined.bind(null, id)}
                deviceCheck={false}
                joinLabel="Abrir a chamada de vídeo"
              />
              {!clinic.videoEmbed && clinic.videoBaseUrl.includes("meet.jit.si") && (
                <p className="text-sm text-muted">
                  No meet.jit.si, quem abre a sala entra com uma conta Google ou GitHub na primeira vez. O paciente aguarda na sala de espera até você entrar.
                </p>
              )}
            </>
          )}
        </section>

        <section className="card p-5">
          {savedId ? (
            <div className="space-y-3">
              <Notice tone="success">Atendimento registrado no prontuário.</Notice>
              <Link href={`/admin/prontuario/${savedId}`} target="_blank" className="btn-secondary">
                <FileText className="size-4" aria-hidden /> Abrir registro (nova aba)
              </Link>
            </div>
          ) : canRecord ? (
            <ActionForm action={saveRecord} className="space-y-5">
              <h2 className="font-semibold">Prontuário (SOAP)</h2>
              <input type="hidden" name="patientId" value={appt.patientId} />
              <input type="hidden" name="appointmentId" value={appt.id} />
              <input type="hidden" name="professionalId" value={appt.professionalId} />
              <input type="hidden" name="returnTo" value={`/admin/agenda/${id}/sala`} />
              <SoapFields />
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name="finish" defaultChecked className="size-5 accent-[var(--brand)]" /> Marcar consulta como realizada
              </label>
              <SubmitButton pendingText="Salvando…">Salvar no prontuário</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-muted">Sem permissão para registrar no prontuário.</p>
          )}
          {appt.patient.records.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-muted">Histórico recente</h3>
              <ol className="mt-2 space-y-3 text-sm">
                {appt.patient.records.map((r) => (
                  <li key={r.id}>
                    <p className="text-muted">
                      {fmtDate(r.createdAt)} · {r.professional.name.split(" ")[0]}
                    </p>
                    {r.assessment && <p className="font-medium">{r.assessment}</p>}
                    {r.prescriptions.map((x) => (
                      <p key={x.id} className="text-brand-700">
                        ℞ {x.medication} {x.dosage && `– ${x.dosage}`}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
