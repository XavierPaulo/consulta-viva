import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getClinic } from "@/lib/clinic";
import { fmtLongDate, fmtTime, now } from "@/lib/format";
import { DEFAULT_TELE_CONSENT, ensureRoom, roomState, roomUrl, roomWindow } from "@/lib/video";
import { Avatar, Notice } from "@/components/ui";
import { TeleConsent } from "@/components/tele-consent";
import { DeviceCheck, VideoRoom } from "@/components/video-room";
import { markPatientJoined } from "../../../actions";

export const metadata: Metadata = { title: "Sala da teleconsulta", robots: { index: false } };

export default async function PatientRoom({ params }: PageProps<"/consulta/[token]/sala">) {
  const { token } = await params;
  const clinic = await getClinic();
  const appt = await prisma.appointment.findUnique({ where: { manageToken: token }, include: { professional: true, patient: { select: { name: true } } } });
  if (!appt || appt.type !== "TELECONSULTA") notFound();
  const state = roomState(appt, now());
  const { opensAt } = roomWindow(appt);
  const room = state === "aberta" && appt.teleConsentAt ? await ensureRoom(appt.id) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={appt.professional.name} url={appt.professional.photoUrl} size={56} />
        <div>
          <p className="text-sm font-medium text-violet-700">Teleconsulta</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {appt.professional.title} {appt.professional.name}
          </h1>
          <p className="text-muted">
            {fmtLongDate(appt.start)}, {fmtTime(appt.start)}
          </p>
        </div>
      </div>

      <div className="card space-y-5 p-5 sm:p-6">
        {state === "cedo" && (
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-6 shrink-0 text-sky-600" aria-hidden />
            <div>
              <p className="text-lg font-semibold">A sala abre às {fmtTime(opensAt)}</p>
              <p className="text-muted">
                Volte por este mesmo link a partir de 30 minutos antes da consulta. Enquanto isso, você já pode ler o termo e testar câmera e microfone.
              </p>
            </div>
          </div>
        )}
        {state === "encerrada" && <Notice tone="info">Esta teleconsulta foi encerrada ou cancelada. Se precisar, agende um novo horário.</Notice>}

        {state !== "encerrada" && !appt.teleConsentAt && <TeleConsent token={token} text={clinic.teleConsentText || DEFAULT_TELE_CONSENT} />}

        {state === "aberta" && room && (
          <>
            <p className="flex items-center gap-2 text-[15px] text-muted">
              <ShieldCheck className="size-5 text-emerald-600" aria-hidden /> Sala exclusiva desta consulta, com chamada criptografada. O médico entra em seguida.
            </p>
            <VideoRoom url={roomUrl(clinic.videoBaseUrl, room, appt.patient.name)} embed={clinic.videoEmbed} onJoin={markPatientJoined.bind(null, token)} />
          </>
        )}
        {state === "cedo" && appt.teleConsentAt && (
          <>
            <Notice tone="success">Termo aceito. Na hora da consulta, o botão para entrar aparece aqui.</Notice>
            <DeviceCheck />
          </>
        )}
      </div>

      <ul className="mt-6 space-y-1 text-sm text-muted">
        <li>Use fones de ouvido e fique em um lugar reservado e bem iluminado.</li>
        <li>No celular, a chamada funciona direto no navegador; não precisa instalar nada.</li>
      </ul>
      <p className="mt-6">
        <Link href={`/consulta/${token}`} className="link">
          ← Detalhes da consulta
        </Link>
      </p>
    </div>
  );
}
