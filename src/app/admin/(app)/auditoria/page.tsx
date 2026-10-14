import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, fmtDateTime, localToDate, todayYmd } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Log de auditoria" };

const ACTION_LABEL: Record<string, [string, string]> = {
  VIEW: ["Visualizou", "gray"],
  CREATE: ["Criou", "green"],
  UPDATE: ["Editou", "blue"],
  DELETE: ["Excluiu", "red"],
  LOGIN: ["Entrou", "teal"],
  LOGOUT: ["Saiu", "gray"],
  LOGIN_FAIL: ["Falha de login", "amber"],
  LOCKED: ["Bloqueado", "red"],
  EXPORT: ["Exportou", "violet"],
  PRINT: ["Imprimiu", "gray"],
  NOTIFY: ["Notificou", "gray"],
  RESET_REQUEST: ["Pediu nova senha", "amber"],
  RESET_PASSWORD: ["Trocou a senha", "amber"],
};

export default async function Auditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  const sp = await searchParams;
  await requireUser("auditoria");
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const from = get("de") || addDays(todayYmd(), -7);
  const to = get("ate") || todayYmd();
  const page = Math.max(1, Number(get("pag")) || 1);
  const where = {
    createdAt: { gte: localToDate(from), lt: localToDate(addDays(to, 1)) },
    ...(get("usuario") ? { userId: get("usuario") } : {}),
    ...(get("acao") ? { action: get("acao") } : {}),
    ...(get("entidade") ? { entity: get("entidade") } : {}),
  };
  const [logs, total, users, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50 }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
  ]);
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>, pag: String(p) }).toString();

  return (
    <>
      <PageHeader title="Log de auditoria" description="Quem acessou o quê, quando, e se editou. Registros não podem ser alterados." />
      <form className="card mb-5 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="label" htmlFor="de">
            De
          </label>
          <input id="de" name="de" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">
            Até
          </label>
          <input id="ate" name="ate" type="date" defaultValue={to} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="usuario">
            Usuário
          </label>
          <select id="usuario" name="usuario" defaultValue={get("usuario")} className="input">
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="acao">
            Ação
          </label>
          <select id="acao" name="acao" defaultValue={get("acao")} className="input">
            <option value="">Todas</option>
            {Object.entries(ACTION_LABEL).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="entidade">
            Item
          </label>
          <select id="entidade" name="entidade" defaultValue={get("entidade")} className="input">
            <option value="">Todos</option>
            {entities.map((e) => (
              <option key={e.entity}>{e.entity}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-secondary w-full">Filtrar</button>
        </div>
      </form>
      <div className="card overflow-x-auto">
        <table className="table text-sm">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Item</th>
              <th>Detalhes</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const [label, tone] = ACTION_LABEL[l.action] ?? [l.action, "gray"];
              return (
                <tr key={l.id}>
                  <td className="whitespace-nowrap tabular-nums">{fmtDateTime(l.createdAt)}</td>
                  <td className="whitespace-nowrap">{l.userName || "—"}</td>
                  <td>
                    <Badge tone={tone}>{label}</Badge>
                  </td>
                  <td className="whitespace-nowrap">{l.entity}</td>
                  <td className="max-w-md text-muted">{l.details}</td>
                  <td className="text-muted">{l.ip || "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Nenhum registro no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{total} registros</span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link className="btn-secondary btn-sm" href={`/admin/auditoria?${qs(page - 1)}`}>
              ← Anteriores
            </Link>
          )}
          {page * 50 < total && (
            <Link className="btn-secondary btn-sm" href={`/admin/auditoria?${qs(page + 1)}`}>
              Próximos →
            </Link>
          )}
        </span>
      </div>
    </>
  );
}
