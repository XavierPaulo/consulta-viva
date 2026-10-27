import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

/** Download do XML do lote TISS, em ISO-8859-1 como pede o padrão. */
export async function GET(_: Request, ctx: RouteContext<"/admin/api/tiss/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user, "financeiro") || user.role === "MEDICO") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const batch = await prisma.tissBatch.findUnique({ where: { id }, include: { insurance: { select: { name: true } } } });
  if (!batch) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await audit(user, "EXPORT", "Lote TISS", id, `Download do XML do lote ${batch.number}`);
  const name = `tiss-${batch.insurance.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-lote-${batch.number}.xml`;
  return new NextResponse(Buffer.from(batch.xml, "latin1"), {
    headers: { "Content-Type": "application/xml; charset=ISO-8859-1", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
