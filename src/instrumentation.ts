// Roda uma vez quando o servidor Next.js sobe. Agenda o envio automático de lembretes a cada
// REMINDERS_INTERVAL_MINUTES (padrão 5). Em hospedagem serverless (ex.: Vercel), use REMINDERS_INTERVAL_MINUTES=0
// e chame /api/cron/lembretes por um cron externo.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const minutes = Number(process.env.REMINDERS_INTERVAL_MINUTES ?? 5);
  if (!minutes) return;
  const g = globalThis as unknown as { __cvReminders?: ReturnType<typeof setInterval> };
  if (g.__cvReminders) clearInterval(g.__cvReminders);
  const { runReminders } = await import("./lib/reminders");
  const tick = () =>
    runReminders()
      .then((r) => {
        if (r.sent24 || r.sent2) console.log(`[lembretes] enviados: ${r.sent24} de 24 h, ${r.sent2} de 2 h`);
      })
      .catch((e) => console.error("[lembretes] falha", e));
  g.__cvReminders = setInterval(tick, minutes * 60_000);
  setTimeout(tick, 15_000);
}
