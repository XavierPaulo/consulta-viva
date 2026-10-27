import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, ownProfessionalScope } from "@/lib/auth";
import { can } from "@/lib/permissions";

/** Situação do paciente na sala de teleconsulta (consultada pela tela do médico). */
export async function GET(_: Request, ctx: RouteContext<"/admin/api/sala/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "agenda")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const appt = await prisma.appointment.findUnique({ where: { id }, select: { professionalId: true, patientJoinedAt: true, teleConsentAt: true } });
  const scope = ownProfessionalScope(user);
  if (!appt || (scope && appt.professionalId !== scope)) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ joinedAt: appt.patientJoinedAt?.toISOString() ?? null, consent: !!appt.teleConsentAt }, { headers: { "Cache-Control": "no-store" } });
}
