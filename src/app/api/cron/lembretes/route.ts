import { runReminders } from "@/lib/reminders";

// Para cron externo (Vercel Cron, GitHub Actions, cron do servidor):
//   GET /api/cron/lembretes  com o cabeçalho  Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  return Response.json(await runReminders());
}
