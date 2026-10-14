import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, ACTIONS, MODULES, ROLE_PERMISSIONS, type Module, type Action } from "@/lib/permissions";
import { ROLES, type Role } from "@/lib/constants";
import { fmtDateTime, parseJson } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/client";
import { Avatar, Badge, Field, PageHeader } from "@/components/ui";
import { saveUser } from "./actions";

export const metadata = { title: "Usuários e acessos" };

export default async function Usuarios() {
  const me = await requireUser("usuarios");
  const [users, pros] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, include: { professional: true } }),
    prisma.professional.findMany({ orderBy: { name: "asc" } }),
  ]);
  const editable = can(me, "usuarios", "edit");

  const form = (u?: (typeof users)[number]) => {
    const extra = parseJson<Partial<Record<Module, Action[]>>>(u?.permissionOverrides, {});
    const key = u?.id ?? "new";
    return (
      <ActionForm action={saveUser.bind(null, u?.id ?? null)} className="space-y-4" resetOnSuccess={!u}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" htmlFor={`un-${key}`} required>
            <input id={`un-${key}`} name="name" defaultValue={u?.name} className="input" required />
          </Field>
          <Field label="E-mail (login)" htmlFor={`ue-${key}`} required>
            <input id={`ue-${key}`} name="email" type="email" defaultValue={u?.email} className="input" required autoComplete="off" />
          </Field>
          <Field label="Perfil de acesso" htmlFor={`ur-${key}`} required>
            <select id={`ur-${key}`} name="role" defaultValue={u?.role ?? "SECRETARIA"} className="input">
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Profissional vinculado (perfil Médico)" htmlFor={`up-${key}`}>
            <select id={`up-${key}`} name="professionalId" defaultValue={u?.professionalId ?? ""} className="input">
              <option value="">—</option>
              {pros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={u ? "Nova senha (deixe vazio para manter)" : "Senha inicial"} htmlFor={`uw-${key}`} required={!u}>
            <input id={`uw-${key}`} name="password" type="password" autoComplete="new-password" className="input" minLength={8} />
          </Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={u?.active ?? true} className="size-4 accent-[var(--brand)]" /> Acesso ativo
            </label>
            {u?.lockedUntil && u.lockedUntil > new Date() && (
              <label className="flex items-center gap-2 text-amber-800">
                <input type="checkbox" name="unlock" defaultChecked className="size-4 accent-[var(--brand)]" /> Desbloquear (bloqueado por tentativas)
              </label>
            )}
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-brand-700">Permissões extras (além das do perfil)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Módulo</th>
                  {Object.values(ACTIONS).map((a) => (
                    <th key={a} className="text-center">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODULES).map(([m, label]) => (
                  <tr key={m}>
                    <td>{label}</td>
                    {Object.keys(ACTIONS).map((a) => {
                      const base = u ? ROLE_PERMISSIONS[u.role as Role]?.[m as Module]?.includes(a as Action) : false;
                      return (
                        <td key={a} className="text-center">
                          <input
                            type="checkbox"
                            name={`perm_${m}_${a}`}
                            aria-label={`${label}: ${ACTIONS[a as Action]}`}
                            defaultChecked={base || extra[m as Module]?.includes(a as Action)}
                            disabled={base}
                            className="size-4 accent-[var(--brand)]"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Itens marcados e desabilitados já vêm do perfil.</p>
          </div>
        </details>
        {editable && <SubmitButton className="btn-primary btn-sm">{u ? "Salvar" : "Criar usuário"}</SubmitButton>}
      </ActionForm>
    );
  };

  return (
    <>
      <PageHeader title="Usuários e acessos" description="Perfis: Administrador, Médico, Secretária/Recepção e Somente leitura, com permissões por módulo e ação." />
      <div className="max-w-4xl space-y-4">
        {can(me, "usuarios", "create") && (
          <details className="card p-5">
            <summary className="cursor-pointer font-semibold">+ Novo usuário</summary>
            <div className="mt-4">{form()}</div>
          </details>
        )}
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <details className="card p-4">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                  <Avatar name={u.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-sm text-muted">
                      {u.email} · último acesso {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "nunca"}
                    </span>
                  </span>
                  <Badge tone="teal">{ROLES[u.role as Role]}</Badge>
                  {!u.active && <Badge tone="gray">Inativo</Badge>}
                  {u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="amber">Bloqueado</Badge>}
                </summary>
                <div className="mt-4">{form(u)}</div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
