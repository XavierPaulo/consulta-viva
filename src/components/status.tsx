import { APPOINTMENT_STATUS, MESSAGE_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { Badge } from "./ui";

export function ApptStatus({ status }: { status: string }) {
  const s = APPOINTMENT_STATUS[status as keyof typeof APPOINTMENT_STATUS] ?? { label: status, tone: "gray" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function PayStatus({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS] ?? { label: status, tone: "gray" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
export function MsgStatus({ status }: { status: string }) {
  const s = MESSAGE_STATUS[status as keyof typeof MESSAGE_STATUS] ?? { label: status, tone: "gray" };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
