import { prisma } from "./db";
import { SHIFTS, type Shift } from "./constants";
import { addDays, hm, localToDate, weekdayOf } from "./format";

export type Slot = { professionalId: string; start: Date; end: Date; unitId: string | null };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + (m ?? 0);
};
const toHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Horários livres calculados em tempo real: grade de disponibilidade do profissional
 * menos as consultas já marcadas (não canceladas), respeitando a antecedência mínima.
 */
export async function getAvailableSlots(opts: {
  professionalIds: string[];
  fromDay: string;
  days: number;
  unitId?: string;
  shift?: Shift;
  minLeadHours?: number;
  ignoreAppointmentId?: string;
}) {
  const { professionalIds, fromDay, days } = opts;
  if (!professionalIds.length) return [];
  const pros = await prisma.professional.findMany({
    where: { id: { in: professionalIds } },
    select: { id: true, durationMin: true, unitId: true, availability: true },
  });
  const rangeStart = localToDate(fromDay);
  const rangeEnd = localToDate(addDays(fromDay, days));
  const busy = await prisma.appointment.findMany({
    where: {
      professionalId: { in: professionalIds },
      status: { not: "CANCELADA" },
      start: { lt: rangeEnd },
      end: { gt: rangeStart },
      ...(opts.ignoreAppointmentId ? { id: { not: opts.ignoreAppointmentId } } : {}),
    },
    select: { professionalId: true, start: true, end: true },
  });
  const earliest = Date.now() + (opts.minLeadHours ?? 0) * 3600_000;
  const slots: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDay, i);
    const wd = weekdayOf(day);
    for (const p of pros) {
      for (const block of p.availability.filter((a) => a.weekday === wd)) {
        const unitId = block.unitId ?? p.unitId;
        if (opts.unitId && unitId !== opts.unitId) continue;
        for (let m = toMin(block.startTime); m + p.durationMin <= toMin(block.endTime); m += p.durationMin) {
          const start = localToDate(day, toHm(m));
          const end = new Date(start.getTime() + p.durationMin * 60_000);
          if (start.getTime() < earliest) continue;
          if (opts.shift) {
            const h = Math.floor(m / 60);
            const s = SHIFTS[opts.shift];
            if (h < s.from || h >= s.to) continue;
          }
          const clash = busy.some(
            (b) => b.professionalId === p.id && b.start < end && b.end > start,
          );
          if (!clash) slots.push({ professionalId: p.id, start, end, unitId });
        }
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Confere se um horário específico continua livre (evita dupla marcação). */
export async function isSlotFree(professionalId: string, start: Date, end: Date, ignoreAppointmentId?: string) {
  const clash = await prisma.appointment.findFirst({
    where: {
      professionalId,
      status: { not: "CANCELADA" },
      start: { lt: end },
      end: { gt: start },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    },
    select: { id: true },
  });
  return !clash;
}

export function slotKey(s: { professionalId: string; start: Date }) {
  return `${s.professionalId}|${s.start.toISOString()}`;
}

export { hm };
