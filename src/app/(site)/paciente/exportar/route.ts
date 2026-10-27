import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { getCurrentPatient } from "@/lib/patient-auth";

/** Portabilidade (LGPD art. 18, V): o paciente baixa os próprios dados, incluindo o prontuário. */
export async function GET() {
  const patient = await getCurrentPatient();
  if (!patient) return NextResponse.json({ error: "Entre na Área do paciente para baixar seus dados." }, { status: 401 });
  const data = await prisma.patient.findUnique({
    where: { id: patient.id },
    include: {
      appointments: { include: { professional: { select: { name: true, crm: true, crmUf: true } } } },
      payments: { omit: { linkToken: true } },
      records: { include: { prescriptions: true, professional: { select: { name: true, crm: true, crmUf: true } } } },
      requests: true,
    },
    omit: { notes: true },
  });
  await audit(null, "EXPORT", "Paciente", patient.id, "Exportação feita pelo próprio paciente (portabilidade LGPD)");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="meus-dados.json"`, "Cache-Control": "no-store" },
  });
}
