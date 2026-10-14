import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

/** Portabilidade (LGPD art. 18): exporta os dados do paciente em JSON. */
export async function GET(_: Request, ctx: RouteContext<"/admin/api/pacientes/[id]/exportar">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "pacientes", "edit")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const includeRecords = can(user, "prontuario");
  const data = await prisma.patient.findUnique({
    where: { id },
    include: {
      appointments: { include: { professional: { select: { name: true, crm: true } } } },
      payments: true,
      ...(includeRecords ? { records: { include: { prescriptions: true } } } : {}),
    },
  });
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await audit(user, "EXPORT", "Paciente", id, "Exportação de dados (portabilidade LGPD)");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="paciente-${id}.json"` },
  });
}
