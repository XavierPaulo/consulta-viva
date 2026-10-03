import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getAvailableSlots } from "@/lib/slots";
import { fmtTime } from "@/lib/format";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user, "agenda")) return NextResponse.json([], { status: 401 });
  const p = req.nextUrl.searchParams.get("p") ?? "";
  const d = req.nextUrl.searchParams.get("d") ?? "";
  const ignore = req.nextUrl.searchParams.get("ignorar") ?? undefined;
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json([]);
  const slots = await getAvailableSlots({ professionalIds: [p], fromDay: d, days: 1, ignoreAppointmentId: ignore });
  return NextResponse.json(slots.map((s) => ({ iso: s.start.toISOString(), time: fmtTime(s.start) })));
}
