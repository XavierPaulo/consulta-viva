import type { Role } from "./constants";

export const MODULES = {
  dashboard: "Painel",
  agenda: "Agenda",
  pacientes: "Pacientes",
  prontuario: "Prontuário",
  profissionais: "Profissionais",
  financeiro: "Financeiro",
  mensagens: "Comunicação",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  usuarios: "Usuários e acessos",
  auditoria: "Log de auditoria",
} as const;
export type Module = keyof typeof MODULES;

export const ACTIONS = { view: "Ver", create: "Criar", edit: "Editar", delete: "Excluir/Cancelar" } as const;
export type Action = keyof typeof ACTIONS;

const ALL: Action[] = ["view", "create", "edit", "delete"];
const VIEW: Action[] = ["view"];

/** Permissões padrão por perfil. Ajustes por usuário ficam em User.permissionOverrides. */
export const ROLE_PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: Object.fromEntries(Object.keys(MODULES).map((m) => [m, ALL])) as Record<Module, Action[]>,
  MEDICO: {
    dashboard: VIEW,
    agenda: ["view", "create", "edit"],
    pacientes: ["view", "create", "edit"],
    prontuario: ["view", "create", "edit"],
    profissionais: VIEW,
    financeiro: VIEW,
    mensagens: ["view", "edit"],
    relatorios: VIEW,
  },
  SECRETARIA: {
    dashboard: VIEW,
    agenda: ALL,
    pacientes: ["view", "create", "edit"],
    profissionais: VIEW,
    financeiro: ["view", "create", "edit"],
    mensagens: ["view", "create", "edit"],
    relatorios: VIEW,
  },
  LEITURA: {
    dashboard: VIEW,
    agenda: VIEW,
    pacientes: VIEW,
    profissionais: VIEW,
    financeiro: VIEW,
    relatorios: VIEW,
  },
};

export function can(
  user: { role: string; permissionOverrides?: string | null },
  module: Module,
  action: Action = "view",
) {
  const base = ROLE_PERMISSIONS[user.role as Role]?.[module] ?? [];
  if (base.includes(action)) return true;
  try {
    const extra = JSON.parse(user.permissionOverrides || "{}") as Partial<Record<Module, Action[]>>;
    return extra[module]?.includes(action) ?? false;
  } catch {
    return false;
  }
}
