import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { onlyDigits } from "@/lib/format";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "pacientes")) return NextResponse.json([], { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);
  const digits = onlyDigits(q);
  const list = await prisma.patient.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        ...(digits.length >= 3 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : []),
        { email: { contains: q.toLowerCase() } },
      ],
    },
    take: 8,
    orderBy: { name: "asc" },
    select: { id: true, name: true, cpf: true, phone: true },
  });
  return NextResponse.json(list);
}
