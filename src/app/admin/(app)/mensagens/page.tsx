import Link from "next/link";
import { Archive, Mail, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { audit, ownProfessionalScope, requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { fmtDateTime, formatPhone } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { EmptyState, PageHeader } from "@/components/ui";
import { MsgStatus } from "@/components/status";
import { replyMessage, setMessageStatus } from "./actions";

export const metadata = { title: "Comunicação" };

export default async function Mensagens({ searchParams }: PageProps<"/admin/mensagens">) {
  const sp = await searchParams;
  const user = await requireUser("mensagens");
  const scope = ownProfessionalScope(user);
  const tab = sp.aba === "enviadas" ? "enviadas" : "caixa";
  const filtro = typeof sp.f === "string" ? sp.f : "abertas";
  const msgs =
    tab === "caixa"
      ? await prisma.message.findMany({
          where: {
            ...(scope ? { OR: [{ professionalId: scope }, { professionalId: null }] } : {}),
            ...(filtro === "abertas" ? { status: { in: ["NOVA", "LIDA"] } } : filtro === "todas" ? {} : { status: filtro }),
          },
          orderBy: { createdAt: "desc" },
          include: { professional: true },
          take: 100,
        })
      : [];
  const sel = typeof sp.m === "string" ? msgs.find((m) => m.id === sp.m) : msgs[0];
  if (sel && sel.status === "NOVA" && can(user, "mensagens", "edit")) {
    await prisma.message.update({ where: { id: sel.id }, data: { status: "LIDA" } });
    await audit(user, "VIEW", "Mensagem", sel.id);
  }
  const sent = tab === "enviadas" ? await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }) : [];

  return (
    <>
      <PageHeader title="Comunicação" description="Mensagens do site e histórico de envios por e-mail, SMS e WhatsApp." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        <Link href="/admin/mensagens" role="tab" aria-selected={tab === "caixa"} data-active={tab === "caixa"} className="chip">
          Caixa de entrada
        </Link>
        <Link href="/admin/mensagens?aba=enviadas" role="tab" aria-selected={tab === "enviadas"} data-active={tab === "enviadas"} className="chip">
          Envios (lembretes e confirmações)
        </Link>
      </div>

      {tab === "enviadas" ? (
        sent.length === 0 ? (
          <EmptyState title="Nada enviado ainda" />
        ) : (
          <div className="card overflow-x-auto">
            <p className="border-b border-line px-4 py-3 text-sm text-muted">No MVP os envios são simulados e ficam registrados aqui. A integração com WhatsApp Business/SMS/e-mail entra na fase 2.</p>
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Canal</th>
                  <th>Para</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((n) => (
                  <tr key={n.id}>
                    <td className="whitespace-nowrap text-sm">{fmtDateTime(n.createdAt)}</td>
                    <td className="text-sm">{n.channel === "WHATSAPP" ? "WhatsApp" : n.channel === "EMAIL" ? "E-mail" : "SMS"}</td>
                    <td className="text-sm whitespace-nowrap">{n.channel === "EMAIL" ? n.to : formatPhone(n.to)}</td>
                    <td className="max-w-xl text-sm text-muted">{n.subject && <strong className="text-foreground">{n.subject}: </strong>}{n.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div>
            <form className="mb-3">
              <label htmlFor="f" className="sr-only">
                Filtrar
              </label>
              <select id="f" name="f" defaultValue={filtro} className="input">
                <option value="abertas">Abertas (novas e lidas)</option>
                <option value="RESPONDIDA">Respondidas</option>
                <option value="ARQUIVADA">Arquivadas</option>
                <option value="todas">Todas</option>
              </select>
              <button className="btn-secondary btn-sm mt-2">Aplicar filtro</button>
            </form>
            {msgs.length === 0 ? (
              <EmptyState title="Caixa vazia">Nenhuma mensagem neste filtro.</EmptyState>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {msgs.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/mensagens?f=${filtro}&m=${m.id}`}
                      aria-current={sel?.id === m.id ? "true" : undefined}
                      className={`block px-4 py-3 hover:bg-slate-50 ${sel?.id === m.id ? "bg-brand-50" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate ${m.status === "NOVA" ? "font-semibold" : "font-medium"}`}>{m.name}</span>
                        <MsgStatus status={m.id === sel?.id && m.status === "NOVA" ? "LIDA" : m.status} />
                      </span>
                      <span className="block truncate text-sm text-muted">{m.body}</span>
                      <span className="block text-xs text-muted">
                        {fmtDateTime(m.createdAt)} · {m.professional ? `${m.professional.title} ${m.professional.name.split(" ")[0]}` : "Equipe"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {sel && (
            <section className="card p-5 sm:p-6" aria-label="Mensagem selecionada">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{sel.name}</h2>
                  <p className="text-sm text-muted">
                    {fmtDateTime(sel.createdAt)} · para {sel.professional ? `${sel.professional.title} ${sel.professional.name}` : "equipe"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm">
                    {sel.preferredChannel === "WHATSAPP" ? <MessageCircle className="size-4 text-emerald-600" aria-hidden /> : <Mail className="size-4 text-sky-600" aria-hidden />}
                    Responder por {sel.preferredChannel === "WHATSAPP" ? `WhatsApp ${formatPhone(sel.whatsapp)}` : `e-mail ${sel.email}`}
                  </p>
                </div>
                {can(user, "mensagens", "edit") && sel.status !== "ARQUIVADA" && (
                  <form action={setMessageStatus.bind(null, sel.id, "ARQUIVADA")}>
                    <SubmitButton className="btn-ghost btn-sm" pendingText="…">
                      <Archive className="size-4" aria-hidden /> Arquivar
                    </SubmitButton>
                  </form>
                )}
              </div>
              <p className="mt-5 rounded-xl bg-slate-50 p-4 whitespace-pre-line">{sel.body}</p>
              {sel.reply && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
                  <p className="text-sm font-semibold text-brand-800">Resposta enviada {sel.repliedAt && `em ${fmtDateTime(sel.repliedAt)}`}</p>
                  <p className="mt-1 whitespace-pre-line">{sel.reply}</p>
                </div>
              )}
              {can(user, "mensagens", "edit") && (
                <ActionForm action={replyMessage.bind(null, sel.id)} className="mt-5 space-y-3" resetOnSuccess>
                  <label htmlFor="reply" className="label">
                    {sel.reply ? "Enviar nova resposta" : "Sua resposta"}
                  </label>
                  <textarea id="reply" name="reply" rows={4} className="input" required />
                  <SubmitButton pendingText="Enviando…">Enviar resposta</SubmitButton>
                </ActionForm>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}
